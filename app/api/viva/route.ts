import { createVivaResponse } from "../../../lib/openai";
import { requireVivaUser } from "../../../lib/identity";
import { supabaseAdmin } from "../../../lib/supabase";

const questionSchema = {
  type: "object", additionalProperties: false,
  properties: { question: { type: "string" }, hint: { type: "string" }, topic: { type: "string" }, sourceBasis: { type: "string" } },
  required: ["question", "hint", "topic", "sourceBasis"],
};

const feedbackSchema = {
  type: "object", additionalProperties: false,
  properties: {
    score: { type: "number" }, maxScore: { type: "number" }, verdict: { type: "string" }, summary: { type: "string" },
    correctPoints: { type: "array", items: { type: "string" } }, missingPoints: { type: "array", items: { type: "string" } }, incorrectClaims: { type: "array", items: { type: "string" } },
    conceptScore: { type: "number" }, clarityScore: { type: "number" }, completenessScore: { type: "number" }, modelAnswer: { type: "string" },
    nextQuestion: { type: "string" }, nextHint: { type: "string" }, nextTopic: { type: "string" }, sourceBasis: { type: "string" },
  },
  required: ["score", "maxScore", "verdict", "summary", "correctPoints", "missingPoints", "incorrectClaims", "conceptScore", "clarityScore", "completenessScore", "modelAnswer", "nextQuestion", "nextHint", "nextTopic", "sourceBasis"],
};

export async function POST(request: Request) {
  try {
    const user = await requireVivaUser(request);
    const body = await request.json() as { action?: string; topicId?: string; sessionId?: string; question?: string; answer?: string; questionNumber?: number };
    const sb = supabaseAdmin();

    if (body.action === "start") {
      if (!body.topicId) return Response.json({ error: "Choose an assigned mock viva." }, { status: 400 });
      const {data:assignment}=await sb.from("test_assignments").select("tests(id,name,subject,difficulty,openai_vector_store_id)").eq("test_id",body.topicId).eq("user_id",user.userId).single();
      const topic=(assignment as any)?.tests as {id:string;name:string;subject:string;difficulty:string;openai_vector_store_id?:string}|undefined;
      if (!topic) return Response.json({ error: "This mock viva is not assigned to you." }, { status: 403 });
      const {data:attempt,error}=await sb.from("test_attempts").insert({test_id:topic.id,user_id:user.userId}).select("id").single();if(error)throw error;
      const prompt = `You are Vivawise, a rigorous but supportive university viva examiner. Generate the first ${topic.difficulty} viva question for the assigned test '${topic.name}' (${topic.subject}). ${topic.openai_vector_store_id ? "Use file search and base the question on the admin-provided test documents." : "No indexed document is available; use reliable foundational subject knowledge."} Ask one clear oral-exam question.`;
      const result = await createVivaResponse(prompt, "viva_question", questionSchema, topic.openai_vector_store_id);
      return Response.json({ sessionId:attempt.id, ...result, grounded: Boolean(topic.openai_vector_store_id) });
    }

    if (body.action === "answer") {
      if (!body.sessionId || !body.question?.trim() || !body.answer?.trim()) return Response.json({ error: "Session, question and answer are required." }, { status: 400 });
      const {data:owned}=await sb.from("test_attempts").select("id,tests(subject,difficulty,openai_vector_store_id)").eq("id",body.sessionId).eq("user_id",user.userId).single();
      if (!owned) return Response.json({ error: "Session not found." }, { status: 404 });
      const test=(owned as any).tests;const vectorStoreId=test?.openai_vector_store_id;
      const prompt = `You are Vivawise, a fair university viva examiner. Evaluate the answer against ${vectorStoreId ? "the admin-provided test documents using file search" : "reliable general subject knowledge"}. Subject: ${test?.subject}. Difficulty: ${test?.difficulty}. Question: ${body.question}. Student answer: ${body.answer}. Score 0 to 10. Be precise and encouraging, then ask one adaptive follow-up question.`;
      const result = await createVivaResponse(prompt, "viva_feedback", feedbackSchema, vectorStoreId);
      const score = Math.max(0, Math.min(10, Number(result.score) || 0));
      const {error}=await sb.from("attempt_answers").insert({attempt_id:body.sessionId,question:body.question,answer:body.answer,score,feedback:result});if(error)throw error;
      return Response.json({ ...result, grounded: Boolean(vectorStoreId) });
    }
    return Response.json({ error: "Unknown viva action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return Response.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 });
  }
}
