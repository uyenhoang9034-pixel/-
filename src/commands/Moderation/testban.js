import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

const MODERATION_CHANNEL_ID =
    '1546893787123556404';

const EMOJIS = {
    decoration:
        '<a:bang3:1546891744237461635>',

    title:
        '<a:bang1:1546891405371117668>',

    item:
        '<:ban1:1546891613261922377>',

    reasonEnd:
        '<a:bang4:1546891928769929298>',
};

export default {
    data:
        new SlashCommandBuilder()
            .setName('testban')
            .setDescription(
                'Xem thử giao diện thông báo Ban',
            )
            .addUserOption(
                option =>
                    option
                        .setName('target')
                        .setDescription(
                            'Thành viên dùng để hiển thị thử',
                        )
                        .setRequired(true),
            )
            .addStringOption(
                option =>
                    option
                        .setName('reason')
                        .setDescription(
                            'Lý do hiển thị thử',
                        )
                        .setRequired(true),
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.BanMembers,
            ),

    category:
        'Moderation',

    async execute(
        interaction,
        config,
        client,
    ) {
        const target =
            interaction.options.getUser(
                'target',
                true,
            );

        const reason =
            interaction.options.getString(
                'reason',
                true,
            );

        const channel =
            await interaction.guild.channels
                .fetch(
                    MODERATION_CHANNEL_ID,
                )
                .catch(() => null);

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            await interaction.reply({
                content:
                    `Không tìm thấy kênh <#${MODERATION_CHANNEL_ID}>.`,
                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        /**
         * TEST ONLY.
         *
         * KHÔNG ban.
         * KHÔNG tạo moderation case.
         * KHÔNG ghi database.
         */

        const fakeCaseId =
            'TEST-001';

        const embed =
            new EmbedBuilder()
                .setColor(0xf29ab2)
                .setTitle(
                    `${EMOJIS.decoration} 𝓤𝓼𝓪𝓰𝓲 𝓜𝓸𝓭𝓮𝓻𝓪𝓽𝓲𝓸𝓷 ${EMOJIS.decoration}`,
                )
                .setDescription(
                    [
                        `${EMOJIS.title} **Thành viên đã bị BAN**`,

                        '',
                        `${EMOJIS.item} **Thành viên**`,
                        `<@${target.id}>`,

                        '',
                        `${EMOJIS.item} **Người xử lý**`,
                        `<@${interaction.user.id}>`,

                        '',
                        `${EMOJIS.item} **Lý do**`,
                        `Vi phạm nội quy: ${reason} ${EMOJIS.reasonEnd}`,

                        '',
                        `${EMOJIS.item} **Case**`,
                        `#${fakeCaseId}`,
                    ].join('\n'),
                )
                .setTimestamp();

        await channel.send({
            embeds: [embed],
        });

        await interaction.reply({
            content:
                `Đã gửi giao diện test Ban vào <#${MODERATION_CHANNEL_ID}>. Không ai bị ban.`,
            flags:
                MessageFlags.Ephemeral,
        });
    },
};
