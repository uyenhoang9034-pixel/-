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
        config,
        client,
    ) {
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

        if (
            !client?.db ||
            typeof client.db.set !==
                'function'
        ) {
            await interaction.editReply(
                '❌ Database hiện không khả dụng.',
            );

            return;
        }

        try {
            /**
             * =================================================
             * FIND LEVEL USER IDS
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
                typeof client.db.list ===
                'function'
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
                                () => [],
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
                            typeof key !==
                                'string' ||
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
             * FETCH ALL MEMBERS
             * =================================================
             *
             * Làm vậy để:
             *
             * - reset member chưa được tìm thấy từ DB list
             * - gỡ role cảnh giới khỏi toàn bộ member
             */

            const members =
                await guild.members
                    .fetch()
                    .catch(
                        () =>
                            guild.members.cache,
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
                     * =========================================
                     * CANONICAL LEVEL DATA
                     * =========================================
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
                     * =========================================
                     * LEGACY LEVEL DATA
                     * =========================================
                     */

                    await client.db
                        .set(
                            `${guild.id}:leveling:users:${userId}`,
                            levelData,
                        )
                        .catch(
                            error => {
                                logger.debug(
                                    `Legacy level reset skipped for ${userId}:`,
                                    error
                                        ?.message ||
                                        error,
                                );
                            },
                        );

                    /**
                     * =========================================
                     * VOICE PROGRESS
                     * =========================================
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
                            error => {
                                logger.debug(
                                    `Voice level reset skipped for ${userId}:`,
                                    error
                                        ?.message ||
                                        error,
                                );
                            },
                        );

                    /**
                     * =========================================
                     * REMOVE LEVEL ROLES
                     * =========================================
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
                            try {
                                await member.roles
                                    .remove(
                                        rolesToRemove,
                                        'Reset toàn bộ Usagi Level System',
                                    );

                                removedRoles +=
                                    rolesToRemove.length;
                            } catch (
                                roleError
                            ) {
                                logger.warn(
                                    `Failed removing level roles from ${userId}:`,
                                    roleError
                                        ?.message ||
                                        roleError,
                                );
                            }
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
