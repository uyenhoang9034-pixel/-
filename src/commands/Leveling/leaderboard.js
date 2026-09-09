import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    TitanBotError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import {
    getLeaderboard,
    getLevelingConfig,
    getXpForLevel,
} from '../../services/leveling/leveling.js';

import {
    getHighestMilestone,
    LEVELING_MAX_LEVEL,
    formatLevelNumber,
} from '../../config/leveling/levelingSystem.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

/**
 * =========================================================
 * EMOJIS
 * =========================================================
 */

const EMOJIS = {
    left:
        '<a:trangtrig2:1546040703375904801>',

    right:
        '<a:trangtrig3:1546040818261954610>',

    title:
        '<a:trangtrig10:1546047240265797682>',

    line:
        '<a:trangtrig6:1546043036390260756>',
};

/**
 * =========================================================
 * REALM NAME
 * =========================================================
 */

function getRealmName(
    level,
) {
    const milestone =
        getHighestMilestone(
            level,
        );

    if (
        !milestone
    ) {
        return 'Phàm Nhân';
    }

    return milestone.realm;
}

/**
 * =========================================================
 * RANK PREFIX
 * =========================================================
 */

function getRankPrefix(
    index,
) {
    if (
        index === 0
    ) {
        return '🥇';
    }

    if (
        index === 1
    ) {
        return '🥈';
    }

    if (
        index === 2
    ) {
        return '🥉';
    }

    return `**${index + 1}.**`;
}

/**
 * =========================================================
 * NUMBER FORMAT
 * =========================================================
 */

function formatXp(
    value,
) {
    return Math.max(
        0,
        Math.floor(
            Number(
                value,
            ) || 0,
        ),
    ).toLocaleString(
        'vi-VN',
    );
}

/**
 * =========================================================
 * COMMAND
 * =========================================================
 */

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'leaderboard',
            )
            .setDescription(
                'Xem Top 20 bảng xếp hạng tu vi của server',
            )
            .setDMPermission(
                false,
            ),

    category:
        'Leveling',

    async execute(
        interaction,
        config,
        client,
    ) {
        await InteractionHelper.safeDefer(
            interaction,
        );

        /**
         * =====================================================
         * CONFIG
         * =====================================================
         */

        const levelingConfig =
            await getLevelingConfig(
                client,
                interaction.guildId,
            );

        if (
            !levelingConfig?.enabled
        ) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setColor(
                                0xffffff,
                            )
                            .setDescription(
                                `${EMOJIS.line} Hệ thống tu vi hiện đang tạm đóng.`,
                            ),
                    ],

                    flags:
                        MessageFlags.Ephemeral,
                },
            );

            return;
        }

        /**
         * =====================================================
         * TOP 20
         * =====================================================
         */

        const leaderboard =
            await getLeaderboard(
                client,
                interaction.guildId,
                20,
            );

        if (
            leaderboard.length ===
            0
        ) {
            throw new TitanBotError(
                'No leaderboard data found',
                ErrorTypes.DATABASE,
                'Chưa có dữ liệu tu vi để hiển thị.',
            );
        }

        /**
         * =====================================================
         * BUILD USERS
         * =====================================================
         */

        const leaderboardText =
            await Promise.all(
                leaderboard.map(
                    async (
                        user,
                        index,
                    ) => {
                        try {
                            const member =
                                await interaction.guild.members
                                    .fetch(
                                        user.userId,
                                    )
                                    .catch(
                                        () => null,
                                    );

                            const userMention =
                                member
                                    ?.user
                                    ?.toString() ||
                                `<@${user.userId}>`;

                            const level =
                                Math.max(
                                    0,
                                    Math.min(
                                        Math.floor(
                                            Number(
                                                user.level,
                                            ) || 0,
                                        ),
                                        LEVELING_MAX_LEVEL,
                                    ),
                                );

                            const displayLevel =
                                formatLevelNumber(
                                    level,
                                );

                            const realm =
                                getRealmName(
                                    level,
                                );

                            const rankPrefix =
                                getRankPrefix(
                                    index,
                                );

                            /**
                             * =================================
                             * MAX LEVEL
                             * =================================
                             *
                             * Lv.9.999 không còn level tiếp theo.
                             */

                            if (
                                level >=
                                LEVELING_MAX_LEVEL
                            ) {
                                return [
                                    `${rankPrefix} ${userMention}`,

                                    `└ **Lv.${displayLevel} · ${realm}**`,

                                    `└ **Đại Đạo viên mãn**`,
                                ].join(
                                    '\n',
                                );
                            }

                            /**
                             * =================================
                             * XP
                             * =================================
                             */

                            const currentXp =
                                Math.max(
                                    0,
                                    Number(
                                        user.xp,
                                    ) || 0,
                                );

                            const xpForNextLevel =
                                getXpForLevel(
                                    level,
                                );

                            return [
                                `${rankPrefix} ${userMention}`,

                                `└ **Lv.${displayLevel} · ${realm}**`,

                                `└ Linh lực: **${formatXp(currentXp)}/${formatXp(xpForNextLevel)} XP**`,
                            ].join(
                                '\n',
                            );
                        } catch (
                            error
                        ) {
                            logger.warn(
                                `[LEVEL LEADERBOARD] Failed loading user ${user.userId}:`,
                                error,
                            );

                            return [
                                `**${index + 1}.** <@${user.userId}>`,

                                '└ Không thể tải dữ liệu tu vi.',
                            ].join(
                                '\n',
                            );
                        }
                    },
                ),
            );

        /**
         * =====================================================
         * EMBED
         * =====================================================
         */

        const embed =
            new EmbedBuilder()
                .setColor(
                    0xffffff,
                )

                .setTitle(
                    `${EMOJIS.left} 𝓣𝓾 𝓥𝓲 𝓑𝓪̉𝓷𝓰 ${EMOJIS.right}`,
                )

                .setDescription(
                    [
                        `${EMOJIS.title} **THIÊN KIÊU BẢNG**`,

                        '',

                        `${EMOJIS.line} *Đạo hữu quần hùng, ai đang đứng trên đỉnh tiên đồ?*`,

                        '',

                        leaderboardText.join(
                            '\n\n',
                        ),

                        '',

                        `${EMOJIS.line} Bảng xếp hạng hiển thị **Top 20** tu sĩ có tu vi cao nhất server.`,
                    ].join(
                        '\n',
                    ),
                )

                .setTimestamp();

        /**
         * =====================================================
         * SEND
         * =====================================================
         */

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    embed,
                ],
            },
        );

        logger.debug(
            `[LEVEL LEADERBOARD] Top 20 displayed for guild ${interaction.guildId}`,
        );
    },
};
