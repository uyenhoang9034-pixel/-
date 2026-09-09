import {
    EmbedBuilder,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    getGuildConfig,
    setGuildConfig,
} from '../config/guildConfig.js';

import {
    TitanBotError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import {
    getUserLevelKey,
} from '../../utils/database/keys.js';

import {
    LEVELING_MAX_LEVEL,
    formatLevelNumber,
} from '../../config/leveling/levelingSystem.js';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const MIN_LEVEL =
    0;

/**
 * =========================================================
 * XP REQUIRED FOR NEXT LEVEL
 * =========================================================
 *
 * Giữ nguyên công thức level cũ:
 *
 * XP = 5(level²) + 50(level) + 50
 *
 * Chỉ mở giới hạn từ 999 -> 9999.
 */

export function getXpForLevel(
    level,
) {
    if (
        !Number.isInteger(
            level,
        ) ||
        level <
            MIN_LEVEL ||
        level >
            LEVELING_MAX_LEVEL
    ) {
        throw new TitanBotError(
            `Invalid level: ${level}. Must be between ${MIN_LEVEL} and ${LEVELING_MAX_LEVEL}`,
            ErrorTypes.VALIDATION,
            'The level must be a valid number.',
        );
    }

    return (
        5 *
            Math.pow(
                level,
                2,
            ) +
        50 *
            level +
        50
    );
}

/**
 * =========================================================
 * LEVEL FROM TOTAL XP
 * =========================================================
 */

export function getLevelFromXp(
    xp,
) {
    if (
        !Number.isFinite(
            xp,
        ) ||
        xp < 0
    ) {
        throw new TitanBotError(
            `Invalid XP: ${xp}`,
            ErrorTypes.VALIDATION,
            'XP must be a non-negative number.',
        );
    }

    let level =
        0;

    let remainingXp =
        Math.floor(
            xp,
        );

    while (
        level <
            LEVELING_MAX_LEVEL
    ) {
        const needed =
            getXpForLevel(
                level,
            );

        if (
            remainingXp <
            needed
        ) {
            break;
        }

        remainingXp -=
            needed;

        level +=
            1;
    }

    /**
     * Lv.9.999 là cap.
     */

    if (
        level >=
        LEVELING_MAX_LEVEL
    ) {
        return {
            level:
                LEVELING_MAX_LEVEL,

            currentXp:
                0,

            xpNeeded:
                0,
        };
    }

    return {
        level,

        currentXp:
            remainingXp,

        xpNeeded:
            getXpForLevel(
                level,
            ),
    };
}

/**
 * =========================================================
 * CALCULATE TOTAL XP
 * =========================================================
 *
 * Dùng cho:
 *
 * /leveladd
 * /levelremove
 * /levelset
 *
 * để leaderboard vẫn sắp xếp đúng.
 */

export function calculateTotalXp(
    level,
    currentXp = 0,
) {
    const safeLevel =
        Math.max(
            MIN_LEVEL,
            Math.min(
                Math.floor(
                    Number(
                        level,
                    ) || 0,
                ),
                LEVELING_MAX_LEVEL,
            ),
        );

    let total =
        Math.max(
            0,
            Number(
                currentXp,
            ) || 0,
        );

    for (
        let i = 0;
        i <
        safeLevel;
        i +=
        1
    ) {
        total +=
            getXpForLevel(
                i,
            );
    }

    return total;
}

/**
 * =========================================================
 * LEADERBOARD
 * =========================================================
 */

export async function getLeaderboard(
    client,
    guildId,
    limit = 10,
) {
    try {
        if (
            !guildId ||
            typeof guildId !==
                'string'
        ) {
            throw new TitanBotError(
                'Invalid guild ID',
                ErrorTypes.VALIDATION,
                'Guild ID is required.',
            );
        }

        if (
            !Number.isInteger(
                limit,
            ) ||
            limit < 1 ||
            limit > 100
        ) {
            limit =
                Math.min(
                    Math.max(
                        Number(
                            limit,
                        ) || 10,
                        1,
                    ),
                    100,
                );
        }

        const guild =
            client.guilds.cache.get(
                guildId,
            );

        if (
            !guild
        ) {
            logger.warn(
                `Guild ${guildId} not found in cache`,
            );

            return [];
        }

        const members =
            await guild.members
                .fetch()
                .catch(
                    error => {
                        logger.error(
                            `Failed to fetch members for guild ${guildId}:`,
                            error,
                        );

                        return new Map();
                    },
                );

        const leaderboard =
            [];

        for (
            const [
                userId,
                member,
            ]
            of members
        ) {
            if (
                member.user.bot
            ) {
                continue;
            }

            const data =
                await getUserLevelData(
                    client,
                    guildId,
                    userId,
                );

            if (
                data &&
                (
                    data.totalXp >
                        0 ||
                    data.level >
                        0
                )
            ) {
                leaderboard.push({
                    userId,

                    username:
                        member.user
                            .username,

                    discriminator:
                        member.user
                            .discriminator,

                    ...data,
                });
            }
        }

        /**
         * Level cao hơn đứng trước.
         *
         * Nếu cùng level:
         * total XP cao hơn đứng trước.
         *
         * Nếu vẫn bằng:
         * XP hiện tại cao hơn đứng trước.
         */

        leaderboard.sort(
            (
                a,
                b,
            ) => {
                if (
                    b.level !==
                    a.level
                ) {
                    return (
                        b.level -
                        a.level
                    );
                }

                if (
                    b.totalXp !==
                    a.totalXp
                ) {
                    return (
                        b.totalXp -
                        a.totalXp
                    );
                }

                return (
                    b.xp -
                    a.xp
                );
            },
        );

        leaderboard.forEach(
            (
                entry,
                index,
            ) => {
                entry.rank =
                    index +
                    1;
            },
        );

        return leaderboard.slice(
            0,
            limit,
        );
    } catch (
        error
    ) {
        logger.error(
            'Error getting leaderboard:',
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to fetch leaderboard: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not fetch the leaderboard at this time.',
        );
    }
}

/**
 * =========================================================
 * LEGACY LEADERBOARD EMBED
 * =========================================================
 *
 * File command leaderboard mới không dùng
 * giao diện này nữa, nhưng giữ export để
 * không phá code cũ nếu còn nơi import.
 */

export function createLeaderboardEmbed(
    leaderboard,
    guild,
) {
    const embed =
        new EmbedBuilder()
            .setTitle(
                `🏆 ${guild.name} Leaderboard`,
            )
            .setColor(
                '#2ecc71',
            )
            .setTimestamp();

    if (
        !leaderboard ||
        leaderboard.length ===
            0
    ) {
        embed.setDescription(
            'No users on the leaderboard yet!',
        );

        return embed;
    }

    const top3 =
        leaderboard.slice(
            0,
            3,
        );

    const rest =
        leaderboard.slice(
            3,
        );

    const top3Text =
        top3
            .map(
                (
                    user,
                    index,
                ) => {
                    const medal =
                        [
                            '🥇',
                            '🥈',
                            '🥉',
                        ][
                            index
                        ];

                    return (
                        `${medal} **#${user.rank}** ${user.username} - ` +
                        `Level ${formatLevelNumber(user.level)} (${user.totalXp} XP)`
                    );
                },
            )
            .join(
                '\n',
            );

    const restText =
        rest
            .map(
                user =>
                    (
                        `**#${user.rank}** ${user.username} - ` +
                        `Level ${formatLevelNumber(user.level)} (${user.totalXp} XP)`
                    ),
            )
            .join(
                '\n',
            );

    embed.setDescription(
        `**Top Members**\n${top3Text}${
            restText
                ? '\n\n' +
                  restText
                : ''
        }`,
    );

    return embed;
}

/**
 * =========================================================
 * LEVELING CONFIG
 * =========================================================
 */

function getDefaultLevelingConfig() {
    return {
        enabled:
            true,

        xpPerMessage: {
            min:
                15,

            max:
                25,
        },

        xpCooldown:
            20,

        levelUpMessage:
            '{user} has leveled up to level {level}!',

        levelUpChannel:
            null,

        ignoredChannels:
            [],

        ignoredRoles:
            [],

        blacklistedUsers:
            [],

        /**
         * Legacy.
         *
         * Role mới được quản lý bằng
         * levelingSystem.js.
         */
        roleRewards:
            {},

        announceLevelUp:
            true,

        xpMultiplier:
            1,
    };
}

export async function getLevelingConfig(
    client,
    guildId,
) {
    try {
        const guildConfig =
            await getGuildConfig(
                client,
                guildId,
            );

        return (
            guildConfig.leveling ||
            getDefaultLevelingConfig()
        );
    } catch (
        error
    ) {
        logger.error(
            `Error getting leveling config for guild ${guildId}:`,
            error,
        );

        return getDefaultLevelingConfig();
    }
}

/**
 * =========================================================
 * GET USER LEVEL DATA
 * =========================================================
 */

export async function getUserLevelData(
    client,
    guildId,
    userId,
) {
    try {
        if (
            !guildId ||
            !userId
        ) {
            throw new TitanBotError(
                'Guild ID and User ID are required',
                ErrorTypes.VALIDATION,
            );
        }

        const key =
            getUserLevelKey(
                guildId,
                userId,
            );

        const data =
            await client.db.get(
                key,
            );

        if (
            !data
        ) {
            return {
                xp:
                    0,

                level:
                    0,

                totalXp:
                    0,

                lastMessage:
                    0,

                rank:
                    0,
            };
        }

        return {
            xp:
                Math.max(
                    0,
                    Number(
                        data.xp,
                    ) || 0,
                ),

            /**
             * QUAN TRỌNG:
             *
             * Không còn clamp ở 999.
             *
             * Cap mới = 9999.
             */
            level:
                Math.max(
                    MIN_LEVEL,
                    Math.min(
                        Math.floor(
                            Number(
                                data.level,
                            ) || 0,
                        ),
                        LEVELING_MAX_LEVEL,
                    ),
                ),

            totalXp:
                Math.max(
                    0,
                    Number(
                        data.totalXp,
                    ) || 0,
                ),

            lastMessage:
                Number(
                    data.lastMessage,
                ) || 0,

            rank:
                Number(
                    data.rank,
                ) || 0,
        };
    } catch (
        error
    ) {
        logger.error(
            `Error getting user level data for ${userId}:`,
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to fetch user data: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not fetch level data at this time.',
        );
    }
}

/**
 * =========================================================
 * SAVE USER LEVEL DATA
 * =========================================================
 */

export async function saveUserLevelData(
    client,
    guildId,
    userId,
    data,
) {
    try {
        if (
            !guildId ||
            !userId
        ) {
            throw new TitanBotError(
                'Guild ID and User ID are required',
                ErrorTypes.VALIDATION,
            );
        }

        if (
            !data ||
            typeof data !==
                'object'
        ) {
            throw new TitanBotError(
                'Invalid user level data',
                ErrorTypes.VALIDATION,
            );
        }

        const sanitizedData = {
            xp:
                Math.max(
                    0,
                    Number(
                        data.xp,
                    ) || 0,
                ),

            level:
                Math.max(
                    MIN_LEVEL,
                    Math.min(
                        Math.floor(
                            Number(
                                data.level,
                            ) || 0,
                        ),
                        LEVELING_MAX_LEVEL,
                    ),
                ),

            totalXp:
                Math.max(
                    0,
                    Number(
                        data.totalXp,
                    ) || 0,
                ),

            lastMessage:
                Number(
                    data.lastMessage,
                ) || 0,

            rank:
                Number(
                    data.rank,
                ) || 0,
        };

        /**
         * Max level không giữ XP dư.
         */

        if (
            sanitizedData.level >=
            LEVELING_MAX_LEVEL
        ) {
            sanitizedData.level =
                LEVELING_MAX_LEVEL;

            sanitizedData.xp =
                0;
        }

        const key =
            getUserLevelKey(
                guildId,
                userId,
            );

        await client.db.set(
            key,
            sanitizedData,
        );

        return sanitizedData;
    } catch (
        error
    ) {
        logger.error(
            `Error saving user level data for ${userId}:`,
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to save user data: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not save level data at this time.',
        );
    }
}

/**
 * =========================================================
 * SAVE LEVELING CONFIG
 * =========================================================
 */

export async function saveLevelingConfig(
    client,
    guildId,
    config,
) {
    try {
        if (
            !guildId ||
            !config
        ) {
            throw new TitanBotError(
                'Guild ID and config are required',
                ErrorTypes.VALIDATION,
            );
        }

        const guildConfig =
            await getGuildConfig(
                client,
                guildId,
            );

        if (
            config.xpCooldown !==
                undefined &&
            (
                config.xpCooldown <
                    0 ||
                config.xpCooldown >
                    3600
            )
        ) {
            throw new TitanBotError(
                'XP cooldown must be between 0 and 3600 seconds',
                ErrorTypes.VALIDATION,
                'Cooldown must be between 0 and 3600 seconds.',
            );
        }

        if (
            config.xpRange &&
            (
                config.xpRange
                    .min <
                    1 ||
                config.xpRange
                    .max <
                    1 ||
                config.xpRange
                    .min >
                    config.xpRange
                        .max
            )
        ) {
            throw new TitanBotError(
                'Invalid XP range configuration',
                ErrorTypes.VALIDATION,
                'Minimum XP must be less than maximum XP, and both must be positive.',
            );
        }

        guildConfig.leveling =
            config;

        await setGuildConfig(
            client,
            guildId,
            guildConfig,
        );

        logger.info(
            `Leveling config updated for guild ${guildId}`,
        );

        return config;
    } catch (
        error
    ) {
        logger.error(
            `Error saving leveling config for guild ${guildId}:`,
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to save config: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not save configuration at this time.',
        );
    }
}

/**
 * =========================================================
 * ADD LEVELS
 * =========================================================
 */

export async function addLevels(
    client,
    guildId,
    userId,
    levels,
) {
    try {
        const levelingConfig =
            await getLevelingConfig(
                client,
                guildId,
            );

        if (
            !levelingConfig
                ?.enabled
        ) {
            throw new TitanBotError(
                'Leveling system is disabled on this server',
                ErrorTypes.CONFIGURATION,
                'The leveling system is currently disabled on this server.',
            );
        }

        if (
            !Number.isInteger(
                levels,
            ) ||
            levels <= 0
        ) {
            throw new TitanBotError(
                `Invalid level amount: ${levels}`,
                ErrorTypes.VALIDATION,
                'You must add a positive number of levels.',
            );
        }

        const userData =
            await getUserLevelData(
                client,
                guildId,
                userId,
            );

        /**
         * Nếu đang Lv.9.995 và add 10
         * -> cap tại Lv.9.999.
         *
         * Không throw error.
         */

        const newLevel =
            Math.min(
                LEVELING_MAX_LEVEL,
                userData.level +
                    levels,
            );

        const newXp =
            0;

        const newTotalXp =
            calculateTotalXp(
                newLevel,
                newXp,
            );

        userData.level =
            newLevel;

        userData.xp =
            newXp;

        userData.totalXp =
            newTotalXp;

        await saveUserLevelData(
            client,
            guildId,
            userId,
            userData,
        );

        logger.info(
            `Added levels to user ${userId} in guild ${guildId}: Lv.${formatLevelNumber(newLevel)}`,
        );

        return userData;
    } catch (
        error
    ) {
        logger.error(
            `Error adding levels for user ${userId}:`,
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to add levels: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not add levels at this time.',
        );
    }
}

/**
 * =========================================================
 * REMOVE LEVELS
 * =========================================================
 */

export async function removeLevels(
    client,
    guildId,
    userId,
    levels,
) {
    try {
        const levelingConfig =
            await getLevelingConfig(
                client,
                guildId,
            );

        if (
            !levelingConfig
                ?.enabled
        ) {
            throw new TitanBotError(
                'Leveling system is disabled on this server',
                ErrorTypes.CONFIGURATION,
                'The leveling system is currently disabled on this server.',
            );
        }

        if (
            !Number.isInteger(
                levels,
            ) ||
            levels <= 0
        ) {
            throw new TitanBotError(
                `Invalid level amount: ${levels}`,
                ErrorTypes.VALIDATION,
                'You must remove a positive number of levels.',
            );
        }

        const userData =
            await getUserLevelData(
                client,
                guildId,
                userId,
            );

        const newLevel =
            Math.max(
                MIN_LEVEL,
                userData.level -
                    levels,
            );

        const newXp =
            0;

        const newTotalXp =
            calculateTotalXp(
                newLevel,
                newXp,
            );

        userData.level =
            newLevel;

        userData.xp =
            newXp;

        userData.totalXp =
            newTotalXp;

        await saveUserLevelData(
            client,
            guildId,
            userId,
            userData,
        );

        logger.info(
            `Removed levels from user ${userId} in guild ${guildId}: Lv.${formatLevelNumber(newLevel)}`,
        );

        return userData;
    } catch (
        error
    ) {
        logger.error(
            `Error removing levels for user ${userId}:`,
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to remove levels: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not remove levels at this time.',
        );
    }
}

/**
 * =========================================================
 * SET LEVEL
 * =========================================================
 */

export async function setUserLevel(
    client,
    guildId,
    userId,
    level,
) {
    try {
        const levelingConfig =
            await getLevelingConfig(
                client,
                guildId,
            );

        if (
            !levelingConfig
                ?.enabled
        ) {
            throw new TitanBotError(
                'Leveling system is disabled on this server',
                ErrorTypes.CONFIGURATION,
                'The leveling system is currently disabled on this server.',
            );
        }

        if (
            !Number.isInteger(
                level,
            ) ||
            level <
                MIN_LEVEL ||
            level >
                LEVELING_MAX_LEVEL
        ) {
            throw new TitanBotError(
                `Invalid level: ${level}`,
                ErrorTypes.VALIDATION,
                `Level must be between ${MIN_LEVEL} and ${LEVELING_MAX_LEVEL}.`,
            );
        }

        const userData =
            await getUserLevelData(
                client,
                guildId,
                userId,
            );

        const newXp =
            0;

        const newTotalXp =
            calculateTotalXp(
                level,
                newXp,
            );

        userData.level =
            level;

        userData.xp =
            newXp;

        userData.totalXp =
            newTotalXp;

        await saveUserLevelData(
            client,
            guildId,
            userId,
            userData,
        );

        logger.info(
            `Set level for user ${userId} to Lv.${formatLevelNumber(level)} in guild ${guildId}`,
        );

        return userData;
    } catch (
        error
    ) {
        logger.error(
            `Error setting level for user ${userId}:`,
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        throw new TitanBotError(
            `Failed to set level: ${error.message}`,
            ErrorTypes.DATABASE,
            'Could not set level at this time.',
        );
    }
}

/**
 * =========================================================
 * DELETE USER LEVEL DATA
 * =========================================================
 */

export async function deleteUserLevelData(
    client,
    guildId,
    userId,
) {
    try {
        if (
            !guildId ||
            !userId
        ) {
            throw new TitanBotError(
                'Guild ID and User ID are required',
                ErrorTypes.VALIDATION,
            );
        }

        const key =
            getUserLevelKey(
                guildId,
                userId,
            );

        await client.db.delete(
            key,
        );

        logger.debug(
            `Deleted level data for user ${userId} in guild ${guildId}`,
        );
    } catch (
        error
    ) {
        logger.error(
            `Error deleting level data for ${userId}:`,
            error,
        );

        if (
            error instanceof
            TitanBotError
        ) {
            throw error;
        }

        logger.warn(
            `Could not delete level data for user ${userId} in guild ${guildId}`,
        );
    }
}
