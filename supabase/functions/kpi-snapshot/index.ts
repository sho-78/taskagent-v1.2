// KPI Snapshot Batch Edge Function
// Trigger: pg_cron (daily at 02:00 JST)
// Computes KPIs for each scope (user/department/project/org) and
// writes to kpi_snapshot for fast dashboard rendering.
//
// Implements section 11.3 of REQUIREMENTS_v0.5.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const { data: orgs } = await supabase
    .from("organization")
    .select("id")
    .eq("status", "active");

  for (const org of orgs ?? []) {
    // Org-level metrics (chapter 11.2.4)
    const { count: completedToday } = await supabase
      .from("task")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "done")
      .gte("completed_at", `${today}T00:00:00+09:00`);

    const { count: overdueCount } = await supabase
      .from("task")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .neq("status", "done")
      .lt("due_at", new Date().toISOString());

    await supabase.from("kpi_snapshot").upsert(
      {
        org_id: org.id,
        scope_type: "org",
        scope_id: org.id,
        period: "daily",
        date: today,
        metrics: {
          completed_count: completedToday ?? 0,
          overdue_count: overdueCount ?? 0,
        },
      },
      { onConflict: "org_id,scope_type,scope_id,period,date" }
    );

    // TODO: per-user, per-department, per-project metrics
    // Implementation note: aggregate from task + activity tables
    // grouped by assignee_id, department_id, project_id respectively.
  }

  return new Response(
    JSON.stringify({ ok: true, processed: orgs?.length ?? 0 }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
});
