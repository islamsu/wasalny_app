# Launching the existing Wasalny app

The workspace artifact **Wasalny — Live App** runs the existing Expo web
application from this repository. It does not render the design mockups or a
newly written replacement UI.

## In this workspace

Open **Wasalny — Live App** in Preview. Its managed workflow is
`artifacts/wasalny-web: web`. The root page is the real home screen, and `/login`
is the existing Google/Phone login screen. The canvas and shared starter API
remain separate and unchanged.

Restart the workflow after changing application source. Startup exports the
current Expo web app, then makes that export available. During an initial build,
the server returns an explicit 503 warming response rather than a mock app.
This is a static export, not hot-module replacement.

## Launch mechanics

- The adapter invokes `scripts/workspace-preview.mjs` using the standalone
  application's installed dependencies.
- The frontend build receives an explicit public configuration allowlist.
  Firebase Admin credentials, session-signing keys and the MySQL URL are not
  passed to the build process.
- The verified Firebase Web key can be supplied as
  `EXPO_PUBLIC_FIREBASE_API_KEY`, or through the existing `GOOGLE_API_KEY` alias.
  This alias is for the Firebase browser key, never a service-account credential.
- Export output is scanned for server credentials before becoming available.
  `.workspace-web` and `.workspace-web-next` are ignored generated directories.
- The real backend is mounted at `/wasalny-api`; its health path is
  `/wasalny-api/api/health`. Client auth and tRPC calls use the same namespace
  so they cannot accidentally hit the workspace's separate `/api` starter.
- The server binds the workflow's `PORT` exactly. Unknown backend routes and
  missing assets return 404, not an HTML fallback. Source files, environment
  files, dotfiles and source maps are not served.
- Standalone scripts are `preview:workspace`, `build:workspace-web`, and
  `serve:workspace-web`. Configure a port and the public Firebase variables
  before launching outside this workspace.

## Deliberate security boundary

This is a **visual workspace preview**, not proof of production readiness or a
successful login. No fixture users, rides, role promotions, registration flags,
HTTP auth allowances, or trusted-proxy hop counts were introduced.

The current preview's protected requests return `HTTPS_REQUIRED`: the external
HTTPS connection terminates before Express, and the trusted forwarding policy
has not yet been established. Firebase's authorized-domain list also does not
yet include this workspace origin. Resolve these explicitly before real login;
do not disable HTTPS enforcement or trust arbitrary forwarding headers just to
remove the error. Successful browser login, session refresh/logout, and real
authenticated ride/IDOR checks are still unexecuted.

The application can now be visually inspected without claiming those security
gates passed. Android signing and physical-device checks remain deferred.