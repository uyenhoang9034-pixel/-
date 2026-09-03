import {
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import {
    getChannelGuideConfig,
    getGuideItem,
} from '../../../services/channelguide/channelGuideService.js';

export default {
    name:
        'channelguide',

    async execute(
        interaction,
        client,
        args,
    ) {
        const guideId =
            args[0];

        const item =
            getGuideItem(
                guideId,
            );

        if (!item) {
            return interaction.reply({
                content:
                    '❌ Không tìm thấy hướng dẫn này.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        const config =
            await getChannelGuideConfig(
                client,
                interaction.guild.id,
            );

        const channelId =
            config.channels[
                item.id
            ];

        const embed =
            new EmbedBuilder()
                .setColor(0xf6b6d6)
                .setTitle(
                    item.title,
                )
                .setDescription(
                    item.description,
                )
                .setFooter({
                    text:
                        '🌸 Serendipity Channel Guide',
                });

        const components = [];

        if (channelId) {
            components.push(
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel(
                                `Đi tới ${item.label}`,
                            )
                            .setEmoji(
                                item.emoji,
                            )
                            .setStyle(
                                ButtonStyle.Link,
                            )
                            .setURL(
                                `https://discord.com/channels/${interaction.guild.id}/${channelId}`,
                            ),
                    ),
            );
        }

        await interaction.reply({
            embeds: [
                embed,
            ],
            components,
            flags:
                MessageFlags.Ephemeral,
        });
    },
};
