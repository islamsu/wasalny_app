export type AuditCsvEntry = {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: Date | string;
};

function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[\",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function auditLogsToCsv(entries: AuditCsvEntry[]) {
  const headers = ["id", "action", "entity_type", "entity_id", "before_value", "after_value", "created_at"];
  const rows = entries.map((entry) => [entry.id, entry.action, entry.entityType, entry.entityId, entry.beforeValue, entry.afterValue, new Date(entry.createdAt).toISOString()].map(escapeCsv).join(","));
  return `\uFEFF${headers.join(",")}\n${rows.join("\n")}\n`;
}
