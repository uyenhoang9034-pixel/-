import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} from 'discord.js';

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';


const MODERATION_CHANNEL_ID =
    '1546893787123556404';


const MODERATION_IMAGE_PATH =
    path.resolve(process.cwd(), 'assets/moderation/ban.webp');

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
                0n,
            )
            .setDMPermission(
                false,
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

        const files = [];
        let mediaUrl = MODERATION_IMAGE_URL;
        if (fs.existsSync(MODERATION_IMAGE_PATH)) {
            files.push(new AttachmentBuilder(MODERATION_IMAGE_PATH, { name: 'ban.webp' }));
            mediaUrl = 'attachment://ban.webp';
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    '# <a:trangtrig2:1546040703375904801> **WARN** <a:trangtrig3:1546040818261954610>',
                ),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    [
                        `<:usagi9:1541422359960092813> Thành viên: <@${target.id}>`,
                        `<:usagi9:1541422359960092813> Người cảnh cáo: <@${interaction.user.id}>`,
                        `<a:bang2:1546891483250954290> Tổng cảnh cáo: ${fakeTotalWarnings}`,
                        `<a:bang2:1546891483250954290> Warning Case: #${fakeWarningCase}`,
                    ].join('\n'),
                ),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `<a:trangtrig29:1546385117478527016> Lý do: ${reason}`,
                ),
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(mediaUrl),
                ),
            );

        try {
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                files: files.length > 0 ? files : undefined,
            });
        } catch (v2Err) {
            logger.warn('Failed to send testwarn log as Components V2, falling back to embed:', v2Err);
            const fallbackEmbed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setDescription(
                    [
                        '# <a:trangtrig2:1546040703375904801> **WARN** <a:trangtrig3:1546040818261954610>',
                        '---',
                        `<:usagi9:1541422359960092813> Thành viên: <@${target.id}>`,
                        `<:usagi9:1541422359960092813> Người cảnh cáo: <@${interaction.user.id}>`,
                        `<a:bang2:1546891483250954290> Tổng cảnh cáo: ${fakeTotalWarnings}`,
                        `<a:bang2:1546891483250954290> Warning Case: #${fakeWarningCase}`,
                        '---',
                        `<a:trangtrig29:1546385117478527016> Lý do: ${reason}`,
                    ].join('\n'),
                );

            if (files.length > 0) {
                fallbackEmbed.setImage('attachment://ban.webp');
            } else {
                fallbackEmbed.setImage(MODERATION_IMAGE_URL);
            }

            try {
                await channel.send({
                    embeds: [fallbackEmbed],
                    files: files.length > 0 ? files : undefined,
                });
            } catch (sendError) {
                if (files.length > 0) {
                    fallbackEmbed.setImage(MODERATION_IMAGE_URL);
                    await channel.send({
                        embeds: [fallbackEmbed],
                    });
                } else {
                    throw sendError;
                }
            }
        }


        await interaction.reply({
            content:
                'Đã gửi giao diện test cảnh cáo. Không có warning nào được lưu.',

            flags:
                MessageFlags.Ephemeral,
        });
    },
};
