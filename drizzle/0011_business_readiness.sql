CREATE TABLE `businessIdempotency` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`operation` varchar(64) NOT NULL,
	`requestKey` varchar(128) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`response` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `businessIdempotency_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_idempotency_scope` UNIQUE(`actorUserId`,`operation`,`requestKey`)
);
--> statement-breakpoint
ALTER TABLE `driverDocuments` ADD `validFrom` timestamp;--> statement-breakpoint
ALTER TABLE `driverDocuments` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `driverProfiles` ADD `subscriptionStartsAt` timestamp;--> statement-breakpoint
ALTER TABLE `driverProfiles` ADD `subscriptionEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `driverProfiles` ADD `onboardingSubmittedAt` timestamp;--> statement-breakpoint
ALTER TABLE `businessIdempotency` ADD CONSTRAINT `businessIdempotency_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;