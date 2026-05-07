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

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data: u, error: uErr } = await supabase
        .from("app_user")
        .select("id, org_id, email, display_name, role")
        .eq("id", userId)
        .maybeSingle();
      if (!aliveRef.current) return;
      if (uErr) console.error("[useAuth] load app_user error:", uErr);
      setAppUser((u as AppUser | null) ?? null);

      if (u?.org_id) {
        const { data: o, error: oErr } = await supabase
          .from("organization")
          .select("id, name, plan, status")
          .eq("id", u.org_id)
          .maybeSingle();
        if (!aliveRef.current) return;
        if (oErr) console.error("[useAuth] load organization error:", oErr);
        setOrganization((o as Organization | null) ?? null);
      } else {
        setOrganization(null);
      }
    } catch (err) {
      console.error("[useAuth] loadProfile threw:", err);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;

    (async () => {
      try {
        console.log("[useAuth] init start");
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("[useAuth] getSession error:", error);
        if (!aliveRef.current) return;
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        }
      } catch (err) {
        console.error("[useAuth] init threw:", err);
      } finally {
        if (aliveRef.current) setLoading(false);
        console.log("[useAuth] init done");
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
