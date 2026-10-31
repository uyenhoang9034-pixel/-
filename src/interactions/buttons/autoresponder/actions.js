import {
    MessageFlags,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

export default [
    {
        name:
            'autoresponder_action',

        async execute(
            interaction,
            client,
            args,
        ) {
            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return;
            }

            const buttonLabel = interaction.component?.label || '';

            // Nếu nút là Feedback (hoặc chứa chữ feedback)
            if (buttonLabel.toLowerCase().includes('feedback')) {
                const modal = new ModalBuilder()
                    .setCustomId('autoresponder_feedback_modal')
                    .setTitle('📝 Gửi Feedback')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('feedback_comment')
                                .setLabel('Nội dung feedback / Nhận xét của bạn')
                                .setPlaceholder('Chia sẻ cảm nghĩ hoặc nhận xét về phần thưởng...')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(1000),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('feedback_attachment')
                                .setLabel('Link ảnh decor / bằng chứng (nếu có)')
                                .setPlaceholder('https://...')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                                .setMaxLength(500),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('feedback_rating')
                                .setLabel('Đánh giá (1 - 5 sao)')
                                .setPlaceholder('5')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                                .setMaxLength(5),
                        ),
                    );

                return await interaction.showModal(modal);
            }

            await interaction.reply({
                content:
                    `🌸 Bạn đã nhấn nút **${buttonLabel || 'Tương tác'}** thành công!`,
                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },
];
