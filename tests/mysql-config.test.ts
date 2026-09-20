import { afterEach, expect, it, vi } from "vitest";
import { mysqlConnectionOptions } from "../server/_core/mysql-config";

afterEach(() => vi.unstubAllEnvs());

it("requires the explicit MySQL variable instead of the generic database URL", () => {
  vi.stubEnv("WASALNY_DATABASE_URL", "");
  vi.stubEnv("DATABASE_URL", "postgresql://unused/unused");
  expect(() => mysqlConnectionOptions()).toThrow("WASALNY_DATABASE_URL is required");
});

it("translates REQUIRED into verified TLS and decodes credentials", () => {
  vi.stubEnv("WASALNY_DATABASE_URL", "mysql://test:p%40ss@example.invalid:12030/staging?ssl-mode=REQUIRED");
  vi.stubEnv("WASALNY_DATABASE_CA_PATH", "");
  const options = mysqlConnectionOptions();
  expect(options.ssl).toEqual({ rejectUnauthorized: true });
  expect(options.password).toBe("p@ss");
  expect(options.database).toBe("staging");
  expect(options.port).toBe(12030);
});

it.each([
  "postgresql://example.invalid/test",
  "mysql://example.invalid/test?ssl-mode=DISABLED",
  "mysql://example.invalid/test?ssl=false",
])("rejects unsafe or unsupported configuration", (url) => {
  vi.stubEnv("WASALNY_DATABASE_URL", url);
  expect(() => mysqlConnectionOptions()).toThrow();
});