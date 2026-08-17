CREATE TABLE `favoriteDrivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyUserId` int NOT NULL,
	`driverUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favoriteDrivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `favorite_family_driver_unique` UNIQUE(`familyUserId`,`driverUserId`)
);
--> statement-breakpoint
CREATE TABLE `rideOffers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rideId` int NOT NULL,
	`driverUserId` int NOT NULL,
	`offeredPrice` int NOT NULL,
	`etaMinutes` int NOT NULL,
	`status` enum('pending','selected','rejected','withdrawn') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rideOffers_id` PRIMARY KEY(`id`),
	CONSTRAINT `offer_ride_driver_unique` UNIQUE(`rideId`,`driverUserId`)
);
