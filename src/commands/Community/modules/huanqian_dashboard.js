import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

import {
    getHuanqianConfig,
} from '../../../services/huanqian/huanqianService.js';


const sessions =
    new Map();


function createSession(
    interaction,
) {
    const sessionId =
        `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    const session = {
        sessionId,

        guildId:
            interaction.guild.id,

        userId:
            interaction.user.id,

        createdAt:
            Date.now(),
    };

    sessions.set(
        sessionId,
        session,
    );

    return session;
}


export function getHuanqianSession(
    sessionId,
) {
    return sessions.get(
        sessionId,
    );
}


export function deleteHuanqianSession(
    sessionId,
) {
    sessions.delete(
        sessionId,
    );
}


function isValidImageUrl(
    value,
) {
    if (
        typeof value !== 'string' ||
        !value.trim()
    ) {
        return false;
    }

    try {
        const url =
            new URL(
                value.trim(),
            );

        return (
            url.protocol ===
                'https:' ||
            url.protocol ===
                'http:'
        );
    } catch {
        return false;
    }
}


function resolveButtonEmoji(
    value,
) {
    if (
        !value ||
        typeof value !== 'string'
    ) {
        return null;
    }

    const customEmoji =
        value.match(
            /^<(?<animated>a)?:?(?<name>[^:>]+):(?<id>\d+)>$/,
        );

    if (customEmoji) {
        return {
            name:
                customEmoji.groups.name,

            id:
                customEmoji.groups.id,

            animated:
                Boolean(
                    customEmoji.groups.animated,
                ),
        };
    }

    return {
        name: value,
    };
}


function getButtonStyle(
    style,
) {
    switch (
        String(style)
            .toLowerCase()
    ) {
        case 'primary':
            return ButtonStyle.Primary;

        case 'success':
            return ButtonStyle.Success;

        case 'danger':
            return ButtonStyle.Danger;

        case 'secondary':
        default:
            return ButtonStyle.Secondary;
    }
}


export function buildHuanqianPanel(
    config,
    guild,
) {
    const guildIcon =
        guild?.iconURL({
            dynamic: true,
            size: 128,
        }) || null;

    const embed =
        new EmbedBuilder()
            .setColor(
                config.panelColor ||
                '#6F5846',
            )
            .setAuthor({
                name:
                    guild?.name ||
                    'Serendipity',

                ...(guildIcon
                    ? {
                        iconURL:
                            guildIcon,
                    }
                    : {}),
            })
            .setTitle(
                config.panelTitle ||
                'Huan Qian — ⋆˚࿔⋆ — 换錢',
            )
            .setDescription(
                config.panelDescription ||
                'Chưa có nội dung.',
            );

    /*
     * Server icon làm thumbnail.
     *
     * Đây KHÔNG phải ảnh custom của Huan Qian.
     * Ảnh custom duy nhất là panelImage.
     */
    if (guildIcon) {
        embed.setThumbnail(
            guildIcon,
        );
    }

    /*
     * Chỉ có MỘT ảnh chính.
     */
    if (
        isValidImageUrl(
            config.panelImage,
        )
    ) {
        embed.setImage(
            config.panelImage,
        );
    }

    embed.setFooter({
        text:
            '🌸 Huan Qian',
    });

    const row =
        new ActionRowBuilder();

    for (
        const button of config.buttons
    ) {
        const component =
            new ButtonBuilder()
                .setCustomId(
                    `huanqian:${button.id}`,
                )
                .setLabel(
                    button.label,
                )
                .setStyle(
                    getButtonStyle(
                        button.style,
                    ),
                );

        const emoji =
            resolveButtonEmoji(
                button.emoji,
            );

        if (emoji) {
            component.setEmoji(
                emoji,
            );
        }

        row.addComponents(
            component,
        );
    }

    return {
        embeds: [
            embed,
        ],

        components: [
            row,
        ],
    };
}


function buildDashboardEmbed(
    config,
) {
    return new EmbedBuilder()
        .setColor(
            config.panelColor ||
            '#6F5846',
        )
        .setTitle(
            '🌸 Huan Qian Dashboard',
        )
        .setDescription(
            [
                'Quản lý panel Huan Qian tại đây.',

                '',

                '🖼️ **Panel Image**',
                config.panelImage
                    ? 'Đã cài đặt'
                    : 'Chưa cài đặt',

                '',

                '📍 **Panel Channel**',
                config.panelChannelId
                    ? `<#${config.panelChannelId}>`
                    : 'Chưa cài đặt',

                '',

                '🔘 **Buttons**',
                '3/3 buttons',

                '',

                'Chọn chức năng bên dưới để chỉnh sửa.',
            ].join('\n'),
        )
        .setFooter({
            text:
                'Chỉ Administrator / Manage Server có thể sử dụng.',
        });
}


function buildDashboardComponents(
    config,
    sessionId,
) {
    const rows = [];

    /*
     * Hàng 1:
     * Panel + Image + Preview
     */
    rows.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `huanqiandashboard:${sessionId}:panel`,
                    )
                    .setLabel(
                        'Panel Settings',
                    )
                    .setEmoji(
                        '🎨',
                    )
                    .setStyle(
                        ButtonStyle.Primary,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `huanqiandashboard:${sessionId}:image`,
                    )
                    .setLabel(
                        'Image',
                    )
                    .setEmoji(
                        '🖼️',
                    )
                    .setStyle(
                        ButtonStyle.Secondary,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `huanqiandashboard:${sessionId}:preview`,
                    )
                    .setLabel(
                        'Preview',
                    )
                    .setEmoji(
                        '👀',
                    )
                    .setStyle(
                        ButtonStyle.Secondary,
                    ),
            ),
    );

    /*
     * Hàng 2:
     * 3 button settings
     */
    rows.push(
        new ActionRowBuilder()
            .addComponents(
                ...config.buttons.map(
                    (
                        button,
                    ) =>
                        new ButtonBuilder()
                            .setCustomId(
                                `huanqiandashboard:${sessionId}:button:${button.id}`,
                            )
                            .setLabel(
                                `Edit ${button.label}`.slice(
                                    0,
                                    80,
                                ),
                            )
                            .setEmoji(
                                '🔘',
                            )
                            .setStyle(
                                getButtonStyle(
                                    button.style,
                                ),
                            ),
                ),
            ),
    );

    /*
     * Hàng 3:
     * Publish + Close
     */
    rows.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `huanqiandashboard:${sessionId}:publish`,
                    )
                    .setLabel(
                        'Publish / Update',
                    )
                    .setEmoji(
                        '📤',
                    )
                    .setStyle(
                        ButtonStyle.Success,
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `huanqiandashboard:${sessionId}:close`,
                    )
                    .setLabel(
                        'Close',
                    )
                    .setEmoji(
                        '❌',
                    )
                    .setStyle(
                        ButtonStyle.Danger,
                    ),
            ),
    );

    return rows;
}


export async function showHuanqianDashboard(
    interaction,
    client,
    session = null,
) {
    const currentSession =
        session ||
        createSession(
            interaction,
        );

    const config =
        await getHuanqianConfig(
            client,
            interaction.guild.id,
        );

    const payload = {
        embeds: [
            buildDashboardEmbed(
                config,
            ),
        ],

        components:
            buildDashboardComponents(
                config,
                currentSession.sessionId,
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
