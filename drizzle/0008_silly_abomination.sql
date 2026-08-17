CREATE TABLE `driverDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentType` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewReason` text,
	`reviewedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driverDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventKey` varchar(160) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`data` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificationEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationEvents_eventKey_unique` UNIQUE(`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `rideRatings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rideId` int NOT NULL,
	`familyUserId` int NOT NULL,
	`driverUserId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rideRatings_id` PRIMARY KEY(`id`),
	CONSTRAINT `rating_ride_family_unique` UNIQUE(`rideId`,`familyUserId`)
);
