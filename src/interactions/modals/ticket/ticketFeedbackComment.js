import {
    EmbedBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
} from 'discord.js';
import { getTicketData, saveTicketData } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';
import { logTicketFeedback } from '../../../utils/ticket/ticketLogging.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { buildDefaultTicketChannelName } from '../../../services/ticket.js';

function buildEmbed(title, description, color) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color);
}

export default {
    name: 'ticket_feedback_comment_modal',

    async execute(interaction, client, args) {
        const [guildId, channelId] = args;

        if (!guildId || !channelId) {
            await InteractionHelper.safeReply(interaction, {
                embeds: [buildEmbed(
                    '⚠️ Gửi phản hồi không hợp lệ',
                    'Biểu mẫu phản hồi này không hợp lệ hoặc đã xảy ra lỗi.',
                    getColor('error'),
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const comment = interaction.fields.getTextInputValue('feedback_comment')?.trim();
        if (!comment) {
            await InteractionHelper.safeReply(interaction, {
                embeds: [buildEmbed(
                    '⚠️ Phản hồi đang trống',
                    'Vui lòng nhập nhận xét trước khi gửi phản hồi.',
                    getColor('warning'),
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        let ticketData;
        try {
            ticketData = await getTicketData(guildId, channelId);
        } catch (err) {
            logger.warn('ticketFeedbackComment: failed to load ticket data', { guildId, channelId, error: err.message });
        }

        if (!ticketData) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildEmbed(
                    '⚠️ Không tìm thấy ticket',
                    'Không thể tìm thấy ticket liên quan đến phản hồi này.',
                    getColor('error'),
                )],
            });
            return;
        }

        if (interaction.user.id !== ticketData.userId) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildEmbed(
                    '❌ Không thể thực hiện',
                    'Chỉ người đã mở ticket mới có thể gửi phản hồi cho ticket này.',
                    getColor('error'),
                )],
            });
            return;
        }

        ticketData.feedback = {
            ...ticketData.feedback,
            comment,
            commentSubmittedAt: new Date().toISOString(),
        };

        try {
            await saveTicketData(guildId, channelId, ticketData);
        } catch (err) {
            logger.error('ticketFeedbackComment: failed to save feedback', { guildId, channelId, error: err.message });
        }

        try {
            const ticketName = interaction.client.channels.cache.get(channelId)?.name || (ticketData.number ? buildDefaultTicketChannelName(ticketData.number) : ticketData.id);
            await logTicketFeedback({
                client: interaction.client,
                guildId,
                ticketNumber: ticketName,
                ticketChannelId: channelId,
                userId: interaction.user.id,
                rating: ticketData.feedback?.rating ?? null,
                comment,
            });
        } catch (err) {
            logger.warn('ticketFeedbackComment: failed to send log', { guildId, channelId, error: err.message });
        }

        const ts = Math.floor(Date.now() / 1000);
        const commentTitle = `<a:trangtrig2:1546040703375904801> **FEEDBACK RECEIVED** <a:trangtrig3:1546040818261954610>`;
        const commentBody = [
            `Cảm ơn bạn đã gửi nhận xét chi tiết về dịch vụ hỗ trợ!`,
            `> "${comment}"`,
            '',
            `Ý kiến đóng góp quý báu của bạn đã được chuyển tới Ban Quản Trị để cải thiện và nâng cao chất lượng phục vụ. <a:heartg1:1545307544808071258>`,
            '',
            `<a:trangtrig41:1547238037832863744> **Thời gian:** <t:${ts}:F>`,
        ].join('\n');

        try {
            const commentContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ${commentTitle}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(commentBody)
                );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [],
                components: [commentContainer],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (v2Err) {
            logger.warn('Failed to edit modal reply as V2:', v2Err);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildEmbed(
                    '💗 Đã gửi phản hồi',
                    'Phản hồi của bạn đã được ghi nhận. Cảm ơn bạn đã giúp chúng mình cải thiện dịch vụ! ✨',
                    getColor('success'),
                )],
            });
        }

        logger.info('Ticket feedback comment submitted', {
            guildId,
            channelId,
            userId: interaction.user.id,
        });
    },
};
