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
} from '../../config/leveling/levelingSystem.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

export default {
    data:
        new SlashCommandBuilder()
            .setName('levelremove')
            .setDescription('Giảm level của thành viên')

            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('Thành viên muốn giảm level')
                    .setRequired(true),
            )

            .addIntegerOption(option =>
                option
                    .setName('levels')
                    .setDescription('Số level muốn giảm')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(LEVELING_MAX_LEVEL),
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageGuild,
            )

            .setDMPermission(false),

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
                .fetch(targetUser.id)
                .catch(() => null);

        if (!member) {
            await InteractionHelper.safeEditReply(
                interaction,
                {
                    content:
                        'Không tìm thấy thành viên này trong server.',
                },
            );

            return;
        }

        const oldData =
            await getUserLevelData(
                client,
                interaction.guildId,
                targetUser.id,
            );

        if (
            oldData.level <= 0
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

        const updatedData =
            await removeLevels(
                client,
                interaction.guildId,
                targetUser.id,
                levelsToRemove,
            );

        await syncHighestLevelRole(
            member,
            updatedData.level,
        );

        await InteractionHelper.safeEditReply(
            interaction,
            {
                content:
                    `Đã giảm level của ${member}.\n**Lv.${oldData.level} → Lv.${updatedData.level}**`,
            },
        );

        logger.info(
            `[LEVEL] ${interaction.user.tag} removed ${levelsToRemove} levels from ${targetUser.tag}. New level: ${updatedData.level}`,
        );
    },
};
