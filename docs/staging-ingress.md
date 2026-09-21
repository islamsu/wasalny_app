# Staging ingress verification — 21 September 2026

## Scope and evidence

This policy applies only to the current Replit workspace preview, not arbitrary
deployments. The canonical origin is taken from the runtime's
`REPLIT_DEV_DOMAIN`, confirmed by HTTPS requests reaching a temporary,
sanitized measurement endpoint in this application. That endpoint was removed.
No published origin was inferred from the development hostname.

Observed through the live edge:

- The immediate application socket peer was loopback.
- Host matched the exact canonical workspace hostname.
- Normal and attacker-supplied HTTP/duplicate proto values reached the
  application as one `X-Forwarded-Proto: https`.
- Injected client-address values were removed; XFF had three entries.
  We do **not** infer a stable client-IP trust chain from that observation.
- Injected `Forwarded` and `X-Forwarded-Host` were removed.
- Injected `X-Forwarded-Port: 80` survived. It is explicitly rejected.
- A plaintext request to the public hostname could not connect; this alone
  does not prove a platform-wide HTTP redirect/rejection guarantee.

These are empirical staging observations, not an official immutable platform
contract. Re-check them when ingress topology or hostname changes.

## Application policy

`WASALNY_STAGING_INGRESS_ORIGIN` explicitly opts into this contract and must
equal `https://REPLIT_DEV_DOMAIN` exactly. Express `trust proxy` stays false;
legacy numeric hop configuration fails startup rather than enabling trust.

Only `/wasalny-api` uses the ingress verifier. It requires the exact Host, one
exact HTTPS proto header, and an immediate loopback peer. Duplicate/malformed
or unsupported forwarding headers fail closed. Successful verification marks
the request privately in-process; the authentication transport check and cookie
helper consume that marker, not arbitrary forwarded headers. Direct API-app
requests cannot manufacture it using headers.

**Trust assumption:** processes within this workspace/container are trusted.
An attacker executing local code already shares the application's credential
boundary; this is not isolation from malicious co-resident processes.

Rate limiting deliberately uses the socket peer, not XFF. Staging users share
the proxy's per-process 30-auth-requests/minute budget. This is conservative,
can cause aggregate throttling, and is not suitable proof of production
per-client or multi-replica rate limiting. A separately reviewed edge/shared
limiter is required before production scaling.

## Executed checks

- Sixteen focused ingress tests: configuration, exact host/proto, duplicates,
  unsupported headers, untrusted peers, direct-app forgery, cookie security,
  rate-limit spoof resistance, and legacy-hop rejection.
- Nine live checks passed: health; anonymous HTTPS auth; exact browser origin;
  malicious-origin rejection; edge proto rewriting; XFF not authenticating;
  surviving forwarded-port rejection; private-file denial; probe removal.
- Complete offline suite: **293 passed, 0 failed, 3 skipped**.
- TypeScript, backend build and two launcher isolation checks passed.
- Browser preflight rendered the existing login UI and opened Google's genuine
  account-entry popup. No credentials, SMS, custom tokens, fake users, or
  authenticated sessions were used or created.

## Firebase and remaining human boundary

The existing service account could read and update Firebase Authentication
configuration. Only the exact canonical workspace hostname was appended to
`authorizedDomains`; existing entries were preserved and the update was
independently reread. No Firebase Console action is currently needed.

Read-only provider inventory still showed zero users. A human must complete
Google account selection/consent or phone verification. Enrollment remains
closed until the particular verified tester UID is explicitly allowlisted.
The narrow enrollment option only creates a normal family account, never
driver/admin privileges. No allowlist entries have been configured.

Real exchange, refresh/replay/logout, two-account ownership/IDOR, approved-driver
dispatch and authenticated ride transitions are **NOT EXECUTED**. Driver/admin
approval remains a separate controlled process. Android signing and real-device
verification remain **DEFERRED**. Production readiness stays **48/100 — NO-GO**.