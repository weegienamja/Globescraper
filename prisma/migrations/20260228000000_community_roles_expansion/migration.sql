-- Community roles expansion: add TEACHER, STUDENT, RECRUITER roles
-- Add username field to User
-- Add role-specific fields to Profile
-- Add RecruiterProfile model
-- Add report status tracking

-- 1. Expand Role enum
ALTER TABLE `User` MODIFY COLUMN `role` ENUM('USER', 'ADMIN', 'TEACHER', 'STUDENT', 'RECRUITER') NOT NULL DEFAULT 'USER';

-- 2. Add username to User
ALTER TABLE `User` ADD COLUMN `username` VARCHAR(40) NULL;
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);

-- 3. Add suspensionReason to User
ALTER TABLE `User` ADD COLUMN `suspensionReason` VARCHAR(500) NULL;

-- 4. Add role-specific fields to Profile
ALTER TABLE `Profile` ADD COLUMN `teflTesolCertified` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Profile` ADD COLUMN `comfortableSubjects` JSON NULL;
ALTER TABLE `Profile` ADD COLUMN `desiredCities` JSON NULL;
ALTER TABLE `Profile` ADD COLUMN `movingTimeline` VARCHAR(100) NULL;

-- 5. Add index to Profile userId (if not exists)
-- CREATE INDEX `Profile_userId_idx` ON `Profile`(`userId`);

-- 6. Create RecruiterProfile table
CREATE TABLE `RecruiterProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `companyName` VARCHAR(200) NULL,
  `website` VARCHAR(500) NULL,
  `verifiedCompany` BOOLEAN NOT NULL DEFAULT false,
  `notes` TEXT NULL,
  `targetCountries` JSON NULL,
  `targetCities` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `RecruiterProfile_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RecruiterProfile` ADD CONSTRAINT `RecruiterProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Expand ReportTargetType enum
ALTER TABLE `Report` MODIFY COLUMN `targetType` ENUM('USER', 'MEETUP', 'MESSAGE') NOT NULL;

-- 8. Add ReportStatus enum and status column to Report
ALTER TABLE `Report` ADD COLUMN `status` ENUM('OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN';

-- 9. Migrate existing users with profiles to TEACHER role
-- (Run this AFTER the enum expansion above)
UPDATE `User` u
INNER JOIN `Profile` p ON p.`userId` = u.`id`
SET u.`role` = 'TEACHER'
WHERE u.`role` = 'USER'
AND p.`displayName` IS NOT NULL;
