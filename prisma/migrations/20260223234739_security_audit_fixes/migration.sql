-- AlterTable: Add new columns, fix column types, add indexes
-- Handle existing rows by setting updatedAt = createdAt for pre-existing leads
ALTER TABLE `Lead`
    ADD COLUMN `deleted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `email` VARCHAR(255) NOT NULL,
    MODIFY `message` TEXT NULL;

-- Backfill updatedAt with createdAt for existing rows
UPDATE `Lead` SET `updatedAt` = `createdAt` WHERE `updatedAt` = CURRENT_TIMESTAMP(3);

-- Remove the column default (Prisma @updatedAt handles this in application code)
ALTER TABLE `Lead` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `Lead_email_idx` ON `Lead`(`email`);

-- CreateIndex
CREATE INDEX `Lead_createdAt_idx` ON `Lead`(`createdAt`);

-- CreateTable (WaitlistEntry if not exists)
CREATE TABLE IF NOT EXISTS `WaitlistEntry` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WaitlistEntry_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
