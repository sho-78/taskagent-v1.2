import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type RpcResult = {
  ok: boolean;
  error?: string;
  status?: string;
  host_org_id?: string;
  guest_org_id?: string;
  project_id?: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "ログインが必要です",
  invitation_not_found: "招待が見つかりません(URL を再確認してください)",
  not_pending: "この招待は既に処理済みです",
  expired: "この招待は期限切れです",
  user_no_org: "受諾するには組織に所属している必要があります",
  cannot_accept_own_invitation: "自分自身の組織には受諾できません",
};

export function CrossOrgAccept() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { appUser, organization } = useAuth();

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!token) return;
    setRunning(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc(
      "accept_cross_org_invitation",
      { p_token: token },
    );
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
    setTimeout(() => navigate("/"), 1500);
  };

  if (!token) {
    return (
      <div className="card max-w-md">
        <div className="text-sm font-medium mb-2">クロス組織招待の受諾</div>
        <div className="text-sm text-danger">URL に token が含まれていません</div>
      </div>
    );
  }

  return (
    <div className="card max-w-md">
      <div className="text-sm font-medium mb-2">クロス組織招待を受諾</div>
      <div className="text-xs text-text-secondary mb-4">
        現在の組織({organization?.name ?? "—"})が、招待元の組織と協業関係を結びます。
        プロジェクト単位での読み取り/書き込みアクセスが付与されます。
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
