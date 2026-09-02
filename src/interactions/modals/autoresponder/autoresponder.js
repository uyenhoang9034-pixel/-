import {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
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
                    url:
                        style === 'link'
                            ? url
                            : undefined,
                },
            );

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
    const response =
        session.response;

    const embedCount =
        response.embeds?.length || 0;

    const imageCount =
        response.files?.length || 0;

    const buttonCount =
        response.buttons?.length || 0;

    const embed =
        {
            title:
                '🌸 Autoresponder Builder',

            description:
                `**Keyword:** \`${session.keyword}\`\n` +
                `**Type:** ${session.type === 'manager' ? 'Manager only' : 'Everyone'}\n\n` +

                `📝 Content: ${response.content ? '✅' : '❌'}\n` +
                `🎨 Embed: ${embedCount ? '✅' : '❌'}\n` +
                `🖼️ Media: ${imageCount}\n` +
                `🔘 Buttons: ${buttonCount}\n` +
                `💬 Reply: ${response.reply?.enabled ? '✅' : '❌'}`,
        };

    await interaction.followUp({
        embeds: [embed],
        ephemeral: true,
    });
}
