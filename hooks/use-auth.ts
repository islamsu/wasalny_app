import * as Auth from "@/lib/_core/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export function useAuth(options?: { autoFetch?: boolean }) {
  const autoFetch = options?.autoFetch ?? true;
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);
  const request = useRef(0);
  const fetchUser = useCallback(async () => {
    const id = ++request.current;
    try {
      setError(null);
      const next = await Auth.getUserInfo();
      if (id === request.current) setUser(next);
    } catch (error) {
      if (id === request.current) {
        setUser(null);
        setError(error instanceof Error ? error : new Error("تعذر التحقق من الجلسة."));
      }
    } finally { if (id === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const unsubscribe = Auth.subscribeAuth(next => {
      request.current++;
      // Cancel in-flight previous-user requests before dropping their cached results.
      void queryClient.cancelQueries();
      queryClient.clear();
      setUser(next);
      setLoading(false);
    });
    if (autoFetch) void fetchUser();
    const timer = autoFetch ? setInterval(() => { void fetchUser(); }, 30_000) : undefined;
    const active = AppState.addEventListener("change", state => {
      if (state === "active" && autoFetch) void fetchUser();
    });
    return () => { request.current++; unsubscribe(); clearInterval(timer); active.remove(); };
  }, [autoFetch, fetchUser, queryClient]);
  const logout = useCallback(async () => {
    setError(null);
    try { await Auth.logout(); }
    catch (error) {
      setError(error instanceof Error ? error : new Error("تعذر إلغاء الجلسة على الخادم."));
      throw error;
    }
  }, []);
  return { user, loading, error, isAuthenticated: Boolean(user), refresh: fetchUser, logout };
}