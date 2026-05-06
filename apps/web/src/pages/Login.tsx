import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page">
      <div className="card w-full max-w-sm">
        <div className="text-lg font-medium mb-1">TaskAgent</div>
        <div className="text-sm text-text-secondary mb-6">
          メールで届くマジックリンクからログインします
        </div>

        {sent ? (
          <div className="text-sm text-success">
            メールを送信しました。受信箱をご確認ください。
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input w-full"
            />
            {error && <div className="text-xs text-danger">{error}</div>}
            <button type="submit" className="btn-primary w-full">
              ログインリンクを送る
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
