import { test } from "node:test";
import assert from "node:assert/strict";
import { webBuildEnvironment } from "./workspace-preview.mjs";

test("browser build receives only public Firebase configuration, not server secrets", () => {
  const result = webBuildEnvironment({
    PATH: "/bin", GOOGLE_API_KEY: "public-web-key",
    FIREBASE_SERVICE_ACCOUNT_JSON: "server-only",
    WASALNY_SESSION_SIGNING_KEY: "server-only",
    WASALNY_DATABASE_URL: "server-only",
    EXPO_PUBLIC_OWNER_OPEN_ID: "must-not-leak",
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: "staging",
  });
  assert.equal(result.EXPO_PUBLIC_FIREBASE_API_KEY, "public-web-key");
  assert.equal(result.EXPO_PUBLIC_FIREBASE_PROJECT_ID, "staging");
  assert.equal(result.EXPO_PUBLIC_API_BASE_URL, "/wasalny-api");
  for (const key of ["FIREBASE_SERVICE_ACCOUNT_JSON", "WASALNY_SESSION_SIGNING_KEY", "WASALNY_DATABASE_URL", "GOOGLE_API_KEY", "EXPO_PUBLIC_OWNER_OPEN_ID"]) {
    assert.equal(key in result, false);
  }
});

test("explicit Firebase browser key takes precedence", () => {
  assert.equal(webBuildEnvironment({
    EXPO_PUBLIC_FIREBASE_API_KEY: "explicit-public", GOOGLE_API_KEY: "other",
  }).EXPO_PUBLIC_FIREBASE_API_KEY, "explicit-public");
});