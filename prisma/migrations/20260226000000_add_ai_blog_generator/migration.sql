-- AI Blog Generator tables
CREATE TABLE `GeneratedArticleDraft` (
    `id` VARCHAR(191) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `topic` VARCHAR(200) NOT NULL,
    `audience` VARCHAR(100) NOT NULL,
    `targetKeyword` VARCHAR(200) NULL,
    `secondaryKeywords` TEXT NULL,
    `title` VARCHAR(300) NOT NULL,
    `slug` VARCHAR(300) NOT NULL,
    `metaTitle` VARCHAR(200) NOT NULL,
    `metaDescription` VARCHAR(500) NOT NULL,
    `markdown` LONGTEXT NOT NULL,
    `html` LONGTEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `confidence` ENUM('HIGH', 'LOW') NOT NULL DEFAULT 'HIGH',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GeneratedArticleDraft_slug_key`(`slug`),
    INDEX `GeneratedArticleDraft_status_idx`(`status`),
    INDEX `GeneratedArticleDraft_city_idx`(`city`),
    INDEX `GeneratedArticleDraft_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeneratedArticleSource` (
    `id` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(2000) NOT NULL,
    `title` VARCHAR(500) NULL,
    `publisher` VARCHAR(200) NULL,
    `publishedAt` DATETIME(3) NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `excerpt` TEXT NULL,

    INDEX `GeneratedArticleSource_draftId_idx`(`draftId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GeneratedArticleRun` (
    `id` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `error` TEXT NULL,
    `modelUsed` VARCHAR(100) NULL,
    `tokenUsage` INTEGER NULL,
    `settingsJson` TEXT NULL,

    INDEX `GeneratedArticleRun_draftId_idx`(`draftId`),
    INDEX `GeneratedArticleRun_status_idx`(`status`),
    INDEX `GeneratedArticleRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `GeneratedArticleSource` ADD CONSTRAINT `GeneratedArticleSource_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `GeneratedArticleDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `GeneratedArticleRun` ADD CONSTRAINT `GeneratedArticleRun_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `GeneratedArticleDraft`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
