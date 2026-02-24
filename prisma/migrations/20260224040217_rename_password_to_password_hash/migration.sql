-- RenameColumn: User.password → User.passwordHash
-- Uses CHANGE COLUMN (not RENAME COLUMN) for compatibility with
-- MySQL 5.7 and MariaDB < 10.5 (common on Hostinger shared hosting).
-- Preserves existing argon2 hashes without data loss.
ALTER TABLE `User` CHANGE COLUMN `password` `passwordHash` VARCHAR(255) NULL;
