-- AlterTable: Add disabled flag to User
ALTER TABLE `User` ADD COLUMN `disabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add community fields to Profile
ALTER TABLE `Profile` ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `currentCity` VARCHAR(100) NULL,
    ADD COLUMN `currentCountry` VARCHAR(100) NULL,
    ADD COLUMN `displayName` VARCHAR(50) NULL,
    ADD COLUMN `meetupCityTour` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `meetupCoffee` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `meetupJobAdvice` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `meetupStudyGroup` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `visibility` ENUM('PRIVATE', 'MEMBERS_ONLY', 'PUBLIC') NOT NULL DEFAULT 'MEMBERS_ONLY';

-- CreateTable: ConnectionRequest
CREATE TABLE `ConnectionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
    `message` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConnectionRequest_toUserId_idx`(`toUserId`),
    INDEX `ConnectionRequest_status_idx`(`status`),
    INDEX `ConnectionRequest_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ConnectionRequest_fromUserId_toUserId_key`(`fromUserId`, `toUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: Meetup
CREATE TABLE `Meetup` (
    `id` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `country` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `dateTime` DATETIME(3) NOT NULL,
    `locationHint` VARCHAR(200) NULL,
    `maxAttendees` INTEGER NULL,
    `visibility` ENUM('MEMBERS_ONLY', 'PUBLIC') NOT NULL DEFAULT 'MEMBERS_ONLY',
    `status` ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Meetup_country_idx`(`country`),
    INDEX `Meetup_city_idx`(`city`),
    INDEX `Meetup_dateTime_idx`(`dateTime`),
    INDEX `Meetup_status_idx`(`status`),
    INDEX `Meetup_createdByUserId_idx`(`createdByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: MeetupAttendee
CREATE TABLE `MeetupAttendee` (
    `id` VARCHAR(191) NOT NULL,
    `meetupId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('GOING', 'INTERESTED', 'LEFT') NOT NULL DEFAULT 'GOING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MeetupAttendee_userId_idx`(`userId`),
    UNIQUE INDEX `MeetupAttendee_meetupId_userId_key`(`meetupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: Block
CREATE TABLE `Block` (
    `id` VARCHAR(191) NOT NULL,
    `blockerUserId` VARCHAR(191) NOT NULL,
    `blockedUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Block_blockedUserId_idx`(`blockedUserId`),
    UNIQUE INDEX `Block_blockerUserId_blockedUserId_key`(`blockerUserId`, `blockedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: Report
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `reporterUserId` VARCHAR(191) NOT NULL,
    `targetType` ENUM('USER', 'MEETUP') NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `reason` ENUM('SPAM', 'HARASSMENT', 'SCAM', 'OTHER') NOT NULL,
    `details` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Report_reporterUserId_idx`(`reporterUserId`),
    INDEX `Report_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `Report_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex: Profile community indexes
CREATE INDEX `Profile_currentCountry_idx` ON `Profile`(`currentCountry`);
CREATE INDEX `Profile_currentCity_idx` ON `Profile`(`currentCity`);
CREATE INDEX `Profile_visibility_idx` ON `Profile`(`visibility`);
CREATE INDEX `Profile_updatedAt_idx` ON `Profile`(`updatedAt`);

-- AddForeignKey
ALTER TABLE `ConnectionRequest` ADD CONSTRAINT `ConnectionRequest_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConnectionRequest` ADD CONSTRAINT `ConnectionRequest_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meetup` ADD CONSTRAINT `Meetup_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetupAttendee` ADD CONSTRAINT `MeetupAttendee_meetupId_fkey` FOREIGN KEY (`meetupId`) REFERENCES `Meetup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetupAttendee` ADD CONSTRAINT `MeetupAttendee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_blockerUserId_fkey` FOREIGN KEY (`blockerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Block` ADD CONSTRAINT `Block_blockedUserId_fkey` FOREIGN KEY (`blockedUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_reporterUserId_fkey` FOREIGN KEY (`reporterUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
