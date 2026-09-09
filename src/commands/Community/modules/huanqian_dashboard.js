import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

import path from 'node:path';

import {
    getHuanqianConfig,
} from '../../../services/huanqian/huanqianService.js';


/**
 * =========================================================
 * LOCAL HUAN QIAN IMAGE
 * =========================================================
 */

export const HUANQIAN_IMAGE_NAME =
    'huanqian.png';

export const HUANQIAN_IMAGE_PATH =
    path.resolve(
        process.cwd(),
        'assets',
        'huanqian',
        HUANQIAN_IMAGE_NAME,
    );


export function createHuanqianImageAttachment() {
    return new AttachmentBuilder(
        HUANQIAN_IMAGE_PATH,
        {
            name:
                HUANQIAN_IMAGE_NAME,
        },
    );
}


/**
 * =========================================================
 * DASHBOARD SESSION
 * =========================================================
 */

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


/**
 * =========================================================
 * BUTTON EMOJI
 * =========================================================
 */

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


    if (
        customEmoji
    ) {
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
        name:
            value,
    };
}


/**
 * =========================================================
 * BUTTON STYLE
 * =========================================================
 */

function getButtonStyle(
    style,
) {
    switch (
        String(
            style,
        ).toLowerCase()
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


/**
 * =========================================================
 * BUILD PUBLIC PANEL
 * =========================================================
 */

export function buildHuanqianPanel(
    config,
    guild,
) {
    const guildIcon =
        guild?.iconURL({
            dynamic:
                true,

            size:
                128,
        }) ||
        null;


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
            )

            /**
             * Ảnh cố định local.
             */
            .setImage(
                `attachment://${HUANQIAN_IMAGE_NAME}`,
            )

            .setFooter({
                text:
                    '🌸 Huan Qian',
            });


    /**
     * Giữ nguyên server icon làm thumbnail.
     */

    if (
        guildIcon
    ) {
        embed.setThumbnail(
            guildIcon,
        );
    }


    const row =
        new ActionRowBuilder();


    for (
        const button
        of config.buttons
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


        if (
            emoji
        ) {
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

        files: [
            createHuanqianImageAttachment(),
        ],
    };
}


/**
 * =========================================================
 * DASHBOARD EMBED
 * =========================================================
 */

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
                '`assets/huanqian/huanqian.png`',

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
            ].join(
                '\n',
            ),
        )
        .setFooter({
            text:
                'Chỉ Administrator / Manage Server có thể sử dụng.',
        });
}


/**
 * =========================================================
 * DASHBOARD COMPONENTS
 * =========================================================
 */

function buildDashboardComponents(
    config,
    sessionId,
) {
    const rows = [];


    /**
     * Hàng 1
     *
     * Bỏ nút Image vì ảnh đã nằm local.
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


    /**
     * Hàng 2
     *
     * Giữ nguyên 3 nút chỉnh Info / Nguồn / Note.
     */

    rows.push(
        new ActionRowBuilder()
            .addComponents(
                ...config.buttons.map(
                    button =>
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


    /**
     * Hàng 3
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


/**
 * =========================================================
 * SHOW DASHBOARD
 * =========================================================
 */

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
