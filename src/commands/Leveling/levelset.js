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


        // =====================================================
        // CONFIG
        // =====================================================

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


        // =====================================================
        // OPTIONS
        // =====================================================

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


        // =====================================================
        // OLD DATA
        // =====================================================

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


        // =====================================================
        // SET LEVEL
        // =====================================================

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


        // =====================================================
        // ROLE
        // =====================================================

        await syncHighestLevelRole(
            member,
            newLevel,
        );


        // =====================================================
        // ANNOUNCEMENT
        // =====================================================
        //
        // Chỉ thông báo nếu level tăng.
        //
        // Nếu đi qua milestone:
        // -> gửi từng Phi Thăng.
        //
        // Nếu không đi qua milestone:
        // -> gửi level cuối bình thường.
        //
        // Set xuống:
        // -> không thông báo, chỉ sync role.
        // =====================================================

        let announcementResult = {
            sent:
                0,

            milestones:
                [],
        };


        if (
            newLevel >
            oldLevel
        ) {
            announcementResult =
                await sendLevelChangeAnnouncements({
                    guild:
                        interaction.guild,

                    member,

                    oldLevel,

                    newLevel,

                    source:
                        'admin',
                });
        }


        // =====================================================
        // RESPONSE
        // =====================================================

        const responseLines = [
            `Đã đặt level của ${member}.`,

            `**Lv.${oldLevel} → Lv.${newLevel}**`,
        ];


        if (
            newLevel >
            oldLevel
        ) {
            responseLines.push(
                announcementResult.sent > 0
                    ? `Đã gửi **${announcementResult.sent}** thông báo level.`
                    : 'Không có thông báo level nào được gửi.',
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
            `[LEVEL] ${interaction.user.tag} set ${targetUser.tag} from Lv.${oldLevel} to Lv.${newLevel}`,
        );
    },
};
