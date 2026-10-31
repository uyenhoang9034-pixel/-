import {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import {
    getChannelGuideConfig,
    getGuideItem,
} from '../../../services/channelguide/channelGuideService.js';

import {
    buildChannelGuidePanel,
} from '../../../commands/Community/modules/channelguide_panel.js';

function buildGuideDetailComponents(guide, guild) {
    const title =
        guide.title ||
        `${guide.emoji || '📖'} ${guide.label || 'Channel Guide'}`;

    const description =
        guide.description ||
        'Chưa có nội dung hướng dẫn cho danh mục này.';

    const channels =
        Array.isArray(guide.channels)
            ? guide.channels.filter(channel =>
                channel &&
                typeof channel.channelId === 'string' &&
                channel.channelId.trim(),
            )
            : [];

    const containers = [];
    let container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                title.startsWith('#') ? title : `# ${title}`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${description}\n\n*🌸 Serendipity Channel Guide*`,
            ),
        );

    // Giữ mỗi Container trong giới hạn component của Discord.
    // Container đầu có 3 thành phần phần đầu, còn tối đa 7 Section.
    let sectionsInContainer = 0;

    for (const channelEntry of channels) {
        if (sectionsInContainer >= 7) {
            containers.push(container);
            container = new ContainerBuilder();
            sectionsInContainer = 0;
        }

        const channelId = channelEntry.channelId;
        const channelLabel = `<#${channelId}>`;

        const channelDescription =
            typeof channelEntry.description === 'string'
                ? channelEntry.description.trim()
                : '';

        const sectionText =
            channelDescription
                ? `<a:heartg1:1545307544808071258> **${channelLabel}**\n${channelDescription}`
                : `<a:heartg1:1545307544808071258> **${channelLabel}**`;

        const jumpButton =
            new ButtonBuilder()
                .setLabel('Đi đến kênh')
                .setStyle(ButtonStyle.Link)
                .setURL(
                    `https://discord.com/channels/${guild.id}/${channelId}`,
                );

        const section =
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(sectionText),
                )
                .setButtonAccessory(jumpButton);

        container.addSectionComponents(section);
        sectionsInContainer += 1;
    }

    if (channels.length === 0) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '\n📌 Danh mục này hiện chưa liên kết kênh nào. Nội dung hướng dẫn vẫn được hiển thị ở phía trên.',
            ),
        );
    }

    containers.push(container);

    return containers;
}

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

            const components =
                buildGuideDetailComponents(
                    guide,
                    interaction.guild,
                );

            return interaction.reply({
                components,
                flags:
                    MessageFlags.Ephemeral |
                    MessageFlags.IsComponentsV2,
                allowedMentions: {
                    parse: [],
                },
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
                    interaction.guild,
                );

            return interaction.update(
                payload,
            );
        },
    },
];
