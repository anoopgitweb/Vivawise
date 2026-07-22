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
    const body = await request.json() as { action?: string; topicId?: string; sessionId?: string; question?: string; answer?: string; questionNumber?: number };
    const db = requireDatabase();

    if (body.action === "start") {
      if (!body.topicId) return Response.json({ error: "Choose an assigned mock viva." }, { status: 400 });
      const topic = await db.prepare(`SELECT t.id,t.title,t.subject,t.difficulty,t.vector_store_id vectorStoreId FROM mock_viva_topics t
        JOIN topic_assignments a ON a.topic_id=t.id WHERE t.id=? AND a.user_id=?`).bind(body.topicId, user.userId).first<{ id: string; title: string; subject: string; difficulty: string; vectorStoreId?: string }>();
      if (!topic) return Response.json({ error: "This mock viva is not assigned to you." }, { status: 403 });
      const sessionId = crypto.randomUUID();
      await db.prepare("INSERT INTO viva_sessions (id,user_id,topic_id,subject,difficulty,question_count,total_score,created_at,updated_at) VALUES (?,?,?,?,?,0,0,?,?)")
        .bind(sessionId, user.userId, topic.id, topic.subject, topic.difficulty, Date.now(), Date.now()).run();
      const prompt = `You are Vivawise, a rigorous but supportive university viva examiner. Generate the first ${topic.difficulty} viva question for the assigned mock viva '${topic.title}' (${topic.subject}). ${topic.vectorStoreId ? "Use file search and base the question on the admin-provided topic documents." : "No document is attached; use reliable foundational subject knowledge."} Ask one clear oral-exam question. The hint must guide without revealing the answer.`;
      const result = await createVivaResponse(prompt, "viva_question", questionSchema, topic.vectorStoreId);
      return Response.json({ sessionId, ...result, grounded: Boolean(topic.vectorStoreId) });
    }

    if (body.action === "answer") {
      if (!body.sessionId || !body.question?.trim() || !body.answer?.trim()) return Response.json({ error: "Session, question and answer are required." }, { status: 400 });
      const owned = await db.prepare(`SELECT s.id,s.subject,s.difficulty,t.vector_store_id vectorStoreId FROM viva_sessions s LEFT JOIN mock_viva_topics t ON t.id=s.topic_id WHERE s.id=? AND s.user_id=?`)
        .bind(body.sessionId, user.userId).first<{ id: string; subject: string; difficulty: string; vectorStoreId?: string }>();
      if (!owned) return Response.json({ error: "Session not found." }, { status: 404 });
      const prompt = `You are Vivawise, a fair university viva examiner. Evaluate the answer against ${owned.vectorStoreId ? "the admin-provided topic documents using file search" : "reliable general subject knowledge"}. Subject: ${owned.subject}. Difficulty: ${owned.difficulty}. Question: ${body.question}. Student answer: ${body.answer}. Score 0 to 10. Be precise and encouraging, then ask one adaptive follow-up question.`;
      const result = await createVivaResponse(prompt, "viva_feedback", feedbackSchema, owned.vectorStoreId);
      const score = Math.max(0, Math.min(10, Number(result.score) || 0));
      await db.batch([
        db.prepare("INSERT INTO viva_answers (id, session_id, user_id, question, answer, score, feedback_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), body.sessionId, user.userId, body.question, body.answer, Math.round(score * 10), JSON.stringify(result), Date.now()),
        db.prepare("UPDATE viva_sessions SET question_count = question_count + 1, total_score = total_score + ?, updated_at = ? WHERE id = ? AND user_id = ?")
          .bind(Math.round(score * 10), Date.now(), body.sessionId, user.userId),
      ]);
      return Response.json({ ...result, grounded: Boolean(owned.vectorStoreId) });
    }
    return Response.json({ error: "Unknown viva action." }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return Response.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 });
  }
}
