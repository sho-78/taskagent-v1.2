import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type RpcResult = {
  ok: boolean;
  error?: string;
  org_id?: string;
  role?: "admin" | "member";
};

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "ログインが必要です",
  invitation_not_found: "招待が見つかりません(URL を再確認してください)",
  already_accepted: "この招待は既に受諾済みです",
  expired: "この招待は期限切れです",
};

export function InviteAccept() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { appUser, refreshProfile } = useAuth();

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!token) return;
    setRunning(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setRunning(false);
      return;
    }
    const result = data as RpcResult;
    if (!result?.ok) {
      setError(ERROR_MESSAGES[result?.error ?? ""] ?? result?.error ?? "不明なエラー");
      setRunning(false);
      return;
    }
    setDone(true);
    if (refreshProfile) await refreshProfile();
    setTimeout(() => navigate("/"), 1500);
  };

  if (!token) {
    return (
      <div className="card max-w-md">
        <div className="text-sm font-medium mb-2">招待の受諾</div>
        <div className="text-sm text-danger">URL に token が含まれていません</div>
      </div>
    );
  }

  return (
    <div className="card max-w-md">
      <div className="text-sm font-medium mb-2">同組織への招待を受諾</div>
      <div className="text-xs text-text-secondary mb-4">
        現在のアカウント({appUser?.email ?? "未ログイン"})で招待を受け入れると、新しい組織に所属が切り替わります。
      </div>
      {done ? (
        <div className="text-sm text-success">
          受諾しました。ホームに移動します...
        </div>
      ) : (
        <>
          <button
            className="btn-primary"
            onClick={accept}
            disabled={running || !appUser}
          >
            {running ? "処理中..." : "招待を受諾する"}
          </button>
          {error && (
            <div className="text-xs text-danger mt-3">{error}</div>
          )}
        </>
      )}
    </div>
  );
}
