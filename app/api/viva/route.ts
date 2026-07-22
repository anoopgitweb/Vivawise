import { createVivaResponse } from "../../../lib/openai";
import { requireVivaUser } from "../../../lib/identity";
import { ensureSchema, requireDatabase } from "../../../lib/runtime";

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
    await ensureSchema();
    const body = await request.json() as { action?: string; subject?: string; difficulty?: string; sessionId?: string; question?: string; answer?: string; questionNumber?: number };
    const db = requireDatabase();
    const resource = await db.prepare("SELECT vector_store_id AS vectorStoreId FROM user_resources WHERE user_id = ?").bind(user.userId).first<{ vectorStoreId?: string }>();
    const vectorStoreId = resource?.vectorStoreId;
    const subject = body.subject?.trim() || "General syllabus";
    const difficulty = body.difficulty?.trim() || "Standard";

    if (body.action === "start") {
      const sessionId = crypto.randomUUID();
      await db.prepare("INSERT INTO viva_sessions (id, user_id, subject, difficulty, question_count, total_score, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?)")
        .bind(sessionId, user.userId, subject, difficulty, Date.now(), Date.now()).run();
      const prompt = `You are Vivawise, a rigorous but supportive university viva examiner. Generate the first ${difficulty} viva question for ${subject}. ${vectorStoreId ? "Search the student's private uploaded syllabus and base the question only on material found there." : "No syllabus has been uploaded, so ask a broadly applicable foundational question and clearly state that basis."} Ask one clear oral-exam question. The hint must guide without revealing the answer. sourceBasis must briefly name the relevant syllabus topic or say 'General subject knowledge'.`;
      const result = await createVivaResponse(prompt, "viva_question", questionSchema, vectorStoreId);
      return Response.json({ sessionId, ...result, grounded: Boolean(vectorStoreId) });
    }

    if (body.action === "answer") {
      if (!body.sessionId || !body.question?.trim() || !body.answer?.trim()) return Response.json({ error: "Session, question and answer are required." }, { status: 400 });
      const owned = await db.prepare("SELECT id FROM viva_sessions WHERE id = ? AND user_id = ?").bind(body.sessionId, user.userId).first();
      if (!owned) return Response.json({ error: "Session not found." }, { status: 404 });
      const prompt = `You are Vivawise, a fair university viva examiner. Evaluate the student's answer against ${vectorStoreId ? "their private uploaded syllabus using file search" : "reliable general subject knowledge"}. Subject: ${subject}. Difficulty: ${difficulty}. Question: ${body.question}. Student answer: ${body.answer}. Score from 0 to 10. Reward correct ideas expressed in different wording. Identify factual errors explicitly. Keep feedback encouraging but precise. Then generate one adaptive follow-up question based on the gaps or strengths. Percentage fields must be numbers from 0 to 100. sourceBasis must identify the syllabus topic used or say 'General subject knowledge'.`;
      const result = await createVivaResponse(prompt, "viva_feedback", feedbackSchema, vectorStoreId);
      const score = Math.max(0, Math.min(10, Number(result.score) || 0));
      await db.batch([
        db.prepare("INSERT INTO viva_answers (id, session_id, user_id, question, answer, score, feedback_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), body.sessionId, user.userId, body.question, body.answer, Math.round(score * 10), JSON.stringify(result), Date.now()),
        db.prepare("UPDATE viva_sessions SET question_count = question_count + 1, total_score = total_score + ?, updated_at = ? WHERE id = ? AND user_id = ?")
          .bind(Math.round(score * 10), Date.now(), body.sessionId, user.userId),
      ]);
      return Response.json({ ...result, grounded: Boolean(vectorStoreId) });
    }
    return Response.json({ error: "Unknown viva action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return Response.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 });
  }
}
