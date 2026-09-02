import {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} from 'discord.js';

import {
    InteractionHelper,
} from '../../../utils/interactionHelper.js';

import {
    getBuilderSession,
    updateBuilderSession,
} from '../../../services/autoresponder/autoresponderService.js';

function errorMessage(
    content,
) {
    return {
        content,
        ephemeral: true,
    };
}

export default [
    {
        name:
            'autoresponder_initial',

        async execute(
            interaction,
            client,
            args,
        ) {
            const [
                sessionId,
            ] = args;

            const session =
                getBuilderSession(
                    sessionId,
                );

            if (
                !session ||
                session.userId !==
                    interaction.user.id
            ) {
                return InteractionHelper.safeReply(
                    interaction,
                    errorMessage(
                        '⚠️ Builder này không còn tồn tại hoặc không phải của bạn.',
                    ),
                );
            }

            const content =
                interaction.fields
                    .getTextInputValue(
                        'response_content',
                    )
                    ?.trim() || '';

            session.response.content =
                content;

            updateBuilderSession(
                sessionId,
                {
                    response:
                        session.response,
                },
            );

            await interaction.reply({
                content:
                    '🌸 Đã lưu nội dung. Builder đang được mở...',
                ephemeral: true,
            });

            await sendBuilder(
                interaction,
                session,
            );
        },
    },

    {
        name:
            'autoresponder_embed',

        async execute(
            interaction,
            client,
            args,
        ) {
            const [
                sessionId,
            ] = args;

            const session =
                getBuilderSession(
                    sessionId,
                );

            if (
                !session ||
                session.userId !==
                    interaction.user.id
            ) {
                return;
            }

            const embed = {
                title:
                    interaction.fields
                        .getTextInputValue(
                            'embed_title',
                        )
                        ?.trim() || '',

                description:
                    interaction.fields
                        .getTextInputValue(
                            'embed_description',
                        )
                        ?.trim() || '',

                color:
                    interaction.fields
                        .getTextInputValue(
                            'embed_color',
                        )
                        ?.trim() || '',

                thumbnail:
                    interaction.fields
                        .getTextInputValue(
                            'embed_thumbnail',
                        )
                        ?.trim() || '',

                image:
                    interaction.fields
                        .getTextInputValue(
                            'embed_image',
                        )
                        ?.trim() || '',
            };

            session.response.embeds =
                [embed];

            updateBuilderSession(
                sessionId,
                {
                    response:
                        session.response,
                },
            );

            await interaction.reply({
                content:
                    '🎨 Embed đã được lưu.',
                ephemeral: true,
            });
        },
    },

    {
        name:
            'autoresponder_button',

        async execute(
            interaction,
            client,
            args,
        ) {
            const [
                sessionId,
            ] = args;

            const session =
                getBuilderSession(
                    sessionId,
                );

            if (
                !session ||
                session.userId !==
                    interaction.user.id
            ) {
                return;
            }

            const label =
                interaction.fields
                    .getTextInputValue(
                        'button_label',
                    )
                    .trim();

            const style =
                interaction.fields
                    .getTextInputValue(
                        'button_style',
                    )
                    .trim()
                    .toLowerCase();

            const url =
                interaction.fields
                    .getTextInputValue(
                        'button_url',
                    )
                    ?.trim();

            if (
                style === 'link' &&
                !url
            ) {
                return InteractionHelper.safeReply(
                    interaction,
                    errorMessage(
                        '⚠️ Link button cần có URL.',
                    ),
                );
            }

            session.response.buttons.push(
                {
    label,
    style,
    customId:
        style === 'link'
            ? undefined
            : `autoresponder_action_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}`,
    url:
        style === 'link'
            ? url
            : undefined,
}

            updateBuilderSession(
                sessionId,
                {
                    response:
                        session.response,
                },
            );

            await interaction.reply({
                content:
                    '🔘 Button đã được thêm.',
                ephemeral: true,
            });
        },
    },
];

async function sendBuilder(
    interaction,
    session,
) {
    const {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        EmbedBuilder,
    } = await import('discord.js');

    const embed = new EmbedBuilder()
        .setColor('#FFB6D9')
        .setTitle('🌸 Autoresponder Builder')
        .setDescription(
            [
                `🔑 **Keyword:** ${session.keyword || '(chưa có)'}`,
                `🎀 **Type:** ${session.type || 'everyone'}`,
                '',
                'Chọn một mục bên dưới để chỉnh response.',
                '',
                '🎨 **Edit Embed** — chỉnh title, description, màu, thumbnail, image.',
                '🔘 **Add Button** — thêm button vào response.',
                '💬 **Reply / Settings** — cài đặt reply và mention.',
                '💾 **Save** — lưu autoresponder.',
                '🌷 **Cancel** — hủy thao tác.',
            ].join('\n'),
        );

    const embedButton =
        new ButtonBuilder()
            .setCustomId(
                `autoresponder_embed:${session.id}`,
            )
            .setLabel('Edit Embed')
            .setEmoji('🎨')
            .setStyle(
                ButtonStyle.Primary,
            );

    const addButton =
        new ButtonBuilder()
            .setCustomId(
                `autoresponder_add_button:${session.id}`,
            )
            .setLabel('Add Button')
            .setEmoji('🔘')
            .setStyle(
                ButtonStyle.Secondary,
            );

    const settingsButton =
        new ButtonBuilder()
            .setCustomId(
                `autoresponder_settings:${session.id}`,
            )
            .setLabel('Reply / Settings')
            .setEmoji('💬')
            .setStyle(
                ButtonStyle.Secondary,
            );

    const saveButton =
        new ButtonBuilder()
            .setCustomId(
                `autoresponder_save:${session.id}`,
            )
            .setLabel('Save')
            .setEmoji('💾')
            .setStyle(
                ButtonStyle.Success,
            );

    const cancelButton =
        new ButtonBuilder()
            .setCustomId(
                `autoresponder_cancel:${session.id}`,
            )
            .setLabel('Cancel')
            .setEmoji('🌷')
            .setStyle(
                ButtonStyle.Danger,
            );

    const row =
        new ActionRowBuilder()
            .addComponents(
                embedButton,
                addButton,
                settingsButton,
                saveButton,
                cancelButton,
            );

    const payload = {
        embeds: [embed],
        components: [row],
    };

    if (
        interaction.replied ||
        interaction.deferred
    ) {
        return interaction.editReply(
            payload,
        );
    }

    return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
    });
}
