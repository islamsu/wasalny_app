import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SubscriptionStatus = "unpaid" | "pending" | "approved" | "rejected";
const FONT_SCALE_KEY = "wasalny.fontScale";

type WasalnyState = {
  subscriptionStatus: SubscriptionStatus;
  driverOnline: boolean;
  fontScale: number;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  setFontScale: (scale: number) => void;
  toggleDriverOnline: () => void;
};

const WasalnyContext = createContext<WasalnyState | null>(null);

export function WasalnyStateProvider({ children }: { children: ReactNode }) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("pending");
  const [driverOnline, setDriverOnline] = useState(false);
  const [fontScale, setFontScaleState] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem(FONT_SCALE_KEY).then((stored) => {
      const parsed = stored ? Number(stored) : 1;
      if ([1, 1.12, 1.25].includes(parsed)) setFontScaleState(parsed);
    }).catch(() => undefined);
  }, []);

  const setFontScale = (scale: number) => {
    const normalized = [1, 1.12, 1.25].includes(scale) ? scale : 1;
    setFontScaleState(normalized);
    AsyncStorage.setItem(FONT_SCALE_KEY, String(normalized)).catch(() => undefined);
  };

  const value = useMemo(() => ({ subscriptionStatus, driverOnline, fontScale, setSubscriptionStatus, setFontScale, toggleDriverOnline: () => {
    if (subscriptionStatus === "approved") setDriverOnline((current) => !current);
  }}), [subscriptionStatus, driverOnline, fontScale]);
  return <WasalnyContext.Provider value={value}>{children}</WasalnyContext.Provider>;
}

export function useWasalnyState() {
  const value = useContext(WasalnyContext);
  if (!value) throw new Error("useWasalnyState must be used inside WasalnyStateProvider");
  return value;
}
