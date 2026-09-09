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
    formatLevelNumber,
} from '../../config/leveling/levelingSystem.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'levelset',
            )
            .setDescription(
                'Đặt level cố định cho thành viên',
            )

            .addUserOption(
                option =>
                    option
                        .setName(
                            'user',
                        )
                        .setDescription(
                            'Thành viên muốn đặt level',
                        )
                        .setRequired(
                            true,
                        ),
            )

            .addIntegerOption(
                option =>
                    option
                        .setName(
                            'level',
                        )
                        .setDescription(
                            'Level muốn đặt',
                        )
                        .setRequired(
                            true,
                        )
                        .setMinValue(
                            0,
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

        const requestedLevel =
            interaction.options.getInteger(
                'level',
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
         * OLD DATA
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
         * SET
         * =====================================================
         */

        const userData =
            await setUserLevel(
                client,
                interaction.guildId,
                targetUser.id,
                requestedLevel,
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
         * Luôn sync, kể cả set xuống.
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
         * /levelset KHÔNG duyệt các milestone trung gian.
         *
         * Nếu set tăng:
         * -> chỉ gửi thông báo của level cuối.
         *
         * Nếu level cuối chính là milestone:
         * -> service tự chọn Phi Thăng / Tiên Lộ / Cực Cảnh.
         *
         * Nếu level cuối không phải milestone:
         * -> Phá Cảnh thường.
         *
         * Set xuống:
         * -> không thông báo.
         */

        let announced =
            false;

        if (
            newLevel >
            oldLevel
        ) {
            announced =
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

        /**
         * =====================================================
         * RESPONSE
         * =====================================================
         */

        const responseLines = [
            `Đã đặt level của ${member}.`,

            `**Lv.${formatLevelNumber(oldLevel)} → Lv.${formatLevelNumber(newLevel)}**`,
        ];

        if (
            newLevel >
            oldLevel
        ) {
            responseLines.push(
                announced
                    ? 'Đã gửi thông báo level.'
                    : 'Không thể gửi thông báo level.',
            );
        }

        await InteractionHelper.safeEditReply(
            interaction,
            {
                content:
                    responseLines.join(
                        '\n',
                    ),
            },
        );

        logger.info(
            `[LEVEL] ${interaction.user.tag} set ${targetUser.tag} from Lv.${formatLevelNumber(oldLevel)} to Lv.${formatLevelNumber(newLevel)}`,
        );
    },
};
