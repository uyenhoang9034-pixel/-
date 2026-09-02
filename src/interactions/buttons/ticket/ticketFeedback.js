import { EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getTicketData, saveTicketData } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';
import { logTicketFeedback } from '../../../utils/ticket/ticketLogging.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

const STAR_LABELS = {
    '1': '⭐ 1 — Rất tệ',
    '2': '⭐ 2 — Chưa tốt',
    '3': '⭐ 3 — Bình thường',
    '4': '⭐ 4 — Tốt',
    '5': '⭐ 5 — Tuyệt vời',
};

const feedbackHandler = {
    name: 'ticket_feedback',

    async execute(interaction, client, args) {
        
        const [guildId, channelId, ratingStr] = args;

        if (!guildId || !channelId || !ratingStr) {
            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Liên kết đánh giá không hợp lệ')
                        .setDescription('Liên kết đánh giá này không hợp lệ hoặc đã bị lỗi.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        try {
            await interaction.deferUpdate();
        } catch (err) {
            logger.warn('ticketFeedback: interaction expired before deferUpdate', { guildId, channelId, error: err.message });
            return;
        }

        let ticketData;
        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn('ticketFeedback: failed to load ticket data', { guildId, channelId, error: err.message });
        }

        if (!ticketData) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Không tìm thấy ticket')
                        .setDescription('Không thể tìm thấy ticket liên quan đến đánh giá này.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        if (interaction.user.id !== ticketData.userId) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Không thể thực hiện')
                        .setDescription('Chỉ người đã mở ticket mới có thể gửi đánh giá cho ticket này.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        if (ticketData.feedback?.rating) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('✅ Bạn đã đánh giá rồi')
                        .setDescription(
    `Bạn đã đánh giá ticket này **${STAR_LABELS[String(ticketData.feedback.rating)]}**.\n\n` +
    `Cảm ơn bạn đã gửi phản hồi! 💗`
)
                        .setColor(getColor('success')),
                ],
                components: [],
            });
            return;
        }

        const rating = parseInt(ratingStr, 10);
        const ratingLabel = STAR_LABELS[String(rating)] ?? `${rating} stars`;

        try {
            ticketData.feedback = {
                rating,
                submittedAt: new Date().toISOString(),
            };
            await saveTicketData(guildId, channelId, ticketData);
        } catch (err) {
            logger.error('ticketFeedback: failed to save feedback', { guildId, channelId, rating, error: err.message });
        }

        try {
            await logTicketFeedback({
                client: interaction.client,
                guildId,
                ticketNumber: ticketData.id,
                ticketChannelId: channelId,
                userId: interaction.user.id,
                rating,
            });
        } catch (err) {
            logger.warn('ticketFeedback: failed to send log', { guildId, channelId, error: err.message });
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('💗 Cảm ơn bạn đã đánh giá!')
                    .setDescription(
    `Bạn đã đánh giá trải nghiệm hỗ trợ của mình: **${ratingLabel}**.\n\n` +
    `Phản hồi của bạn đã được ghi nhận và sẽ giúp chúng mình cải thiện dịch vụ tốt hơn! ✨`
)
                    .setColor(getColor('success'))
                    .setFooter({
    text: 'Cảm ơn bạn đã sử dụng hệ thống hỗ trợ! 🌷'
})
                    .setTimestamp(),
            ],
            components: [],
        });

        logger.info('Ticket feedback submitted', {
            guildId,
            channelId,
            userId: interaction.user.id,
            rating,
        });
    },
};

const commentHandler = {
    name: 'ticket_feedback_comment',

    async execute(interaction, client, args) {
        const [guildId, channelId] = args;

        if (!guildId || !channelId) {
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⚠️ Invalid Feedback Link')
                        .setDescription('This feedback action appears to be malformed.')
                        .setColor(getColor('error')),
                ],
                components: [],
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`ticket_feedback_comment_modal:${guildId}:${channelId}`)
            .setTitle('Gửi nhận xét về hỗ trợ');

        const commentInput = new TextInputBuilder()
            .setCustomId('feedback_comment')
            .setLabel('Nhận xét của bạn')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Hãy chia sẻ điều bạn hài lòng hoặc điều chúng mình có thể cải thiện...')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(commentInput));

        await interaction.showModal(modal);
    },
};

const declineHandler = {
    name: 'ticket_feedback_decline',

    async execute(interaction) {
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('👋 No problem!')
                    .setDescription('You can always reach out again if you need further support.')
                    .setColor(getColor('default')),
            ],
            components: [],
        });
    },
};

export default [feedbackHandler, commentHandler, declineHandler];
