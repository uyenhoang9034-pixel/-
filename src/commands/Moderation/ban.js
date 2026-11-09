import {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} from 'discord.js';

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

import {
    successEmbed,
} from '../../utils/embeds.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
    ModerationService,
} from '../../services/moderation/moderationService.js';

import {
    TitanBotError,
    ErrorTypes,
} from '../../utils/errorHandler.js';


const MODERATION_CHANNEL_ID =
    '1546893787123556404';


/**
 * =========================================================
 * MODERATION IMAGE
 * =========================================================
 */

const MODERATION_IMAGE_PATH =
    path.resolve(process.cwd(), 'assets/moderation/ban.webp');

const MODERATION_IMAGE_URL =
    'https://files.catbox.moe/6mx2kd.webp';


/**
 * =========================================================
 * EMOJIS
 * =========================================================
 */

const EMOJIS = {
    decoration:
        '<a:bang6:1546906224388350035>',

    field:
        '<a:bang4:1546905765439217666>',

    reasonEnd:
        '<a:bang1:1546891405371117668>',
};


/**
 * =========================================================
 * SEND USAGI BAN LOG
 * =========================================================
 */

async function sendUsagiBanLog({
    guild,
    target,
    moderator,
    reason,
    caseId,
}) {
    const channel =
        await guild.channels
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
        logger.warn(
            `Ban log channel ${MODERATION_CHANNEL_ID} not found.`,
        );

        return;
    }

    const files = [];
    let mediaUrl = MODERATION_IMAGE_URL;
    if (fs.existsSync(MODERATION_IMAGE_PATH)) {
        files.push(new AttachmentBuilder(MODERATION_IMAGE_PATH, { name: 'ban.webp' }));
        mediaUrl = 'attachment://ban.webp';
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '# <a:trangtrig2:1546040703375904801> **BAN** <a:trangtrig3:1546040818261954610>',
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    `<:usagi9:1541422359960092813> Thành viên: <@${target.id}>`,
                    `<:usagi9:1541422359960092813> Người xử lý: <@${moderator.id}>`,
                    `<a:bang2:1546891483250954290> Ban Case: #${caseId}`,
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
        logger.warn('Failed to send ban log as Components V2, falling back to embed:', v2Err);
        const fallbackEmbed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setDescription(
                [
                    '# <a:trangtrig2:1546040703375904801> **BAN** <a:trangtrig3:1546040818261954610>',
                    '---',
                    `<:usagi9:1541422359960092813> Thành viên: <@${target.id}>`,
                    `<:usagi9:1541422359960092813> Người xử lý: <@${moderator.id}>`,
                    `<a:bang2:1546891483250954290> Ban Case: #${caseId}`,
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
}


/**
 * =========================================================
 * COMMAND
 * =========================================================
 */

export default {
    data:
        new SlashCommandBuilder()
            .setName(
                'ban',
            )
            .setDescription(
                'Ban a user from the server',
            )
            .addUserOption(
                option =>
                    option
                        .setName(
                            'target',
                        )
                        .setDescription(
                            'The user to ban',
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
                            'Reason for the ban',
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
        config,
        client,
    ) {
        const user =
            interaction.options
                .getUser(
                    'target',
                );


        const reason =
            interaction.options
                .getString(
                    'reason',
                ) ||
            'Không có lý do';


        if (!user) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to ban.',
            );
        }


        if (
            user.id ===
            interaction.user.id
        ) {
            throw new TitanBotError(
                'Cannot ban self',
                ErrorTypes.VALIDATION,
                'You cannot ban yourself.',
            );
        }


        if (
            user.id ===
            client.user.id
        ) {
            throw new TitanBotError(
                'Cannot ban bot',
                ErrorTypes.VALIDATION,
                'You cannot ban the bot.',
            );
        }


        const result =
            await ModerationService
                .banUser({
                    guild:
                        interaction.guild,

                    user,

                    moderator:
                        interaction.member,

                    reason,
                });


        await sendUsagiBanLog({
            guild:
                interaction.guild,

            target:
                user,

            moderator:
                interaction.user,

            reason,

            caseId:
                result.caseId,
        });


        await InteractionHelper
            .universalReply(
                interaction,
                {
                    embeds: [
                        successEmbed(
                            `🚫 **Banned** ${user.tag}`,
                            `**Reason:** ${reason}\n**Case ID:** #${result.caseId}`,
                        ),
                    ],
                },
            );
    },
};
