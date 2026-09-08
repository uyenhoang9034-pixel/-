import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    addLevels,
    getLevelingConfig,
} from '../../services/leveling/leveling.js';

import {
    syncHighestLevelRole,
} from '../../services/leveling/levelRoleService.js';

import {
    sendLevelAnnouncement,
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
            .setName('leveladd')
            .setDescription('Tăng level cho thành viên')

            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('Thành viên muốn tăng level')
                    .setRequired(true),
            )

            .addIntegerOption(option =>
                option
                    .setName('levels')
                    .setDescription('Số level muốn tăng')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(LEVELING_MAX_LEVEL),
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageGuild,
            )

            .setDMPermission(false),

    category: 'Leveling',

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

        const userData =
            await addLevels(
                client,
                interaction.guildId,
                targetUser.id,
                levelsToAdd,
            );

        await syncHighestLevelRole(
            member,
            userData.level,
        );

        await sendLevelAnnouncement({
            guild:
                interaction.guild,

            member,

            level:
                userData.level,

            source:
                'admin',
        });

        await InteractionHelper.safeEditReply(
            interaction,
            {
                content:
                    `Đã tăng **${levelsToAdd} level** cho ${member}.\nLevel hiện tại: **Lv.${userData.level}**`,
            },
        );

        logger.info(
            `[LEVEL] ${interaction.user.tag} added ${levelsToAdd} levels to ${targetUser.tag}. New level: ${userData.level}`,
        );
    },
};
