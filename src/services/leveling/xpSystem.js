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
    sendLevelAnnouncement,
} from './levelAnnouncementService.js';

import {
    syncHighestLevelRole,
} from './levelRoleService.js';

import {
    LEVELING_MAX_LEVEL,
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

            const lockKey =
                `leveling:${guild.id}:${member.user.id}`;

            return Mutex.runExclusive(
                lockKey,
                async () => {
                    if (
                        !xpToAdd ||
                        xpToAdd <= 0
                    ) {
                        return null;
                    }

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

                    const levelData =
                        await getUserLevelData(
                            client,
                            guild.id,
                            member.user.id,
                        );

                    const initialLevel =
                        levelData.level;

                    levelData.xp +=
                        xpToAdd;

                    levelData.totalXp +=
                        xpToAdd;

                    if (
                        source === 'chat'
                    ) {
                        levelData.lastMessage =
                            Date.now();
                    }

                    while (
                        levelData.level <
                            LEVELING_MAX_LEVEL &&
                        levelData.xp >=
                            getXpForLevel(
                                levelData.level,
                            )
                    ) {
                        levelData.xp -=
                            getXpForLevel(
                                levelData.level,
                            );

                        levelData.level +=
                            1;
                    }

                    /**
                     * Lv.999 là cap.
                     * Không giữ XP dư.
                     */
                    if (
                        levelData.level >=
                        LEVELING_MAX_LEVEL
                    ) {
                        levelData.level =
                            LEVELING_MAX_LEVEL;

                        levelData.xp =
                            0;
                    }

                    await saveUserLevelData(
                        client,
                        guild.id,
                        member.user.id,
                        levelData,
                    );

                    const didLevelUp =
                        levelData.level >
                        initialLevel;

                    if (
                        didLevelUp
                    ) {
                        await syncHighestLevelRole(
                            member,
                            levelData.level,
                        );

                        /**
                         * Chỉ gửi thông báo cho
                         * level cuối cùng đạt được.
                         */
                        await sendLevelAnnouncement({
                            guild,
                            member,
                            level:
                                levelData.level,
                            source,
                        });

                        logger.info(
                            `${member.user.tag} leveled from ${initialLevel} to ${levelData.level} via ${source}`,
                        );
                    }

                    return {
                        level:
                            levelData.level,

                        xp:
                            levelData.xp,

                        totalXp:
                            levelData.totalXp,

                        xpNeeded:
                            levelData.level >=
                            LEVELING_MAX_LEVEL
                                ? 0
                                : getXpForLevel(
                                      levelData.level,
                                  ),

                        leveledUp:
                            didLevelUp,

                        levelsGained:
                            levelData.level -
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
