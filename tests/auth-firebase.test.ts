// Firebase Admin mocked: verifies calls/claim policy, not live staging identity.
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verifyIdToken: vi.fn(), getUser: vi.fn(), initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/app", () => ({
  getApps: () => [], cert: mocks.cert, initializeApp: mocks.initializeApp,
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => mocks }));
import { assertFirebaseIdentity, verifyFirebase } from "../server/auth/firebase";
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FIREBASE_PROJECT_ID", "unit-project");
  vi.stubEnv("WASALNY_SESSION_SIGNING_KEY", "ab".repeat(32));
  // Nonfunctional test fixture; cert() is mocked, never a real private key.
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", JSON.stringify({
    type: "service_account", project_id: "unit-project",
    client_email: "unit@unit-project.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nUNIT_TEST_NOT_A_KEY\n-----END PRIVATE KEY-----",
  }));
  vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
  mocks.verifyIdToken.mockReset().mockResolvedValue({ uid: "unit-uid", sub: "unit-uid", iss: "https://securetoken.google.com/unit-project", aud: "unit-project", auth_time: Math.floor(Date.now()/1000) });
  mocks.getUser.mockReset().mockResolvedValue({ disabled: false, tokensValidAfterTime: new Date(0).toISOString() });
  mocks.initializeApp.mockClear();
  mocks.cert.mockReset().mockReturnValue({ mockedCertificate: true });
});
it("requests actual Admin revocation checking with explicit project", async () => {
  await verifyFirebase("opaque-fixture-id-token");
  expect(mocks.verifyIdToken).toHaveBeenCalledWith("opaque-fixture-id-token", true);
  expect(mocks.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: "unit-project" }), "wasalny-unit-project");
  expect(mocks.cert).toHaveBeenCalledWith(expect.objectContaining({ projectId: "unit-project", clientEmail: "unit@unit-project.iam.gserviceaccount.com" }));
});
it("requires explicit credential provisioning", async () => {
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", "");
  vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "/not-used/no-implicit-adc.json");
  await expect(verifyFirebase("fixture")).rejects.toMatchObject({ code: "FIREBASE_CREDENTIALS_REQUIRED", status: 503 });
  expect(mocks.verifyIdToken).not.toHaveBeenCalled();
});
it.each([
  "malformed SECRET credential",
  JSON.stringify({ type: "service_account", project_id: "wrong-project", client_email: "x@wrong-project.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----invalid" }),
  JSON.stringify({ type: "authorized_user", project_id: "unit-project" }),
  JSON.stringify({ type: "service_account", project_id: "unit-project" }),
])("rejects invalid credential configuration without SDK verification or output", async raw => {
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", raw);
  await expect(verifyFirebase("fixture")).rejects.toMatchObject({ message: "FIREBASE_CREDENTIALS_INVALID", status: 503 });
  expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  expect(mocks.initializeApp).not.toHaveBeenCalled();
});
it("sanitizes certificate parsing failures", async () => {
  mocks.cert.mockImplementation(() => { throw new Error("SECRET key content"); });
  await expect(verifyFirebase("fixture")).rejects.toThrow(/^FIREBASE_CREDENTIALS_INVALID$/);
});
it.each([
  { iss: "https://securetoken.google.com/other-project" }, { aud: "other-project" },
  { sub: "different" }, { auth_time: undefined }, { auth_time: Date.now()/1000 + 3600 },
])("rejects provider boundary mismatch %j", async patch => {
  mocks.verifyIdToken.mockResolvedValue({ uid: "unit-uid", sub: "unit-uid", iss: "https://securetoken.google.com/unit-project", aud: "unit-project", auth_time: Date.now()/1000, ...patch });
  await expect(verifyFirebase("fixture")).rejects.toThrow("FIREBASE_TOKEN_REJECTED");
});
it.each([
  { disabled: true, tokensValidAfterTime: new Date(0).toISOString() },
  { disabled: false, tokensValidAfterTime: new Date(Date.now()+50000).toISOString() },
  { disabled: false },
])("fails closed for identity disabled/revoked/unknown validity %j", async user => {
  mocks.getUser.mockResolvedValue(user);
  await expect(assertFirebaseIdentity("https://securetoken.google.com/unit-project", "unit-uid", new Date())).rejects.toThrow("IDENTITY_REJECTED");
});
it("does not leak Firebase SDK errors or tokens", async () => {
  mocks.verifyIdToken.mockRejectedValue(new Error("SECRET fixture token"));
  await expect(verifyFirebase("SECRET")).rejects.toMatchObject({ message: "FIREBASE_SERVICE_UNAVAILABLE", status: 503 });
});
it.each(["auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token", "auth/user-disabled"])("keeps explicit provider denials unauthorized: %s", async code => {
  mocks.verifyIdToken.mockRejectedValue({ code, message: "SECRET" });
  await expect(verifyFirebase("SECRET")).rejects.toMatchObject({ message: "FIREBASE_TOKEN_REJECTED", status: 401 });
});
it.each(["auth/internal-error", "app/network-error", "auth/insufficient-permission"])("preserves provider infrastructure failures: %s", async code => {
  mocks.getUser.mockRejectedValue({ code, message: "SECRET" });
  await expect(assertFirebaseIdentity("https://securetoken.google.com/unit-project", "unit-uid", new Date()))
    .rejects.toMatchObject({ message: "FIREBASE_SERVICE_UNAVAILABLE", status: 503 });
});