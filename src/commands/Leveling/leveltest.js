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
    LEVEL_MILESTONE_LEVELS,
    formatLevelNumber,
} from '../../config/leveling/levelingSystem.js';

/**
 * =========================================================
 * /leveltest
 * =========================================================
 *
 * CHỈ TEST GIAO DIỆN.
 *
 * KHÔNG:
 *
 * - tăng level thật
 * - giảm level thật
 * - đổi XP
 * - gắn role
 * - xóa role
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
                                    'Phá Cảnh · Tiên Lộ / Cực Cảnh',

                                value:
                                    'tien_lo',
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
                            'Thành viên muốn hiển thị trong test',
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

        const milestone =
            getExactMilestone(
                level,
            );

        /**
         * =====================================================
         * PHI THĂNG
         * =====================================================
         *
         * Chỉ mốc <= 999.
         */

        if (
            type ===
            'phi_thang'
        ) {
            if (
                !milestone ||
                milestone.announcementType !==
                    'phi_thang'
            ) {
                await interaction.reply({
                    content:
                        [
                            '❌ Level này không phải mốc **Phá Cảnh · Phi Thăng**.',

                            '',

                            'Các mốc hợp lệ:',

                            '**Lv.1, 10, 20, 40, 70, 100, 200, 300, 500, 999**',
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
                        '❌ Không thể gửi thông báo Phi Thăng.',

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }
        }

        /**
         * =====================================================
         * TIÊN LỘ / CỰC CẢNH
         * =====================================================
         */

        else if (
            type ===
            'tien_lo'
        ) {
            if (
                !milestone ||
                ![
                    'tien_lo',
                    'cuc_canh',
                ].includes(
                    milestone.announcementType,
                )
            ) {
                await interaction.reply({
                    content:
                        [
                            '❌ Level này không phải mốc **Tiên Lộ / Cực Cảnh**.',

                            '',

                            'Các mốc hợp lệ:',

                            '**Lv.1.999, 3.999, 6.999, 9.999**',
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
                        milestone.announcementType,
                });

            if (
                !success
            ) {
                await interaction.reply({
                    content:
                        `❌ Không thể gửi thông báo Lv.${formatLevelNumber(level)}.`,

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }
        }

        /**
         * =====================================================
         * VOICE
         * =====================================================
         */

        else if (
            type ===
            'voice'
        ) {
            /**
             * Không cho test Voice thường
             * bằng đúng một milestone,
             * vì ngoài đời milestone sẽ ưu tiên
             * thông báo cảnh giới.
             */

            if (
                milestone
            ) {
                await interaction.reply({
                    content:
                        [
                            '❌ Level này là một mốc cảnh giới đặc biệt.',

                            '',

                            'Hãy chọn level khác nếu muốn test **TU VI TINH TIẾN**.',

                            '',

                            `Các milestone hiện tại: **${LEVEL_MILESTONE_LEVELS
                                .map(
                                    item =>
                                        formatLevelNumber(
                                            item,
                                        ),
                                )
                                .join(', ')}**`,
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

        /**
         * =====================================================
         * PHÁ CẢNH THƯỜNG
         * =====================================================
         */

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

        /**
         * =====================================================
         * IMAGE INFO
         * =====================================================
         */

        let imageInfo =
            'Không sử dụng ảnh.';

        if (
            milestone?.image &&
            type !==
                'pha_canh' &&
            type !==
                'voice'
        ) {
            imageInfo =
                `Ảnh: \`${milestone.image.path}\``;
        }

        /**
         * =====================================================
         * CONFIRM
         * =====================================================
         */

        await interaction.reply({
            content:
                [
                    '✅ Đã gửi thông báo test.',

                    '',

                    `Level hiển thị: **Lv.${formatLevelNumber(level)}**`,

                    `Thành viên: ${member}`,

                    imageInfo,

                    '',

                    'Level, XP và role thật **không bị thay đổi**.',
                ].join(
                    '\n',
                ),

            flags:
                MessageFlags.Ephemeral,
        });
    },
};
