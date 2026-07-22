import { requireAppUser, supabaseAdmin } from "../../../lib/supabase";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser(request);
    const sb = supabaseAdmin();
    let { data, error } = await sb
      .from("test_attempts")
      .select(
        "id,status,score,selected_module,started_at,completed_at,tests(name,subject,question_count),attempt_answers(count)",
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });
    if (error && error.message.includes("selected_module")) {
      const fallback = await sb
        .from("test_attempts")
        .select(
          "id,status,score,started_at,completed_at,tests(name,subject,question_count),attempt_answers(count)",
        )
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error) throw error;
    return Response.json({
      attempts: (data || []).map((attempt: any) => ({
        id: attempt.id,
        status: attempt.status,
        score:
          attempt.score === null || attempt.score === undefined
            ? null
            : Number(attempt.score),
        selectedModule: attempt.selected_module || "All syllabus modules",
        startedAt: attempt.started_at,
        completedAt: attempt.completed_at,
        vivaName: attempt.tests?.name || "Viva",
        subject: attempt.tests?.subject || "",
        questionCount: Number(attempt.tests?.question_count) || 0,
        answeredCount: Number(attempt.attempt_answers?.[0]?.count) || 0,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load attempts." },
      { status: 500 },
    );
  }
}
