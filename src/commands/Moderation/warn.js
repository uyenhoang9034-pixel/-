import {
    SlashCommandBuilder,
    PermissionFlagsBits,
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

import {
    successEmbed,
} from '../../utils/embeds.js';

import {
    logModerationAction,
} from '../../utils/moderation.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    WarningService,
} from '../../services/moderation/warningService.js';

import {
    ModerationService,
} from '../../services/moderation/moderationService.js';

import {
    TitanBotError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

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


const MODERATION_IMAGE_PATH =
    path.resolve(process.cwd(), 'assets/moderation/ban.webp');

const MODERATION_IMAGE_URL =
    'https://files.catbox.moe/6mx2kd.webp';


const EMOJIS = {
    /**
     * Giữ nguyên emoji dòng Usagi Moderation.
     */
    decoration:
        '<a:bang3:1546891744237461635>',

    /**
     * Emoji mới cho toàn bộ tiêu đề field.
     */
    field:
        '<a:bang2:1546891483250954290>',
};


/**
 * =========================================================
 * SEND USAGI WARN LOG
 * =========================================================
 */

async function sendUsagiWarnLog({
    guild,
    target,
    moderator,
    reason,
    totalCount,
    warningCase,
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
            `Warn log channel ${MODERATION_CHANNEL_ID} not found.`,
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
                    `<:usagi9:1541422359960092813> Người cảnh cáo: <@${moderator.id}>`,
                    `<a:bang2:1546891483250954290> Tổng cảnh cáo: ${totalCount}`,
                    `<a:bang2:1546891483250954290> Warning Case: #${warningCase}`,
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
        logger.warn('Failed to send warn log as Components V2, falling back to embed:', v2Err);
        const fallbackEmbed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setDescription(
                [
                    '# <a:trangtrig2:1546040703375904801> **WARN** <a:trangtrig3:1546040818261954610>',
                    '---',
                    `<:usagi9:1541422359960092813> Thành viên: <@${target.id}>`,
                    `<:usagi9:1541422359960092813> Người cảnh cáo: <@${moderator.id}>`,
                    `<a:bang2:1546891483250954290> Tổng cảnh cáo: ${totalCount}`,
                    `<a:bang2:1546891483250954290> Warning Case: #${warningCase}`,
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
                'warn',
            )
            .setDescription(
                'Cảnh cáo một thành viên',
            )
            .addUserOption(
                option =>
                    option
                        .setName(
                            'target',
                        )
                        .setRequired(
                            true,
                        )
                        .setDescription(
                            'Thành viên cần cảnh cáo',
                        ),
            )
            .addStringOption(
                option =>
                    option
                        .setName(
                            'reason',
                        )
                        .setRequired(
                            true,
                        )
                        .setDescription(
                            'Nhập lý do cảnh cáo',
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
        const deferSuccess =
            await InteractionHelper.safeDefer(
                interaction,
            );


        if (!deferSuccess) {
            logger.warn(
                'Warn interaction defer failed',
                {
                    userId:
                        interaction.user.id,

                    guildId:
                        interaction.guildId,

                    commandName:
                        'warn',
                },
            );

            return;
        }


        const target =
            interaction.options.getUser(
                'target',
            );


        const member =
            interaction.options.getMember(
                'target',
            ) ||
            (target
                ? await interaction.guild.members.fetch(target.id).catch(() => null)
                : null);


        const reason =
            interaction.options.getString(
                'reason',
            );


        const moderator =
            interaction.user;


        const guildId =
            interaction.guildId;


        if (!target) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'You must specify a user to warn.',
                {
                    subtype:
                        'invalid_user',
                },
            );
        }


        if (!reason) {
            throw new TitanBotError(
                'Missing warning reason',
                ErrorTypes.VALIDATION,
                'You must provide a reason for the warning.',
                {
                    subtype:
                        'missing_required',
                },
            );
        }


        if (!member) {
            throw new TitanBotError(
                'Target not found',
                ErrorTypes.USER_INPUT,
                'The target user is not currently in this server.',
            );
        }


        if (
            target.id ===
            interaction.user.id
        ) {
            throw new TitanBotError(
                'Cannot warn self',
                ErrorTypes.VALIDATION,
                'You cannot warn yourself.',
            );
        }


        if (
            target.id ===
            client.user.id
        ) {
            throw new TitanBotError(
                'Cannot warn bot',
                ErrorTypes.VALIDATION,
                'You cannot warn the bot.',
            );
        }


        ModerationService.assertModerationHierarchy(
            interaction.member,
            member,
            'warn',
        );


        const {
            id: warningId,
            totalCount,
        } =
            await WarningService.addWarning({
                guildId,

                userId:
                    target.id,

                moderatorId:
                    moderator.id,

                reason,

                timestamp:
                    Date.now(),
            });


        await logModerationAction({
            client,

            guild:
                interaction.guild,

            event: {
                action:
                    'User Warned',

                target:
                    `${target.tag} (${target.id})`,

                executor:
                    `${moderator.tag} (${moderator.id})`,

                reason,

                metadata: {
                    userId:
                        target.id,

                    moderatorId:
                        moderator.id,

                    totalWarns:
                        totalCount,

                    warningNumber:
                        totalCount,

                    warningId,
                },
            },
        });


        await sendUsagiWarnLog({
            guild:
                interaction.guild,

            target,

            moderator,

            reason,

            totalCount,

            warningCase:
                warningId,
        });


        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    successEmbed(
                        `⚠️ **Warned** ${target.tag}`,
                        [
                            `**Reason:** ${reason}`,
                            `**Total Warns:** ${totalCount}`,
                            `**Warning Case:** #${warningId}`,
                        ].join(
                            '\n',
                        ),
                    ),
                ],
            },
        );
    },
};
