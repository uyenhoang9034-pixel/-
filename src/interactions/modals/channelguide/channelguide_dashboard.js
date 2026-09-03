import {
    MessageFlags,
} from 'discord.js';

import {
    getChannelGuideConfig,
    saveChannelGuideConfig,
} from '../../../services/channelguide/channelGuideService.js';

import {
    getDashboardSession,
} from '../../../commands/Community/modules/channelguide_dashboard.js';

function hasAdminPermission(interaction) {
    return (
        interaction.member?.permissions?.has(
            'Administrator',
        ) ||
        interaction.member?.permissions?.has(
            'ManageGuild',
        )
    );
}

function normalizeChannels(value) {
    if (!value?.trim()) {
        return [];
    }

    return [
        ...new Set(
            value
                .split(',')
                .map(
                    item =>
                        item.trim(),
                )
                .filter(Boolean),
        ),
    ].map(
        channelId => ({
            channelId,
            description: '',
        }),
    );
}

const guideHandler = {
    name:
        'channelguide_dashboard_guide',

    async execute(
        interaction,
        client,
        args,
    ) {
        if (
            !interaction.guild ||
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

        const config =
            await getChannelGuideConfig(
                client,
                interaction.guild.id,
            );

        const guideId =
            args[0];

        const sessionId =
            args[1];

        const label =
            interaction.fields
                .getTextInputValue(
                    'guide_label',
                )
                .trim();

        const emoji =
            interaction.fields
                .getTextInputValue(
                    'guide_emoji',
                )
                .trim();

        const title =
            interaction.fields
                .getTextInputValue(
                    'guide_title',
                )
                .trim();

        const description =
            interaction.fields
                .getTextInputValue(
                    'guide_description',
                )
                .trim();

        const channels =
            normalizeChannels(
                interaction.fields
                    .getTextInputValue(
                        'guide_channels',
                    ),
            );

        if (
            !label ||
            !emoji ||
            !title ||
            !description
        ) {
            return interaction.reply({
                content:
                    '❌ Vui lòng điền đầy đủ thông tin bắt buộc.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        let savedGuideId =
            guideId;

        if (
            guideId === 'new'
        ) {
            savedGuideId =
                `guide_${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;

            config.guides.push({
                id:
                    savedGuideId,
                label,
                emoji,
                title,
                description,
                enabled: true,
                channels,
            });
        } else {
            const guide =
                config.guides.find(
                    item =>
                        item.id ===
                        guideId,
                );

            if (!guide) {
                return interaction.reply({
                    content:
                        '❌ Không tìm thấy guide cần chỉnh sửa.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            guide.label =
                label;

            guide.emoji =
                emoji;

            guide.title =
                title;

            guide.description =
                description;

            guide.channels =
                channels;
        }

        await saveChannelGuideConfig(
            client,
            interaction.guild.id,
            config,
        );

        const session =
            getDashboardSession(
                sessionId,
            );

        if (session) {
            session.selectedGuideId =
                savedGuideId;
        }

        return interaction.reply({
            content:
                '✅ Đã lưu Channel Guide.',
            flags:
                MessageFlags.Ephemeral,
        });
    },
};

const panelHandler = {
    name:
        'channelguide_dashboard_panel',

    async execute(
        interaction,
        client,
    ) {
        if (
            !interaction.guild ||
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

        const config =
            await getChannelGuideConfig(
                client,
                interaction.guild.id,
            );

        const panelChannelId =
            interaction.fields
                .getTextInputValue(
                    'panel_channel',
                )
                .trim();

        const panelTitle =
            interaction.fields
                .getTextInputValue(
                    'panel_title',
                )
                .trim();

        const panelDescription =
            interaction.fields
                .getTextInputValue(
                    'panel_description',
                )
                .trim();

        const panelImage =
            interaction.fields
                .getTextInputValue(
                    'panel_image',
                )
                .trim();

        const channel =
            await interaction.guild.channels
                .fetch(
                    panelChannelId,
                )
                .catch(
                    () => null,
                );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return interaction.reply({
                content:
                    '❌ Panel Channel ID không hợp lệ hoặc bot không truy cập được channel này.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        config.panelChannelId =
            panelChannelId;

        config.panelTitle =
            panelTitle;

        config.panelDescription =
            panelDescription;

        config.panelImage =
            panelImage || null;

        await saveChannelGuideConfig(
            client,
            interaction.guild.id,
            config,
        );

        return interaction.reply({
            content:
                '✅ Panel Settings đã được lưu.',
            flags:
                MessageFlags.Ephemeral,
        });
    },
};

export default [
    guideHandler,
    panelHandler,
];
