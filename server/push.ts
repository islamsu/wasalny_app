import { getPushTokens, recordNotificationEvent } from "./db";

type PushPayload = { title: string; body: string; data?: Record<string, unknown> };

export async function sendPushToUser(userId: number, payload: PushPayload) {
  const tokens = await getPushTokens(userId);
  if (!tokens.length) return { sent: 0, tickets: [] };
  const messages = tokens.map((token) => ({ to: token.token, sound: "default", title: payload.title, body: payload.body, data: payload.data ?? {} }));
  const response = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { Accept: "application/json", "Accept-encoding": "gzip, deflate", "Content-Type": "application/json" }, body: JSON.stringify(messages) });
  if (!response.ok) throw new Error(`Expo Push Service returned ${response.status}`);
  const result = await response.json() as { data?: unknown[] };
  return { sent: messages.length, tickets: result.data ?? [] };
}

export async function sendPushToUserOnce(userId: number, eventKey: string, eventType: string, payload: PushPayload) {
  const tokens = await getPushTokens(userId);
  if (!tokens.length) return { sent: 0, tickets: [], deduplicated: false };
  const recorded = await recordNotificationEvent({ userId, eventKey, eventType, title: payload.title, body: payload.body, data: payload.data });
  if (!recorded) return { sent: 0, tickets: [], deduplicated: true };
  return { ...(await sendPushToUser(userId, payload)), deduplicated: false };
}
