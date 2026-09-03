import {
    MessageFlags,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import {
    getChannelGuideConfig,
    saveChannelGuideConfig,
    toggleGuide,
    moveGuide,
    deleteGuide,
} from '../../../services/channelguide/channelGuideService.js';

import {
    getDashboardSession,
    deleteDashboardSession,
    showChannelGuideDashboard,
} from '../../../commands/Community/modules/channelguide_dashboard.js';

function hasAdminPermission(interaction) {
    return (
        interaction.member?.permissions?.has('Administrator') ||
        interaction.member?.permissions?.has('ManageGuild')
    );
}

function getSession(interaction, sessionId) {
    const session = getDashboardSession(sessionId);

    if (!session) {
        return null;
    }

    if (session.userId !== interaction.user.id) {
        return null;
    }

    if (session.guildId !== interaction.guild.id) {
        return null;
    }

    return session;
}

function buildGuideModal(
    config,
    guide = null,
    sessionId = '',
) {
    const isEdit = Boolean(guide);

    const modal = new ModalBuilder()
        .setCustomId(
            `channelguide_dashboard_guide:${isEdit ? guide.id : 'new'}:${sessionId}`
        )
        .setTitle(
            isEdit
                ? 'Edit Channel Guide'
                : 'Add Channel Guide',
        );

    const labelInput = new TextInputBuilder()
        .setCustomId('guide_label')
        .setLabel('Tên nút guide')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80)
        .setValue(
            guide?.label || '',
        );

    const emojiInput = new TextInputBuilder()
        .setCustomId('guide_emoji')
        .setLabel('Emoji')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10)
        .setValue(
            guide?.emoji || '📖',
        );

    const titleInput = new TextInputBuilder()
        .setCustomId('guide_title')
        .setLabel('Tiêu đề hướng dẫn')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256)
        .setValue(
            guide?.title || '',
        );

    const descriptionInput = new TextInputBuilder()
        .setCustomId('guide_description')
        .setLabel('Nội dung hướng dẫn')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setValue(
            guide?.description || '',
        );

    const channelsInput = new TextInputBuilder()
        .setCustomId('guide_channels')
        .setLabel('Channel IDs, cách nhau bằng dấu phẩy')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('123456789, 987654321')
        .setValue(
            (guide?.channels || [])
                .map(channel => channel.channelId)
                .join(', '),
        );

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            labelInput,
        ),
        new ActionRowBuilder().addComponents(
            emojiInput,
        ),
        new ActionRowBuilder().addComponents(
            titleInput,
        ),
        new ActionRowBuilder().addComponents(
            descriptionInput,
        ),
        new ActionRowBuilder().addComponents(
            channelsInput,
        ),
    );

    return modal;
}

function buildPanelModal(config) {
    const modal = new ModalBuilder()
        .setCustomId(
            'channelguide_dashboard_panel',
        )
        .setTitle(
            'Channel Guide Panel Settings',
        );

    const channelInput = new TextInputBuilder()
        .setCustomId('panel_channel')
        .setLabel('Panel Channel ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(
            config.panelChannelId || '',
        );

    const titleInput = new TextInputBuilder()
        .setCustomId('panel_title')
        .setLabel('Panel Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(256)
        .setValue(
            config.panelTitle || '',
        );

    const descriptionInput = new TextInputBuilder()
        .setCustomId('panel_description')
        .setLabel('Panel Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000)
        .setValue(
            config.panelDescription || '',
        );

    const imageInput = new TextInputBuilder()
        .setCustomId('panel_image')
        .setLabel('Panel Image URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(
            config.panelImage || '',
        );

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            channelInput,
        ),
        new ActionRowBuilder().addComponents(
            titleInput,
        ),
        new ActionRowBuilder().addComponents(
            descriptionInput,
        ),
        new ActionRowBuilder().addComponents(
            imageInput,
        ),
    );

    return modal;
}

function buildPreview(config) {
    const enabledGuides =
        config.guides.filter(
            guide =>
                guide.enabled !== false,
        );

    const embed =
        new EmbedBuilder()
            .setColor(0xf6b6d6)
            .setTitle(
                config.panelTitle ||
                '𝓢𝓮𝓻𝓮𝓷𝓭𝓲𝓹𝓲𝓽𝔂 🖤🤍',
            )
            .setDescription(
                config.panelDescription ||
                'Hướng dẫn sử dụng các kênh discord server Serendipity 🖤🤍',
            );

    if (config.panelImage) {
        embed.setImage(
            config.panelImage,
        );
    }

    const rows = [];

    for (
        let i = 0;
        i < enabledGuides.length;
        i += 5
    ) {
        const row =
            new ActionRowBuilder();

        enabledGuides
            .slice(i, i + 5)
            .forEach(guide => {
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
            });

        rows.push(row);
    }

    return {
        embeds: [embed],
        components: rows,
    };
}

export default {
    name:
        'channelguide_dashboard',

    async execute(
        interaction,
        client,
        args,
    ) {
        if (!interaction.guild) {
            return;
        }

        if (!hasAdminPermission(interaction)) {
            return interaction.reply({
                content:
                    '❌ Bạn cần quyền Administrator hoặc Manage Server.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        const sessionId =
            args[0];

        const action =
            args[1];

        const session =
            getSession(
                interaction,
                sessionId,
            );

        if (!session) {
            return interaction.reply({
                content:
                    '❌ Dashboard này đã hết hạn hoặc không thuộc về bạn.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        const guildId =
            interaction.guild.id;

        if (
            action === 'close'
        ) {
            deleteDashboardSession(
                sessionId,
            );

            return interaction.update({
                content:
                    '🌸 Channel Guide Dashboard đã đóng.',
                embeds: [],
                components: [],
            });
        }

        if (
            action === 'prev' ||
            action === 'next'
        ) {
            const config =
                await getChannelGuideConfig(
                    client,
                    guildId,
                );

            if (
                action === 'prev'
            ) {
                session.page =
                    Math.max(
                        0,
                        session.page - 1,
                    );
            } else {
                const maxPage =
                    Math.max(
                        0,
                        Math.ceil(
                            config.guides.length /
                                20,
                        ) - 1,
                    );

                session.page =
                    Math.min(
                        maxPage,
                        session.page + 1,
                    );
            }

            await interaction.deferUpdate();

            return showChannelGuideDashboard(
                interaction,
                client,
                session,
            );
        }

        const config =
            await getChannelGuideConfig(
                client,
                guildId,
            );

        const selected =
            session.selectedGuideId
                ? config.guides.find(
                    guide =>
                        guide.id ===
                        session.selectedGuideId,
                )
                : null;

        if (
            action === 'edit'
        ) {
            if (!selected) {
                return interaction.reply({
                    content:
                        '❌ Hãy chọn một guide trước.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            return interaction.showModal(
                buildGuideModal(
    config,
    selected,
    sessionId,
),
            );
        }

        if (
            action === 'add'
        ) {
            return interaction.showModal(
               buildGuideModal(
    config,
    null,
    sessionId,
),
            );
        }

        if (
            action === 'toggle'
        ) {
            if (!selected) {
                return interaction.reply({
                    content:
                        '❌ Hãy chọn một guide trước.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            await toggleGuide(
                client,
                guildId,
                selected.id,
            );

            await interaction.deferUpdate();

            return showChannelGuideDashboard(
                interaction,
                client,
                session,
            );
        }

        if (
            action === 'up' ||
            action === 'down'
        ) {
            if (!selected) {
                return interaction.reply({
                    content:
                        '❌ Hãy chọn một guide trước.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            await moveGuide(
                client,
                guildId,
                selected.id,
                action,
            );

            await interaction.deferUpdate();

            return showChannelGuideDashboard(
                interaction,
                client,
                session,
            );
        }

        if (
            action === 'panel'
        ) {
            return interaction.showModal(
                buildPanelModal(
                    config,
                ),
            );
        }

        if (
            action === 'preview'
        ) {
            return interaction.reply({
                content:
                    '👀 Đây là Preview của Channel Guide Panel:',
                ...buildPreview(config),
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        if (
            action === 'publish'
        ) {
            if (!config.panelChannelId) {
                return interaction.reply({
                    content:
                        '❌ Chưa cài Panel Channel. Hãy mở Panel Settings trước.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const channel =
                await interaction.guild.channels.fetch(
                    config.panelChannelId,
                ).catch(
                    () => null,
                );

            if (
                !channel ||
                !channel.isTextBased()
            ) {
                return interaction.reply({
                    content:
                        '❌ Panel Channel không hợp lệ hoặc bot không thể truy cập.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const payload =
                buildPreview(
                    config,
                );

            let message = null;

            if (
                config.panelMessageId
            ) {
                message =
                    await channel.messages
                        .fetch(
                            config.panelMessageId,
                        )
                        .catch(
                            () => null,
                        );
            }

            if (message) {
                await message.edit(
                    payload,
                );
            } else {
                message =
                    await channel.send(
                        payload,
                    );

                config.panelMessageId =
                    message.id;

                await saveChannelGuideConfig(
                    client,
                    guildId,
                    config,
                );
            }

            return interaction.reply({
                content:
                    '✅ Channel Guide Panel đã được Publish / Update.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        if (
            action === 'delete'
        ) {
            if (!selected) {
                return interaction.reply({
                    content:
                        '❌ Hãy chọn một guide trước.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            await deleteGuide(
                client,
                guildId,
                selected.id,
            );

            session.selectedGuideId =
                null;

            await interaction.deferUpdate();

            return showChannelGuideDashboard(
                interaction,
                client,
                session,
            );
        }

        return interaction.reply({
            content:
                '❌ Thao tác Dashboard không hợp lệ.',
            flags:
                MessageFlags.Ephemeral,
        });
    },
};
