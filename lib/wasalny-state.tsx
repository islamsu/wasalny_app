import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpc } from "@/lib/trpc";
import { subscribeAuth } from "@/lib/_core/auth";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAppRole, type AppRole } from "@/lib/role-routing";

export type UserRole = AppRole;
export type DriverAccountStatus = "active" | "frozen" | "suspended" | "pending";
type SubscriptionStatus = "unpaid" | "pending" | "approved" | "rejected";
const FONT_SCALE_KEY = "wasalny.fontScale";

type WasalnyState = {
  currentUser: { role: UserRole; name: string } | null;
  subscriptionStatus: SubscriptionStatus;
  driverOnline: boolean;
  driverAccountStatus: DriverAccountStatus;
  fontScale: number;
  login: (role: UserRole, name?: string) => void;
  logout: () => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  setFontScale: (scale: number) => void;
  setDriverAccountStatus: (status: DriverAccountStatus) => void;
  toggleDriverOnline: () => void;
};

const WasalnyContext = createContext<WasalnyState | null>(null);

export function WasalnyStateProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(() => subscribeAuth(() => { queryClient.clear(); }), [queryClient]);
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const currentUser = me.data && isAppRole(me.data.appRole)
    ? { role: me.data.appRole, name: me.data.name ?? "" }
    : null;
  const onboarding = trpc.profile.onboarding.useQuery(undefined, { enabled: me.data?.appRole === "driver", retry: false, refetchInterval: 15_000 });
  const subscriptionStatus: SubscriptionStatus = onboarding.data?.profile?.subscriptionStatus ?? "unpaid";
  const driverOnline = onboarding.data?.profile?.isOnline ?? false;
  const driverAccountStatus: DriverAccountStatus = onboarding.data?.profile?.accountStatus ?? "pending";
  const setSubscriptionStatus = (_status: SubscriptionStatus) => { void onboarding.refetch(); };
  const setDriverAccountStatus = (_status: DriverAccountStatus) => { void onboarding.refetch(); };
  const [fontScale, setFontScaleState] = useState(1);

  useEffect(() => { AsyncStorage.getItem(FONT_SCALE_KEY).then((stored) => { const parsed = stored ? Number(stored) : 1; if ([1, 1.12, 1.25].includes(parsed)) setFontScaleState(parsed); }).catch(() => undefined); }, []);
  const setFontScale = (scale: number) => { const normalized = [1, 1.12, 1.25].includes(scale) ? scale : 1; setFontScaleState(normalized); AsyncStorage.setItem(FONT_SCALE_KEY, String(normalized)).catch(() => undefined); };
  const login = (_role: UserRole, _name?: string) => { void me.refetch(); };
  const logout = () => { void me.refetch(); };
  const toggleDriverOnline = () => { void onboarding.refetch(); };
  const value = useMemo(() => ({ currentUser, subscriptionStatus, driverOnline, driverAccountStatus, fontScale, login, logout, setSubscriptionStatus, setFontScale, setDriverAccountStatus, toggleDriverOnline }), [currentUser, subscriptionStatus, driverOnline, driverAccountStatus, fontScale]);
  return <WasalnyContext.Provider value={value}>{children}</WasalnyContext.Provider>;
}
export function useWasalnyState() { const value = useContext(WasalnyContext); if (!value) throw new Error("useWasalnyState must be used inside WasalnyStateProvider"); return value; }
