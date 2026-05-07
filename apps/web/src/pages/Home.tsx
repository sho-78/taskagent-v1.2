import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type TaskRow = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  completed_at: string | null;
  created_at: string;
};

type Stats = {
  total: number;
  todo: number;
  done: number;
  completedThisWeek: number;
};

export function Home() {
  const { appUser, organization } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [topTasks, setTopTasks] = useState<TaskRow[]>([]);

  useEffect(() => {
    if (!appUser) return;
    const load = async () => {
      const { data } = await supabase
        .from("task")
        .select("id, title, status, completed_at, created_at")
        .order("created_at", { ascending: false });

      const list = (data as TaskRow[]) ?? [];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      setStats({
        total: list.length,
        todo: list.filter((t) => t.status !== "done").length,
        done: list.filter((t) => t.status === "done").length,
        completedThisWeek: list.filter(
          (t) =>
            t.status === "done" &&
            t.completed_at !== null &&
            new Date(t.completed_at) > weekAgo
        ).length,
      });

      setTopTasks(list.filter((t) => t.status !== "done").slice(0, 5));
    };
    load();
  }, [appUser?.id]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">ホーム</h1>
        <p className="text-sm text-text-secondary mt-1">
          {organization
            ? `${organization.name} のダッシュボード`
            : "ダッシュボード"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card-muted">
          <div className="text-xs text-text-secondary">未完了タスク</div>
          <div className="text-2xl font-medium tabular mt-1">
            {stats?.todo ?? "—"}
          </div>
        </div>
        <div className="card-muted">
          <div className="text-xs text-text-secondary">今週の完了</div>
          <div className="text-2xl font-medium tabular mt-1">
            {stats?.completedThisWeek ?? "—"}
          </div>
        </div>
        <div className="card-muted">
          <div className="text-xs text-text-secondary">合計タスク</div>
          <div className="text-2xl font-medium tabular mt-1">
            {stats?.total ?? "—"}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">優先タスク</div>
          <Link to="/tasks" className="text-xs text-primary hover:underline">
            すべて見る →
          </Link>
        </div>
        {topTasks.length === 0 ? (
          <div className="text-sm text-text-secondary">
            未完了のタスクはありません。
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {topTasks.map((t) => (
              <li
                key={t.id}
                className="text-sm py-2 first:pt-0 last:pb-0"
              >
                {t.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
