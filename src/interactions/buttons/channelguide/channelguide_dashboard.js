import {
    MessageFlags,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

import {
    getChannelGuideConfig,
    saveChannelGuideConfig,
    toggleGuide,
    moveGuide,
    deleteGuide,
    normalizePanelSlot,
} from '../../../services/channelguide/channelGuideService.js';

import {
    getDashboardSession,
    deleteDashboardSession,
    showChannelGuideDashboard,
} from '../../../commands/Community/modules/channelguide_dashboard.js';

import { hasRoleTier } from '../../../config/commands/roleAccess.js';

function hasAdminPermission(interaction) {
    return hasRoleTier(
        interaction.member,
        'TOP_ADMIN',
        interaction.guild,
        interaction.user,
    );
}

function getSession(interaction, sessionId) {
    const session =
        getDashboardSession(
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
        interaction.guild.id
    ) {
        return null;
    }

    return session;
}

function buildGuideModal(
    config,
    guide = null,
    sessionId = '',
    panelSlot = 1,
) {
    const isEdit =
        Boolean(guide);
    const resolvedSlot = normalizePanelSlot(panelSlot);

    const modal =
        new ModalBuilder()
            .setCustomId(
                `channelguide_dashboard_guide:${isEdit ? guide.id : 'new'}:${sessionId}:${resolvedSlot}`,
            )
            .setTitle(
                resolvedSlot === 2
                    ? (isEdit ? 'Edit Channel Guide 2' : 'Add Channel Guide 2')
                    : (isEdit ? 'Edit Channel Guide' : 'Add Channel Guide'),
            );

    const labelInput =
        new TextInputBuilder()
            .setCustomId(
                'guide_label',
            )
            .setLabel(
                'Tên nút guide',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(true)
            .setMaxLength(80)
            .setValue(
                guide?.label || '',
            );

    const emojiInput =
        new TextInputBuilder()
            .setCustomId(
                'guide_emoji',
            )
            .setLabel('Emoji')
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(true)
            .setMaxLength(100)
.setValue(
    guide?.emoji || '📖',
);
    const titleInput =
        new TextInputBuilder()
            .setCustomId(
                'guide_title',
            )
            .setLabel(
                'Tiêu đề hướng dẫn',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(true)
            .setMaxLength(256)
            .setValue(
                guide?.title || '',
            );

    const descriptionInput =
        new TextInputBuilder()
            .setCustomId(
                'guide_description',
            )
            .setLabel(
                'Nội dung hướng dẫn',
            )
            .setStyle(
                TextInputStyle.Paragraph,
            )
            .setRequired(true)
            .setMaxLength(4000)
            .setValue(
                guide?.description || '',
            );

    const channelsInput =
        new TextInputBuilder()
            .setCustomId(
                'guide_channels',
            )
            .setLabel(
                'Channel IDs (phân cách bằng dấu phẩy)',
            )
            .setStyle(
                TextInputStyle.Paragraph,
            )
            .setRequired(false)
            .setPlaceholder(
                'Dán ID kênh: 123..., 456...',
            )
            .setValue(
                (guide?.channels || [])
                    .map(
                        channel =>
                            channel.channelId,
                    )
                    .join(', '),
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                labelInput,
            ),
        new ActionRowBuilder()
            .addComponents(
                emojiInput,
            ),
        new ActionRowBuilder()
            .addComponents(
                titleInput,
            ),
        new ActionRowBuilder()
            .addComponents(
                descriptionInput,
            ),
        new ActionRowBuilder()
            .addComponents(
                channelsInput,
            ),
    );

    return modal;
}

function buildPanelModal(config, sessionId = '', panelSlot = 1) {
    const resolvedSlot = normalizePanelSlot(panelSlot);
    const modal =
        new ModalBuilder()
            .setCustomId(
                `channelguide_dashboard_panel:${sessionId}:${resolvedSlot}`,
            )
            .setTitle(
                resolvedSlot === 2
                    ? 'Channel Guide 2 Panel Settings'
                    : 'Channel Guide Panel Settings',
            );

    const channelInput =
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
            .setRequired(true)
            .setValue(
                config.panelChannelId ||
                '',
            );

    const titleInput =
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
            .setRequired(true)
            .setMaxLength(256)
            .setValue(
                config.panelTitle ||
                '',
            );

    const descriptionInput =
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
            .setRequired(true)
            .setMaxLength(4000)
            .setValue(
                config.panelDescription ||
                '',
            );

    const imageInput =
        new TextInputBuilder()
            .setCustomId(
                'panel_image',
            )
            .setLabel(
                'Panel Image URL',
            )
            .setStyle(
                TextInputStyle.Short,
            )
            .setRequired(false)
            .setValue(
                config.panelImage ||
                '',
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                channelInput,
            ),
        new ActionRowBuilder()
            .addComponents(
                titleInput,
            ),
        new ActionRowBuilder()
            .addComponents(
                descriptionInput,
            ),
        new ActionRowBuilder()
            .addComponents(
                imageInput,
            ),
    );

    return modal;
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
        const panelSlot =
            normalizePanelSlot(session.panelSlot);

        if (
            action === 'close'
        ) {
            deleteDashboardSession(
                sessionId,
            );

            return interaction.update({
                content:
                    panelSlot === 2
                        ? '🌸 Channel Guide 2 Dashboard đã đóng.'
                        : '🌸 Channel Guide Dashboard đã đóng.',
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
                    panelSlot,
                );

            const maxPage =
                Math.max(
                    0,
                    Math.ceil(
                        config.guides.length /
                            20,
                    ) - 1,
                );

            session.page =
                action === 'prev'
                    ? Math.max(
                        0,
                        session.page - 1,
                    )
                    : Math.min(
                        maxPage,
                        session.page + 1,
                    );

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
                panelSlot,
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
                    panelSlot,
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
                    panelSlot,
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
                panelSlot,
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
                panelSlot,
            );

            await interaction.deferUpdate();

            return showChannelGuideDashboard(
                interaction,
                client,
                session,
            );
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
                panelSlot,
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

        if (
            action === 'panel'
        ) {
            return interaction.showModal(
                buildPanelModal(
                    config,
                    sessionId,
                    panelSlot,
                ),
            );
        }

        if (
            action === 'preview'
        ) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            const { buildChannelGuidePanel } =
                await import(
                    '../../../commands/Community/modules/channelguide_panel.js'
                );

            const previewPayload =
                buildChannelGuidePanel(
                    config,
                    0,
                    interaction.guild,
                    panelSlot,
                );

            delete previewPayload.content;
            delete previewPayload.embeds;

            return interaction.editReply(previewPayload);
        }

        if (
            action === 'publish'
        ) {
            if (
                !config.panelChannelId
            ) {
                return interaction.reply({
                    content:
                        '❌ Chưa cài Panel Channel. Hãy mở Panel Settings trước.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

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
                return interaction.editReply({
                    content:
                        '❌ Panel Channel không hợp lệ hoặc bot không thể truy cập.',
                });
            }

            const { buildChannelGuidePanel } =
    await import(
        '../../../commands/Community/modules/channelguide_panel.js'
    );

            const payload =
    buildChannelGuidePanel(
        config,
        0,
        interaction.guild,
        panelSlot,
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
                const editPayload = { ...payload };
                if (message.flags?.has?.(MessageFlags.IsComponentsV2)) {
                    delete editPayload.content;
                    delete editPayload.embeds;
                }
                await message.edit(
                    editPayload,
                );
            } else {
                const sendPayload = { ...payload };
                delete sendPayload.content;
                delete sendPayload.embeds;

                message =
                    await channel.send(
                        sendPayload,
                    );

                config.panelMessageId =
                    message.id;

                await saveChannelGuideConfig(
                    client,
                    guildId,
                    config,
                    panelSlot,
                );
            }

            return interaction.editReply({
                content:
                    panelSlot === 2
                        ? '✅ Channel Guide Panel 2 đã được Publish / Update.'
                        : '✅ Channel Guide Panel đã được Publish / Update.',
            });
        }

        return interaction.reply({
            content:
                '❌ Thao tác Dashboard không hợp lệ.',
            flags:
                MessageFlags.Ephemeral,
        });
    },
};
