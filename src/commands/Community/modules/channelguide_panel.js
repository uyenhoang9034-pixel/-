import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';

const PAGE_SIZE = 20;

export function buildChannelGuidePanel(
    config,
    page = 0,
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
            Math.max(
                page,
                0,
            ),
            totalPages - 1,
        );

    const pageGuides =
        guides.slice(
            safePage * PAGE_SIZE,
            (safePage + 1) *
                PAGE_SIZE,
        );

    const embed =
        new EmbedBuilder()
            .setColor(
                0xf6b6d6,
            )
            .setTitle(
                config.panelTitle ||
                '𝓢𝓮𝓻𝓮𝓷𝓭𝓲𝓹𝓲𝓽𝔂 🖤🤍',
            )
            .setDescription(
                config.panelDescription ||
                'Hướng dẫn sử dụng các kênh discord server Serendipity 🖤🤍',
            );

    if (
        config.panelImage
    ) {
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
                guide => {
                    row.addComponents(
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
                            .setEmoji(
                                guide.emoji,
                            )
                            .setStyle(
                                ButtonStyle.Secondary,
                            ),
                    );
                },
            );

        components.push(
            row,
        );
    }

    if (
        totalPages > 1
    ) {
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
                        .setEmoji(
                            '◀️',
                        )
                        .setStyle(
                            ButtonStyle.Secondary,
                        )
                        .setDisabled(
                            safePage <= 0,
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `channelguide_nav:${safePage + 1}`,
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
                        .setLabel(
                            'Next',
                        )
                        .setEmoji(
                            '▶️',
                        )
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
        embeds: [
            embed,
        ],
        components,
    };
}
