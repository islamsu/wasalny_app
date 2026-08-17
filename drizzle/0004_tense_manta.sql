CREATE TABLE `familyComplaints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyUserId` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`status` enum('open','in_review','resolved','closed') NOT NULL DEFAULT 'open',
	`relatedRideId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `familyComplaints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `familyViolations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyUserId` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`reason` text NOT NULL,
	`source` varchar(64) NOT NULL,
	`relatedRideId` int,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `familyViolations_id` PRIMARY KEY(`id`)
);
