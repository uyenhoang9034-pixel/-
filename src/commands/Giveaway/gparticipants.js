import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { getGuildGiveaways } from '../../utils/giveaways.js';
import { logger } from '../../utils/logger.js';
import {
    TitanBotError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

const GIVEAWAY_ADMIN_ROLE_ID = '1541303749916754001';
const USERS_PER_PAGE = 20;

export default {
    data: new SlashCommandBuilder()
        .setName('gparticipants')
        .setDescription('Xem danh sách người đã tham gia một giveaway.')
        .addStringOption((option) =>
            option
                .setName('messageid')
                .setDescription('Message ID của giveaway cần xem.')
                .setRequired(true),
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway participants command used outside guild',
                ErrorTypes.VALIDATION,
                'Lệnh này chỉ có thể sử dụng trong server.',
                { userId: interaction.user.id },
            );
        }

        if (!interaction.member.roles.cache.has(GIVEAWAY_ADMIN_ROLE_ID)) {
            await interaction.reply({
                content: '❌ Bạn không có quyền xem danh sách người tham gia giveaway.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const messageId = interaction.options.getString('messageid', true).trim();

        try {
            const giveaways = await getGuildGiveaways(
                interaction.client,
                interaction.guildId,
            );

            const giveaway = giveaways.find(
                (item) => item?.messageId === messageId,
            );

            if (!giveaway) {
                await interaction.reply({
                    content: '❌ Không tìm thấy giveaway có Message ID này trong server.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const participants = Array.isArray(giveaway.participants)
                ? [...new Set(giveaway.participants.filter(Boolean))]
                : [];

            const totalPages = Math.max(
                1,
                Math.ceil(participants.length / USERS_PER_PAGE),
            );

            const embeds = [];

            for (let page = 0; page < totalPages; page += 1) {
                const start = page * USERS_PER_PAGE;
                const pageParticipants = participants.slice(
                    start,
                    start + USERS_PER_PAGE,
                );

                const participantText = pageParticipants.length
                    ? pageParticipants
                        .map((userId, index) =>
                            `**${start + index + 1}.** <@${userId}> \`${userId}\``,
                        )
                        .join('\n')
                    : '*Chưa có người tham gia.*';

                const status = giveaway.ended || giveaway.isEnded
                    ? 'Đã kết thúc'
                    : 'Đang diễn ra';

                const embed = new EmbedBuilder()
                    .setColor(0xF4A6C1)
                    .setTitle('🎉 Giveaway Participants')
                    .setDescription(participantText)
                    .addFields(
                        {
                            name: '🎁 Phần thưởng',
                            value: String(giveaway.prize || 'Không xác định').slice(0, 1024),
                            inline: true,
                        },
                        {
                            name: '👥 Tổng tham gia',
                            value: participants.length.toString(),
                            inline: true,
                        },
                        {
                            name: '📌 Trạng thái',
                            value: status,
                            inline: true,
                        },
                        {
                            name: '🆔 Message ID',
                            value: `\`${messageId}\``,
                            inline: false,
                        },
                    )
                    .setFooter({
                        text: `Trang ${page + 1}/${totalPages} • Chỉ Admin được xem`,
                    })
                    .setTimestamp();

                embeds.push(embed);
            }

            // Discord chỉ cho tối đa 10 embeds trong một message.
            // Nếu giveaway rất lớn, gửi nhiều ephemeral follow-up theo từng nhóm 10 trang.
            const chunks = [];
            for (let i = 0; i < embeds.length; i += 10) {
                chunks.push(embeds.slice(i, i + 10));
            }

            await interaction.reply({
                embeds: chunks[0],
                flags: MessageFlags.Ephemeral,
            });

            for (let i = 1; i < chunks.length; i += 1) {
                await interaction.followUp({
                    embeds: chunks[i],
                    flags: MessageFlags.Ephemeral,
                });
            }

            logger.info(
                `Giveaway participants viewed by ${interaction.user.tag}: ${messageId} (${participants.length} participants)`,
            );
        } catch (error) {
            logger.error('Error viewing giveaway participants:', error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ Có lỗi khi đọc danh sách người tham gia giveaway.',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: '❌ Có lỗi khi đọc danh sách người tham gia giveaway.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};
