import { useCallback, useEffect, useState } from "react";
import { Trash2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  org_id: string;
  title: string;
  body: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export function Tasks() {
  const { appUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!appUser) return;
    setError(null);
    const { data, error } = await supabase
      .from("task")
      .select("id, org_id, title, body, status, priority, due_at, completed_at, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setTasks((data as Task[]) ?? []);
    }
    setLoading(false);
  }, [appUser?.id]);

  useEffect(() => {
    if (appUser) fetchTasks();
  }, [appUser?.id, fetchTasks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser || !newTitle.trim()) return;
    setError(null);
    const { error } = await supabase.from("task").insert({
      org_id: appUser.org_id,
      title: newTitle.trim(),
      created_by: appUser.id,
    });
    if (error) {
      setError(error.message);
    } else {
      setNewTitle("");
      fetchTasks();
    }
  };

  const handleToggle = async (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    const { error } = await supabase
      .from("task")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (!error) fetchTasks();
    else setError(error.message);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このタスクを削除しますか？")) return;
    const { error } = await supabase.from("task").delete().eq("id", id);
    if (!error) fetchTasks();
    else setError(error.message);
  };

  if (!appUser) {
    return (
      <div className="text-sm text-text-secondary">
        プロフィールを読み込み中です...
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-medium mb-1">タスク</h1>
      <p className="text-sm text-text-secondary mb-6">
        自分の組織のタスクを管理します（簡易ビュー）
      </p>

      <form onSubmit={handleAdd} className="card mb-4 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="新しいタスクを入力..."
          className="input flex-1"
        />
        <button type="submit" className="btn-primary" disabled={!newTitle.trim()}>
          追加
        </button>
      </form>

      {error && (
        <div className="card mb-4 text-sm text-danger">エラー: {error}</div>
      )}

      <div className="card">
        {loading ? (
          <div className="text-sm text-text-secondary">読み込み中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-text-secondary">
            タスクはまだありません。上のフォームから追加してください。
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const done = task.status === "done";
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <button
                    onClick={() => handleToggle(task)}
                    className={cn(
                      "w-5 h-5 border rounded flex items-center justify-center shrink-0 transition-colors",
                      done
                        ? "bg-primary border-primary text-white"
                        : "border-border-strong hover:border-primary"
                    )}
                    aria-label="完了切替"
                  >
                    {done && <Check size={12} />}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      done && "line-through text-text-muted"
                    )}
                  >
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="text-text-muted hover:text-danger transition-colors"
                    aria-label="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
