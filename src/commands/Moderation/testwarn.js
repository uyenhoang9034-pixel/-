import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    AttachmentBuilder,
} from 'discord.js';


const MODERATION_CHANNEL_ID =
    '1546893787123556404';


const MODERATION_IMAGE_URL =
    'https://files.catbox.moe/6mx2kd.webp';


const EMOJIS = {
    decoration:
        '<a:bang3:1546891744237461635>',

    field:
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
                        `${EMOJIS.field} **CẢNH CÁO!**`,

                        '',

                        `${EMOJIS.field} **Thành viên**`,
                        `<@${target.id}>`,

                        '',

                        `${EMOJIS.field} **Người cảnh cáo**`,
                        `<@${interaction.user.id}>`,

                        '',

                        `${EMOJIS.field} **Lý do**`,
                        reason,

                        '',

                        `${EMOJIS.field} **Tổng cảnh cáo**`,
                        `**${fakeTotalWarnings}**`,

                        '',

                        `${EMOJIS.field} **Warning Case**`,
                        `#${fakeWarningCase}`,
                    ].join(
                        '\n',
                    ),
                )
                .setImage(
                    'attachment://ban.webp',
                )
                .setTimestamp();


        const files = [
            new AttachmentBuilder(
                MODERATION_IMAGE_URL,
                {
                    name: 'ban.webp',
                },
            ),
        ];

        await channel.send({
            embeds: [
                embed,
            ],
            files,
        });


        await interaction.reply({
            content:
                'Đã gửi giao diện test cảnh cáo. Không có warning nào được lưu.',

            flags:
                MessageFlags.Ephemeral,
        });
    },
};
