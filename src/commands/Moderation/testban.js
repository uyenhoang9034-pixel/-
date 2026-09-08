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
        '<a:bang6:1546906224388350035>',

    ban:
        '<a:bang5:1546905838986330124>',

    reasonEnd:
        '<a:bang1:1546891405371117668>',
};

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'testban',
            )
            .setDescription(
                'Xem thử giao diện thông báo Ban',
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
                            'Lý do hiển thị thử',
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

        /**
         * TEST ONLY
         *
         * Không ban thật.
         * Không tạo case thật.
         * Không ghi database.
         */

        const fakeCaseId =
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
                        `${EMOJIS.ban} **ĐÃ BAN!**`,

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
                        `#${fakeCaseId}`,
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
                'Đã gửi giao diện test Ban. Không ai bị ban.',

            flags:
                MessageFlags.Ephemeral,
        });
    },
};
