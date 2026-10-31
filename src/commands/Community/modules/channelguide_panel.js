import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} from 'discord.js';

const PAGE_SIZE = 20;

const BUTTON_STYLES = [
    ButtonStyle.Secondary,
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
            animated: Boolean(customEmoji.groups.animated),
        };
    }

    return { name: value };
}

export function buildChannelGuidePanel(config, page = 0, guild = null) {
    const guides = config.guides.filter(
        guide => guide.enabled !== false,
    );

    const totalPages = Math.max(
        1,
        Math.ceil(guides.length / PAGE_SIZE),
    );

    const safePage = Math.min(
        Math.max(page, 0),
        totalPages - 1,
    );

    const pageGuides = guides.slice(
        safePage * PAGE_SIZE,
        (safePage + 1) * PAGE_SIZE,
    );

    const guildIcon = guild?.iconURL({
        dynamic: true,
        size: 128,
    }) || null;

    const container = new ContainerBuilder();

    const heading = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${config.panelTitle || '🌸 Serendipity Channel Guide'}`,
            ),
        );

    if (guildIcon) {
        heading.setThumbnailAccessory(
            new ThumbnailBuilder()
                .setURL(guildIcon)
                .setDescription(guild?.name || 'Server icon'),
        );
    }

    container
        .addSectionComponents(heading)
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                config.panelDescription ||
                'Hướng dẫn sử dụng các kênh Discord trong server.',
            ),
        );

    if (config.panelImage) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(config.panelImage)
                    .setDescription('Channel Guide'),
            ),
        );
    }

    const components = [container];

    for (let i = 0; i < pageGuides.length; i += 5) {
        const row = new ActionRowBuilder();

        pageGuides.slice(i, i + 5).forEach((guide, index) => {
            const button = new ButtonBuilder()
                .setCustomId(`channelguide:${guide.id}`)
                .setLabel(guide.label.slice(0, 80))
                .setStyle(
                    BUTTON_STYLES[
                        (i + index) % BUTTON_STYLES.length
                    ],
                );

            const emoji = resolveButtonEmoji(guide.emoji);
            if (emoji) button.setEmoji(emoji);

            row.addComponents(button);
        });

        components.push(row);
    }

    if (totalPages > 1) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`channelguide_nav:${safePage - 1}`)
                    .setLabel('Previous')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage <= 0),
                new ButtonBuilder()
                    .setCustomId(`channelguide_nav:${safePage}`)
                    .setLabel(`Page ${safePage + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`channelguide_nav:${safePage + 1}`)
                    .setLabel('Next')
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage >= totalPages - 1),
            ),
        );
    }

    return {
        // Clear the legacy embed when converting an already-published panel
        // to Components V2. The panel is then rendered only from components.
        content: null,
        embeds: [],
        components,
        flags: MessageFlags.IsComponentsV2,
    };
}
