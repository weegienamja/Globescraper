-- AlterTable
ALTER TABLE `Lead` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Profile` ADD COLUMN `meetupLanguageExchange` BOOLEAN NOT NULL DEFAULT false;
