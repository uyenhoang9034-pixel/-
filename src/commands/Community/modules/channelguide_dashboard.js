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
} from '../../../services/channelguide/channelGuideService.js';

const sessions = new Map();

function createSession(interaction) {
    const sessionId =
        `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    const session = {
        sessionId,
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        selectedGuideId: null,
        page: 0,
    };

    sessions.set(
        sessionId,
        session,
    );

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
                    String(
                        selected.channels?.length || 0,
                    ),
                inline: true,
            },
        );
    } else {
        fields.push({
            name: '💡 Hướng dẫn',
            value:
                'Chọn một guide bên dưới để chỉnh sửa.',
            inline: false,
        });
    }

    return new EmbedBuilder()
        .setColor(0xf6b6d6)
        .setTitle(
            '🌸 Channel Guide Dashboard',
        )
        .setDescription(
            'Quản lý toàn bộ các hướng dẫn của Serendipity tại đây.',
        )
        .addFields(fields)
        .setFooter({
            text:
                'Chỉ Administrator / Manage Server có thể sử dụng.',
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
        menu.setDisabled(true);
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
) {
    const currentSession =
        session ||
        createSession(interaction);

    const config =
        await getChannelGuideConfig(
            client,
            interaction.guild.id,
        );

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
