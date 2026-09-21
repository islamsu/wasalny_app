/** Dates are supplied evidence, never upload-time-derived legal periods. */
export const EXPIRING_DOCUMENT_TYPES = ["id", "license", "vehicle"] as const;

export function validInterval(start: Date | null | undefined, end: Date | null | undefined, now = new Date()): boolean {
  return !!start && !!end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
    && start.getTime() <= now.getTime() && end.getTime() > now.getTime() && start < end;
}

export function documentIsCurrent(document: { documentType: string; validFrom?: Date | null; expiresAt?: Date | null }, now = new Date()): boolean {
  if (document.validFrom && (!Number.isFinite(document.validFrom.getTime()) || document.validFrom > now)) return false;
  if (document.expiresAt && (!Number.isFinite(document.expiresAt.getTime()) || document.expiresAt <= now)) return false;
  if (document.validFrom && document.expiresAt && document.validFrom >= document.expiresAt) return false;
  return !(EXPIRING_DOCUMENT_TYPES as readonly string[]).includes(document.documentType) || !!document.expiresAt;
}