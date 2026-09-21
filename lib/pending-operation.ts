import AsyncStorage from "@react-native-async-storage/async-storage";

// Persist before sending; an uncertain response must replay the same payload/key.
const running = new Set<string>();
export async function pendingOperation<T extends object, R>(
  userId: number, operation: string, input: T,
  send: (input: T & { idempotencyKey: string }) => Promise<R>,
): Promise<R> {
  const storageKey = `wasalny.pending.${userId}.${operation}`;
  if (running.has(storageKey)) throw new Error("العملية قيد التنفيذ");
  running.add(storageKey);
  try {
    const stored = await AsyncStorage.getItem(storageKey);
    const payload: T & { idempotencyKey: string } = stored ? JSON.parse(stored) : {
      ...input, idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}-${operation}`,
    };
    if (!stored) await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
    let result: R;
    try { result = await send(payload); }
    catch (error) {
      // Only explicit precondition/validation denials are safe to replace.
      // Network failures, timeouts and server failures retain the original intent.
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (code && ["BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "UNPROCESSABLE_CONTENT"].includes(code)) {
        await AsyncStorage.removeItem(storageKey);
      } else if (!code || ["TIMEOUT", "INTERNAL_SERVER_ERROR", "BAD_GATEWAY", "SERVICE_UNAVAILABLE", "GATEWAY_TIMEOUT"].includes(code)) {
        throw new Error(`${error instanceof Error ? error.message : "تعذر تأكيد العملية"}. أعد المحاولة لإرسال نفس الطلب المحفوظ دون تكراره.`);
      }
      throw error;
    }
    await AsyncStorage.removeItem(storageKey);
    return result;
  } finally {
    running.delete(storageKey);
  }
}