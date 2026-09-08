import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

const MODERATION_CHANNEL_ID =
    '1546893787123556404';

const MODERATION_IMAGE_URL =
    'https://cdn.phototourl.com/free/2026-09-08-9fd00794-554a-4eca-91fd-8f5cd6c3dae9.jpg';

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
                'Xem thử giao diện thông báo cảnh cáo',
            )
            .addUserOption(
                option =>
                    option
                        .setName(
                            'target',
                        )
                        .setDescription(
                            'Thành viên dùng để hiển thị thử',
                        )
                        .setRequired(
                            true,
                        ),
            )
            .addStringOption(
                option =>
                    option
                        .setName(
                            'reason',
                        )
                        .setDescription(
                            'Nội dung cảnh cáo hiển thị thử',
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
            await interaction.guild.channels
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
            await interaction.reply({
                content:
                    'Không tìm thấy kênh moderation.',

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }

        const fakeTotalWarnings =
            0;

        const fakeWarningCase =
            'TEST-001';

        const embed =
            new EmbedBuilder()
                .setColor(
                    0xffffff,
                )
                .setTitle(
                    `${EMOJIS.decoration} 𝓤𝓼𝓪𝓰𝓲 𝓜𝓸𝓭𝓮𝓻𝓪𝓽𝓲𝓸𝓷 ${EMOJIS.decoration}`,
                )
                .setDescription(
                    [
                        `${EMOJIS.warn} **CẢNH CÁO!**`,

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
                        `**${fakeTotalWarnings}**`,

                        '',
                        `${EMOJIS.warn} **Warning Case**`,
                        `#${fakeWarningCase}`,
                    ].join('\n'),
                )
                .setImage(
                    MODERATION_IMAGE_URL,
                )
                .setTimestamp();

        await channel.send({
            embeds: [
                embed,
            ],
        });

        await interaction.reply({
            content:
                'Đã gửi giao diện test cảnh cáo. Không có warning nào được lưu.',

            flags:
                MessageFlags.Ephemeral,
        });
    },
};
