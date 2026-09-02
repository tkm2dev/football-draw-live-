-- CreateTable
CREATE TABLE `ScheduleEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tournamentId` INTEGER NOT NULL,
    `sequenceNo` INTEGER NOT NULL,
    `divisionType` ENUM('PUBLIC', 'SENIOR40') NULL,
    `categoryLabel` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(32) NOT NULL,
    `groupLabel` VARCHAR(32) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `homeLabel` VARCHAR(191) NOT NULL,
    `awayLabel` VARCHAR(191) NOT NULL,
    `homeScore` INTEGER NULL,
    `awayScore` INTEGER NULL,
    `status` ENUM('SCHEDULED', 'LIVE', 'FINISHED') NOT NULL DEFAULT 'SCHEDULED',
    `field` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `matchId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ScheduleEntry_matchId_key`(`matchId`),
    UNIQUE INDEX `ScheduleEntry_tournamentId_sequenceNo_key`(`tournamentId`, `sequenceNo`),
    INDEX `ScheduleEntry_tournamentId_startsAt_idx`(`tournamentId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ScheduleEntry` ADD CONSTRAINT `ScheduleEntry_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleEntry` ADD CONSTRAINT `ScheduleEntry_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
