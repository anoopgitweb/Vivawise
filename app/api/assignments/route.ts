import { requireVivaUser } from "../../../lib/identity";
import { ensureSchema, requireDatabase } from "../../../lib/runtime";

export async function GET(request: Request) {
  try {
    const user = await requireVivaUser(request); await ensureSchema();
    const rows = await requireDatabase().prepare(`SELECT t.id,t.title,t.subject,t.description,t.difficulty,COUNT(d.id) documentCount
      FROM topic_assignments a JOIN mock_viva_topics t ON t.id=a.topic_id LEFT JOIN topic_documents d ON d.topic_id=t.id
      WHERE a.user_id=? GROUP BY t.id ORDER BY a.assigned_at DESC`).bind(user.userId).all();
    return Response.json({ user: { email: user.email, displayName: user.displayName }, topics: rows.results });
  } catch (error) { if (error instanceof Response) return error; return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}
