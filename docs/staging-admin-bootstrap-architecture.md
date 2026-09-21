# Staging identity and first-admin bootstrap architecture

## Current boundary

This document is an architecture and approval checklist, **not evidence of a
bootstrap, administrator promotion, verified MFA, live Firebase login, or Android
signing verification**. No bootstrap endpoint or automatic promotion exists.
Sensitive administrator mutations remain fail-closed. The prelink CLI creates
identity mappings only; it cannot create users or grant roles and requires an
existing active administrator as its audit actor. It cannot bootstrap the first
administrator.

## Canonical staging configuration

- `FIREBASE_PROJECT_ID`: explicit nonsecret staging project ID.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: complete service-account JSON in the server's
  secret store. Its `project_id` must exactly equal `FIREBASE_PROJECT_ID`.
  The server calls Firebase Admin `cert()` in memory; it never writes a key file,
  logs credentials, uses client configuration as Admin credentials, or silently
  falls back to ADC / `GOOGLE_APPLICATION_CREDENTIALS`.
- `WASALNY_SESSION_SIGNING_KEY`: separate cryptographically generated hex key of
  at least 32 bytes. Never reuse a Firebase private key or legacy session secret.
- Existing `WASALNY_DATABASE_URL` and verified-TLS CA configuration: staging
  MySQL only. Never the generic runtime database variable.
- `WASALNY_ALLOWED_ORIGINS`: exact approved browser origins;
  `WASALNY_TRUST_PROXY_HOPS`: explicit ingress topology only after confirming
  ingress strips untrusted forwarding headers. HTTPS remains mandatory.
- `WASALNY_AUTH_ALLOW_NEW_USERS`: closed unless explicitly `true`. Prelink
  existing accounts before opening registration, avoiding duplicate accounts.

Restart the controlled deployment after credential rotation; the Firebase Admin
app caches its initialized credential. No actual values are provided here.
Deploy a shared edge rate limiter before horizontal scaling; the application's
30-auth-requests/minute/IP limiter is per process.

Authentication failures and infrastructure failures are distinct. Invalid,
expired or revoked credentials return unauthorized; blocked users are forbidden.
Missing configuration, provider network/permission failures and database outages
return sanitized service-unavailable errors through both REST and tRPC. They
never silently create an anonymous principal or expose underlying SDK/SQL errors.

## Proposed controlled first-admin ceremony (not implemented)

1. **Approve a bounded staging change.** Two independent authorized operators
   approve a ticket identifying the staging Firebase project, exact MySQL
   host/database, existing Wasalny numeric user ID, exact Firebase issuer/UID,
   intended `appRole` transition, expiry and a unique one-use approval ID.
   The execution identity and approver identities must be independently
   authenticated via the organization's IAM with enforced MFA, not supplied as
   unverified CLI text or inferred from email.
2. **Establish identity without privilege.** Verify the candidate's Firebase ID
   token using Admin with revocation checking and a second-factor sign-in claim
   from the verified provider token. Require `auth_time` within five minutes;
   reject enrolled-but-not-used MFA, client-supplied flags, disabled identities,
   wrong projects and emulators. Independently verify ownership of the existing
   numeric Wasalny account; email equality is never an identity-linking rule.
   An absent or conflicting identity mapping requires its own reviewed migration.
3. **Use a separate one-shot operator job.** No HTTP endpoint, startup hook,
   owner-email allowlist, default account, environment-admin grant, or public
   registration branch may execute this operation. Use a narrowly scoped,
   short-lived database credential and approved staging target allowlist.
   The job must validate signed, unexpired approval evidence and acquire a
   dedicated bootstrap lock plus the candidate user/identity rows.
4. **Perform an atomic, narrowly scoped transition.** Under the lock, verify
   there is no existing active application administrator, the candidate is
   active, the exact issuer/subject maps to that numeric ID, and the approval
   has not been consumed. Update only the approved application role; keep user
   IDs, business foreign keys, and unrelated legacy fields intact. Revoke all
   candidate sessions and require a fresh MFA sign-in afterwards. If the
   verified conditions change, abort rather than choose a different user.
5. **Audit before acknowledging success.** Persist before/after application
   role, exact target IDs, approval ID, independently verified operator and
   approver identities, provider MFA/auth-time evidence (never bearer tokens),
   execution ID, staging target fingerprint and timestamp. Use an append-only
   external audit sink for the operator identity because the existing
   `auditLogs.actorUserId` identifies an application user, not an external
   bootstrap operator. A dedicated bootstrap ledger / outbox with a unique
   approval ID and transactionally recorded outcome is required before this
   job can be implemented; schema work needs separate review. Do not invent an
   application actor or use a fabricated user ID to satisfy the current schema.
6. **Close the ceremony.** Independently verify exactly one approved transition,
   old-session rejection, the durable audit receipt and approval consumption.
   Revoke the one-shot job credential and disable its deployment permission.
   Any rollback must be an independently approved, audited role removal with
   session revocation, not restoration of old privileged sessions.

## Required evidence before enabling sensitive administrator mutations

Real staging provider MFA must be supported and tested: Admin-verified second
factor sign-in, recent provider authentication, immutable session MFA context,
current DB role/status, disabled/revoked provider identity, stale-session denial,
step-up failure and successful refresh without extension of authentication
freshness. Bootstrap approval does not waive these runtime checks.

Run a staging-only concurrent rehearsal of the proposed job against authorized
test accounts after explicit approval, including replayed approval, two competing
operators, rollback, unavailable audit sink and wrong-target rejection. None of
these rehearsals or real promotions have been performed by this implementation.
SHA1/SHA256 configuration and real Android authentication remain **DEFERRED
DEVICE/SIGNING VERIFICATION**.