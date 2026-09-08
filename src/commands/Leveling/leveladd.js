import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    addLevels,
    getUserLevelData,
    getLevelingConfig,
} from '../../services/leveling/leveling.js';

import {
    syncHighestLevelRole,
} from '../../services/leveling/levelRoleService.js';

import {
    sendLevelChangeAnnouncements,
} from '../../services/leveling/levelAnnouncementService.js';

import {
    LEVELING_MAX_LEVEL,
} from '../../config/leveling/levelingSystem.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'leveladd',
            )
            .setDescription(
                'Tăng level cho thành viên',
            )

            .addUserOption(
                option =>
                    option
                        .setName(
                            'user',
                        )
                        .setDescription(
                            'Thành viên muốn tăng level',
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
                            'Số level muốn tăng',
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
            !levelingConfig
                ?.enabled
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

        const levelsToAdd =
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
            Number(
                oldData.level,
            ) || 0;

        /**
         * =====================================================
         * ADD LEVEL
         * =====================================================
         */

        const userData =
            await addLevels(
                client,
                interaction.guildId,
                targetUser.id,
                levelsToAdd,
            );

        const newLevel =
            Number(
                userData.level,
            ) || 0;

        /**
         * =====================================================
         * ROLE
         * =====================================================
         *
         * Chỉ giữ role cảnh giới cao nhất.
         */

        await syncHighestLevelRole(
            member,
            newLevel,
        );

        /**
         * =====================================================
         * ANNOUNCEMENT
         * =====================================================
         *
         * Ví dụ:
         *
         * Lv.9 -> Lv.21
         *
         * sẽ phát:
         *
         * Lv.10 Trúc Cơ
         * Lv.20 Kim Đan
         */

        await sendLevelChangeAnnouncements({
            guild:
                interaction.guild,

            member,

            oldLevel,

            newLevel,

            source:
                'admin',
        });

        /**
         * =====================================================
         * RESPONSE
         * =====================================================
         */

        await InteractionHelper.safeEditReply(
            interaction,
            {
                content:
                    [
                        `Đã tăng level cho ${member}.`,

                        `**Lv.${oldLevel} → Lv.${newLevel}**`,

                        `Tăng thực tế: **+${newLevel - oldLevel} level**`,
                    ].join(
                        '\n',
                    ),
            },
        );

        logger.info(
            `[LEVEL] ${interaction.user.tag} added levels to ${targetUser.tag}: Lv.${oldLevel} -> Lv.${newLevel}`,
        );
    },
};
