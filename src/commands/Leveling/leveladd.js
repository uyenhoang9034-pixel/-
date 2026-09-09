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
    formatLevelNumber,
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
         * ALREADY MAX
         * =====================================================
         */

        if (
            oldLevel >=
            LEVELING_MAX_LEVEL
        ) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        `${member} đã đạt tối đa **Lv.${formatLevelNumber(LEVELING_MAX_LEVEL)}**.`,
                },
            );

            return;
        }

        /**
         * =====================================================
         * ADD
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
         * /leveladd phải bắt tất cả milestone đã vượt.
         *
         * Ví dụ:
         *
         * 998 -> 2000
         *
         * -> Lv.999 Chân Tiên
         * -> Lv.1.999 Đại La Kim Tiên
         */

        const announcementResult =
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

        const actualAdded =
            newLevel -
            oldLevel;

        await InteractionHelper.safeEditReply(
            interaction,
            {
                content:
                    [
                        `Đã tăng level cho ${member}.`,

                        `**Lv.${formatLevelNumber(oldLevel)} → Lv.${formatLevelNumber(newLevel)}**`,

                        `Tăng thực tế: **+${formatLevelNumber(actualAdded)} level**`,

                        announcementResult.sent >
                        0
                            ? `Đã gửi **${announcementResult.sent}** thông báo level.`
                            : 'Không có thông báo level nào được gửi.',
                    ].join(
                        '\n',
                    ),
            },
        );

        logger.info(
            `[LEVEL] ${interaction.user.tag} added levels to ${targetUser.tag}: Lv.${formatLevelNumber(oldLevel)} -> Lv.${formatLevelNumber(newLevel)}`,
        );
    },
};
