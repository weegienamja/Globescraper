-- ─── User status + soft-delete ─────────────────────────────────

ALTER TABLE `User` ADD COLUMN `status` ENUM('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE `User` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- ─── AdminAuditLog expansion ──────────────────────────────────

ALTER TABLE `AdminAuditLog` ADD COLUMN `targetUserId` VARCHAR(191) NULL;
ALTER TABLE `AdminAuditLog` ADD COLUMN `beforeJson` TEXT NULL;
ALTER TABLE `AdminAuditLog` ADD COLUMN `afterJson` TEXT NULL;
CREATE INDEX `AdminAuditLog_targetUserId_idx` ON `AdminAuditLog`(`targetUserId`);

-- ─── Canonical connections table ──────────────────────────────

CREATE TABLE `Connection` (
    `id` VARCHAR(191) NOT NULL,
    `userLowId` VARCHAR(191) NOT NULL,
    `userHighId` VARCHAR(191) NOT NULL,
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Connection_userLowId_userHighId_key` ON `Connection`(`userLowId`, `userHighId`);
CREATE INDEX `Connection_userHighId_idx` ON `Connection`(`userHighId`);
CREATE INDEX `Connection_status_idx` ON `Connection`(`status`);
CREATE INDEX `Connection_requestedByUserId_idx` ON `Connection`(`requestedByUserId`);

ALTER TABLE `Connection` ADD CONSTRAINT `Connection_userLowId_fkey` FOREIGN KEY (`userLowId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Connection` ADD CONSTRAINT `Connection_userHighId_fkey` FOREIGN KEY (`userHighId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Messaging tables ─────────────────────────────────────────

CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('DM') NOT NULL DEFAULT 'DM',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConversationParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lastReadAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ConversationParticipant_conversationId_userId_key` ON `ConversationParticipant`(`conversationId`, `userId`);
CREATE INDEX `ConversationParticipant_userId_idx` ON `ConversationParticipant`(`userId`);

ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Message_conversationId_createdAt_idx` ON `Message`(`conversationId`, `createdAt`);
CREATE INDEX `Message_senderId_idx` ON `Message`(`senderId`);

ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Security events ──────────────────────────────────────────

CREATE TABLE `UserSecurityEvent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(50) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `UserSecurityEvent_userId_idx` ON `UserSecurityEvent`(`userId`);
CREATE INDEX `UserSecurityEvent_eventType_idx` ON `UserSecurityEvent`(`eventType`);
CREATE INDEX `UserSecurityEvent_createdAt_idx` ON `UserSecurityEvent`(`createdAt`);

ALTER TABLE `UserSecurityEvent` ADD CONSTRAINT `UserSecurityEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Blocked IPs ──────────────────────────────────────────────

CREATE TABLE `BlockedIp` (
    `id` VARCHAR(191) NOT NULL,
    `ipCidr` VARCHAR(50) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `BlockedIp_ipCidr_idx` ON `BlockedIp`(`ipCidr`);
CREATE INDEX `BlockedIp_expiresAt_idx` ON `BlockedIp`(`expiresAt`);
