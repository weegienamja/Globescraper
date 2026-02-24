-- Add lastLoginAt to User
ALTER TABLE `User` ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

-- Add status and adminNotes to Lead
ALTER TABLE `Lead` ADD COLUMN `status` ENUM('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED') NOT NULL DEFAULT 'NEW';
ALTER TABLE `Lead` ADD COLUMN `adminNotes` TEXT NULL;
CREATE INDEX `Lead_status_idx` ON `Lead`(`status`);

-- CreateTable: AdminAuditLog
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(50) NOT NULL,
    `targetType` VARCHAR(50) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_adminUserId_idx`(`adminUserId`),
    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
