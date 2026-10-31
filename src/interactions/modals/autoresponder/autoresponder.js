import {
    ModalBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
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

async function safeAcknowledgeModal(interaction) {
    if (interaction.replied || interaction.deferred) return;
    try {
        await interaction.deferUpdate();
    } catch (_) {
        try {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        } catch (__) {}
    }
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

            let title = '';
            try {
                title = interaction.fields.getTextInputValue('response_title')?.trim() || '';
            } catch (_) {}

            const content =
                interaction.fields
                    .getTextInputValue(
                        'response_content',
                    )
                    ?.trim() || '';

            session.response.content = content;
            if (!session.response.embeds?.length) {
                session.response.embeds = [{}];
            }
            session.response.embeds[0].title = title;
            session.response.embeds[0].description = content;
            session.response.title = title;

            updateBuilderSession(
                sessionId,
                {
                    response:
                        session.response,
                },
            );

            await safeAcknowledgeModal(interaction);
            await sendBuilder(
                interaction,
                session,
            );
        },
    },

    {
        name: 'autoresponder_edit_title',
        async execute(interaction, client, args) {
            const [sessionId] = args;
            const session = getBuilderSession(sessionId);
            if (!session || session.userId !== interaction.user.id) return;

            const newTitle = interaction.fields.getTextInputValue('title_input')?.trim() || '';
            if (!session.response.embeds?.length) {
                session.response.embeds = [{}];
            }
            session.response.embeds[0].title = newTitle;
            session.response.title = newTitle;

            updateBuilderSession(sessionId, { response: session.response });

            await safeAcknowledgeModal(interaction);
            await sendBuilder(interaction, session);
        },
    },

    {
        name: 'autoresponder_edit_content',
        async execute(interaction, client, args) {
            const [sessionId] = args;
            const session = getBuilderSession(sessionId);
            if (!session || session.userId !== interaction.user.id) return;

            const newContent = interaction.fields.getTextInputValue('content_input')?.trim() || '';
            if (!session.response.embeds?.length) {
                session.response.embeds = [{}];
            }
            session.response.embeds[0].description = newContent;
            session.response.content = newContent;

            updateBuilderSession(sessionId, { response: session.response });

            await safeAcknowledgeModal(interaction);
            await sendBuilder(interaction, session);
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
            if (embed.title) session.response.title = embed.title;
            if (embed.description) session.response.content = embed.description;

            updateBuilderSession(
                sessionId,
                {
                    response:
                        session.response,
                },
            );

            await safeAcknowledgeModal(interaction);
            await sendBuilder(
                interaction,
                session,
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

const images =
    Array.isArray(
        session.response.images,
    )
        ? [
            ...session.response.images,
        ]
        : [];

for (
    let i = 1;
    i <= 5;
    i++
) {
    const value =
        interaction.fields
            .getTextInputValue(
                `image_${i}`,
            )
            ?.trim();

    if (value) {
        if (
            !images.includes(value)
        ) {
            images.push(
                value,
            );
        }
    }
}

session.response.images =
    images.slice(0, 10);

updateBuilderSession(
    sessionId,
    {
        response:
            session.response,
    },
);
        await safeAcknowledgeModal(interaction);
        await sendBuilder(
            interaction,
            session,
        );
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
                : `autoresponder_action:${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,
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

            await safeAcknowledgeModal(interaction);
            await sendBuilder(
                interaction,
                session,
            );
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

const keyword =
    interaction.fields
        .getTextInputValue(
            'setting_keyword',
        )
        ?.trim() || '';

const type =
    interaction.fields
        .getTextInputValue(
            'setting_type',
        )
        ?.trim()
        .toLowerCase() || 'everyone';

const footer =
    interaction.fields
        .getTextInputValue(
            'setting_footer',
        )
        ?.trim() || '';

const replyEnabled =
    interaction.fields
        .getTextInputValue(
            'reply_enabled',
        )
        ?.trim()
        .toLowerCase() === 'yes';

const mentionAuthor =
    interaction.fields
        .getTextInputValue(
            'mention_author',
        )
        ?.trim()
        .toLowerCase() === 'yes';

if (!keyword) {
    return InteractionHelper.safeReply(
        interaction,
        errorMessage(
            '⚠️ Keyword không được để trống.',
        ),
    );
}

if (
    type !== 'everyone' &&
    type !== 'manager'
) {
    return InteractionHelper.safeReply(
        interaction,
        errorMessage(
            '⚠️ Type chỉ được là everyone hoặc manager.',
        ),
    );
}

session.keyword =
    keyword;

session.type =
    type;

const currentEmbed =
    session.response
        .embeds?.[0] || {};

const updatedEmbed = {
    ...currentEmbed,
};

if (footer) {
    updatedEmbed.footer = {
        text: footer,
    };
} else {
    delete updatedEmbed.footer;
}

if (
    Object.keys(updatedEmbed)
        .length > 0
) {
    session.response.embeds =
        [
            updatedEmbed,
            ...(
                session.response
                    .embeds || []
            ).slice(1),
        ];
}

session.response.reply = {
    enabled:
    replyEnabled,
mentionAuthor:
mentionAuthor,
};

updateBuilderSession(
    sessionId,
    {
        keyword:
            session.keyword,
        type:
            session.type,
        response:
            session.response,
    },
);

        await safeAcknowledgeModal(interaction);
        await sendBuilder(
            interaction,
            session,
        );
    },
},
];

export async function sendBuilder(
    interaction,
    session,
) {
    const title = session.response?.embeds?.[0]?.title || session.response?.title || '';
    const content = session.response?.embeds?.[0]?.description || session.response?.content || '';
    const imagesCount = session.response?.images?.length || 0;
    const buttonsCount = session.response?.buttons?.length || 0;

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# Autoresponder Builder')
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    `🔑 **Từ khóa (Keyword):** \`${session.keyword || '(chưa có)'}\``,
                    `🏷️ **Phạm vi (Type):** \`${session.type || 'everyone'}\``,
                    '',
                    `📌 **Tiêu đề (Title):** ${title ? title : '*(Chưa đặt - bấm nút Sửa Title để thêm)*'}`,
                    `📝 **Nội dung (Content):**\n${content ? (content.length > 500 ? content.slice(0, 500) + '...' : content) : '*(Trống - bấm nút Sửa Nội Dung để nhập)*'}`,
                    imagesCount > 0 ? `🖼️ **Hình ảnh:** ${imagesCount} ảnh` : '',
                    buttonsCount > 0 ? `🔘 **Buttons:** ${buttonsCount} nút` : '',
                ]
                    .filter(Boolean)
                    .join('\n')
            )
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`autoresponder_edit_title:${session.sessionId}`)
            .setLabel('Sửa Title')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`autoresponder_edit_content:${session.sessionId}`)
            .setLabel('Sửa Nội Dung')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`autoresponder_add_button:${session.sessionId}`)
            .setLabel('Thêm Nút')
            .setEmoji('🔘')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`autoresponder_images:${session.sessionId}`)
            .setLabel('Thêm Ảnh')
            .setEmoji('🖼️')
            .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`autoresponder_settings:${session.sessionId}`)
            .setLabel('Cài Đặt')
            .setEmoji('⚙️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`autoresponder_save:${session.sessionId}`)
            .setLabel('Lưu')
            .setEmoji('💾')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`autoresponder_cancel:${session.sessionId}`)
            .setLabel('Hủy')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Secondary),
    );

    container.addActionRowComponents(row1, row2);

    const payload = {
        content: null,
        embeds: [],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };

    if (
        interaction.replied ||
        interaction.deferred
    ) {
        return interaction.editReply(payload);
    }

    return interaction.reply({
        ...payload,
        flags:
            MessageFlags.Ephemeral |
            MessageFlags.IsComponentsV2,
    });
}
