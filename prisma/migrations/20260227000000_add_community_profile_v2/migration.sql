-- Community Profile V2: extended profile fields, gallery captions, activity events

-- New enums are added implicitly by ALTER COLUMN usage below (MySQL ENUM columns)

-- Profile: new boolean intents
ALTER TABLE `Profile` ADD COLUMN `meetupVisaHelp` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Profile` ADD COLUMN `meetupSchoolReferrals` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Profile` ADD COLUMN `meetupExploring` BOOLEAN NOT NULL DEFAULT false;

-- Profile: relocation journey / matching
ALTER TABLE `Profile` ADD COLUMN `relocationStage` ENUM('PLANNING', 'SECURED_JOB', 'ARRIVED', 'TEACHING', 'RENEWING_VISA') NOT NULL DEFAULT 'PLANNING';
ALTER TABLE `Profile` ADD COLUMN `lookingFor` ENUM('FIRST_JOB', 'BETTER_SCHOOL', 'FLATMATES', 'LANGUAGE_EXCHANGE', 'FRIENDS', 'TRAVEL_BUDDIES') NULL;
ALTER TABLE `Profile` ADD COLUMN `replyTimeHint` ENUM('WITHIN_HOUR', 'WITHIN_FEW_HOURS', 'WITHIN_DAY', 'NOT_ACTIVE') NULL;

-- Profile: JSON array fields
ALTER TABLE `Profile` ADD COLUMN `certifications` JSON NULL;
ALTER TABLE `Profile` ADD COLUMN `languagesTeaching` JSON NULL;
ALTER TABLE `Profile` ADD COLUMN `interests` JSON NULL;

-- Profile: privacy / verification
ALTER TABLE `Profile` ADD COLUMN `showCityPublicly` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Profile` ADD COLUMN `phoneVerified` BOOLEAN NOT NULL DEFAULT false;

-- ProfileImage: optional caption
ALTER TABLE `ProfileImage` ADD COLUMN `caption` VARCHAR(200) NULL;

-- ActivityEvent table
CREATE TABLE `ActivityEvent` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('COMMENTED', 'RSVP', 'POSTED', 'CONNECTED') NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `linkUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityEvent_profileId_idx`(`profileId`),
    INDEX `ActivityEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign key: ActivityEvent → Profile
ALTER TABLE `ActivityEvent` ADD CONSTRAINT `ActivityEvent_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
