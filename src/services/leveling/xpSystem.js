import {
    logger,
} from '../../utils/logger.js';

import {
    getLevelingConfig,
    getXpForLevel,
    getUserLevelData,
    saveUserLevelData,
} from './leveling.js';

import {
    sendLevelChangeAnnouncements,
} from './levelAnnouncementService.js';

import {
    syncHighestLevelRole,
} from './levelRoleService.js';

import {
    LEVELING_MAX_LEVEL,
    formatLevelNumber,
} from '../../config/leveling/levelingSystem.js';

import {
    Mutex,
} from '../../utils/mutex.js';

import {
    wrapServiceBoundary,
} from '../../utils/errorHandler.js';

/**
 * =========================================================
 * ADD XP
 * =========================================================
 */

export const addXp =
    wrapServiceBoundary(
        async function addXp(
            client,
            guild,
            member,
            xpToAdd,
            options = {},
        ) {
            const {
                source = 'chat',
            } = options;

            /**
             * =================================================
             * BASIC VALIDATION
             * =================================================
             */

            if (
                !guild ||
                !member ||
                member.user?.bot
            ) {
                return null;
            }

            const safeXpToAdd =
                Math.max(
                    0,
                    Number(
                        xpToAdd,
                    ) || 0,
                );

            if (
                safeXpToAdd <= 0
            ) {
                return null;
            }

            /**
             * =================================================
             * USER LOCK
             * =================================================
             *
             * Tránh 2 message đến cùng lúc
             * cùng đọc state cũ rồi ghi đè nhau.
             */

            const lockKey =
                `leveling:${guild.id}:${member.user.id}`;

            return Mutex.runExclusive(
                lockKey,
                async () => {
                    /**
                     * =========================================
                     * CONFIG
                     * =========================================
                     */

                    const config =
                        await getLevelingConfig(
                            client,
                            guild.id,
                        );

                    if (
                        !config?.enabled
                    ) {
                        return null;
                    }

                    /**
                     * =========================================
                     * CURRENT USER DATA
                     * =========================================
                     */

                    const levelData =
                        await getUserLevelData(
                            client,
                            guild.id,
                            member.user.id,
                        );

                    const initialLevel =
                        Math.max(
                            0,
                            Number(
                                levelData.level,
                            ) || 0,
                        );

                    /**
                     * Đã max level.
                     *
                     * Vẫn cập nhật lastMessage nếu đây là chat
                     * để cooldown không bị lệch.
                     */

                    if (
                        initialLevel >=
                        LEVELING_MAX_LEVEL
                    ) {
                        if (
                            source ===
                            'chat'
                        ) {
                            levelData.lastMessage =
                                Date.now();

                            await saveUserLevelData(
                                client,
                                guild.id,
                                member.user.id,
                                levelData,
                            );
                        }

                        return {
                            level:
                                LEVELING_MAX_LEVEL,

                            xp:
                                0,

                            totalXp:
                                levelData.totalXp,

                            xpNeeded:
                                0,

                            leveledUp:
                                false,

                            levelsGained:
                                0,
                        };
                    }

                    /**
                     * =========================================
                     * ADD XP
                     * =========================================
                     */

                    levelData.xp =
                        Math.max(
                            0,
                            Number(
                                levelData.xp,
                            ) || 0,
                        ) +
                        safeXpToAdd;

                    levelData.totalXp =
                        Math.max(
                            0,
                            Number(
                                levelData.totalXp,
                            ) || 0,
                        ) +
                        safeXpToAdd;

                    /**
                     * Chat mới update cooldown.
                     *
                     * Voice không dùng addXp nữa,
                     * nhưng giữ source để tương thích.
                     */

                    if (
                        source ===
                        'chat'
                    ) {
                        levelData.lastMessage =
                            Date.now();
                    }

                    /**
                     * =========================================
                     * LEVEL LOOP
                     * =========================================
                     *
                     * Có thể nhảy nhiều level nếu XP lớn.
                     */

                    while (
                        levelData.level <
                            LEVELING_MAX_LEVEL
                    ) {
                        const xpNeeded =
                            getXpForLevel(
                                levelData.level,
                            );

                        if (
                            levelData.xp <
                            xpNeeded
                        ) {
                            break;
                        }

                        levelData.xp -=
                            xpNeeded;

                        levelData.level +=
                            1;
                    }

                    /**
                     * =========================================
                     * MAX LEVEL
                     * =========================================
                     */

                    if (
                        levelData.level >=
                        LEVELING_MAX_LEVEL
                    ) {
                        levelData.level =
                            LEVELING_MAX_LEVEL;

                        /**
                         * Lv.9.999 là tuyệt đối cap.
                         *
                         * Không giữ XP dư.
                         */
                        levelData.xp =
                            0;
                    }

                    /**
                     * =========================================
                     * SAVE
                     * =========================================
                     */

                    const savedData =
                        await saveUserLevelData(
                            client,
                            guild.id,
                            member.user.id,
                            levelData,
                        );

                    const finalLevel =
                        Number(
                            savedData
                                ?.level ??
                            levelData.level,
                        ) || 0;

                    const finalXp =
                        Number(
                            savedData
                                ?.xp ??
                            levelData.xp,
                        ) || 0;

                    const finalTotalXp =
                        Number(
                            savedData
                                ?.totalXp ??
                            levelData.totalXp,
                        ) || 0;

                    const didLevelUp =
                        finalLevel >
                        initialLevel;

                    /**
                     * =========================================
                     * LEVEL UP
                     * =========================================
                     */

                    if (
                        didLevelUp
                    ) {
                        /**
                         * -------------------------------------
                         * ROLE
                         * -------------------------------------
                         *
                         * Chỉ giữ role cảnh giới cao nhất.
                         */

                        try {
                            await syncHighestLevelRole(
                                member,
                                finalLevel,
                            );
                        } catch (
                            roleError
                        ) {
                            logger.warn(
                                `[LEVEL] Failed syncing role for ${member.user.tag}:`,
                                roleError,
                            );
                        }

                        /**
                         * -------------------------------------
                         * ANNOUNCEMENT
                         * -------------------------------------
                         *
                         * Ví dụ:
                         *
                         * Lv.998 -> Lv.2001
                         *
                         * sẽ phát:
                         *
                         * Lv.999
                         * Lv.1.999
                         *
                         * Không bỏ sót Tiên Lộ.
                         */

                        try {
                            await sendLevelChangeAnnouncements({
                                guild,

                                member,

                                oldLevel:
                                    initialLevel,

                                newLevel:
                                    finalLevel,

                                source,
                            });
                        } catch (
                            announcementError
                        ) {
                            logger.warn(
                                `[LEVEL] Failed sending level announcement for ${member.user.tag}:`,
                                announcementError,
                            );
                        }

                        logger.info(
                            `[LEVEL] ${member.user.tag}: Lv.${formatLevelNumber(initialLevel)} -> Lv.${formatLevelNumber(finalLevel)} via ${source}`,
                        );
                    }

                    /**
                     * =========================================
                     * RESULT
                     * =========================================
                     */

                    return {
                        level:
                            finalLevel,

                        xp:
                            finalXp,

                        totalXp:
                            finalTotalXp,

                        xpNeeded:
                            finalLevel >=
                            LEVELING_MAX_LEVEL
                                ? 0
                                : getXpForLevel(
                                      finalLevel,
                                  ),

                        leveledUp:
                            didLevelUp,

                        levelsGained:
                            finalLevel -
                            initialLevel,
                    };
                },
            );
        },
        {
            service:
                'xpSystem',

            operation:
                'addXp',

            userMessage:
                'Failed to award XP. Please try again.',
        },
    );
