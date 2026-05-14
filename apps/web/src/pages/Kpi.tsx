import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "todo" | "in_progress" | "done" | "cancelled";

type TaskRow = {
  id: string;
  priority: Priority;
  status: Status;
  due_at: string | null;
  completed_at: string | null;
};

type DailyPoint = { date: string; completed: number };
type PriorityPoint = { name: string; value: number; color: string };

const DAYS_WINDOW = 14;

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "急", color: "#DC2626" },
  high: { label: "高", color: "#F59E0B" },
  medium: { label: "中", color: "#9CA3AF" },
  low: { label: "低", color: "#D1D5DB" },
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function formatMd(key: string): string {
  const [, m, d] = key.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

export function Kpi() {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [byPriority, setByPriority] = useState<PriorityPoint[]>([]);
  const [summary, setSummary] = useState({
    completedRecent: 0,
    completionRate: 0,
    overdueRate: 0,
    openCount: 0,
  });

  const load = useCallback(async () => {
    if (!appUser) return;
    setError(null);
    const { data, error: queryErr } = await supabase
      .from("task")
      .select("id, priority, status, due_at, completed_at");
    if (queryErr) {
      setError(queryErr.message);
      setLoading(false);
      return;
    }
    const rows = (data as TaskRow[]) ?? [];

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - (DAYS_WINDOW - 1));
    since.setHours(0, 0, 0, 0);

    const dayMap = new Map<string, number>();
    for (let i = 0; i < DAYS_WINDOW; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      dayMap.set(ymd(d), 0);
    }
    for (const r of rows) {
      if (r.status !== "done" || !r.completed_at) continue;
      const d = new Date(r.completed_at);
      if (d < since) continue;
      const key = ymd(d);
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      }
    }
    const dailyPoints: DailyPoint[] = Array.from(dayMap.entries()).map(
      ([k, v]) => ({ date: formatMd(k), completed: v }),
    );

    const prCounts: Record<Priority, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const r of rows) {
      if (r.status === "done" || r.status === "cancelled") continue;
      prCounts[r.priority]++;
    }
    const priorityPoints: PriorityPoint[] = (
      ["urgent", "high", "medium", "low"] as const
    ).map((p) => ({
      name: PRIORITY_META[p].label,
      value: prCounts[p],
      color: PRIORITY_META[p].color,
    }));

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const openCount = rows.filter(
      (r) => r.status === "todo" || r.status === "in_progress",
    ).length;
    const completedRecent = dailyPoints.reduce((s, p) => s + p.completed, 0);
    const total = rows.length;
    const completed = rows.filter((r) => r.status === "done").length;
    const completionRate =
      total === 0 ? 0 : Math.round((completed / total) * 100);
    const withDue = rows.filter(
      (r) =>
        (r.status === "todo" || r.status === "in_progress") && r.due_at,
    );
    const overdue = withDue.filter(
      (r) => r.due_at && new Date(r.due_at) < todayStart,
    ).length;
    const overdueRate =
      withDue.length === 0 ? 0 : Math.round((overdue / withDue.length) * 100);

    setDaily(dailyPoints);
    setByPriority(priorityPoints);
    setSummary({ completedRecent, completionRate, overdueRate, openCount });
    setLoading(false);
  }, [appUser?.id]);

  useEffect(() => {
    if (appUser) load();
  }, [appUser?.id, load]);

  return (
    <div>
      <h1 className="text-xl font-medium mb-1">KPI ダッシュボード</h1>
      <p className="text-sm text-text-secondary mb-6">
        直近 {DAYS_WINDOW} 日の実績と未完了の状況を可視化(F-019 MVP)
      </p>

      {error && (
        <div className="card mb-4 text-sm text-danger">エラー: {error}</div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label={`完了タスク(直近${DAYS_WINDOW}日)`}
          value={loading ? "—" : summary.completedRecent}
        />
        <SummaryCard
          label="完了率(全期間)"
          value={loading ? "—" : `${summary.completionRate}%`}
        />
        <SummaryCard
          label="遅延率(期限あり未完了)"
          value={loading ? "—" : `${summary.overdueRate}%`}
          tone={summary.overdueRate >= 30 ? "warn" : undefined}
        />
        <SummaryCard
          label="未完了"
          value={loading ? "—" : summary.openCount}
        />
      </div>

      <div className="card mb-4">
        <div className="text-sm font-medium mb-2">
          完了タスクの推移(直近 {DAYS_WINDOW} 日)
        </div>
        {loading ? (
          <div className="text-sm text-text-secondary h-40 flex items-center justify-center">
            読み込み中...
          </div>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart
                data={daily}
                margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={{ stroke: "#E5E7EB" }}
                  tickLine={{ stroke: "#E5E7EB" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={{ stroke: "#E5E7EB" }}
                  tickLine={{ stroke: "#E5E7EB" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#111827" }}
                />
                <Bar
                  dataKey="completed"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="text-sm font-medium mb-2">優先度別の未完了件数</div>
        {loading ? (
          <div className="text-sm text-text-secondary h-40 flex items-center justify-center">
            読み込み中...
          </div>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={byPriority}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(p: { name: string; value: number }) =>
                    p.value > 0 ? `${p.name}: ${p.value}` : ""
                  }
                >
                  {byPriority.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "warn";
}) {
  return (
    <div className="card-muted">
      <div className="text-xs text-text-secondary">{label}</div>
      <div
        className={`text-2xl font-medium tabular mt-1 ${
          tone === "warn" ? "text-danger" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
