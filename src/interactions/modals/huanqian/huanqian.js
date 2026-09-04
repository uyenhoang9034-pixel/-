import {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} from 'discord.js';

import {
    getHuanqianConfig,
    updateHuanqianPanel,
    updateHuanqianButton,
} from '../../../services/huanqian/huanqianService.js';

import {
    getHuanqianSession,
    showHuanqianDashboard,
} from '../../../commands/Community/modules/huanqian_dashboard.js';


function hasAdminPermission(
    interaction,
) {
    return (
        interaction.member?.permissions?.has(
            'Administrator',
        ) ||
        interaction.member?.permissions?.has(
            'ManageGuild',
        )
    );
}


function getSession(
    interaction,
    sessionId,
) {
    const session =
        getHuanqianSession(
            sessionId,
        );

    if (!session) {
        return null;
    }

    if (
        session.userId !==
        interaction.user.id
    ) {
        return null;
    }

    if (
        session.guildId !==
        interaction.guild?.id
    ) {
        return null;
    }

    return session;
}


function validUrl(
    value,
) {
    if (
        !value ||
        typeof value !== 'string'
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


/*
 * ==========================================================
 * PANEL SETTINGS MODAL
 * ==========================================================
 *
 * 4 field:
 *
 * Panel Channel ID
 * Title
 * Description
 * Color
 */

export async function buildPanelModal(
    client,
    guildId,
    sessionId,
) {
    const config =
        await getHuanqianConfig(
            client,
            guildId,
        );

    return new ModalBuilder()
        .setCustomId(
            `huanqian_modal:panel:${sessionId}`,
        )
        .setTitle(
            '🌸 Huan Qian Panel',
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'panel_channel',
                        )
                        .setLabel(
                            'Panel Channel ID',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            true,
                        )
                        .setValue(
                            config.panelChannelId ||
                            '',
                        ),
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'panel_title',
                        )
                        .setLabel(
                            'Panel Title',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            true,
                        )
                        .setMaxLength(
                            256,
                        )
                        .setValue(
                            config.panelTitle ||
                            '',
                        ),
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'panel_description',
                        )
                        .setLabel(
                            'Panel Description',
                        )
                        .setStyle(
                            TextInputStyle.Paragraph,
                        )
                        .setRequired(
                            true,
                        )
                        .setMaxLength(
                            4000,
                        )
                        .setValue(
                            config.panelDescription ||
                            '',
                        ),
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'panel_color',
                        )
                        .setLabel(
                            'Embed Color',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            true,
                        )
                        .setMaxLength(
                            20,
                        )
                        .setValue(
                            config.panelColor ||
                            '#6F5846',
                        ),
                ),
        );
}


/*
 * ==========================================================
 * IMAGE MODAL
 * ==========================================================
 *
 * Chỉ có một ảnh.
 *
 * Khi link hết hạn:
 * /huanqiandashboard setup
 * → Image
 * → dán link mới.
 */

export async function buildImageModal(
    client,
    guildId,
    sessionId,
) {
    const config =
        await getHuanqianConfig(
            client,
            guildId,
        );

    return new ModalBuilder()
        .setCustomId(
            `huanqian_modal:image:${sessionId}`,
        )
        .setTitle(
            '🖼️ Huan Qian Image',
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'panel_image',
                        )
                        .setLabel(
                            'Image URL',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            false,
                        )
                        .setValue(
                            config.panelImage ||
                            '',
                        ),
                ),
        );
}


/*
 * ==========================================================
 * BUTTON MODAL
 * ==========================================================
 *
 * 5 field:
 *
 * Label
 * Emoji
 * Style
 * Title
 * Description
 */

export async function buildButtonModal(
    client,
    guildId,
    sessionId,
    buttonId,
) {
    const config =
        await getHuanqianConfig(
            client,
            guildId,
        );

    const button =
        config.buttons.find(
            item =>
                item.id ===
                buttonId,
        );

    if (!button) {
        throw new Error(
            'Button not found.',
        );
    }

    return new ModalBuilder()
        .setCustomId(
            `huanqian_modal:button:${buttonId}:${sessionId}`,
        )
        .setTitle(
            `🔘 Edit ${button.label}`,
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'button_label',
                        )
                        .setLabel(
                            'Button label',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            true,
                        )
                        .setMaxLength(
                            80,
                        )
                        .setValue(
                            button.label,
                        ),
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'button_emoji',
                        )
                        .setLabel(
                            'Emoji',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            false,
                        )
                        .setMaxLength(
                            100,
                        )
                        .setValue(
                            button.emoji ||
                            '',
                        ),
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'button_style',
                        )
                        .setLabel(
                            'Style: primary / secondary / success / danger',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            true,
                        )
                        .setMaxLength(
                            20,
                        )
                        .setValue(
                            button.style,
                        ),
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'button_title',
                        )
                        .setLabel(
                            'Thông tin Title',
                        )
                        .setStyle(
                            TextInputStyle.Short,
                        )
                        .setRequired(
                            true,
                        )
                        .setMaxLength(
                            256,
                        )
                        .setValue(
                            button.title ||
                            '',
                        ),
                ),

            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'button_description',
                        )
                        .setLabel(
                            'Thông tin Description',
                        )
                        .setStyle(
                            TextInputStyle.Paragraph,
                        )
                        .setRequired(
                            true,
                        )
                        .setMaxLength(
                            4000,
                        )
                        .setValue(
                            button.description ||
                            '',
                        ),
                ),
        );
}


/*
 * ==========================================================
 * MODAL HANDLER
 * ==========================================================
 */

export default [
    {
        name:
            'huanqian_modal',

        async execute(
            interaction,
            client,
            args,
        ) {
            if (
                !interaction.guild
            ) {
                return;
            }

            if (
                !hasAdminPermission(
                    interaction,
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ Bạn cần quyền Administrator hoặc Manage Server.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const type =
                args[0];

            /*
             * ------------------------------------------------
             * PANEL
             * ------------------------------------------------
             */

            if (
                type === 'panel'
            ) {
                const sessionId =
                    args[1];

                const session =
                    getSession(
                        interaction,
                        sessionId,
                    );

                if (!session) {
                    return interaction.reply({
                        content:
                            '❌ Dashboard đã hết hạn.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                const panelChannel =
                    interaction.fields.getTextInputValue(
                        'panel_channel',
                    ).trim();

                const title =
                    interaction.fields.getTextInputValue(
                        'panel_title',
                    ).trim();

                const description =
                    interaction.fields.getTextInputValue(
                        'panel_description',
                    );

                const color =
                    interaction.fields.getTextInputValue(
                        'panel_color',
                    ).trim();

                if (
                    !/^\d{17,20}$/.test(
                        panelChannel,
                    )
                ) {
                    return interaction.reply({
                        content:
                            '❌ Panel Channel ID không hợp lệ.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                if (
                    !/^#?[0-9a-fA-F]{6}$/.test(
                        color,
                    )
                ) {
                    return interaction.reply({
                        content:
                            '❌ Embed Color phải có dạng `#6F5846`.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                await updateHuanqianPanel(
                    client,
                    interaction.guild.id,
                    {
                        panelChannelId:
                            panelChannel,

                        panelTitle:
                            title,

                        panelDescription:
                            description,

                        panelColor:
                            color.startsWith('#')
                                ? color
                                : `#${color}`,
                    },
                );

                await interaction.deferUpdate();

                return showHuanqianDashboard(
                    interaction,
                    client,
                    session,
                );
            }


            /*
             * ------------------------------------------------
             * IMAGE
             * ------------------------------------------------
             */

            if (
                type === 'image'
            ) {
                const sessionId =
                    args[1];

                const session =
                    getSession(
                        interaction,
                        sessionId,
                    );

                if (!session) {
                    return interaction.reply({
                        content:
                            '❌ Dashboard đã hết hạn.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                const image =
                    interaction.fields.getTextInputValue(
                        'panel_image',
                    ).trim();

                if (
                    image &&
                    !validUrl(
                        image,
                    )
                ) {
                    return interaction.reply({
                        content:
                            '❌ Image URL không hợp lệ.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                await updateHuanqianPanel(
                    client,
                    interaction.guild.id,
                    {
                        panelImage:
                            image ||
                            null,
                    },
                );

                await interaction.deferUpdate();

                return showHuanqianDashboard(
                    interaction,
                    client,
                    session,
                );
            }


            /*
             * ------------------------------------------------
             * BUTTON
             * ------------------------------------------------
             */

            if (
                type === 'button'
            ) {
                const buttonId =
                    args[1];

                const sessionId =
                    args[2];

                const session =
                    getSession(
                        interaction,
                        sessionId,
                    );

                if (!session) {
                    return interaction.reply({
                        content:
                            '❌ Dashboard đã hết hạn.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                const label =
                    interaction.fields.getTextInputValue(
                        'button_label',
                    ).trim();

                const emoji =
                    interaction.fields.getTextInputValue(
                        'button_emoji',
                    ).trim();

                const style =
                    interaction.fields.getTextInputValue(
                        'button_style',
                    )
                        .trim()
                        .toLowerCase();

                const title =
                    interaction.fields.getTextInputValue(
                        'button_title',
                    ).trim();

                const description =
                    interaction.fields.getTextInputValue(
                        'button_description',
                    );

                const allowedStyles = [
                    'primary',
                    'secondary',
                    'success',
                    'danger',
                ];

                if (
                    !allowedStyles.includes(
                        style,
                    )
                ) {
                    return interaction.reply({
                        content:
                            '❌ Style phải là `primary`, `secondary`, `success` hoặc `danger`.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                await updateHuanqianButton(
                    client,
                    interaction.guild.id,
                    buttonId,
                    {
                        label,
                        emoji,
                        style,
                        title,
                        description,
                    },
                );

                await interaction.deferUpdate();

                return showHuanqianDashboard(
                    interaction,
                    client,
                    session,
                );
            }

            return interaction.reply({
                content:
                    '❌ Modal Huan Qian không hợp lệ.',

                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },
];
