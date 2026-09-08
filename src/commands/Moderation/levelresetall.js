import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import {
    LEVEL_REWARD_ROLE_IDS,
} from '../../config/leveling/levelingSystem.js';

import {
    getUserLevelPrefix,
} from '../../utils/database/keys.js';

import {
    logger,
} from '../../utils/logger.js';

/**
 * =========================================================
 * LEVEL RESET ALL
 * =========================================================
 *
 * LỆNH NGUY HIỂM:
 *
 * Reset toàn bộ:
 *
 * - Level
 * - XP
 * - Total XP
 * - Last message
 * - Voice progress
 * - Role cảnh giới
 *
 * về trạng thái ban đầu.
 *
 * Dùng khi chuyển từ Level System cũ
 * sang Usagi Level System mới.
 * =========================================================
 */

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'levelresetall',
            )
            .setDescription(
                'Reset toàn bộ hệ thống level của server về Lv.0.',
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator,
            ),

    category:
        'Moderation',

    async execute(
        interaction,
        client,
    ) {
        /**
         * =====================================================
         * ADMIN ONLY
         * =====================================================
         */

        if (
            !interaction.memberPermissions
                ?.has(
                    PermissionFlagsBits.Administrator,
                )
        ) {
            await interaction.reply({
                content:
                    '❌ Bạn không có quyền sử dụng lệnh này.',

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral,
        });

        const guild =
            interaction.guild;

        if (
            !guild
        ) {
            await interaction.editReply(
                '❌ Không thể xác định server.',
            );

            return;
        }

        try {
            /**
             * =================================================
             * FIND OLD LEVEL DATABASE KEYS
             * =================================================
             */

            const prefixes = [
                getUserLevelPrefix(
                    guild.id,
                ),

                `${guild.id}:leveling:users:`,
            ];

            const userIds =
                new Set();

            if (
                client.db?.list
            ) {
                for (
                    const prefix
                    of prefixes
                ) {
                    let keys =
                        await client.db
                            .list(
                                prefix,
                            )
                            .catch(
                                () =>
                                    [],
                            );

                    if (
                        !Array.isArray(
                            keys,
                        )
                    ) {
                        keys =
                            typeof keys ===
                                'object' &&
                            keys !==
                                null
                                ? Object.keys(
                                      keys,
                                  )
                                : [];
                    }

                    for (
                        const key
                        of keys
                    ) {
                        if (
                            !key.startsWith(
                                prefix,
                            )
                        ) {
                            continue;
                        }

                        const userId =
                            key.slice(
                                prefix.length,
                            );

                        if (
                            /^\d{17,20}$/.test(
                                userId,
                            )
                        ) {
                            userIds.add(
                                userId,
                            );
                        }
                    }
                }
            }

            /**
             * =================================================
             * ALSO FETCH SERVER MEMBERS
             * =================================================
             *
             * Việc này giúp xóa role cảnh giới
             * kể cả member không còn record level.
             */

            const members =
                await guild.members
                    .fetch()
                    .catch(
                        () =>
                            guild.members
                                .cache,
                    );

            for (
                const member
                of members.values()
            ) {
                if (
                    member.user.bot
                ) {
                    continue;
                }

                userIds.add(
                    member.id,
                );
            }

            let resetUsers =
                0;

            let removedRoles =
                0;

            let errors =
                0;

            /**
             * =================================================
             * RESET EACH USER
             * =================================================
             */

            for (
                const userId
                of userIds
            ) {
                try {
                    /**
                     * -----------------------------------------
                     * LEVEL DATA
                     * -----------------------------------------
                     */

                    const levelData = {
                        level:
                            0,

                        xp:
                            0,

                        totalXp:
                            0,

                        lastMessage:
                            0,
                    };

                    /**
                     * Ghi đè cả key canonical.
                     */

                    const canonicalPrefix =
                        getUserLevelPrefix(
                            guild.id,
                        );

                    await client.db.set(
                        `${canonicalPrefix}${userId}`,
                        levelData,
                    );

                    /**
                     * Nếu repo cũ từng dùng legacy key
                     * thì ghi đè luôn.
                     */

                    await client.db
                        .set(
                            `${guild.id}:leveling:users:${userId}`,
                            levelData,
                        )
                        .catch(
                            () => {},
                        );

                    /**
                     * -----------------------------------------
                     * VOICE PROGRESS
                     * -----------------------------------------
                     *
                     * 30 phút = 1 level.
                     *
                     * Reset phần phút voice còn dư về 0.
                     */

                    await client.db
                        .set(
                            `levelVoice:${guild.id}:${userId}`,
                            {
                                milliseconds:
                                    0,
                            },
                        )
                        .catch(
                            () => {},
                        );

                    /**
                     * -----------------------------------------
                     * REMOVE LEVEL ROLES
                     * -----------------------------------------
                     */

                    const member =
                        members.get(
                            userId,
                        );

                    if (
                        member
                    ) {
                        const rolesToRemove =
                            LEVEL_REWARD_ROLE_IDS
                                .filter(
                                    roleId =>
                                        member.roles.cache
                                            .has(
                                                roleId,
                                            ),
                                );

                        if (
                            rolesToRemove.length >
                            0
                        ) {
                            await member.roles
                                .remove(
                                    rolesToRemove,
                                    'Reset toàn bộ Usagi Level System',
                                )
                                .catch(
                                    error => {
                                        logger.warn(
                                            `Failed removing level roles from ${userId}:`,
                                            error
                                                ?.message ||
                                                error,
                                        );
                                    },
                                );

                            removedRoles +=
                                rolesToRemove.length;
                        }
                    }

                    resetUsers +=
                        1;
                } catch (
                    userError
                ) {
                    errors +=
                        1;

                    logger.warn(
                        `Failed resetting level for ${userId}:`,
                        userError
                            ?.message ||
                            userError,
                    );
                }
            }

            /**
             * =================================================
             * COMPLETE
             * =================================================
             */

            await interaction.editReply(
                [
                    '✅ **Usagi Level System đã được reset!**',
                    '',
                    `👤 Thành viên đã xử lý: **${resetUsers}**`,
                    `🎭 Role cảnh giới đã gỡ: **${removedRoles}**`,
                    `⚠️ Lỗi: **${errors}**`,
                    '',
                    'Tất cả người chơi hiện bắt đầu lại từ **Lv.0**.',
                    'Tin nhắn và Voice sau thời điểm này sẽ sử dụng hệ thống level mới.',
                ].join(
                    '\n',
                ),
            );

            logger.info(
                `[LEVEL RESET ALL] Guild ${guild.id} reset by ${interaction.user.id}. Users: ${resetUsers}, roles removed: ${removedRoles}, errors: ${errors}`,
            );
        } catch (
            error
        ) {
            logger.error(
                'Failed to reset leveling system:',
                error,
            );

            await interaction.editReply(
                '❌ Có lỗi xảy ra khi reset hệ thống level. Kiểm tra terminal để xem chi tiết.',
            );
        }
    },
};
