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

    warn:
        '<a:bang2:1546891483250954290>',
};

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'testwarn',
            )
            .setDescription(
                'Test giao diện thông báo cảnh cáo',
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
                            'Lý do cảnh cáo hiển thị trong bản test',
                        )
                        .setRequired(
                            true,
                        ),
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ModerateMembers,
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
                    0xf7c6d9,
                )
                .setTitle(
                    `${EMOJIS.decoration} 𝓤𝓼𝓪𝓰𝓲 𝓜𝓸𝓭𝓮𝓻𝓪𝓽𝓲𝓸𝓷 ${EMOJIS.decoration}`,
                )
                .setDescription(
                    [
                        `${EMOJIS.warn} **CẢNH CÁO**`,

                        '',
                        `${EMOJIS.warn} **Thành viên**`,
                        `<@${target.id}>`,

                        '',
                        `${EMOJIS.warn} **Người cảnh cáo**`,
                        `<@${interaction.user.id}>`,

                        '',
                        `${EMOJIS.warn} **Lý do**`,
                        reason,

                        '',
                        `${EMOJIS.warn} **Tổng cảnh cáo**`,
                        '**1**',

                        '',
                        `${EMOJIS.warn} **Warning Case**`,
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
                        `Đã gửi bản test cảnh cáo vào <#${MODERATION_CHANNEL_ID}>. Warning không được lưu vào database.`,
                    ephemeral:
                        true,
                },
            );
    },
};
