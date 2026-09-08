import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

/**
 * =========================================================
 * CONFIG
 * =========================================================
 */

const MODERATION_CHANNEL_ID =
    '1546893787123556404';

const EMOJIS = {
    decoration:
        '<a:bang3:1546891744237461635>',

    banTitle:
        '<a:bang1:1546891405371117668>',

    ban:
        '<:ban1:1546891613261922377>',

    reasonEnd:
        '<a:bang4:1546891928769929298>',
};

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'testban',
            )
            .setDescription(
                'Test giao diện thông báo Ban',
            )
            .addUserOption(
                (option) =>
                    option
                        .setName(
                            'target',
                        )
                        .setDescription(
                            'Thành viên hiển thị trong bản test',
                        )
                        .setRequired(
                            true,
                        ),
            )
            .addStringOption(
                (option) =>
                    option
                        .setName(
                            'reason',
                        )
                        .setDescription(
                            'Lý do hiển thị trong bản test',
                        )
                        .setRequired(
                            true,
                        ),
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.BanMembers,
            ),

    category:
        'moderation',

    async execute(
        interaction,
        config,
        client,
    ) {
        const target =
            interaction.options
                .getUser(
                    'target',
                    true,
                );

        const reason =
            interaction.options
                .getString(
                    'reason',
                    true,
                );

        const channel =
            await interaction.guild
                .channels
                .fetch(
                    MODERATION_CHANNEL_ID,
                )
                .catch(
                    () => null,
                );

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            await InteractionHelper
                .universalReply(
                    interaction,
                    {
                        content:
                            'Không tìm thấy kênh moderation.',
                        ephemeral:
                            true,
                    },
                );

            return;
        }

        const embed =
            new EmbedBuilder()
                .setColor(
                    0xf29ab2,
                )
                .setTitle(
                    `${EMOJIS.decoration} 𝓤𝓼𝓪𝓰𝓲 𝓜𝓸𝓭𝓮𝓻𝓪𝓽𝓲𝓸𝓷 ${EMOJIS.decoration}`,
                )
                .setDescription(
                    [
                        `${EMOJIS.banTitle} **Thành viên đã bị BAN**`,

                        '',
                        `${EMOJIS.ban} **Thành viên**`,
                        `<@${target.id}>`,

                        '',
                        `${EMOJIS.ban} **Người xử lý**`,
                        `<@${interaction.user.id}>`,

                        '',
                        `${EMOJIS.ban} **Lý do**`,
                        `Vi phạm nội quy: ${reason} ${EMOJIS.reasonEnd}`,

                        '',
                        `${EMOJIS.ban} **Case**`,
                        '#TEST-001',
                    ].join('\n'),
                )
                .setTimestamp();

        await channel.send({
            embeds: [
                embed,
            ],
        });

        await InteractionHelper
            .universalReply(
                interaction,
                {
                    content:
                        `Đã gửi bản test Ban vào <#${MODERATION_CHANNEL_ID}>. Không có thành viên nào bị ban.`,
                    ephemeral:
                        true,
                },
            );
    },
};
