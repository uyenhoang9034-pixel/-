import {
    ModalBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
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

session.response.images =
    images.slice(0, 10);

        updateBuilderSession(
            sessionId,
            {
                response:
                    session.response,
            },
        );

        await interaction.reply({
            content:
                `🖼️ Đã lưu ${images.length} hình ảnh.`,
            flags:
                MessageFlags.Ephemeral,
        });

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
            : `autoresponder_action_${Date.now()}_${Math.random()
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

            await interaction.reply({
                content:
                    '🔘 Button đã được thêm.',
                ephemeral: true,
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

const keyword =
    interaction.fields
        .getTextInputValue(
            'setting_keyword',
        )
        .trim();

const type =
    interaction.fields
        .getTextInputValue(
            'setting_type',
        )
        .trim()
        .toLowerCase();

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
        .trim()
        .toLowerCase() ===
    'yes';

const mentionAuthor =
    interaction.fields
        .getTextInputValue(
            'mention_author',
        )
        .trim()
        .toLowerCase() ===
    'yes';

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
} else {
    session.response.embeds =
        (
            session.response
                .embeds || []
        ).slice(1);
}

updateBuilderSession(
    sessionId,
    {
        keyword:
            session.keyword,
        type:
            session.type,
        response: {
            ...session.response,
            reply: {
                enabled:
                    replyEnabled,
                mentionAuthor,
            },
        },
    },
);

await interaction.reply({
    content:
        '💬 Đã cập nhật Keyword / Type / Footer / Reply / Mention.',
    flags:
        MessageFlags.Ephemeral,
});

await sendBuilder(
    interaction,
    session,
);
];

export async function sendBuilder(
    interaction,
    session,
) {
    const embed =
        new EmbedBuilder()
            .setColor('#FFB6D9')
            .setTitle(
                '🌸 Autoresponder Builder',
            )
            .setDescription(
                [
                    `🔑 **Keyword:** ${session.keyword || '(chưa có)'}`,
                    `🎀 **Type:** ${session.type || 'everyone'}`,
                    '',
                    'Chọn một mục bên dưới để chỉnh response.',
                    '',
                    '🎨 **Edit Embed** — chỉnh Embed.',
                    '🔘 **Add Button** — thêm button.',
                    '💬 **Reply / Settings** — chỉnh reply và mention.',
                    '💾 **Save** — lưu autoresponder.',
                    '🌷 **Cancel** — hủy thao tác.',
                ].join('\n'),
            );

const row =
    new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `autoresponder_embed:${session.sessionId}`,
                )
                .setLabel('Edit Embed')
                .setEmoji('🎨')
                .setStyle(
                    ButtonStyle.Primary,
                ),

            new ButtonBuilder()
                .setCustomId(
                    `autoresponder_add_button:${session.sessionId}`,
                )
                .setLabel('Add Button')
                .setEmoji('🔘')
                .setStyle(
                    ButtonStyle.Secondary,
                ),

            new ButtonBuilder()
                .setCustomId(
                    `autoresponder_images:${session.sessionId}`,
                )
                .setLabel('Add Images')
                .setEmoji('🖼️')
                .setStyle(
                    ButtonStyle.Secondary,
                ),

            new ButtonBuilder()
                .setCustomId(
                    `autoresponder_settings:${session.sessionId}`,
                )
                .setLabel('Settings')
                .setEmoji('💬')
                .setStyle(
                    ButtonStyle.Secondary,
                ),
        );

const actionRow =
    new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `autoresponder_save:${session.sessionId}`,
                )
                .setLabel('Save')
                .setEmoji('💾')
                .setStyle(
                    ButtonStyle.Success,
                ),

            new ButtonBuilder()
                .setCustomId(
                    `autoresponder_cancel:${session.sessionId}`,
                )
                .setLabel('Cancel')
                .setEmoji('🌷')
                .setStyle(
                    ButtonStyle.Danger,
                ),
        );
const payload = {
    embeds: [embed],
    components: [
        row,
        actionRow,
    ],
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
        flags:
            MessageFlags.Ephemeral,
    });
}
