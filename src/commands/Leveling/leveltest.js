import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import {
    sendLevelAnnouncement,
} from '../../services/leveling/levelAnnouncementService.js';

import {
    getExactMilestone,
    LEVELING_MAX_LEVEL,
} from '../../config/leveling/levelingSystem.js';

/**
 * =========================================================
 * TEST LEVEL
 * =========================================================
 */

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'leveltest',
            )
            .setDescription(
                'Test giao diện thông báo level',
            )

            .addStringOption(
                option =>
                    option
                        .setName(
                            'type',
                        )
                        .setDescription(
                            'Loại thông báo cần test',
                        )
                        .setRequired(
                            true,
                        )
                        .addChoices(
                            {
                                name:
                                    'Phá Cảnh',
                                value:
                                    'pha_canh',
                            },
                            {
                                name:
                                    'Phá Cảnh · Phi Thăng',
                                value:
                                    'phi_thang',
                            },
                            {
                                name:
                                    'Voice',
                                value:
                                    'voice',
                            },
                        ),
            )

            .addIntegerOption(
                option =>
                    option
                        .setName(
                            'level',
                        )
                        .setDescription(
                            'Level muốn hiển thị',
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

            .addUserOption(
                option =>
                    option
                        .setName(
                            'user',
                        )
                        .setDescription(
                            'Thành viên hiển thị trong test',
                        )
                        .setRequired(
                            false,
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
    ) {
        const type =
            interaction.options
                .getString(
                    'type',
                    true,
                );

        const level =
            interaction.options
                .getInteger(
                    'level',
                    true,
                );

        const targetUser =
            interaction.options
                .getUser(
                    'user',
                ) ||
            interaction.user;

        const member =
            await interaction.guild
                .members
                .fetch(
                    targetUser.id,
                )
                .catch(
                    () => null,
                );

        if (!member) {
            await interaction.reply({
                content:
                    'Không tìm thấy thành viên.',

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        /**
         * =================================================
         * PHI THANG VALIDATION
         * =================================================
         */

        if (
            type ===
                'phi_thang' &&
            !getExactMilestone(
                level,
            )
        ) {
            await interaction.reply({
                content:
                    'Phi Thăng chỉ có ở các mốc: **Lv.1, 10, 20, 40, 70, 100, 200, 300, 500, 999**.',

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        const sent =
            await sendLevelAnnouncement({
                guild:
                    interaction.guild,

                member,

                level,

                source:
                    type === 'voice'
                        ? 'voice'
                        : 'chat',

                forceType:
                    type ===
                    'phi_thang'
                        ? 'phi_thang'
                        : type ===
                            'pha_canh'
                          ? 'pha_canh'
                          : null,
            });

        await interaction.reply({
            content:
                sent
                    ? 'Đã gửi thông báo test. **Không thay đổi level và không cấp role.**'
                    : 'Không thể gửi thông báo vào kênh level.',

            flags:
                MessageFlags.Ephemeral,
        });
    },
};
