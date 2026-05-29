/*
  Warnings:

  - You are about to drop the column `clarity` on the `reports` table. All the data in the column will be lost.
  - You are about to drop the column `depth` on the `reports` table. All the data in the column will be lost.
  - Added the required column `fluency` to the `reports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `relevance` to the `reports` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `reports` DROP COLUMN `clarity`,
    DROP COLUMN `depth`,
    ADD COLUMN `fluency` INTEGER NOT NULL,
    ADD COLUMN `performanceLevel` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED') NOT NULL DEFAULT 'INTERMEDIATE',
    ADD COLUMN `relevance` INTEGER NOT NULL,
    ADD COLUMN `resources` JSON NULL;
