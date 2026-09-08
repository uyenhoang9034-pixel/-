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
 * /leveltest
 * =========================================================
 *
 * Chỉ test giao diện thông báo.
 *
 * KHÔNG:
 * - tăng level
 * - giảm level
 * - set level
 * - thay đổi XP
 * - gắn role
 * - xóa role
 *
 * Ví dụ:
 *
 * /leveltest type:Phá Cảnh level:55
 * /leveltest type:Phi Thăng level:100
 * /leveltest type:Voice level:55
 * =========================================================
 */

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'leveltest',
            )
            .setDescription(
                'Test giao diện thông báo level (không thay đổi dữ liệu)',
            )

            .addStringOption(
                option =>
                    option
                        .setName(
                            'type',
                        )
                        .setDescription(
                            'Loại thông báo muốn test',
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
                                    'Voice · Tu Vi Tinh Tiến',
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
                            'Level muốn hiển thị thử',
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
                            'Thành viên muốn hiển thị trong thông báo',
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
        config,
        client,
    ) {
        const type =
            interaction.options.getString(
                'type',
                true,
            );

        const level =
            interaction.options.getInteger(
                'level',
                true,
            );

        const targetUser =
            interaction.options.getUser(
                'user',
            ) ||
            interaction.user;

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
            await interaction.reply({
                content:
                    '❌ Không tìm thấy thành viên này trong server.',

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        /**
         * =============================================
         * PHI THĂNG
         * =============================================
         *
         * Phi Thăng chỉ tồn tại ở milestone thật.
         */

        if (
            type ===
            'phi_thang'
        ) {
            const milestone =
                getExactMilestone(
                    level,
                );

            if (
                !milestone
            ) {
                await interaction.reply({
                    content:
                        [
                            '❌ Level này không phải cảnh giới Phi Thăng.',
                            '',
                            'Các level Phi Thăng hợp lệ:',
                            '**1, 10, 20, 40, 70, 100, 200, 300, 500, 999**',
                        ].join(
                            '\n',
                        ),

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }

            await sendLevelAnnouncement({
                guild:
                    interaction.guild,

                member,

                level,

                source:
                    'admin',

                forceType:
                    'phi_thang',
            });
        }

        /**
         * =============================================
         * VOICE
         * =============================================
         */

        else if (
            type ===
            'voice'
        ) {
            /**
             * Không forceType để source voice
             * chọn giao diện Voice.
             *
             * Nếu nhập đúng milestone thì service
             * sẽ ưu tiên Phi Thăng.
             *
             * Vì đây là TEST giao diện Voice thường,
             * ta ép pha_canh sẽ sai.
             *
             * Do đó gọi source voice với level thường.
             */

            if (
                getExactMilestone(
                    level,
                )
            ) {
                await interaction.reply({
                    content:
                        [
                            '❌ Level này là một mốc Phi Thăng.',
                            '',
                            'Để test giao diện Voice thường, hãy chọn level không phải:',
                            '**1, 10, 20, 40, 70, 100, 200, 300, 500, 999**',
                        ].join(
                            '\n',
                        ),

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }

            await sendLevelAnnouncement({
                guild:
                    interaction.guild,

                member,

                level,

                source:
                    'voice',
            });
        }

        /**
         * =============================================
         * PHÁ CẢNH THƯỜNG
         * =============================================
         */

        else {
            await sendLevelAnnouncement({
                guild:
                    interaction.guild,

                member,

                level,

                source:
                    'admin',

                forceType:
                    'pha_canh',
            });
        }

        /**
         * =============================================
         * CONFIRMATION
         * =============================================
         */

        await interaction.reply({
            content:
                [
                    '✅ Đã gửi thông báo test.',
                    '',
                    `Level hiển thị: **Lv.${level}**`,
                    `Thành viên: ${member}`,
                    '',
                    'Dữ liệu level và role thật **không bị thay đổi**.',
                ].join(
                    '\n',
                ),

            flags:
                MessageFlags.Ephemeral,
        });
    },
};
