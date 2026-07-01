import { useEffect, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setAuth, setLoading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session?.user ?? null, session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (() => {
        setAuth(session?.user ?? null, session);
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, [setAuth, setLoading]);

  return <>{children}</>;
}
