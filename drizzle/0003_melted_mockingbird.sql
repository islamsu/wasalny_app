ALTER TABLE `users` ADD `userStatus` enum('active','blocked','suspended_temp','suspended_permanent') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `moderationReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `suspendedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `moderatedBy` int;