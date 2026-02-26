-- Add image fields to GeneratedArticleDraft
ALTER TABLE `GeneratedArticleDraft` ADD COLUMN `heroImageUrl` VARCHAR(2000) NULL;
ALTER TABLE `GeneratedArticleDraft` ADD COLUMN `ogImageUrl` VARCHAR(2000) NULL;
ALTER TABLE `GeneratedArticleDraft` ADD COLUMN `imagesJson` JSON NULL;

-- Create ArticleImageKind enum check and GeneratedArticleImage table
CREATE TABLE `GeneratedArticleImage` (
    `id` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NOT NULL,
    `kind` ENUM('HERO', 'OG', 'INLINE') NOT NULL,
    `prompt` TEXT NOT NULL,
    `altText` VARCHAR(500) NOT NULL,
    `caption` VARCHAR(500) NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `mimeType` VARCHAR(50) NOT NULL,
    `storageUrl` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GeneratedArticleImage_draftId_idx`(`draftId`),
    INDEX `GeneratedArticleImage_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key
ALTER TABLE `GeneratedArticleImage` ADD CONSTRAINT `GeneratedArticleImage_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `GeneratedArticleDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
