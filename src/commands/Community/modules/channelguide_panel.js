import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';

const PAGE_SIZE = 20;

const BUTTON_STYLES = [
    ButtonStyle.Primary,
    ButtonStyle.Success,
    ButtonStyle.Secondary,
    ButtonStyle.Primary,
    ButtonStyle.Danger,
    ButtonStyle.Success,
    ButtonStyle.Secondary,
    ButtonStyle.Primary,
];

function resolveButtonEmoji(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const customEmoji = value.match(
        /^<(?<animated>a)?:(?<name>[^:>]+):(?<id>\d+)>$/,
    );

    if (customEmoji) {
        return {
            name: customEmoji.groups.name,
            id: customEmoji.groups.id,
            animated: Boolean(
                customEmoji.groups.animated,
            ),
        };
    }

    return {
        name: value,
    };
}

export function buildChannelGuidePanel(
    config,
    page = 0,
    guild = null,
) {
    const guides =
        config.guides.filter(
            guide =>
                guide.enabled !== false,
        );

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                guides.length /
                    PAGE_SIZE,
            ),
        );

    const safePage =
        Math.min(
            Math.max(page, 0),
            totalPages - 1,
        );

    const pageGuides =
        guides.slice(
            safePage * PAGE_SIZE,
            (safePage + 1) * PAGE_SIZE,
        );

    const guildIcon =
        guild?.iconURL({
            dynamic: true,
            size: 128,
        }) || null;

    const embed =
        new EmbedBuilder()
            .setColor(0xf6b6d6)
            .setAuthor({
                name:
                    guild?.name ||
                    '𝓢𝓮𝓻𝓮𝓷𝓭𝓲𝓹𝓲𝓽𝔂 🖤🤍',

                ...(guildIcon
                    ? {
                        iconURL: guildIcon,
                    }
                    : {}),
            })
            .setTitle(
                config.panelTitle ||
                '🌸 Hướng dẫn sử dụng các kênh discord server Serendipity 🖤🤍',
            )
            .setDescription(
                config.panelDescription ||
                'Hướng dẫn sử dụng các kênh discord server Serendipity 🖤🤍',
            );

    // Thumbnail góc trên bên phải
    if (guildIcon) {
        embed.setThumbnail(guildIcon);
    }

    // Ảnh lớn phía dưới
    if (config.panelImage) {
        embed.setImage(
            config.panelImage,
        );
    }

    const components = [];

    for (
        let i = 0;
        i < pageGuides.length;
        i += 5
    ) {
        const row =
            new ActionRowBuilder();

        pageGuides
            .slice(i, i + 5)
            .forEach(
                (guide, index) => {
                    const button =
                        new ButtonBuilder()
                            .setCustomId(
                                `channelguide:${guide.id}`,
                            )
                            .setLabel(
                                guide.label.slice(
                                    0,
                                    80,
                                ),
                            )
                            .setStyle(
                                BUTTON_STYLES[
                                    (i + index) %
                                        BUTTON_STYLES.length
                                ],
                            );

                    const emoji =
                        resolveButtonEmoji(
                            guide.emoji,
                        );

                    if (emoji) {
                        button.setEmoji(
                            emoji,
                        );
                    }

                    row.addComponents(
                        button,
                    );
                },
            );

        components.push(row);
    }

    if (totalPages > 1) {
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `channelguide_nav:${safePage - 1}`,
                        )
                        .setLabel(
                            'Previous',
                        )
                        .setEmoji('◀️')
                        .setStyle(
                            ButtonStyle.Secondary,
                        )
                        .setDisabled(
                            safePage <= 0,
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `channelguide_nav:${safePage}`,
                        )
                        .setLabel(
                            `Page ${safePage + 1}/${totalPages}`,
                        )
                        .setStyle(
                            ButtonStyle.Secondary,
                        )
                        .setDisabled(
                            true,
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `channelguide_nav:${safePage + 1}`,
                        )
                        .setLabel('Next')
                        .setEmoji('▶️')
                        .setStyle(
                            ButtonStyle.Secondary,
                        )
                        .setDisabled(
                            safePage >=
                                totalPages - 1,
                        ),
                ),
        );
    }

    return {
        embeds: [embed],
        components,
    };
}
