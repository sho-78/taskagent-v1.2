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
    const { data: u } = await supabase
      .from("app_user")
      .select("id, org_id, email, display_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (!aliveRef.current) return;
    setAppUser((u as AppUser | null) ?? null);

    if (u?.org_id) {
      const { data: o } = await supabase
        .from("organization")
        .select("id, name, plan, status")
        .eq("id", u.org_id)
        .maybeSingle();
      if (!aliveRef.current) return;
      setOrganization((o as Organization | null) ?? null);
    } else {
      setOrganization(null);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!aliveRef.current) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
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
