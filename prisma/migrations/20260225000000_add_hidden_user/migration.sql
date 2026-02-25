-- CreateTable
CREATE TABLE `HiddenUser` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `hiddenUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HiddenUser_hiddenUserId_idx`(`hiddenUserId`),
    UNIQUE INDEX `HiddenUser_userId_hiddenUserId_key`(`userId`, `hiddenUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HiddenUser` ADD CONSTRAINT `HiddenUser_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HiddenUser` ADD CONSTRAINT `HiddenUser_hiddenUserId_fkey` FOREIGN KEY (`hiddenUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
