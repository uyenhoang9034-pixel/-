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
 * HELPERS
 * =========================================================
 */

function getRealmName(
    level,
) {
    const milestone =
        getHighestMilestone(
            level,
        );

    /**
     * Chưa đạt Lv.1.
     */
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
         * GET LEVEL CONFIG
         * =====================================================
         */

        const levelingConfig =
            await getLevelingConfig(
                client,
                interaction.guildId,
            );

        /**
         * =====================================================
         * LEVEL SYSTEM DISABLED
         * =====================================================
         */

        if (
            !levelingConfig
                ?.enabled
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
         * GET TOP 20
         * =====================================================
         */

        const leaderboard =
            await getLeaderboard(
                client,
                interaction.guildId,
                20,
            );

        /**
         * =====================================================
         * NO DATA
         * =====================================================
         */

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
         * BUILD RANKING
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
                            /**
                             * ---------------------------------
                             * MEMBER
                             * ---------------------------------
                             */

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

                            /**
                             * ---------------------------------
                             * LEVEL
                             * ---------------------------------
                             */

                            const level =
                                Math.max(
                                    0,
                                    Number(
                                        user.level,
                                    ) || 0,
                                );

                            /**
                             * ---------------------------------
                             * REALM
                             * ---------------------------------
                             */

                            const realm =
                                getRealmName(
                                    level,
                                );

                            /**
                             * ---------------------------------
                             * RANK
                             * ---------------------------------
                             */

                            const rankPrefix =
                                getRankPrefix(
                                    index,
                                );

                            /**
                             * =================================
                             * MAX LEVEL
                             * =================================
                             *
                             * Lv.999 không cần hiển thị
                             * XP cần cho level tiếp theo.
                             */

                            if (
                                level >=
                                LEVELING_MAX_LEVEL
                            ) {
                                return [
                                    `${rankPrefix} ${userMention}`,

                                    `└ **Lv.${LEVELING_MAX_LEVEL} · ${realm}**`,
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

                            /**
                             * =================================
                             * USER LINE
                             * =================================
                             */

                            return [
                                `${rankPrefix} ${userMention}`,

                                `└ **Lv.${level} · ${realm}**`,

                                `└ Linh lực: **${currentXp}/${xpForNextLevel} XP**`,
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
         * BUILD EMBED
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
