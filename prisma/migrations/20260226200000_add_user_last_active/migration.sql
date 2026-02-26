-- Add lastActiveAt column to track user online/offline status
ALTER TABLE `User` ADD COLUMN `lastActiveAt` DATETIME(3) NULL;

-- Index for efficient "online users" queries
CREATE INDEX `User_lastActiveAt_idx` ON `User`(`lastActiveAt`);
