import {
    EmbedBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} from 'discord.js';
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
            const ts = Math.floor(Date.now() / 1000);
            const ratedTitle = `<a:trangtrig2:1546040703375904801> **THANKS YOUR FEEDBACK** <a:trangtrig3:1546040818261954610>`;
            const ratedBody = [
                `Bạn đã đánh giá ticket này **${STAR_LABELS[String(ticketData.feedback.rating)] || ticketData.feedback.rating}** rồi nè!`,
                `> Đánh giá của bạn đã được ghi lại vào hệ thống.`,
                '',
                `Cảm ơn bạn rất nhiều! Chúc bạn một ngày tốt lành! <a:heartg1:1545307544808071258>`,
                '',
                `<a:trangtrig41:1547238037832863744> **Thời gian:** <t:${ts}:F>`,
            ].join('\n');

            try {
                const ratedContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# ${ratedTitle}`)
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(ratedBody)
                    );

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [],
                    files: [],
                    components: [ratedContainer],
                    flags: MessageFlags.IsComponentsV2,
                });
            } catch (err) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Bạn đã đánh giá rồi')
                            .setDescription(ratedBody)
                            .setColor(getColor('success')),
                    ],
                    files: [],
                    components: [],
                });
            }
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
            const ticketName = interaction.client.channels.cache.get(channelId)?.name || (ticketData.number ? `ticket-${ticketData.number}` : ticketData.id);
            await logTicketFeedback({
                client: interaction.client,
                guildId,
                ticketNumber: ticketName,
                ticketChannelId: channelId,
                userId: interaction.user.id,
                rating,
            });
        } catch (err) {
            logger.warn('ticketFeedback: failed to send log', { guildId, channelId, error: err.message });
        }

        const ts = Math.floor(Date.now() / 1000);
        const thankTitle = `<a:trangtrig2:1546040703375904801> **THANKS YOUR FEEDBACK** <a:trangtrig3:1546040818261954610>`;
        let thankLines;

        if (rating >= 3) {
            thankLines = [
                `Bạn đã đánh giá trải nghiệm hỗ trợ vừa rồi **(${ratingLabel})**.`,
                `> Đánh giá của bạn đã được ghi lại vào hệ thống.`,
                '',
                `Xin chân thành cảm ơn đánh giá của bạn. Chúc bạn một ngày tốt lành! <a:heartg1:1545307544808071258>`,
                '',
                `<a:trangtrig41:1547238037832863744> **Thời gian:** <t:${ts}:F>`,
            ].join('\n');
        } else {
            thankLines = [
                `Bạn đã đánh giá trải nghiệm hỗ trợ vừa rồi **(${ratingLabel})**.`,
                `> Đánh giá của bạn đã được ghi lại vào hệ thống.`,
                '',
                `Bọn mình thành thật xin lỗi vì trải nghiệm hỗ trợ vừa rồi chưa được trọn vẹn và làm bạn phiền lòng. Bọn mình sẽ ghi nhận để chấn chỉnh và cải thiện ngay lập tức! <a:heartg1:1545307544808071258>`,
                '',
                `Xin chân thành cảm ơn đánh giá của bạn. Chúc bạn một ngày tốt lành! <a:heartg1:1545307544808071258>`,
                '',
                `<a:trangtrig41:1547238037832863744> **Thời gian:** <t:${ts}:F>`,
            ].join('\n');
        }

        try {
            const thankContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ${thankTitle}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(thankLines)
                );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [],
                files: [],
                components: [thankContainer],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (v2Err) {
            logger.warn('Failed to edit feedback reply as Components V2, falling back to embed:', v2Err);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    new EmbedBuilder()
                        .setTitle('THANKS YOUR FEEDBACK')
                        .setDescription(thankLines)
                        .setColor(getColor('success')),
                ],
                files: [],
                components: [],
            });
        }

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
        try {
            await interaction.deferUpdate();
            const ts = Math.floor(Date.now() / 1000);
            const declineTitle = `<a:trangtrig2:1546040703375904801> **THANK YOU** <a:trangtrig3:1546040818261954610>`;
            const declineBody = [
                `Không sao nè! Cảm ơn bạn đã hợp tác với bọn mình trong quá trình vừa rồi nhé! <a:heartg1:1545307544808071258>`,
                '',
                `Nếu bạn cần hỗ trợ thêm bất cứ lúc nào, bọn mình luôn sẵn sàng ở đây nhé. Chúc bạn một ngày thật vui vẻ và nhiều may mắn!`,
                '',
                `<a:trangtrig41:1547238037832863744> **Thời gian:** <t:${ts}:F>`,
            ].join('\n');

            const declineContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ${declineTitle}`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(declineBody)
                );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [],
                files: [],
                components: [declineContainer],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (err) {
            logger.warn('Failed to handle feedback decline as V2:', err);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('👋 Cảm ơn bạn!')
                        .setDescription('Bạn có thể liên hệ lại bất cứ lúc nào nếu cần hỗ trợ thêm nhé.')
                        .setColor(getColor('default')),
                ],
                files: [],
                components: [],
            }).catch(() => {});
        }
    },
};

export default [feedbackHandler, commentHandler, declineHandler];
