import { useEffect, useRef, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppUser = {
  id: string;
  org_id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "member";
};

export type Organization = {
  id: string;
  name: string;
  plan: string;
  status: string;
};

function withTimeout<T>(thenable: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(thenable),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[useAuth] ${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data: u, error: ue } = await withTimeout(
        supabase
          .from("app_user")
          .select("id, org_id, email, display_name, role")
          .eq("id", userId)
          .maybeSingle(),
        8000,
        "load app_user"
      );
      if (ue) console.warn("[useAuth] app_user error:", ue);
      if (!aliveRef.current) return;
      setAppUser((u as AppUser | null) ?? null);

      if (u?.org_id) {
        const { data: o, error: oe } = await withTimeout(
          supabase
            .from("organization")
            .select("id, name, plan, status")
            .eq("id", u.org_id)
            .maybeSingle(),
          8000,
          "load organization"
        );
        if (oe) console.warn("[useAuth] organization error:", oe);
        if (!aliveRef.current) return;
        setOrganization((o as Organization | null) ?? null);
      } else {
        setOrganization(null);
      }
    } catch (e) {
      console.error("[useAuth] loadProfile failed:", e);
      if (!aliveRef.current) return;
      setAppUser(null);
      setOrganization(null);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;

    (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          "getSession"
        );
        if (!aliveRef.current) return;
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        }
      } catch (e) {
        console.error("[useAuth] init failed:", e);
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user) {
        await loadProfile(s.user.id);
      } else {
        setAppUser(null);
        setOrganization(null);
      }
    });

    return () => {
      aliveRef.current = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const user: User | null = session?.user ?? null;

  return {
    user,
    session,
    appUser,
    organization,
    loading,
    refreshProfile: () => (user ? loadProfile(user.id) : Promise.resolve()),
    signOut: () => supabase.auth.signOut(),
  };
}
