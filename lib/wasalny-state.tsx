import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type SubscriptionStatus = "unpaid" | "pending" | "approved" | "rejected";

type WasalnyState = {
  subscriptionStatus: SubscriptionStatus;
  driverOnline: boolean;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  toggleDriverOnline: () => void;
};

const WasalnyContext = createContext<WasalnyState | null>(null);

export function WasalnyStateProvider({ children }: { children: ReactNode }) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("pending");
  const [driverOnline, setDriverOnline] = useState(false);
  const value = useMemo(() => ({ subscriptionStatus, driverOnline, setSubscriptionStatus, toggleDriverOnline: () => {
    if (subscriptionStatus === "approved") setDriverOnline((current) => !current);
  }}), [subscriptionStatus, driverOnline]);
  return <WasalnyContext.Provider value={value}>{children}</WasalnyContext.Provider>;
}

export function useWasalnyState() {
  const value = useContext(WasalnyContext);
  if (!value) throw new Error("useWasalnyState must be used inside WasalnyStateProvider");
  return value;
}
