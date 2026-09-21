import { describe, expect, it } from "vitest";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import { mysqlConnectionOptions } from "../server/_core/mysql-config";
import { durableCommand } from "../server/business-transactions";
import { createRide, createCarOffer, selectCarOffer } from "../server/db";
import { REQUIRED_DRIVER_DOCUMENTS } from "../server/_core/authorization";

// Parent executes only after security review + complete offline suite.
// Real DB-only evidence, NOT Firebase login/session/identity evidence.
// No manually provisioned user fixture gate. Dedicated generated business rows
// are committed so separate connections can see them, then exact-owned cleanup.
const enabled = process.env.WASALNY_APPROVED_BUSINESS_LOCK_TEST === "1";
describe.skipIf(!enabled)("staging MySQL business concurrency, real distinct connections", () => {
  it("enforces durable replay and competing assignments, then removes all owned fixtures", async () => {
    const options = mysqlConnectionOptions();
    if (options.host !== "mysql-3bbd4c03-wasalnyproject.h.aivencloud.com" || options.port !== 12030 || options.database !== "wasalny_staging" || options.ssl.rejectUnauthorized !== true) throw new Error("Non-approved target or unverified TLS");
    const connections: Connection[] = [];
    const owner = `dbtest-${randomUUID()}`;
    const userIds: number[] = [];
    let inventory: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const connection = await mysql.createConnection(options);
        connections.push(connection);
        const [tls] = await connection.query<RowDataPacket[]>("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
        expect(tls[0]?.Value).toBeTruthy();
        await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");
        await connection.query("SET SESSION innodb_lock_wait_timeout = 5");
      }
      const [setup, first, second] = connections;
      // Quiescent staging only: no provider bootstrap can create an unrelated
      // caller while fixture drivers are briefly online (selection requires it).
      if (process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Quiescent no-provider staging required");
      const [mutex] = await setup.query<RowDataPacket[]>("SELECT GET_LOCK('wasalny_staging_business_tests', 0) AS acquired");
      if (Number(mutex[0].acquired) !== 1) throw new Error("Another staging business test is running");
      const [tables] = await setup.query<RowDataPacket[]>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
      inventory = tables.map(row => String(row.name)).filter(name => name !== "__drizzle_migrations");
      if (inventory.length !== 17 || inventory.some(name => !/^[A-Za-z0-9_]+$/.test(name))) throw new Error("Unexpected application inventory");
      for (const table of inventory) {
        const [rows] = await setup.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${table}\``);
        if (Number(rows[0].total) !== 0) throw new Error(`Refusing populated application table: ${table}`);
      }
      const assertQuiescent = async () => {
        const [foreignUsers] = await setup.query<RowDataPacket[]>("SELECT id FROM users WHERE openId NOT IN (?, ?, ?)", [0, 1, 2].map(i => `${owner}-${i}`));
        if (foreignUsers.length) throw new Error("Staging traffic detected; aborting fixture operations");
        for (const table of ["authIdentities", "authSessions", "authRefreshTokens"]) {
          const [rows] = await setup.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${table}\``);
          if (Number(rows[0].total)) throw new Error("Authenticated staging traffic detected");
        }
        const [busy] = await setup.query<RowDataPacket[]>("SELECT ID FROM information_schema.PROCESSLIST WHERE DB = DATABASE() AND COMMAND NOT IN ('Sleep', 'Daemon') AND ID NOT IN (?, ?, ?)", connections.map(connection => connection.threadId));
        if (busy.length) throw new Error("Concurrent staging database traffic detected");
      };
      await assertQuiescent();
      const firstDb = drizzle(first);
      const secondDb = drizzle(second);
      for (const [index, role] of ["family", "family", "driver"].entries()) {
        const [result] = await setup.execute<ResultSetHeader>("INSERT INTO users (openId, name, appRole, userStatus) VALUES (?, ?, ?, 'active')", [`${owner}-${index}`, `DB ONLY synthetic concurrency ${owner}`, role]);
        userIds.push(result.insertId);
      }
      const [familyA, familyB, driver] = userIds;
      // Explicit fixture dates only, never a production duration policy.
      await setup.execute("INSERT INTO driverProfiles (userId, vehicleType, accountStatus, verificationStatus, subscriptionStatus, subscriptionStartsAt, subscriptionEndsAt, isOnline, lastLat, lastLng, lastLocationAt) VALUES (?, 'car', 'active', 'approved', 'approved', '2020-01-01', '2037-01-01', 1, 30, 31, NOW())", [driver]);
      for (const type of REQUIRED_DRIVER_DOCUMENTS) {
        await setup.execute("INSERT INTO driverDocuments (userId, documentType, fileName, mimeType, storageKey, storageUrl, status, validFrom, expiresAt) VALUES (?, ?, 'DB_ONLY_NO_FILE.pdf', 'application/pdf', ?, ?, 'approved', '2020-01-01', '2037-01-01')", [driver, type, `${owner}/${type}`, `db-test-only:${owner}/${type}`]);
      }
      await assertQuiescent();

      // Actual durableCommand on separate sockets, not an in-memory lock model.
      const rideInput = { familyUserId: familyA, idempotencyKey: `${owner}-create`, vehicleType: "car" as const, pickupLabel: owner, destinationLabel: owner, pickupLat: 30, pickupLng: 31 };
      const create = (database: typeof firstDb) => durableCommand(database, familyA, "ride.create", rideInput.idempotencyKey, rideInput, () => createRide(rideInput));
      const created = await Promise.all([create(firstDb), create(secondDb)]);
      expect(created[0].id).toBe(created[1].id);
      expect(created[0].requestedAt).toBeInstanceOf(Date);
      expect(created[1].requestedAt).toBeInstanceOf(Date);
      const [count] = await setup.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM rides WHERE familyUserId = ?", [familyA]);
      expect(Number(count[0].total)).toBe(1);
      await expect(durableCommand(secondDb, familyA, "ride.create", rideInput.idempotencyKey, { ...rideInput, destinationLabel: "changed" }, () => createRide(rideInput))).rejects.toMatchObject({ code: "CONFLICT" });

      const otherInput = { ...rideInput, familyUserId: familyB, idempotencyKey: `${owner}-other` };
      const other = await durableCommand(secondDb, familyB, "ride.create", otherInput.idempotencyKey, otherInput, () => createRide(otherInput));
      const offerIds: number[] = [];
      for (const rideId of [created[0].id, other.id]) {
        const [result] = await setup.execute<ResultSetHeader>("INSERT INTO rideOffers (rideId, driverUserId, offeredPrice, etaMinutes) VALUES (?, ?, 100, 5)", [rideId, driver]);
        offerIds.push(result.insertId);
      }
      const select = (database: typeof firstDb, familyUserId: number, rideId: number, offerId: number) => {
        const input = { familyUserId, rideId, offerId, idempotencyKey: `${owner}-select-${rideId}` };
        return durableCommand(database, familyUserId, "offer.select", input.idempotencyKey, input, () => selectCarOffer(input));
      };
      const selections = await Promise.allSettled([
        select(firstDb, familyA, created[0].id, offerIds[0]),
        select(secondDb, familyB, other.id, offerIds[1]),
      ]);
      expect(selections.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const [assigned] = await setup.query<RowDataPacket[]>("SELECT id, familyUserId FROM rides WHERE driverUserId = ? AND status IN ('accepted','arriving','active')", [driver]);
      expect(assigned).toHaveLength(1);
      const [selectedOffers] = await setup.query<RowDataPacket[]>("SELECT id FROM rideOffers WHERE driverUserId = ? AND status = 'selected'", [driver]);
      expect(selectedOffers).toHaveLength(1);

      // Force the cross-operation lock inversion: bid owns driver-user while
      // selection owns ride. The complete transaction retry must settle safely.
      const winner = assigned[0];
      await setup.execute("UPDATE rides SET status = 'requested', driverUserId = NULL, acceptedAt = NULL WHERE id = ? AND familyUserId = ?", [winner.id, winner.familyUserId]);
      await setup.execute("UPDATE rideOffers SET status = 'pending' WHERE id = ? AND rideId = ?", [selectedOffers[0].id, winner.id]);
      await assertQuiescent();
      let bidEntered!: () => void;
      let selectionEntered!: () => void;
      const bidBarrier = new Promise<void>(resolve => { bidEntered = resolve; });
      const selectionBarrier = new Promise<void>(resolve => { selectionEntered = resolve; });
      const bidInput = { rideId: Number(winner.id), driverUserId: driver, offeredPrice: 110, etaMinutes: 4, idempotencyKey: `${owner}-race-bid` };
      const selectionInput = { rideId: Number(winner.id), familyUserId: Number(winner.familyUserId), offerId: Number(selectedOffers[0].id), idempotencyKey: `${owner}-race-select` };
      const raced = await Promise.allSettled([
        durableCommand(firstDb, driver, "offer.create", bidInput.idempotencyKey, bidInput, async () => {
          bidEntered(); await selectionBarrier; return createCarOffer(bidInput);
        }),
        durableCommand(secondDb, selectionInput.familyUserId, "offer.select", selectionInput.idempotencyKey, selectionInput, async () => {
          selectionEntered(); await bidBarrier; return selectCarOffer(selectionInput);
        }),
      ]);
      expect(raced[1].status).toBe("fulfilled");
      // Existing bid uniqueness or now-active driver can reject the duplicate;
      // an exhausted raw lock error must not be the public outcome.
      if (raced[0].status === "rejected") {
        let error = raced[0].reason;
        while (error) { expect([1205, 1213]).not.toContain(error.errno); error = error.cause; }
      }

      // Replaying after persisted role change must fail even for a cached success.
      await setup.execute("UPDATE users SET appRole = 'driver' WHERE id = ? AND openId = ?", [familyA, `${owner}-0`]);
      await expect(create(firstDb)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await setup.execute("UPDATE users SET appRole = 'family' WHERE id = ? AND openId = ?", [familyA, `${owner}-0`]);
    } finally {
      try {
        for (const connection of connections) await connection.rollback();
        if (connections[0] && userIds.length) {
        const cleanup = connections[0];
        const marks = userIds.map(() => "?").join(",");
        const [owned] = await cleanup.query<RowDataPacket[]>(`SELECT id, openId FROM users WHERE id IN (${marks})`, userIds);
        // No wildcard deletion, no unrelated rows, no auth table deletion.
        if (owned.length !== userIds.length || owned.some(row => !Array.from({ length: 3 }, (_, i) => `${owner}-${i}`).includes(row.openId))) throw new Error(`Fixture ownership mismatch; manual review required for ${owner}`);
        await cleanup.beginTransaction();
        try {
          const [ownedRides] = await cleanup.query<RowDataPacket[]>(`SELECT id, familyUserId, pickupLabel FROM rides WHERE familyUserId IN (${marks}) FOR UPDATE`, userIds);
          if (ownedRides.some(ride => ride.pickupLabel !== owner || !userIds.includes(Number(ride.familyUserId)))) throw new Error("Fixture ride ownership mismatch");
          const rideIds = ownedRides.map(ride => Number(ride.id));
          if (rideIds.length) {
            const rideMarks = rideIds.map(() => "?").join(",");
            // Remove every offer on our verified rides, not just our driver's.
            await cleanup.query(`DELETE FROM rideOffers WHERE rideId IN (${rideMarks})`, rideIds);
            await cleanup.query(`DELETE FROM rides WHERE id IN (${rideMarks})`, rideIds);
          }
          await cleanup.query(`DELETE FROM businessIdempotency WHERE actorUserId IN (${marks})`, userIds);
          await cleanup.query(`DELETE FROM driverDocuments WHERE userId IN (${marks})`, userIds);
          await cleanup.query(`DELETE FROM driverProfiles WHERE userId IN (${marks})`, userIds);
          await cleanup.query(`DELETE FROM users WHERE id IN (${marks})`, userIds);
          await cleanup.commit();
          const [remaining] = await cleanup.query<RowDataPacket[]>(`SELECT id FROM users WHERE id IN (${marks})`, userIds);
          expect(remaining).toHaveLength(0);
          for (const table of inventory) {
            const [rows] = await cleanup.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${table}\``);
            expect(Number(rows[0].total), `Nonempty post-cleanup inventory: ${table}`).toBe(0);
          }
        } catch (error) {
          await cleanup.rollback();
          throw error;
        }
        }
      } finally {
        await Promise.allSettled(connections.map(connection => connection.end()));
      }
    }
  }, 60000);
});