import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';

import {
    normalizeAutoresponderResponse,
    validateAutoresponderResponse,
} from './responseValidator.js';

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
) {
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

    if (response.content) {
        payload.content =
            response.content;
    }

    if (
        response.embeds.length
    ) {
        payload.embeds =
            response.embeds.map(
                buildEmbed,
            );
    }

    if (
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

    const components =
        buildComponents(
            response.buttons,
        );

    if (components.length) {
        payload.components =
            components;
    }

    return payload;
}

export function buildEmbedFromData(
    data,
) {
    return buildEmbed(data);
}
