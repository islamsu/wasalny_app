import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type SubscriptionStatus = "unpaid" | "pending" | "approved" | "rejected";

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
  const [fontScale, setFontScale] = useState(1);
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
