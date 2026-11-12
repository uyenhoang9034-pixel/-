import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
} from 'discord.js';

import {
    getChannelGuideConfig,
    getGuideItem,
    normalizePanelSlot,
} from '../../../services/channelguide/channelGuideService.js';

const sessions = new Map();

function createSession(interaction, panelSlot = 1) {
    const sessionId =
        `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    const session = {
        sessionId,
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        panelSlot: normalizePanelSlot(panelSlot),
        selectedGuideId: null,
        page: 0,
    };

    if (sessions.size >= 50) {
        const oldestKey = sessions.keys().next().value;
        if (oldestKey) sessions.delete(oldestKey);
    }

    sessions.set(
        sessionId,
        session,
    );

    setTimeout(() => {
        sessions.delete(sessionId);
    }, 30 * 60 * 1000);

    return session;
}

export function getDashboardSession(sessionId) {
    return sessions.get(sessionId);
}

export function deleteDashboardSession(sessionId) {
    sessions.delete(sessionId);
}

function buildDashboardEmbed(config, session) {
    const enabledCount =
        config.guides.filter(
            guide =>
                guide.enabled !== false,
        ).length;

    const selected =
        session.selectedGuideId
            ? getGuideItem(
                config,
                session.selectedGuideId,
            )
            : null;

    const fields = [
        {
            name: '📚 Guides',
            value:
                `${enabledCount}/${config.guides.length} enabled`,
            inline: true,
        },
        {
            name: '📍 Panel',
            value:
                config.panelChannelId
                    ? `<#${config.panelChannelId}>`
                    : 'Chưa cài đặt',
            inline: true,
        },
        {
            name: '🖼️ Panel Image',
            value:
                config.panelImage
                    ? 'Configured'
                    : 'Not configured',
            inline: true,
        },
    ];

    if (selected) {
        fields.push(
            {
                name: '🌸 Selected Guide',
                value:
                    `${selected.emoji} ${selected.label}`,
                inline: false,
            },
            {
                name: '📝 Description',
                value:
                    (
                        selected.description ||
                        'Chưa có nội dung.'
                    ).slice(0, 1024),
                inline: false,
            },
            {
                name: '📌 Status',
                value:
                    selected.enabled === false
                        ? '🔴 Disabled'
                        : '🟢 Enabled',
                inline: true,
            },
            {
                name: '🔗 Linked Channels',
                value:
                    `${selected.channels?.length || 0} kênh đã liên kết\nMở Edit Guide để thêm hoặc thay Channel IDs.`,
                inline: true,
            },
        );
    } else {
        fields.push({
            name: '💡 Hướng dẫn',
            value:
                config.guides.length === 0
                    ? 'Chưa có danh mục nào. Bấm **➕ Add Guide** bên dưới để thêm mới.'
                    : 'Chọn một guide bên dưới để chỉnh sửa.',
            inline: false,
        });
    }

    const panelSlot = normalizePanelSlot(session.panelSlot);
    const dashboardTitle =
        panelSlot === 2
            ? '🌸 Channel Guide 2 Dashboard'
            : '🌸 Channel Guide Dashboard';
    const commandHint =
        panelSlot === 2
            ? '/channelguide setup2 (Panel 2)'
            : '/channelguide setup (Panel 1)';

    return new EmbedBuilder()
        .setColor(0xf6b6d6)
        .setTitle(
            dashboardTitle,
        )
        .setDescription(
            `Quản lý các danh mục Channel Guide (${commandHint}). Muốn gắn kênh: chọn danh mục → Edit Guide → nhập Channel IDs (các ID cách nhau bằng dấu phẩy) → Save.`,
        )
        .addFields(fields)
        .setFooter({
            text:
                `Panel ${panelSlot} • Chỉ Administrator / Manage Server có thể sử dụng.`,
        });
}

function buildGuideSelect(config, session) {
    const pageSize = 20;

    const start =
        session.page * pageSize;

    const guides =
        config.guides.slice(
            start,
            start + pageSize,
        );

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `channelguide_dashboard_select:${session.sessionId}`,
            )
            .setPlaceholder(
                '📖 Chọn guide cần chỉnh...',
            );

    if (guides.length === 0) {
        menu
            .setDisabled(true)
            .addOptions({
                label: 'Chưa có guide nào',
                description: 'Bấm ➕ Add Guide bên dưới để thêm mới.',
                value: '__empty__',
            });
        return menu;
    }

    menu.addOptions(
        guides.map(
            guide => ({
                label:
                    guide.label.slice(0, 100),

                description:
                    guide.enabled === false
                        ? '🔴 Disabled'
                        : '🟢 Enabled',

                value: guide.id,

                emoji: guide.emoji,
            }),
        ),
    );

    return menu;
}

function buildComponents(config, session) {
    const rows = [];

    rows.push(
        new ActionRowBuilder()
            .addComponents(
                buildGuideSelect(
                    config,
                    session,
                ),
            ),
    );

    rows.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:edit`,
                    )
                    .setLabel('Edit Guide')
                    .setEmoji('✏️')
                    .setStyle(
                        ButtonStyle.Primary,
                    )
                    .setDisabled(
                        !session.selectedGuideId,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:add`,
                    )
                    .setLabel('Add Guide')
                    .setEmoji('➕')
                    .setStyle(
                        ButtonStyle.Success,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:toggle`,
                    )
                    .setLabel('Enable / Disable')
                    .setEmoji('🔄')
                    .setStyle(
                        ButtonStyle.Secondary,
                    )
                    .setDisabled(
                        !session.selectedGuideId,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:up`,
                    )
                    .setLabel('Up')
                    .setEmoji('⬆️')
                    .setStyle(
                        ButtonStyle.Secondary,
                    )
                    .setDisabled(
                        !session.selectedGuideId,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:down`,
                    )
                    .setLabel('Down')
                    .setEmoji('⬇️')
                    .setStyle(
                        ButtonStyle.Secondary,
                    )
                    .setDisabled(
                        !session.selectedGuideId,
                    ),
            ),
    );

    rows.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:panel`,
                    )
                    .setLabel('Panel Settings')
                    .setEmoji('🎨')
                    .setStyle(
                        ButtonStyle.Primary,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:preview`,
                    )
                    .setLabel('Preview')
                    .setEmoji('👀')
                    .setStyle(
                        ButtonStyle.Secondary,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:publish`,
                    )
                    .setLabel('Publish / Update')
                    .setEmoji('📤')
                    .setStyle(
                        ButtonStyle.Success,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:delete`,
                    )
                    .setLabel('Delete Guide')
                    .setEmoji('🗑️')
                    .setStyle(
                        ButtonStyle.Danger,
                    )
                    .setDisabled(
                        !session.selectedGuideId,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `channelguide_dashboard:${session.sessionId}:close`,
                    )
                    .setLabel('Close')
                    .setEmoji('❌')
                    .setStyle(
                        ButtonStyle.Danger,
                    ),
            ),
    );

    if (config.guides.length > 20) {
        rows.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `channelguide_dashboard:${session.sessionId}:prev`,
                        )
                        .setLabel('Previous')
                        .setEmoji('◀️')
                        .setStyle(
                            ButtonStyle.Secondary,
                        )
                        .setDisabled(
                            session.page <= 0,
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `channelguide_dashboard:${session.sessionId}:next`,
                        )
                        .setLabel('Next')
                        .setEmoji('▶️')
                        .setStyle(
                            ButtonStyle.Secondary,
                        )
                        .setDisabled(
                            (session.page + 1) * 20 >=
                                config.guides.length,
                        ),
                ),
        );
    }

    return rows;
}

export async function showChannelGuideDashboard(
    interaction,
    client,
    session = null,
    options = {},
) {
    const panelSlot = normalizePanelSlot(
        session?.panelSlot ?? options?.panelSlot ?? 1,
    );

    const currentSession =
        session ||
        createSession(interaction, panelSlot);

    currentSession.panelSlot = normalizePanelSlot(
        currentSession.panelSlot ?? panelSlot,
    );

    const config =
        await getChannelGuideConfig(
            client,
            interaction.guild.id,
            currentSession.panelSlot,
        );

    const maxPage = Math.max(0, Math.ceil(config.guides.length / 20) - 1);
    const parsedPage = Number.isInteger(currentSession.page) ? currentSession.page : 0;
    currentSession.page = Math.max(0, Math.min(parsedPage, maxPage));

    const payload = {
        embeds: [
            buildDashboardEmbed(
                config,
                currentSession,
            ),
        ],
        components:
            buildComponents(
                config,
                currentSession,
            ),
    };

    if (
        interaction.replied ||
        interaction.deferred
    ) {
        await interaction.editReply(
            payload,
        );
    } else {
        await interaction.reply({
            ...payload,
            flags:
                MessageFlags.Ephemeral,
        });
    }

    return currentSession;
}
