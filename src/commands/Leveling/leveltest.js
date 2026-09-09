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
 * Chỉ test giao diện.
 *
 * KHÔNG:
 *
 * - tăng level
 * - giảm level
 * - sửa XP
 * - gắn role
 * - xóa role
 *
 * Phi Thăng sẽ sử dụng ảnh local:
 *
 * Lv.1 / 10 / 20 / 40 / 70
 * -> assets/level/lv1-70.webp
 *
 * Lv.100 / 200 / 300
 * -> assets/level/lv100-300.webp
 *
 * Lv.500
 * -> assets/level/lv500.webp
 *
 * Lv.999
 * -> assets/level/lv999.webp
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

            // =================================================
            // TYPE
            // =================================================

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

            // =================================================
            // LEVEL
            // =================================================

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

            // =================================================
            // USER
            // =================================================

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
        // =====================================================
        // OPTIONS
        // =====================================================

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


        // =====================================================
        // PHI THĂNG
        // =====================================================

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


            const success =
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


            if (
                !success
            ) {
                await interaction.reply({
                    content:
                        [
                            '❌ Không thể gửi thông báo Phi Thăng.',

                            '',

                            `Hãy kiểm tra file ảnh của **Lv.${level}** trong thư mục:`,

                            '`assets/level/`',

                            '',

                            'Và kiểm tra quyền gửi tin nhắn/embed của bot.',
                        ].join(
                            '\n',
                        ),

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }
        }


        // =====================================================
        // VOICE
        // =====================================================

        else if (
            type ===
            'voice'
        ) {
            /**
             * Voice thường không được nhập milestone,
             * vì milestone thật phải ưu tiên Phi Thăng.
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


            const success =
                await sendLevelAnnouncement({
                    guild:
                        interaction.guild,

                    member,

                    level,

                    source:
                        'voice',
                });


            if (
                !success
            ) {
                await interaction.reply({
                    content:
                        '❌ Không thể gửi thông báo Voice Level.',

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }
        }


        // =====================================================
        // PHÁ CẢNH THƯỜNG
        // =====================================================

        else {
            const success =
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


            if (
                !success
            ) {
                await interaction.reply({
                    content:
                        '❌ Không thể gửi thông báo Phá Cảnh.',

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }
        }


        // =====================================================
        // CONFIRMATION
        // =====================================================

        let imageInfo =
            'Không sử dụng ảnh.';


        if (
            type ===
            'phi_thang'
        ) {
            const milestone =
                getExactMilestone(
                    level,
                );


            imageInfo =
                milestone?.image
                    ? `Ảnh: \`assets/level/${milestone.image}\``
                    : 'Không có ảnh.';
        }


        await interaction.reply({
            content:
                [
                    '✅ Đã gửi thông báo test.',

                    '',

                    `Level hiển thị: **Lv.${level}**`,

                    `Thành viên: ${member}`,

                    imageInfo,

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
