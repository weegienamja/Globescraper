-- AlterTable: add hiddenFromCommunity to Profile
ALTER TABLE `Profile` ADD COLUMN `hiddenFromCommunity` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Profile_hiddenFromCommunity_idx` ON `Profile`(`hiddenFromCommunity`);

-- DropTable (if exists from previous migration attempt)
DROP TABLE IF EXISTS `HiddenUser`;
