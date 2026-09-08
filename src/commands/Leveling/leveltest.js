import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    setUserLevel,
    getUserLevelData,
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
            .setName('levelset')
            .setDescription('Đặt level cố định cho thành viên')

            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('Thành viên muốn đặt level')
                    .setRequired(true),
            )

            .addIntegerOption(option =>
                option
                    .setName('level')
                    .setDescription('Level muốn đặt')
                    .setRequired(true)
                    .setMinValue(0)
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

        const newLevel =
            interaction.options.getInteger(
                'level',
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

        const userData =
            await setUserLevel(
                client,
                interaction.guildId,
                targetUser.id,
                newLevel,
            );

        await syncHighestLevelRole(
            member,
            newLevel,
        );

        /**
         * Chỉ thông báo khi level tăng.
         *
         * Set xuống thấp hơn chỉ sync role.
         */
        if (
            newLevel >
            oldData.level
        ) {
            await sendLevelAnnouncement({
                guild:
                    interaction.guild,

                member,

                level:
                    newLevel,

                source:
                    'admin',
            });
        }

        await InteractionHelper.safeEditReply(
            interaction,
            {
                content:
                    `Đã đặt level của ${member}.\n**Lv.${oldData.level} → Lv.${userData.level}**`,
            },
        );

        logger.info(
            `[LEVEL] ${interaction.user.tag} set ${targetUser.tag} from Lv.${oldData.level} to Lv.${userData.level}`,
        );
    },
};
