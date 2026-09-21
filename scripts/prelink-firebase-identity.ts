/**
 * Controlled staging identity migration, NOT an admin bootstrap.
 *
 * Run by an authorized operator only, after independent proof that the Firebase
 * UID and existing numeric Wasalny user ID belong to the same person. Email
 * equality is NOT proof. Record the approval ticket in --reason. Dry-run first;
 * rerun with --apply only after a second operator approves the exact mapping.
 *
 * Required: WASALNY_AUTH_MAINTENANCE=staging, WASALNY_STAGING_DATABASE_HOST,
 * WASALNY_STAGING_DATABASE_NAME (independently confirmed allowlist), Firebase
 * FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON secret and session key
 * configuration. Uses only WASALNY_DATABASE_URL. Credentials stay in memory.
 * Never executed by server startup, migrations, or deployment hooks.
 *
 * args: --user-id N --firebase-uid UID --actor-id N --reason TICKET [--apply]
 * Audit actor must already be an active admin; this tool creates NO users and
 * grants NO privileges. Initial admin bootstrap deliberately remains unavailable
 * until an approved external operator identity/audit sink and verified MFA are
 * provisioned. There is no first-login, owner-email, or environment-owner grant.
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { authConfig } from "../server/auth/config";
import { assertFirebaseIdentity } from "../server/auth/firebase";
import { transaction, rows, write } from "../server/auth/repository";

export async function prelink(args: string[]) {
  const { values } = parseArgs({ args, options: {
    "user-id": { type: "string" }, "firebase-uid": { type: "string" },
    "actor-id": { type: "string" }, reason: { type: "string" }, apply: { type: "boolean", default: false },
  }, strict: true });
  if (process.env.WASALNY_AUTH_MAINTENANCE !== "staging" || process.env.NODE_ENV === "production") throw new Error("STAGING_MAINTENANCE_REQUIRED");
  const url = new URL(process.env.WASALNY_DATABASE_URL ?? "");
  if (!process.env.WASALNY_STAGING_DATABASE_HOST || !process.env.WASALNY_STAGING_DATABASE_NAME ||
    url.protocol !== "mysql:" || url.hostname !== process.env.WASALNY_STAGING_DATABASE_HOST ||
    decodeURIComponent(url.pathname.slice(1)) !== process.env.WASALNY_STAGING_DATABASE_NAME) throw new Error("STAGING_DATABASE_ALLOWLIST_REQUIRED");
  const userId = Number(values["user-id"]), actorId = Number(values["actor-id"]);
  const uid = values["firebase-uid"], reason = values.reason;
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(actorId) || actorId <= 0 ||
    !uid || Buffer.byteLength(uid) > 255 || !reason || reason.length < 8 || reason.length > 500) throw new Error("EXPLICIT_MAPPING_AND_APPROVAL_REQUIRED");
  const issuer = `https://securetoken.google.com/${authConfig().projectId}`;
  await assertFirebaseIdentity(issuer, uid, new Date());
  return transaction(async c => {
    // Lock in stable numeric order to avoid opposing operator deadlocks.
    const people = await rows(c, "SELECT * FROM users WHERE id IN (?,?) ORDER BY id FOR UPDATE", [userId, actorId]);
    const user = people.find(u => u.id === userId), actor = people.find(u => u.id === actorId);
    if (!user || user.userStatus !== "active" || actor?.appRole !== "admin" || actor.userStatus !== "active") throw new Error("EXISTING_ACTIVE_USER_AND_ADMIN_REQUIRED");
    const mappings = await rows(c, "SELECT * FROM authIdentities WHERE (issuer=? AND subject=?) OR userId=? FOR UPDATE", [Buffer.from(issuer), Buffer.from(uid), userId]);
    if (mappings.length) throw new Error("IDENTITY_ALREADY_LINKED_REVIEW_REQUIRED");
    if (!values.apply) return { dryRun: true, userId, actorId, projectId: authConfig().projectId };
    const linked = await write(c, "INSERT INTO authIdentities (userId,issuer,subject) VALUES (?,?,?)", [userId, Buffer.from(issuer), Buffer.from(uid)]);
    await write(c, "INSERT INTO auditLogs (actorUserId,action,entityType,entityId,beforeValue,afterValue,metadata) VALUES (?,'firebase_identity_prelinked','authIdentity',?,NULL,?,?)",
      [actorId, String(linked.insertId), JSON.stringify({ userId, issuer, subject: uid }), JSON.stringify({ reason, channel: "controlled_staging_cli" })]);
    return { dryRun: false, userId, identityId: linked.insertId };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prelink(process.argv.slice(2)).then(result => { console.log(JSON.stringify(result)); process.exit(0); })
    .catch(() => { console.error("Identity prelink failed; verify staging configuration, approval and mapping. No credentials logged."); process.exit(1); });
}