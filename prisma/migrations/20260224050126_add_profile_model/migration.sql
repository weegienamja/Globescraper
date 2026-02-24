-- CreateTable: Profile
CREATE TABLE `Profile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `passportCountry` VARCHAR(100) NULL,
    `degreeStatus` ENUM('NONE', 'IN_PROGRESS', 'BACHELORS', 'MASTERS') NOT NULL DEFAULT 'NONE',
    `nativeEnglish` BOOLEAN NOT NULL DEFAULT false,
    `teachingExperience` ENUM('NONE', 'LT1_YEAR', 'ONE_TO_THREE', 'THREE_PLUS') NOT NULL DEFAULT 'NONE',
    `certificationStatus` ENUM('NONE', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'NONE',
    `desiredStartTimeline` ENUM('ASAP', 'ONE_TO_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'RESEARCHING') NOT NULL DEFAULT 'RESEARCHING',
    `savingsBand` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Profile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: ProfileTargetCountry
CREATE TABLE `ProfileTargetCountry` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `country` ENUM('VIETNAM', 'THAILAND', 'CAMBODIA', 'INDONESIA', 'PHILIPPINES', 'MALAYSIA') NOT NULL,

    INDEX `ProfileTargetCountry_profileId_idx`(`profileId`),
    UNIQUE INDEX `ProfileTargetCountry_profileId_country_key`(`profileId`, `country`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileTargetCountry` ADD CONSTRAINT `ProfileTargetCountry_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
