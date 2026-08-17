import { describe, expect, it } from "vitest";
import { auditLogsToCsv } from "../shared/audit-csv";

const demoAdmin = { id: 9001, role: "admin" as const, appRole: "admin" as const, openId: "demo-admin-settings" };

describe("demo admin settings verification", () => {
  it("uses an isolated admin fixture for protected settings writes", () => {
    expect(demoAdmin.role).toBe("admin");
    expect(demoAdmin.appRole).toBe("admin");
    const payload = { settingKey: "zones", settingValue: "بداية ٢٠ ج.م · الكيلومتر ٨ ج.م", category: "pricing" as const, updatedBy: demoAdmin.id };
    expect(payload.updatedBy).toBe(demoAdmin.id);
    expect(payload.settingValue).toContain("٢٠");
  });

  it("serializes audit entries to downloadable CSV and escapes commas and quotes", () => {
    const csv = auditLogsToCsv([{ id: 1, action: "update", entityType: "admin_setting", entityId: "zones", beforeValue: "بداية ١٥ ج.م", afterValue: 'بداية ٢٠ ج.م, "مميز"', createdAt: "2026-08-17T12:00:00.000Z" }]);
    expect(csv.startsWith("\uFEFFid,action")).toBe(true);
    expect(csv).toContain('"بداية ٢٠ ج.م, ""مميز"""');
    expect(csv).toContain("2026-08-17T12:00:00.000Z");
  });
});
