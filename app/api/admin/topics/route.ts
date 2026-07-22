import {
  attachFile,
  createTopicVectorStore,
  deleteKnowledgeFile,
  detachFile,
  uploadKnowledgeFile,
} from "../../../../lib/openai";
import { requireSupabaseAdmin, supabaseAdmin } from "../../../../lib/supabase";

async function fetchAllAttempts(sb: ReturnType<typeof supabaseAdmin>) {
  const pageSize = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("test_attempts")
      .select("id,test_id,user_id,status,score,started_at,completed_at")
      .order("started_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

export async function GET(request: Request) {
  try {
    await requireSupabaseAdmin(request);
    const sb = supabaseAdmin();
    const [
      { data, error },
      { data: assignments, error: assignmentError },
      { data: users, error: userError },
      { data: attempts, error: attemptError },
      { data: documents, error: documentError },
    ] = await Promise.all([
      sb
        .from("tests")
        .select("*,test_documents(count),test_assignments(count)")
        .order("created_at", { ascending: false }),
      sb
        .from("test_assignments")
        .select("id,test_id,user_id,assigned_at")
        .order("assigned_at", { ascending: false }),
      sb
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("role", "student")
        .order("full_name"),
      fetchAllAttempts(sb),
      sb
        .from("test_documents")
        .select("id,test_id,file_name,status,created_at,error_message")
        .order("created_at", { ascending: false }),
    ]);
    if (error) throw error;
    if (assignmentError) throw assignmentError;
    if (userError) throw userError;
    if (attemptError) throw attemptError;
    if (documentError) throw documentError;
    const userMap = new Map((users || []).map((u) => [u.id, u]));
    return Response.json({
      topics: (data || []).map((t) => ({
        ...t,
        title: t.name,
        document_count: t.test_documents?.[0]?.count || 0,
        assignment_count: t.test_assignments?.[0]?.count || 0,
        assignments: (assignments || [])
          .filter((a) => a.test_id === t.id)
          .map((a) => ({ ...a, user: userMap.get(a.user_id) })),
        attempts: (attempts || [])
          .filter((a) => a.test_id === t.id)
          .map((a) => ({ ...a, user: userMap.get(a.user_id) })),
        documents: (documents || []).filter(
          (document) => document.test_id === t.id,
        ),
      })),
      users,
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireSupabaseAdmin(request);
    const sb = supabaseAdmin();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const testId = String(form.get("topicId") || "");
      const file = form.get("file");
      if (!testId || !(file instanceof File))
        return Response.json(
          { error: "Test and document are required." },
          { status: 400 },
        );
      const { data: test, error: testError } = await sb
        .from("tests")
        .select("id,name,openai_vector_store_id")
        .eq("id", testId)
        .single();
      if (testError || !test)
        return Response.json({ error: "Test not found." }, { status: 404 });
      const id = crypto.randomUUID();
      const path = `${testId}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const bytes = await file.arrayBuffer();
      const { error: storageError } = await sb.storage
        .from("test-documents")
        .upload(path, bytes, { contentType: file.type, upsert: false });
      if (storageError)
        throw new Error(
          `Supabase Storage upload failed: ${storageError.message}`,
        );
      const { error: recordError } = await sb.from("test_documents").insert({
        id,
        test_id: testId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        openai_file_id: null,
        status: "processing",
        error_message: null,
        uploaded_by: user.id,
      });
      if (recordError) {
        await sb.storage.from("test-documents").remove([path]);
        throw new Error(
          `Document database record failed: ${recordError.message}`,
        );
      }
      let vectorId = test.openai_vector_store_id as string | null;
      let openaiFileId: string | null = null;
      let status = "pending",
        errorMessage: string | null = null;
      try {
        if (!vectorId) {
          vectorId = await createTopicVectorStore(testId, test.name);
          await sb
            .from("tests")
            .update({
              openai_vector_store_id: vectorId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", testId);
        }
        openaiFileId = await uploadKnowledgeFile(file);
        await attachFile(vectorId, openaiFileId);
        status = "ready";
      } catch (error) {
        status = "failed";
        errorMessage =
          error instanceof Error ? error.message : "OpenAI indexing pending";
      }
      const { error } = await sb
        .from("test_documents")
        .update({
          openai_file_id: openaiFileId,
          status,
          error_message: errorMessage,
        })
        .eq("id", id);
      if (error)
        throw new Error(`Document status update failed: ${error.message}`);
      return Response.json({ ok: true, status, error: errorMessage });
    }
    const body = (await request.json()) as {
      action?: string;
      title?: string;
      subject?: string;
      description?: string;
      difficulty?: string;
      topicId?: string;
      email?: string;
      userId?: string;
      questionCount?: number;
      timeLimitMinutes?: number;
      attemptsAllowed?: number;
      availableFrom?: string;
      dueAt?: string;
      passMark?: number;
      feedbackTiming?: string;
      hintsAllowed?: boolean;
      skippingAllowed?: boolean;
      answerMode?: string;
      instructions?: string;
      groundingMode?: string;
      documentId?: string;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
    };
    if (body.action === "create_document_upload") {
      if (!body.topicId || !body.fileName)
        return Response.json(
          { error: "Viva and filename are required." },
          { status: 400 },
        );
      const id = crypto.randomUUID();
      const path = `${body.topicId}/${id}-${body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: recordError } = await sb.from("test_documents").insert({
        id,
        test_id: body.topicId,
        file_name: body.fileName,
        storage_path: path,
        mime_type: body.mimeType || "application/octet-stream",
        size_bytes: body.sizeBytes || 0,
        status: "processing",
        uploaded_by: user.id,
      });
      if (recordError)
        throw new Error(
          `Document database record failed: ${recordError.message}`,
        );
      const { data: signed, error: signedError } = await sb.storage
        .from("test-documents")
        .createSignedUploadUrl(path);
      if (signedError || !signed?.signedUrl) {
        await sb.from("test_documents").delete().eq("id", id);
        throw new Error(
          `Could not prepare upload: ${signedError?.message || "No signed URL returned"}`,
        );
      }
      return Response.json({ documentId: id, signedUrl: signed.signedUrl });
    }
    if (body.action === "finalize_document_upload") {
      if (!body.documentId)
        return Response.json(
          { error: "Document is required." },
          { status: 400 },
        );
      const { data: document, error: documentError } = await sb
        .from("test_documents")
        .select("id,test_id,file_name,storage_path,mime_type")
        .eq("id", body.documentId)
        .single();
      if (documentError || !document)
        return Response.json(
          { error: "Document record not found." },
          { status: 404 },
        );
      const { data: test, error: testError } = await sb
        .from("tests")
        .select("id,name,openai_vector_store_id")
        .eq("id", document.test_id)
        .single();
      if (testError || !test)
        throw new Error(testError?.message || "Viva not found.");
      try {
        const { data: blob, error: downloadError } = await sb.storage
          .from("test-documents")
          .download(document.storage_path);
        if (downloadError || !blob)
          throw new Error(
            downloadError?.message || "Uploaded file could not be read.",
          );
        let vectorId = test.openai_vector_store_id as string | null;
        if (!vectorId) {
          vectorId = await createTopicVectorStore(test.id, test.name);
          await sb
            .from("tests")
            .update({ openai_vector_store_id: vectorId })
            .eq("id", test.id);
        }
        const openaiFileId = await uploadKnowledgeFile(
          new File([blob], document.file_name, { type: document.mime_type }),
        );
        await attachFile(vectorId, openaiFileId);
        const { error: updateError } = await sb
          .from("test_documents")
          .update({
            status: "ready",
            error_message: null,
            openai_file_id: openaiFileId,
          })
          .eq("id", document.id);
        if (updateError) throw new Error(updateError.message);
        return Response.json({ ok: true, status: "ready" });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Indexing failed.";
        await sb
          .from("test_documents")
          .update({ status: "failed", error_message: message })
          .eq("id", document.id);
        return Response.json(
          { error: message, status: "failed" },
          { status: 502 },
        );
      }
    }
    if (body.action === "create") {
      const { data, error } = await sb
        .from("tests")
        .insert({
          name: body.title?.trim(),
          subject: body.subject?.trim(),
          description: body.description?.trim() || "",
          difficulty: body.difficulty || "Standard",
          created_by: user.id,
          question_count: body.questionCount || 10,
          time_limit_minutes: body.timeLimitMinutes || 20,
          attempts_allowed: body.attemptsAllowed || 1,
          available_from: body.availableFrom || null,
          due_at: body.dueAt || null,
          pass_mark: body.passMark ?? 60,
          feedback_timing: body.feedbackTiming || "after_each",
          hints_allowed: body.hintsAllowed ?? true,
          skipping_allowed: body.skippingAllowed ?? false,
          answer_mode: body.answerMode || "both",
          instructions: body.instructions?.trim() || "",
          grounding_mode: body.groundingMode || "documents_only",
        })
        .select("id")
        .single();
      if (error) throw error;
      return Response.json({ id: data.id });
    }
    if (body.action === "assign") {
      let studentId = body.userId;
      const email = body.email?.trim().toLowerCase();
      if (!studentId && email) {
        const { data: student } = await sb
          .from("profiles")
          .select("id")
          .eq("email", email)
          .eq("role", "student")
          .single();
        studentId = student?.id;
      }
      if (!studentId)
        return Response.json(
          { error: "Choose a registered student." },
          { status: 400 },
        );
      const { data: student } = await sb
        .from("profiles")
        .select("id")
        .eq("id", studentId)
        .eq("role", "student")
        .single();
      if (!student)
        return Response.json(
          { error: "The selected student was not found." },
          { status: 404 },
        );
      const { error } = await sb
        .from("test_assignments")
        .upsert(
          { test_id: body.topicId, user_id: student.id, assigned_by: user.id },
          { onConflict: "test_id,user_id" },
        );
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (body.action === "update_instructions") {
      if (!body.topicId)
        return Response.json({ error: "Choose a test." }, { status: 400 });
      const { error } = await sb
        .from("tests")
        .update({
          instructions: body.instructions?.trim() || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.topicId);
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (body.action === "update_module") {
      if (!body.topicId)
        return Response.json({ error: "Choose a module." }, { status: 400 });
      const { error } = await sb
        .from("tests")
        .update({
          name: body.title?.trim(),
          subject: body.subject?.trim(),
          description: body.description?.trim() || "",
          difficulty: body.difficulty || "Standard",
          question_count: body.questionCount || 10,
          time_limit_minutes: body.timeLimitMinutes || 20,
          attempts_allowed: body.attemptsAllowed || 1,
          pass_mark: body.passMark ?? 60,
          instructions: body.instructions?.trim() || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.topicId);
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (body.action === "unassign") {
      if (!body.topicId || !body.userId)
        return Response.json(
          { error: "Module and student are required." },
          { status: 400 },
        );
      const { error } = await sb
        .from("test_assignments")
        .delete()
        .eq("test_id", body.topicId)
        .eq("user_id", body.userId);
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (body.action === "retry_document") {
      if (!body.documentId)
        return Response.json({ error: "Choose a document." }, { status: 400 });
      const { data: document, error: documentError } = await sb
        .from("test_documents")
        .select("id,test_id,file_name,storage_path,mime_type,openai_file_id")
        .eq("id", body.documentId)
        .single();
      if (documentError || !document)
        return Response.json({ error: "Document not found." }, { status: 404 });
      const { data: test, error: testError } = await sb
        .from("tests")
        .select("id,name,openai_vector_store_id")
        .eq("id", document.test_id)
        .single();
      if (testError || !test) throw testError || new Error("Test not found.");
      await sb
        .from("test_documents")
        .update({ status: "processing", error_message: null })
        .eq("id", document.id);
      try {
        let vectorId = test.openai_vector_store_id as string | null;
        if (!vectorId) {
          vectorId = await createTopicVectorStore(test.id, test.name);
          await sb
            .from("tests")
            .update({ openai_vector_store_id: vectorId })
            .eq("id", test.id);
        }
        let openaiFileId = document.openai_file_id as string | null;
        if (!openaiFileId) {
          const { data: blob, error: downloadError } = await sb.storage
            .from("test-documents")
            .download(document.storage_path);
          if (downloadError || !blob)
            throw (
              downloadError || new Error("Stored document could not be read.")
            );
          openaiFileId = await uploadKnowledgeFile(
            new File([blob], document.file_name, { type: document.mime_type }),
          );
        }
        await attachFile(vectorId, openaiFileId);
        await sb
          .from("test_documents")
          .update({
            status: "ready",
            error_message: null,
            openai_file_id: openaiFileId,
          })
          .eq("id", document.id);
        return Response.json({ ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Indexing failed.";
        await sb
          .from("test_documents")
          .update({ status: "failed", error_message: message })
          .eq("id", document.id);
        return Response.json({ error: message }, { status: 502 });
      }
    }
    if (body.action === "delete_document") {
      if (!body.documentId)
        return Response.json({ error: "Choose a document." }, { status: 400 });
      const { data: document, error: documentError } = await sb
        .from("test_documents")
        .select("id,test_id,storage_path,openai_file_id")
        .eq("id", body.documentId)
        .single();
      if (documentError || !document)
        return Response.json({ error: "Document not found." }, { status: 404 });
      const { data: test } = await sb
        .from("tests")
        .select("openai_vector_store_id")
        .eq("id", document.test_id)
        .single();
      if (document.openai_file_id) {
        if (test?.openai_vector_store_id)
          await detachFile(
            test.openai_vector_store_id,
            document.openai_file_id,
          ).catch(() => undefined);
        await deleteKnowledgeFile(document.openai_file_id).catch(
          () => undefined,
        );
      }
      const { error: storageError } = await sb.storage
        .from("test-documents")
        .remove([document.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await sb
        .from("test_documents")
        .delete()
        .eq("id", document.id);
      if (deleteError) throw deleteError;
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
function fail(error: unknown) {
  if (error instanceof Response) return error;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : typeof error === "string"
          ? error
          : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}
