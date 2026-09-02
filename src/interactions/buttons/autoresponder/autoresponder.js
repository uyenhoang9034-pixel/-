import {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} from 'discord.js';

import {
    getBuilderSession,
    deleteBuilderSession,
    createAutoresponder,
    updateAutoresponder,
} from '../../../services/autoresponder/autoresponderService.js';

import {
    InteractionHelper,
} from '../../../utils/interactionHelper.js';

export default [
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

            const current =
                session.response
                    .embeds?.[0] || {};

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `autoresponder_embed:${sessionId}`,
                    )
                    .setTitle(
                        '🎨 Edit Embed',
                    );

            const fields = [
                [
                    'embed_title',
                    'Title',
                    current.title || '',
                ],
                [
                    'embed_description',
                    'Description',
                    current.description || '',
                ],
                [
                    'embed_color',
                    'Color',
                    current.color || '#FFB6D9',
                ],
                [
                    'embed_thumbnail',
                    'Thumbnail URL',
                    current.thumbnail || '',
                ],
                [
                    'embed_image',
                    'Image URL',
                    current.image || '',
                ],
            ];

            for (
                const [
                    id,
                    label,
                    value,
                ] of fields
            ) {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId(id)
                            .setLabel(label)
                            .setStyle(
                                id ===
                                    'embed_description'
                                    ? TextInputStyle.Paragraph
                                    : TextInputStyle.Short,
                            )
                            .setRequired(false)
                            .setValue(
                                value.substring(
                                    0,
                                    4000,
                                ),
                            ),
                    ),
                );
            }

            await interaction.showModal(
                modal,
            );
        },
    },

    {
        name:
            'autoresponder_add_button',

        async execute(
            interaction,
            client,
            args,
        ) {
            const [
                sessionId,
            ] = args;

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `autoresponder_button:${sessionId}`,
                    )
                    .setTitle(
                        '🔘 Add Button',
                    )
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(
                                    'button_label',
                                )
                                .setLabel(
                                    'Button label',
                                )
                                .setRequired(true)
                                .setMaxLength(
                                    80,
                                )
                                .setStyle(
                                    TextInputStyle.Short,
                                ),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(
                                    'button_style',
                                )
                                .setLabel(
                                    'Style: primary / secondary / success / danger / link',
                                )
                                .setRequired(true)
                                .setStyle(
                                    TextInputStyle.Short,
                                ),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(
                                    'button_url',
                                )
                                .setLabel(
                                    'URL nếu là link',
                                )
                                .setRequired(false)
                                .setStyle(
                                    TextInputStyle.Short,
                                ),
                        ),
                    );

            await interaction.showModal(
                modal,
            );
        },
    },

    {
        name:
            'autoresponder_save',

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

            const result =
                session.mode ===
                'create'
                    ? await createAutoresponder(
                        client,
                        session.guildId,
                        {
                            keyword:
                                session.keyword,
                            type:
                                session.type,
                            response:
                                session.response,
                        },
                    )
                    : await updateAutoresponder(
                        client,
                        session.guildId,
                        session.responderId,
                        {
                            keyword:
                                session.keyword,
                            type:
                                session.type,
                            response:
                                session.response,
                        },
                    );

            if (
                !result.success
            ) {
                return InteractionHelper.safeReply(
                    interaction,
                    {
                        content:
                            `❌ ${result.message || 'Không thể lưu autoresponder.'}`,
                        flags:
                            MessageFlags.Ephemeral,
                    },
                );
            }

            deleteBuilderSession(
                sessionId,
            );

            await interaction.reply({
                content:
                    `🌸 Đã lưu autoresponder **${result.responder.displayKeyword}** thành công!`,
                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },

    {
        name:
            'autoresponder_cancel',

        async execute(
            interaction,
            client,
            args,
        ) {
            const [
                sessionId,
            ] = args;

            deleteBuilderSession(
                sessionId,
            );

            await interaction.reply({
                content:
                    '🌷 Đã hủy Builder.',
                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },
];
