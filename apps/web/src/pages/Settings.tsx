import { useCallback, useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Role = "admin" | "member";
type CrossOrgStatus = "pending" | "accepted" | "revoked" | "expired";

type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

type CrossOrgInvitationRow = {
  id: string;
  guest_org_email: string;
  project_id: string | null;
  permissions: { read?: boolean; write?: boolean };
  status: CrossOrgStatus;
  token: string;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
};

const DAYS_VALID = 14;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function inviteUrl(kind: "invite" | "cross-org", token: string): string {
  const base = `${window.location.origin}${import.meta.env.VITE_BASE_PATH ?? "/"}`;
  const path = kind === "invite" ? "invite/accept" : "cross-org/accept";
  return `${base.replace(/\/$/, "")}/${path}?token=${token}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function Settings() {
  const { appUser, organization } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const [orgName, setOrgName] = useState(organization?.name ?? "");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMsg, setOrgMsg] = useState<string | null>(null);

  useEffect(() => {
    setOrgName(organization?.name ?? "");
  }, [organization?.name]);

  const saveOrgName = async () => {
    if (!organization?.id || !orgName.trim()) return;
    setOrgSaving(true);
    setOrgMsg(null);
    const { error } = await supabase
      .from("organization")
      .update({ name: orgName.trim() })
      .eq("id", organization.id);
    setOrgSaving(false);
    setOrgMsg(error ? `エラー: ${error.message}` : "保存しました");
  };

  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<Role>("member");
  const [invError, setInvError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!appUser) return;
    const { data, error } = await supabase
      .from("invitation")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .order("created_at", { ascending: false });
    if (!error) setInvitations((data as InvitationRow[]) ?? []);
  }, [appUser?.id]);

  const createInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvError(null);
    if (!appUser || !invEmail.trim()) return;
    const token = generateToken();
    const expiresAt = new Date(Date.now() + DAYS_VALID * 86400_000).toISOString();
    const { error } = await supabase.from("invitation").insert({
      org_id: appUser.org_id,
      email: invEmail.trim(),
      role: invRole,
      token,
      expires_at: expiresAt,
      created_by: appUser.id,
    });
    if (error) {
      setInvError(error.message);
    } else {
      setInvEmail("");
      setInvRole("member");
      fetchInvitations();
    }
  };

  const deleteInvitation = async (id: string) => {
    const { error } = await supabase.from("invitation").delete().eq("id", id);
    if (!error) fetchInvitations();
  };

  const [crossInvs, setCrossInvs] = useState<CrossOrgInvitationRow[]>([]);
  const [coEmail, setCoEmail] = useState("");
  const [coWrite, setCoWrite] = useState(false);
  const [coError, setCoError] = useState<string | null>(null);

  const fetchCrossInvs = useCallback(async () => {
    if (!appUser) return;
    const { data, error } = await supabase
      .from("cross_org_invitation")
      .select(
        "id, guest_org_email, project_id, permissions, status, token, expires_at, responded_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (!error) setCrossInvs((data as CrossOrgInvitationRow[]) ?? []);
  }, [appUser?.id]);

  const createCrossInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoError(null);
    if (!appUser || !coEmail.trim()) return;
    const token = generateToken();
    const expiresAt = new Date(Date.now() + DAYS_VALID * 86400_000).toISOString();
    const { error } = await supabase.from("cross_org_invitation").insert({
      host_org_id: appUser.org_id,
      guest_org_email: coEmail.trim(),
      project_id: null,
      permissions: { read: true, write: coWrite },
      token,
      expires_at: expiresAt,
      created_by: appUser.id,
    });
    if (error) {
      setCoError(error.message);
    } else {
      setCoEmail("");
      setCoWrite(false);
      fetchCrossInvs();
    }
  };

  const revokeCrossInvitation = async (id: string) => {
    const { error } = await supabase
      .from("cross_org_invitation")
      .update({ status: "revoked" as CrossOrgStatus })
      .eq("id", id);
    if (!error) fetchCrossInvs();
  };

  useEffect(() => {
    if (appUser) {
      fetchInvitations();
      fetchCrossInvs();
    }
  }, [appUser?.id, fetchInvitations, fetchCrossInvs]);

  const handleCopy = async (token: string, kind: "invite" | "cross-org") => {
    const ok = await copyToClipboard(inviteUrl(kind, token));
    if (ok) {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-medium mb-1">設定</h1>
      <p className="text-sm text-text-secondary mb-6">
        組織情報の編集、同組織メンバー招待、クロス組織招待
      </p>

      <section className="card mb-4">
        <div className="text-sm font-medium mb-3">組織名</div>
        <div className="flex items-center gap-2">
          <input
            className="input flex-1 max-w-md"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={!isAdmin}
          />
          <button
            className="btn-primary"
            onClick={saveOrgName}
            disabled={!isAdmin || orgSaving || !orgName.trim()}
          >
            {orgSaving ? "保存中..." : "保存"}
          </button>
        </div>
        {!isAdmin && (
          <div className="text-xs text-text-secondary mt-2">
            組織名の編集は管理者のみ可能です
          </div>
        )}
        {orgMsg && (
          <div className="text-xs text-text-secondary mt-2">{orgMsg}</div>
        )}
      </section>

      <section className="card mb-4">
        <div className="text-sm font-medium mb-1">同組織メンバー招待</div>
        <div className="text-xs text-text-secondary mb-3">
          発行した URL を相手に共有してください(有効期限 {DAYS_VALID} 日)
        </div>

        <form
          onSubmit={createInvitation}
          className="flex flex-wrap items-center gap-2 mb-3"
        >
          <input
            type="email"
            required
            placeholder="invitee@example.com"
            className="input flex-1 min-w-[200px] max-w-md"
            value={invEmail}
            onChange={(e) => setInvEmail(e.target.value)}
            disabled={!isAdmin}
          />
          <select
            className="input w-28"
            value={invRole}
            onChange={(e) => setInvRole(e.target.value as Role)}
            disabled={!isAdmin}
          >
            <option value="member">メンバー</option>
            <option value="admin">管理者</option>
          </select>
          <button
            type="submit"
            className="btn-primary"
            disabled={!isAdmin || !invEmail.trim()}
          >
            招待を発行
          </button>
        </form>

        {invError && (
          <div className="text-xs text-danger mb-2">エラー: {invError}</div>
        )}

        <div className="space-y-1">
          {invitations.length === 0 ? (
            <div className="text-xs text-text-secondary">
              発行済みの招待はありません
            </div>
          ) : (
            invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0"
              >
                <div className="flex-1 truncate">{inv.email}</div>
                <span className="text-xs text-text-secondary w-16">
                  {inv.role === "admin" ? "管理者" : "メンバー"}
                </span>
                <span className="text-xs text-text-secondary w-20">
                  {inv.accepted_at
                    ? "受諾済"
                    : new Date(inv.expires_at) < new Date()
                      ? "期限切れ"
                      : "未受諾"}
                </span>
                <button
                  className="btn h-7 text-xs px-2"
                  onClick={() => handleCopy(inv.token, "invite")}
                  title="招待 URL をコピー"
                >
                  <Copy size={12} />
                  {copiedToken === inv.token ? "コピー済" : "URL"}
                </button>
                <button
                  className="btn h-7 text-xs px-2"
                  onClick={() => deleteInvitation(inv.id)}
                  disabled={!isAdmin}
                  title="削除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card mb-4">
        <div className="text-sm font-medium mb-1">クロス組織招待(F-017)</div>
        <div className="text-xs text-text-secondary mb-3">
          別組織の管理者を招待して、プロジェクト単位で読み取り/書き込み権限を付与
        </div>

        <form
          onSubmit={createCrossInvitation}
          className="flex flex-wrap items-center gap-2 mb-3"
        >
          <input
            type="email"
            required
            placeholder="partner-admin@example.com"
            className="input flex-1 min-w-[200px] max-w-md"
            value={coEmail}
            onChange={(e) => setCoEmail(e.target.value)}
            disabled={!isAdmin}
          />
          <label className="flex items-center gap-1 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={coWrite}
              onChange={(e) => setCoWrite(e.target.checked)}
              disabled={!isAdmin}
            />
            書き込み権限を付与
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={!isAdmin || !coEmail.trim()}
          >
            招待を発行
          </button>
        </form>

        {coError && (
          <div className="text-xs text-danger mb-2">エラー: {coError}</div>
        )}

        <div className="space-y-1">
          {crossInvs.length === 0 ? (
            <div className="text-xs text-text-secondary">
              発行済みのクロス組織招待はありません
            </div>
          ) : (
            crossInvs.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2 text-sm py-1.5 border-b border-border last:border-0"
              >
                <div className="flex-1 truncate">{inv.guest_org_email}</div>
                <span className="text-xs text-text-secondary w-16">
                  {inv.permissions?.write ? "読み書き" : "読み取り"}
                </span>
                <span className="text-xs text-text-secondary w-20">
                  {inv.status === "pending"
                    ? new Date(inv.expires_at) < new Date()
                      ? "期限切れ"
                      : "未受諾"
                    : inv.status === "accepted"
                      ? "受諾済"
                      : inv.status === "revoked"
                        ? "取消済"
                        : "期限切れ"}
                </span>
                <button
                  className="btn h-7 text-xs px-2"
                  onClick={() => handleCopy(inv.token, "cross-org")}
                  disabled={inv.status !== "pending"}
                  title="招待 URL をコピー"
                >
                  <Copy size={12} />
                  {copiedToken === inv.token ? "コピー済" : "URL"}
                </button>
                <button
                  className="btn h-7 text-xs px-2"
                  onClick={() => revokeCrossInvitation(inv.id)}
                  disabled={!isAdmin || inv.status !== "pending"}
                  title="取り消し"
                >
                  取消
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
