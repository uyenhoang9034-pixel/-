import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import {
    GUIDE_ITEMS,
    getChannelGuideConfig,
    setChannelGuideConfig,
} from '../../services/channelguide/channelGuideService.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('channelguide')
        .setDescription(
            'Manage the server Channel Guide',
        )

        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription(
                    'Create or update the Channel Guide',
                )

                .addChannelOption(option =>
                    option
                        .setName('panel')
                        .setDescription(
                            'Channel where the guide panel will be posted',
                        )
                        .setRequired(true),
                )

                .addChannelOption(option =>
                    option
                        .setName('information')
                        .setDescription(
                            'Serendipity Information channel',
                        ),
                )

                .addChannelOption(option =>
                    option
                        .setName('news')
                        .setDescription(
                            'Serendipity-news channel',
                        ),
                )

                .addChannelOption(option =>
                    option
                        .setName('chat')
                        .setDescription(
                            'Chat and Beyond channel',
                        ),
                )

                .addChannelOption(option =>
                    option
                        .setName('games')
                        .setDescription(
                            'Game On channel',
                        ),
                )

                .addChannelOption(option =>
                    option
                        .setName('sidequests')
                        .setDescription(
                            'Side-quests channel',
                        ),
                )

                .addChannelOption(option =>
                    option
                        .setName('stuffies')
                        .setDescription(
                            'Extra Stuffies channel',
                        ),
                )

                .addChannelOption(option =>
                    option
                        .setName('boutique')
                        .setDescription(
                            'Usagi boutique channel',
                        ),
                )

                .addChannelOption(option =>
                    option
                        .setName('voice')
                        .setDescription(
                            'Voice Lounge channel',
                        ),
                )

                .addStringOption(option =>
                    option
                        .setName('image')
                        .setDescription(
                            'Optional image URL for the guide embed',
                        )
                        .setRequired(false),
                ),
        ),

    category: 'Community',

    async execute(
        interaction,
    ) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content:
                    '❌ Lệnh này chỉ dùng trong server.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.Administrator,
            ) &&
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageGuild,
            )
        ) {
            return interaction.reply({
                content:
                    '❌ Bạn cần quyền Administrator hoặc Manage Server.',
                flags:
                    MessageFlags.Ephemeral,
            });
        }

        const panel =
            interaction.options.getChannel(
                'panel',
                true,
            );

        const channels = {};

        for (
            const item of GUIDE_ITEMS
        ) {
            const channel =
                interaction.options.getChannel(
                    item.id,
                    false,
                );

            if (channel) {
                channels[item.id] =
                    channel.id;
            }
        }

        const image =
            interaction.options.getString(
                'image',
                false,
            )?.trim() || null;

        const config =
            await setChannelGuideConfig(
                interaction.client,
                interaction.guild.id,
                {
                    panelChannelId:
                        panel.id,
                    panelMessageId:
                        null,
                    panelImage:
                        image,
                    channels,
                },
            );

        const embed =
            new EmbedBuilder()
                .setColor(0xf6b6d6)
                .setTitle(
                    '𝓢𝓮𝓻𝓮𝓷𝓭𝓲𝓹𝓲𝓽𝔂 🖤🤍',
                )
                .setDescription(
                    [
                        '🌸 **Welcome to Serendipity!**',
                        '',
                        'Bấm vào các button bên dưới để xem hướng dẫn sử dụng từng khu vực trong server.',
                        '',
                        '📖 Hãy xem hướng dẫn trước khi sử dụng các kênh nhé!',
                    ].join('\n'),
                );

        if (config.panelImage) {
            embed.setImage(
                config.panelImage,
            );
        }

        const rows = [];

        for (
            let i = 0;
            i < GUIDE_ITEMS.length;
            i += 5
        ) {
            const row =
                new ActionRowBuilder();

            for (
                const item of GUIDE_ITEMS.slice(
                    i,
                    i + 5,
                )
            ) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `channelguide:${item.id}`,
                        )
                        .setLabel(
                            item.label,
                        )
                        .setEmoji(
                            item.emoji,
                        )
                        .setStyle(
                            ButtonStyle.Primary,
                        ),
                );
            }

            rows.push(row);
        }

        const message =
            await panel.send({
                embeds: [
                    embed,
                ],
                components:
                    rows,
            });

        await setChannelGuideConfig(
            interaction.client,
            interaction.guild.id,
            {
                panelMessageId:
                    message.id,
            },
        );

        await interaction.reply({
            content:
                `🌸 Channel Guide đã được tạo tại ${panel}.`,
            flags:
                MessageFlags.Ephemeral,
        });
    },
};
