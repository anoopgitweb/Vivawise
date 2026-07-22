import { createVivaResponse } from "../../../lib/openai";
import { requireVivaUser } from "../../../lib/identity";
import { supabaseAdmin } from "../../../lib/supabase";
import { getVivaEnv } from "../../../lib/runtime";

const demoQuestions = [
  "Explain the central concept of this test in your own words.",
  "Describe one practical example related to this topic.",
  "Compare two important ideas from this subject.",
  "What common misunderstanding should a student avoid?",
  "Summarise this topic as if explaining it to a beginner.",
];
function demoFeedback(answer: string, nextIndex: number, max: number) {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const score = Math.min(10, Math.max(2, Math.round((words / 8) * 10) / 10));
  return {
    score,
    maxScore: 10,
    verdict: score >= 6 ? "Good developing answer" : "Needs more detail",
    summary:
      score >= 6
        ? "Your answer communicates the main idea clearly."
        : "Add a definition, reasoning and an example.",
    correctPoints:
      words >= 8
        ? ["The response contains a developed explanation."]
        : ["You attempted the question directly."],
    missingPoints:
      words >= 20 ? [] : ["Add more supporting detail and a concrete example."],
    incorrectClaims: [],
    conceptScore: Math.round(score * 10),
    clarityScore: Math.min(100, 50 + words * 2),
    completenessScore: Math.min(100, words * 4),
    modelAnswer: "Demo mode does not provide a document-grounded model answer.",
    nextQuestion: demoQuestions[nextIndex % demoQuestions.length],
    nextHint: "Structure your answer as definition, explanation and example.",
    nextTopic: "Demo practice",
    sourceBasis: "Demo mode — not evaluated against uploaded documents",
    completed: nextIndex >= max,
    demo: true,
  };
}

const questionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string" },
    hint: { type: "string" },
    topic: { type: "string" },
    sourceBasis: { type: "string" },
  },
  required: ["question", "hint", "topic", "sourceBasis"],
};

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "number" },
    maxScore: { type: "number" },
    verdict: { type: "string" },
    summary: { type: "string" },
    correctPoints: { type: "array", items: { type: "string" } },
    missingPoints: { type: "array", items: { type: "string" } },
    incorrectClaims: { type: "array", items: { type: "string" } },
    conceptScore: { type: "number" },
    clarityScore: { type: "number" },
    completenessScore: { type: "number" },
    modelAnswer: { type: "string" },
    nextQuestion: { type: "string" },
    nextHint: { type: "string" },
    nextTopic: { type: "string" },
    sourceBasis: { type: "string" },
  },
  required: [
    "score",
    "maxScore",
    "verdict",
    "summary",
    "correctPoints",
    "missingPoints",
    "incorrectClaims",
    "conceptScore",
    "clarityScore",
    "completenessScore",
    "modelAnswer",
    "nextQuestion",
    "nextHint",
    "nextTopic",
    "sourceBasis",
  ],
};

export async function POST(request: Request) {
  try {
    const user = await requireVivaUser(request);
    const body = (await request.json()) as {
      action?: string;
      topicId?: string;
      sessionId?: string;
      question?: string;
      answer?: string;
      questionNumber?: number;
    };
    const sb = supabaseAdmin();

    if (body.action === "start") {
      if (!body.topicId)
        return Response.json(
          { error: "Choose an assigned mock viva." },
          { status: 400 },
        );
      const { data: assignment } = await sb
        .from("test_assignments")
        .select("tests(*)")
        .eq("test_id", body.topicId)
        .eq("user_id", user.userId)
        .single();
      const topic = (assignment as any)?.tests as any;
      if (!topic)
        return Response.json(
          { error: "This mock viva is not assigned to you." },
          { status: 403 },
        );
      const now = Date.now();
      if (
        topic.available_from &&
        now < new Date(topic.available_from).getTime()
      )
        return Response.json(
          { error: "This viva is not open yet." },
          { status: 403 },
        );
      if (topic.due_at && now > new Date(topic.due_at).getTime())
        return Response.json(
          { error: "The deadline for this viva has passed." },
          { status: 403 },
        );
      const { count: attemptCount } = await sb
        .from("test_attempts")
        .select("id", { count: "exact", head: true })
        .eq("test_id", topic.id)
        .eq("user_id", user.userId)
        .eq("status", "completed");
      if ((attemptCount || 0) >= topic.attempts_allowed)
        return Response.json(
          {
            error: `You have used all ${topic.attempts_allowed} allowed attempt(s).`,
          },
          { status: 403 },
        );
      const demoMode = !getVivaEnv().OPENAI_API_KEY;
      const { count: readyDocuments } = await sb
        .from("test_documents")
        .select("id", { count: "exact", head: true })
        .eq("test_id", topic.id)
        .eq("status", "ready");
      if (
        !demoMode &&
        topic.grounding_mode === "documents_only" &&
        (!topic.openai_vector_store_id || !readyDocuments)
      )
        return Response.json(
          {
            error:
              "This test is not ready: an administrator must attach and successfully index at least one supporting document.",
          },
          { status: 409 },
        );
      const { data: attempt, error } = await sb
        .from("test_attempts")
        .insert({ test_id: topic.id, user_id: user.userId })
        .select("id")
        .single();
      if (error) throw error;
      const prompt = `You are Vivawise, a rigorous university viva examiner. Generate question 1 of ${topic.question_count} for '${topic.name}'. ${topic.instructions ? `Instructions: ${topic.instructions}` : ""} ${topic.openai_vector_store_id ? "You MUST use file search. Ask a question supported by the attached test documents only. Do not use outside knowledge. If the documents do not support a suitable question, state that the source material is insufficient." : "Use foundational knowledge only because this test permits it."}`;
      const result = demoMode
        ? {
            question: demoQuestions[0],
            hint: "Structure your answer as definition, explanation and example.",
            topic: "Demo practice",
            sourceBasis: "Demo mode — OpenAI is not connected",
          }
        : await createVivaResponse(
            prompt,
            "viva_question",
            questionSchema,
            topic.openai_vector_store_id,
          );
      return Response.json({
        sessionId: attempt.id,
        ...result,
        grounded: !demoMode && Boolean(topic.openai_vector_store_id),
        demo: demoMode,
        settings: {
          questionCount: topic.question_count,
          timeLimitMinutes: topic.time_limit_minutes,
          hintsAllowed: topic.hints_allowed,
          skippingAllowed: topic.skipping_allowed,
          answerMode: topic.answer_mode,
          feedbackTiming: topic.feedback_timing,
        },
      });
    }

    if (body.action === "answer") {
      if (!body.sessionId || !body.question?.trim() || !body.answer?.trim())
        return Response.json(
          { error: "Session, question and answer are required." },
          { status: 400 },
        );
      const { data: owned } = await sb
        .from("test_attempts")
        .select("id,started_at,tests(*)")
        .eq("id", body.sessionId)
        .eq("user_id", user.userId)
        .single();
      if (!owned)
        return Response.json({ error: "Session not found." }, { status: 404 });
      const test = (owned as any).tests;
      const vectorStoreId = test?.openai_vector_store_id;
      if (
        Date.now() >
        new Date((owned as any).started_at).getTime() +
          test.time_limit_minutes * 60000
      )
        return Response.json(
          { error: "The time limit for this attempt has expired." },
          { status: 403 },
        );
      const { count: answerCount } = await sb
        .from("attempt_answers")
        .select("id", { count: "exact", head: true })
        .eq("attempt_id", body.sessionId);
      if ((answerCount || 0) >= test.question_count)
        return Response.json(
          { error: "This viva is already complete." },
          { status: 409 },
        );
      const prompt = `You are Vivawise, a fair university viva examiner. ${vectorStoreId ? "You MUST use file search and evaluate only against the attached test documents. Do not introduce outside facts." : "Evaluate using foundational knowledge."} Question: ${body.question}. Student answer: ${body.answer}. Score 0 to 10. Then generate question ${(answerCount || 0) + 2} of ${test.question_count}, also grounded only in the attached documents.`;
      const demoMode = !getVivaEnv().OPENAI_API_KEY;
      const result = demoMode
        ? demoFeedback(body.answer, (answerCount || 0) + 1, test.question_count)
        : await createVivaResponse(
            prompt,
            "viva_feedback",
            feedbackSchema,
            vectorStoreId,
          );
      const score = Math.max(0, Math.min(10, Number(result.score) || 0));
      const { error } = await sb
        .from("attempt_answers")
        .insert({
          attempt_id: body.sessionId,
          question: body.question,
          answer: body.answer,
          score,
          feedback: result,
        });
      if (error) throw error;
      const completed = (answerCount || 0) + 1 >= test.question_count;
      if (completed) {
        const { data: all } = await sb
          .from("attempt_answers")
          .select("score")
          .eq("attempt_id", body.sessionId);
        const average =
          (all || []).reduce((sum, row) => sum + Number(row.score), 0) /
          Math.max(1, (all || []).length);
        await sb
          .from("test_attempts")
          .update({
            status: "completed",
            score: average * 10,
            completed_at: new Date().toISOString(),
          })
          .eq("id", body.sessionId);
      }
      return Response.json({
        ...result,
        completed,
        demo: demoMode,
        grounded: !demoMode && Boolean(vectorStoreId),
      });
    }
    return Response.json({ error: "Unknown viva action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    return Response.json(
      { error: message },
      { status: message.includes("OPENAI_API_KEY") ? 503 : 500 },
    );
  }
}
