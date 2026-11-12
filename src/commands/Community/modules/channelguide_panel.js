import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { normalizePanelSlot } from '../../../services/channelguide/channelGuideService.js';

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

export function buildChannelGuidePanel(
    config,
    page = 0,
    guild = null,
    panelSlot = 1,
) {
    const resolvedSlot = normalizePanelSlot(panelSlot);
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

    const container = new ContainerBuilder();

    // Tiêu đề chính (xóa thumbnail theo yêu cầu)
    container
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${config.panelTitle || '🌸 Serendipity Channel Guide'}`,
            ),
        )
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

    // Ảnh bên dưới văn bản (sử dụng assets/channelguide/channelguide.png)
    const channelGuideImgPath = path.resolve(process.cwd(), 'assets/channelguide/channelguide.png');
    const hasLocalImage = fs.existsSync(channelGuideImgPath);
    const imageUrl =
        resolvedSlot === 2
            ? (config.panelImage || (hasLocalImage ? 'attachment://channelguide.png' : null))
            : (hasLocalImage ? 'attachment://channelguide.png' : config.panelImage);

    if (imageUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder()
                    .setURL(imageUrl)
                    .setDescription('Channel Guide'),
            ),
        );
    }

    const files = [];
    if (imageUrl === 'attachment://channelguide.png' && hasLocalImage) {
        files.push(
            new AttachmentBuilder(channelGuideImgPath, { name: 'channelguide.png' }),
        );
    }

    const components = [container];

    for (let i = 0; i < pageGuides.length; i += 5) {
        const row = new ActionRowBuilder();

        pageGuides.slice(i, i + 5).forEach((guide, index) => {
            const button = new ButtonBuilder()
                .setCustomId(`channelguide:${guide.id}:${resolvedSlot}`)
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
                    .setCustomId(`channelguide_nav:${safePage - 1}:${resolvedSlot}`)
                    .setLabel('Previous')
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage <= 0),
                new ButtonBuilder()
                    .setCustomId(`channelguide_nav:${safePage}:${resolvedSlot}`)
                    .setLabel(`Page ${safePage + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`channelguide_nav:${safePage + 1}:${resolvedSlot}`)
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
        files,
        flags: MessageFlags.IsComponentsV2,
    };
}
