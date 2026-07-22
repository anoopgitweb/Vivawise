import { requireAppUser, supabaseAdmin } from "../../../lib/supabase";
export async function GET(request: Request) {
  try {
    const user = await requireAppUser(request);
    const sb = supabaseAdmin();
    let { data, error } = await sb
      .from("test_assignments")
      .select(
        "tests(id,name,subject,description,difficulty,question_count,time_limit_minutes,syllabus_modules,test_documents(count))",
      )
      .eq("user_id", user.id)
      .order("assigned_at", { ascending: false });
    if (error && error.message.includes("syllabus_modules")) {
      const fallback = await sb
        .from("test_assignments")
        .select(
          "tests(id,name,subject,description,difficulty,question_count,time_limit_minutes,test_documents(count))",
        )
        .eq("user_id", user.id)
        .order("assigned_at", { ascending: false });
      data = fallback.data as typeof data;
      error = fallback.error;
    }
    if (error) throw error;
    const topics = (data || [])
      .map((row: any) => row.tests)
      .filter(Boolean)
      .map((t: any) => ({
        id: t.id,
        title: t.name,
        subject: t.subject,
        description: t.description,
        difficulty: t.difficulty,
        documentCount: t.test_documents?.[0]?.count || 0,
        questionCount: Number(t.question_count) || 10,
        timeLimitMinutes: Number(t.time_limit_minutes) || 20,
        syllabusModules: Array.isArray(t.syllabus_modules)
          ? t.syllabus_modules
          : [],
      }));
    return Response.json({
      user: { email: user.email, displayName: user.fullName },
      topics,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return Response.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
