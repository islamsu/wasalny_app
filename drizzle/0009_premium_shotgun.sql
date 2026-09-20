CREATE TABLE `authIdentities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`issuer` varbinary(255) NOT NULL,
	`subject` varbinary(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastAuthenticatedAt` timestamp,
	CONSTRAINT `authIdentities_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_identity_issuer_subject_unique` UNIQUE(`issuer`,`subject`),
	CONSTRAINT `auth_identity_id_user_unique` UNIQUE(`id`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `authRefreshTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varbinary(64) NOT NULL,
	`tokenHash` binary(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`revokedAt` timestamp,
	`replacedByTokenId` int,
	`replayDetectedAt` timestamp,
	CONSTRAINT `authRefreshTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_refresh_token_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `authSessions` (
	`id` varbinary(64) NOT NULL,
	`userId` int NOT NULL,
	`identityId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`absoluteExpiresAt` timestamp NOT NULL,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`inactivityExpiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`revocationReason` varchar(255),
	`authenticatedAt` timestamp NOT NULL,
	`authFreshUntil` timestamp NOT NULL,
	`mfaAuthenticatedAt` timestamp,
	`mfaContext` text,
	CONSTRAINT `authSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `driverProfiles` ADD `verificationStatus` enum('pending','approved','rejected','revoked') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `driverProfiles` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `driverProfiles` ADD `verifiedBy` int;--> statement-breakpoint
ALTER TABLE `authIdentities` ADD CONSTRAINT `authIdentities_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `authRefreshTokens` ADD CONSTRAINT `authRefreshTokens_sessionId_authSessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `authSessions`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `authRefreshTokens` ADD CONSTRAINT `auth_refresh_replacement_fk` FOREIGN KEY (`replacedByTokenId`) REFERENCES `authRefreshTokens`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `authSessions` ADD CONSTRAINT `authSessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `authSessions` ADD CONSTRAINT `auth_session_identity_user_fk` FOREIGN KEY (`identityId`,`userId`) REFERENCES `authIdentities`(`id`,`userId`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `auth_identity_user_idx` ON `authIdentities` (`userId`);--> statement-breakpoint
CREATE INDEX `auth_refresh_session_idx` ON `authRefreshTokens` (`sessionId`);--> statement-breakpoint
CREATE INDEX `auth_refresh_expiry_idx` ON `authRefreshTokens` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `auth_refresh_consumed_idx` ON `authRefreshTokens` (`consumedAt`);--> statement-breakpoint
CREATE INDEX `auth_refresh_revoked_idx` ON `authRefreshTokens` (`revokedAt`);--> statement-breakpoint
CREATE INDEX `auth_refresh_replacement_idx` ON `authRefreshTokens` (`replacedByTokenId`);--> statement-breakpoint
CREATE INDEX `auth_refresh_replay_idx` ON `authRefreshTokens` (`replayDetectedAt`);--> statement-breakpoint
CREATE INDEX `auth_session_user_idx` ON `authSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `auth_session_identity_idx` ON `authSessions` (`identityId`);--> statement-breakpoint
CREATE INDEX `auth_session_absolute_expiry_idx` ON `authSessions` (`absoluteExpiresAt`);--> statement-breakpoint
CREATE INDEX `auth_session_inactivity_expiry_idx` ON `authSessions` (`inactivityExpiresAt`);--> statement-breakpoint
CREATE INDEX `auth_session_revoked_idx` ON `authSessions` (`revokedAt`);--> statement-breakpoint
ALTER TABLE `driverProfiles` ADD CONSTRAINT `driverProfiles_verifiedBy_users_id_fk` FOREIGN KEY (`verifiedBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;