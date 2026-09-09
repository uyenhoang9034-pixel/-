import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    removeLevels,
    getUserLevelData,
    getLevelingConfig,
} from '../../services/leveling/leveling.js';

import {
    syncHighestLevelRole,
} from '../../services/leveling/levelRoleService.js';

import {
    LEVELING_MAX_LEVEL,
    formatLevelNumber,
} from '../../config/leveling/levelingSystem.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'levelremove',
            )
            .setDescription(
                'Giảm level của thành viên',
            )

            .addUserOption(
                option =>
                    option
                        .setName(
                            'user',
                        )
                        .setDescription(
                            'Thành viên muốn giảm level',
                        )
                        .setRequired(
                            true,
                        ),
            )

            .addIntegerOption(
                option =>
                    option
                        .setName(
                            'levels',
                        )
                        .setDescription(
                            'Số level muốn giảm',
                        )
                        .setRequired(
                            true,
                        )
                        .setMinValue(
                            1,
                        )
                        .setMaxValue(
                            LEVELING_MAX_LEVEL,
                        ),
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageGuild,
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
                    content:
                        'Hệ thống level hiện đang tắt.',
                },
            );

            return;
        }

        const targetUser =
            interaction.options.getUser(
                'user',
                true,
            );

        const levelsToRemove =
            interaction.options.getInteger(
                'levels',
                true,
            );

        const member =
            await interaction.guild.members
                .fetch(
                    targetUser.id,
                )
                .catch(
                    () => null,
                );

        if (
            !member
        ) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        'Không tìm thấy thành viên này trong server.',
                },
            );

            return;
        }

        /**
         * =====================================================
         * OLD LEVEL
         * =====================================================
         */

        const oldData =
            await getUserLevelData(
                client,
                interaction.guildId,
                targetUser.id,
            );

        const oldLevel =
            Math.max(
                0,
                Number(
                    oldData.level,
                ) || 0,
            );

        if (
            oldLevel <= 0
        ) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        `${member} hiện đang ở **Lv.0**, không thể giảm thêm.`,
                },
            );

            return;
        }

        /**
         * =====================================================
         * REMOVE
         * =====================================================
         */

        const updatedData =
            await removeLevels(
                client,
                interaction.guildId,
                targetUser.id,
                levelsToRemove,
            );

        const newLevel =
            Math.max(
                0,
                Number(
                    updatedData.level,
                ) || 0,
            );

        /**
         * =====================================================
         * ROLE
         * =====================================================
         *
         * Giảm level:
         *
         * Lv.6999 -> Lv.3000
         *
         * bot sẽ:
         *
         * gỡ Tiên Đế
         * cấp Đại La Kim Tiên
         *
         * Chỉ giữ role cảnh giới cao nhất.
         */

        await syncHighestLevelRole(
            member,
            newLevel,
        );

        /**
         * =====================================================
         * RESPONSE
         * =====================================================
         *
         * Giảm level KHÔNG gửi thông báo
         * vào channel level.
         */

        await InteractionHelper.safeEditReply(
            interaction,
            {
                content:
                    [
                        `Đã giảm level của ${member}.`,

                        `**Lv.${formatLevelNumber(oldLevel)} → Lv.${formatLevelNumber(newLevel)}**`,

                        `Giảm thực tế: **-${formatLevelNumber(oldLevel - newLevel)} level**`,
                    ].join(
                        '\n',
                    ),
            },
        );

        logger.info(
            `[LEVEL] ${interaction.user.tag} removed levels from ${targetUser.tag}: Lv.${formatLevelNumber(oldLevel)} -> Lv.${formatLevelNumber(newLevel)}`,
        );
    },
};
