import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} from 'discord.js';

import {
    normalizeAutoresponderResponse,
    validateAutoresponderResponse,
} from './responseValidator.js';

function isFlowerDecorOnly(text) {
    if (!text) return true;
    const stripped = text.replace(/[⋆.˚𝜗𝜚🌸🌷🎀✨ \t\r\n]/gu, '');
    return stripped.length === 0;
}

function buildEmbed(data) {
    const embed =
        new EmbedBuilder();

    if (data.title) {
        embed.setTitle(
            data.title,
        );
    }

    if (data.description) {
        embed.setDescription(
            data.description,
        );
    }

    if (data.color) {
        embed.setColor(
            data.color,
        );
    }

    if (data.url) {
        embed.setURL(
            data.url,
        );
    }

    if (data.thumbnail) {
        embed.setThumbnail(
            data.thumbnail,
        );
    }

    if (data.image) {
        embed.setImage(
            data.image,
        );
    }

    if (data.footer) {
        embed.setFooter({
            text:
                typeof data.footer ===
                'string'
                    ? data.footer
                    : data.footer.text,
            iconURL:
                typeof data.footer ===
                'object'
                    ? data.footer.iconURL
                    : undefined,
        });
    }

    if (data.author) {
        embed.setAuthor(
            data.author,
        );
    }

    if (data.timestamp) {
        embed.setTimestamp();
    }

    if (
        Array.isArray(
            data.fields,
        ) &&
        data.fields.length
    ) {
        embed.addFields(
            data.fields,
        );
    }

    return embed;
}

function buildButton(button) {
    const builder =
        new ButtonBuilder()
            .setLabel(
                button.label,
            );

    if (button.emoji) {
        builder.setEmoji(
            button.emoji,
        );
    }
  if (
        button.style !== 'link' &&
        button.customId
    ) {
        builder.setCustomId(
            button.customId,
        );
    }
    switch (
        button.style
    ) {
        case 'primary':
            builder.setStyle(
                ButtonStyle.Primary,
            );
            break;

        case 'success':
            builder.setStyle(
                ButtonStyle.Success,
            );
            break;

        case 'danger':
            builder.setStyle(
                ButtonStyle.Danger,
            );
            break;

        case 'link':
            builder
                .setStyle(
                    ButtonStyle.Link,
                )
                .setURL(
                    button.url,
                );
            break;

        default:
            builder.setStyle(
                ButtonStyle.Secondary,
            );
    }

    return builder;
}

function buildComponents(
    buttons,
) {
    if (
        !Array.isArray(buttons) ||
        buttons.length === 0
    ) {
        return [];
    }

    const rows = [];

    for (
        let i = 0;
        i < buttons.length;
        i += 5
    ) {
        rows.push(
            new ActionRowBuilder()
                .addComponents(
                    buttons
                        .slice(i, i + 5)
                        .map(
                            buildButton,
                        ),
                ),
        );
    }

    return rows;
}

export function buildDiscordMessagePayload(
    rawResponse,
    options = {},
) {
    const targetMentionText =
        options.targetMentionText || '';

    const response =
        normalizeAutoresponderResponse(
            rawResponse,
        );

    const validation =
        validateAutoresponderResponse(
            response,
        );

    if (!validation.valid) {
        throw new Error(
            validation.error,
        );
    }

    const payload = {
        allowedMentions:
            response.allowedMentions,
    };

    // Extract Title
    const rawTitle =
        response.title ||
        response.embeds?.[0]?.title ||
        '';

    // Extract Content / Description
    let rawContent = response.content || '';
    let rawDesc =
        response.embeds?.[0]?.description || '';

    if (isFlowerDecorOnly(rawContent)) {
        rawContent = '';
    }
    if (isFlowerDecorOnly(rawDesc)) {
        rawDesc = '';
    }

    let finalTitle = rawTitle.trim();
    let finalDesc =
        rawDesc.trim() || rawContent.trim();

    // If title is not set explicitly, but content starts with # header
    if (!finalTitle && finalDesc.startsWith('# ')) {
        const lines = finalDesc.split('\n');
        finalTitle = lines[0];
        finalDesc = lines
            .slice(1)
            .join('\n')
            .trim();
    }

    // Extract Images
    const images = [];
    if (
        Array.isArray(
            response.images,
        )
    ) {
        for (
            const img of response.images
        ) {
            if (
                typeof img ===
                    'string' &&
                img.trim()
            ) {
                images.push(
                    img.trim(),
                );
            }
        }
    }
    const embedImg =
        response.embeds?.[0]?.image;
    const embedImgUrl =
        typeof embedImg === 'string'
            ? embedImg
            : embedImg?.url;
    if (
        embedImgUrl &&
        !images.includes(embedImgUrl)
    ) {
        images.push(embedImgUrl);
    }

    // Extract Files
    if (
        response.files &&
        response.files.length
    ) {
        payload.files =
            response.files.map(
                file =>
                    typeof file ===
                    'string'
                        ? {
                            attachment:
                                file,
                        }
                        : file,
            );
    }

    const hasContainerContent =
        finalTitle ||
        finalDesc ||
        images.length > 0 ||
        (response.buttons &&
            response.buttons.length > 0);

    if (hasContainerContent) {
        const container =
            new ContainerBuilder();

        // 0. Target Mention Text (Tag người được chỉ định)
        if (targetMentionText) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    targetMentionText,
                ),
            );
        }

        // 1. Header Title
        if (finalTitle) {
            const formattedTitle =
                finalTitle.startsWith(
                    '#',
                )
                    ? finalTitle
                    : `# ${finalTitle}`;
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    formattedTitle,
                ),
            );

            // Native horizontal divider line right below Title
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(
                        true,
                    )
                    .setSpacing(
                        SeparatorSpacingSize.Small,
                    ),
            );
        }

        // 2. Body Description
        if (finalDesc) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    finalDesc,
                ),
            );
        }

        // 3. Media Gallery (Images)
        if (images.length > 0) {
            const gallery =
                new MediaGalleryBuilder();
            for (
                const imgUrl of images.slice(
                    0,
                    4,
                )
            ) {
                gallery.addItems(
                    new MediaGalleryItemBuilder().setURL(
                        imgUrl,
                    ),
                );
            }
            container.addMediaGalleryComponents(
                gallery,
            );
        }

        // 4. Buttons (Action Rows)
        const buttonRows =
            buildComponents(
                response.buttons,
            );
        for (
            const row of buttonRows
        ) {
            container.addActionRowComponents(
                row,
            );
        }

        payload.components = [
            container,
        ];
        payload.flags =
            MessageFlags.IsComponentsV2;
    } else {
        const contentParts = [
            targetMentionText,
            rawContent,
        ].filter(Boolean);

        if (contentParts.length > 0) {
            payload.content =
                contentParts.join('\n');
        }
    }

    return payload;
}

export function buildEmbedFromData(
    data,
) {
    return buildEmbed(data);
}
