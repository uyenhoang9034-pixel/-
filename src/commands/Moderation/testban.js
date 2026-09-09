import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    AttachmentBuilder,
} from 'discord.js';

import fs from 'node:fs/promises';
import path from 'node:path';


const MODERATION_CHANNEL_ID =
    '1546893787123556404';


const MODERATION_IMAGE_NAME =
    'ban.webp';

const MODERATION_IMAGE_PATH =
    path.resolve(
        process.cwd(),
        'assets',
        'moderation',
        MODERATION_IMAGE_NAME,
    );


const EMOJIS = {
    decoration:
        '<a:bang6:1546906224388350035>',

    field:
        '<a:bang4:1546905765439217666>',

    reasonEnd:
        '<a:bang1:1546891405371117668>',
};


async function createModerationImageAttachment() {
    try {
        await fs.access(
            MODERATION_IMAGE_PATH,
        );
    } catch {
        return null;
    }


    return new AttachmentBuilder(
        MODERATION_IMAGE_PATH,
        {
            name:
                MODERATION_IMAGE_NAME,
        },
    );
}


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


        const image =
            await createModerationImageAttachment();


        if (!image) {
            await interaction.reply({
                content:
                    'Không tìm thấy file `assets/moderation/ban.webp`.',

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }


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
                        `${EMOJIS.field} **ĐÃ BAN!**`,

                        '',

                        `${EMOJIS.field} **Thành viên**`,
                        `<@${target.id}>`,

                        '',

                        `${EMOJIS.field} **Người xử lý**`,
                        `<@${interaction.user.id}>`,

                        '',

                        `${EMOJIS.field} **Lý do**`,
                        `Vi phạm nội quy: ${reason} ${EMOJIS.reasonEnd}`,

                        '',

                        `${EMOJIS.field} **Case**`,
                        `#${fakeCaseId}`,
                    ].join(
                        '\n',
                    ),
                )
                .setImage(
                    `attachment://${MODERATION_IMAGE_NAME}`,
                )
                .setTimestamp();


        await channel.send({
            embeds: [
                embed,
            ],

            files: [
                image,
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
