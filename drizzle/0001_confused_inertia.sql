CREATE TABLE `driverProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleType` enum('toktok','car') NOT NULL DEFAULT 'car',
	`vehicleNumber` varchar(32),
	`accountStatus` enum('active','frozen','suspended','pending') NOT NULL DEFAULT 'pending',
	`subscriptionStatus` enum('unpaid','pending','approved','rejected') NOT NULL DEFAULT 'unpaid',
	`isOnline` boolean NOT NULL DEFAULT false,
	`lastLat` double,
	`lastLng` double,
	`lastLocationAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driverProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pushTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` enum('android','ios','web') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `pushTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `rides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingCode` varchar(32) NOT NULL,
	`familyUserId` int NOT NULL,
	`driverUserId` int,
	`vehicleType` enum('toktok','car','fast') NOT NULL,
	`status` enum('requested','accepted','arriving','active','completed','cancelled') NOT NULL DEFAULT 'requested',
	`pickupLabel` varchar(255) NOT NULL,
	`destinationLabel` varchar(255) NOT NULL,
	`pickupLat` double NOT NULL,
	`pickupLng` double NOT NULL,
	`destinationLat` double,
	`destinationLng` double,
	`estimatedFare` int,
	`etaMinutes` int,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedAt` timestamp,
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rides_id` PRIMARY KEY(`id`),
	CONSTRAINT `rides_bookingCode_unique` UNIQUE(`bookingCode`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `appRole` enum('family','driver','admin') DEFAULT 'family' NOT NULL;