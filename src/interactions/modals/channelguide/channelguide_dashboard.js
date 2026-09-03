import {
    MessageFlags,
} from 'discord.js';

import {
    getChannelGuideConfig,
    saveChannelGuideConfig,
} from '../../../services/channelguide/channelGuideService.js';

import {
    getDashboardSession,
    showChannelGuideDashboard,
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

    const ids =
        value
            .split(',')
            .map(
                item =>
                    item.trim(),
            )
            .filter(Boolean);

    return [
        ...new Set(ids),
    ].map(
        channelId => ({
            channelId,
            description: '',
        }),
    );
}

export default {
    name:
        'channelguide_dashboard_guide',

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

        const config =
            await getChannelGuideConfig(
                client,
                interaction.guild.id,
            );

        const guideId =
            args[0];

        const label =
            interaction.fields.getTextInputValue(
                'guide_label',
            ).trim();

        const emoji =
            interaction.fields.getTextInputValue(
                'guide_emoji',
            ).trim();

        const title =
            interaction.fields.getTextInputValue(
                'guide_title',
            ).trim();

        const description =
            interaction.fields.getTextInputValue(
                'guide_description',
            ).trim();

        const channels =
            normalizeChannels(
                interaction.fields.getTextInputValue(
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

        if (
            guideId === 'new'
        ) {
            const id =
                `guide_${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;

            config.guides.push({
                id,
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
                args[1],
            );

        if (session) {
            if (
                guideId === 'new'
            ) {
                session.selectedGuideId =
                    config.guides[
                        config.guides.length - 1
                    ].id;
            } else {
                session.selectedGuideId =
                    guideId;
            }

            await interaction.reply({
                content:
                    '✅ Đã lưu Channel Guide.',
                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        return interaction.reply({
            content:
                '✅ Đã lưu Channel Guide. Hãy chạy lại `/channelguide setup` để xem Dashboard.',
            flags:
                MessageFlags.Ephemeral,
        });
    },
};
