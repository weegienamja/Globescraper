-- Email marketing fields on User
ALTER TABLE `User` ADD COLUMN `emailMarketingOptIn` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `User` ADD COLUMN `marketingOptInAt` DATETIME(3) NULL;
ALTER TABLE `User` ADD COLUMN `emailUnsubscribed` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `User` ADD COLUMN `unsubscribeToken` VARCHAR(64) NULL;
ALTER TABLE `User` ADD COLUMN `lastEmailEngagementAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_unsubscribeToken_key` ON `User`(`unsubscribeToken`);

-- EmailCampaign table
CREATE TABLE `EmailCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `previewText` VARCHAR(500) NULL,
    `htmlContent` LONGTEXT NOT NULL,
    `textContent` LONGTEXT NULL,
    `segmentJson` JSON NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT') NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `deliveredCount` INTEGER NOT NULL DEFAULT 0,
    `openCount` INTEGER NOT NULL DEFAULT 0,
    `bounceCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailCampaign_status_idx`(`status`),
    INDEX `EmailCampaign_scheduledAt_idx`(`scheduledAt`),
    INDEX `EmailCampaign_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- EmailLog table
CREATE TABLE `EmailLog` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('TRANSACTIONAL', 'MARKETING') NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'BOUNCED') NOT NULL DEFAULT 'PENDING',
    `providerMessageId` VARCHAR(255) NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `openedAt` DATETIME(3) NULL,
    `clickedAt` DATETIME(3) NULL,

    INDEX `EmailLog_campaignId_idx`(`campaignId`),
    INDEX `EmailLog_userId_idx`(`userId`),
    INDEX `EmailLog_providerMessageId_idx`(`providerMessageId`),
    INDEX `EmailLog_status_idx`(`status`),
    INDEX `EmailLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `EmailLog` ADD CONSTRAINT `EmailLog_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `EmailCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `EmailLog` ADD CONSTRAINT `EmailLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill unsubscribe tokens for existing users
UPDATE `User` SET `unsubscribeToken` = REPLACE(UUID(), '-', '') WHERE `unsubscribeToken` IS NULL;
