import {
    MessageFlags,
    EmbedBuilder,
} from 'discord.js';

import {
    getChannelGuideConfig,
    getGuideItem,
} from '../../../services/channelguide/channelGuideService.js';

import {
    buildChannelGuidePanel,
} from '../../../commands/Community/modules/channelguide_panel.js';

export default [
    {
        name:
            'channelguide',

        async execute(
            interaction,
            client,
            args,
        ) {
            if (!interaction.guild) {
                return interaction.reply({
                    content:
                        '❌ Hướng dẫn này chỉ dùng trong server.',
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

            const guide =
                getGuideItem(
                    config,
                    guideId,
                );

            if (!guide) {
                return interaction.reply({
                    content:
                        '❌ Không tìm thấy hướng dẫn này.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            if (
                guide.enabled === false
            ) {
                return interaction.reply({
                    content:
                        '❌ Hướng dẫn này hiện đang được tắt.',
                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        0xf6b6d6,
                    )
                    .setTitle(
                        `${guide.emoji} ${guide.title}`,
                    )
                    .setDescription(
                        guide.description ||
                        'Chưa có nội dung hướng dẫn.',
                    )
                    .setFooter({
                        text:
                            '🌸 Serendipity Channel Guide',
                    });

            return interaction.reply({
                embeds: [
                    embed,
                ],
                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },

    {
        name:
            'channelguide_nav',

        async execute(
            interaction,
            client,
            args,
        ) {
            if (!interaction.guild) {
                return;
            }

            const config =
                await getChannelGuideConfig(
                    client,
                    interaction.guild.id,
                );

            const page =
                Number.parseInt(
                    args[0],
                    10,
                );

            const payload =
                buildChannelGuidePanel(
                    config,
                    Number.isFinite(
                        page,
                    )
                        ? page
                        : 0,
                );

            return interaction.update(
                payload,
            );
        },
    },
];
