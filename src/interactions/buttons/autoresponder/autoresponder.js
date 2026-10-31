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
        name: 'autoresponder_edit_title',
        async execute(interaction, client, args) {
            const [sessionId] = args;
            const session = getBuilderSession(sessionId);
            if (!session || session.userId !== interaction.user.id) return;

            const current = session.response.embeds?.[0] || {};
            const titleValue = current.title || session.response.title || '';

            const modal = new ModalBuilder()
                .setCustomId(`autoresponder_edit_title:${sessionId}`)
                .setTitle('Sửa Tiêu Đề')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('title_input')
                            .setLabel('Tiêu đề (Title)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Nhập tiêu đề autoresponder (hoặc để trống)...')
                            .setValue(titleValue.substring(0, 256))
                            .setRequired(false)
                            .setMaxLength(256),
                    ),
                );

            await interaction.showModal(modal);
        },
    },

    {
        name: 'autoresponder_edit_content',
        async execute(interaction, client, args) {
            const [sessionId] = args;
            const session = getBuilderSession(sessionId);
            if (!session || session.userId !== interaction.user.id) return;

            const current = session.response.embeds?.[0] || {};
            const contentValue = current.description || session.response.content || '';

            const modal = new ModalBuilder()
                .setCustomId(`autoresponder_edit_content:${sessionId}`)
                .setTitle('Sửa Nội Dung')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('content_input')
                            .setLabel('Nội dung phản hồi (Description)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Nhập nội dung bot sẽ trả lời...')
                            .setValue(contentValue.substring(0, 4000))
                            .setRequired(true)
                            .setMaxLength(4000),
                    ),
                );

            await interaction.showModal(modal);
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
                                    'Tên nút (Label)',
                                )
                                .setPlaceholder('Ví dụ: Feedback')
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
                                    'Kiểu nút (Style)',
                                )
                                .setPlaceholder('primary, secondary, success, danger, link')
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
                                    'URL (nếu kiểu nút là link)',
                                )
                                .setPlaceholder('https://...')
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
        'autoresponder_images',

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

        const modal =
            new ModalBuilder()
                .setCustomId(
                    `autoresponder_images:${sessionId}`,
                )
                .setTitle(
                    '🖼️ Add Images',
                );

        const currentImages =
            session.response.images ||
            [];

        for (
            let i = 0;
            i < 5;
            i++
        ) {
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            `image_${i + 1}`,
                        )
                        .setLabel(
                            `Image ${i + 1} URL`,
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(false)
                        .setValue(
                            currentImages[i] ||
                            '',
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
                    `✅ Đã lưu autoresponder **${result.responder.displayKeyword}** thành công!`,
                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },

      {
        name:
            'autoresponder_settings',

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

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `autoresponder_settings:${sessionId}`,
                    )
                    .setTitle(
                        '💬 Reply / Settings',
                    )
.addComponents(
    new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(
                'setting_keyword',
            )
            .setLabel(
                'Keyword',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(true)
            .setValue(
                session.keyword || '',
            )
            .setMaxLength(100),
    ),

    new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(
                'setting_type',
            )
            .setLabel(
                'Type: everyone / manager',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(true)
            .setValue(
                session.type ||
                'everyone',
            ),
    ),

    new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(
                'setting_footer',
            )
            .setLabel(
                'Footer',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(false)
            .setValue(
                session.response
                    ?.embeds?.[0]
                    ?.footer?.text ||
                '',
            )
            .setMaxLength(2048),
    ),

    new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(
                'reply_enabled',
            )
            .setLabel(
                'Reply? yes / no',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(false)
            .setValue(
                session.response
                    ?.reply
                    ?.enabled
                    ? 'yes'
                    : 'no',
            ),
    ),

    new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(
                'mention_author',
            )
            .setLabel(
                'Mention người gửi? yes / no',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(false)
            .setValue(
                session.response
                    ?.reply
                    ?.mentionAuthor
                    ? 'yes'
                    : 'no',
            ),
    ),
);

            await interaction.showModal(
                modal,
            );
        },
    },

    {
        name: 'autoresponder_options',

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

            const modal =
                new ModalBuilder()
                    .setCustomId(
                        `autoresponder_options:${sessionId}`,
                    )
                    .setTitle(
                        '🔧 Tùy Chọn Autoresponder',
                    )
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(
                                    'option_delete_trigger',
                                )
                                .setLabel(
                                    'Xóa tin nhắn lệnh? (yes/no)',
                                )
                                .setPlaceholder(
                                    'yes: Xóa tin nhắn kích hoạt (ví dụ xóa lvup1)',
                                )
                                .setStyle(
                                    TextInputStyle.Short,
                                )
                                .setRequired(false)
                                .setValue(
                                    session.response
                                        ?.deleteTrigger
                                        ? 'yes'
                                        : 'no',
                                )
                                .setMaxLength(3),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(
                                    'option_mention_target',
                                )
                                .setLabel(
                                    'Tag người được chỉ định? (yes/no)',
                                )
                                .setPlaceholder(
                                    'yes: Tag user được gõ sau keyword (@User)',
                                )
                                .setStyle(
                                    TextInputStyle.Short,
                                )
                                .setRequired(false)
                                .setValue(
                                    session.response
                                        ?.mentionTarget !==
                                        false
                                        ? 'yes'
                                        : 'no',
                                )
                                .setMaxLength(3),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(
                                    'option_mention_author',
                                )
                                .setLabel(
                                    'Tag người gửi tin nhắn? (yes/no)',
                                )
                                .setPlaceholder(
                                    'yes: Tag người gửi keyword',
                                )
                                .setStyle(
                                    TextInputStyle.Short,
                                )
                                .setRequired(false)
                                .setValue(
                                    session.response
                                        ?.reply
                                        ?.mentionAuthor
                                        ? 'yes'
                                        : 'no',
                                )
                                .setMaxLength(3),
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(
                                    'option_reply_enabled',
                                )
                                .setLabel(
                                    'Reply trích dẫn tin nhắn? (yes/no)',
                                )
                                .setPlaceholder(
                                    'yes: Bật reply trích dẫn (xóa lệnh sẽ tắt)',
                                )
                                .setStyle(
                                    TextInputStyle.Short,
                                )
                                .setRequired(false)
                                .setValue(
                                    session.response
                                        ?.reply
                                        ?.enabled
                                        ? 'yes'
                                        : 'no',
                                )
                                .setMaxLength(3),
                        ),
                    );

            await interaction.showModal(
                modal,
            );
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
                    'Đã hủy Builder.',
                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },
];
