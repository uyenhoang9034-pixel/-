import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    AttachmentBuilder,
} from 'discord.js';

import fs from 'node:fs/promises';
import path from 'node:path';

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
 * CREATE LOCAL IMAGE
 * =========================================================
 */

async function createModerationImageAttachment() {
    try {
        await fs.access(
            MODERATION_IMAGE_PATH,
        );
    } catch {
        logger.warn(
            `[WARN] Moderation image not found: ${MODERATION_IMAGE_PATH}`,
        );

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


    const image =
        await createModerationImageAttachment();


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
                    `<@${moderator.id}>`,

                    '',

                    `${EMOJIS.field} **Lý do**`,
                    reason,

                    '',

                    `${EMOJIS.field} **Tổng cảnh cáo**`,
                    `**${totalCount}**`,

                    '',

                    `${EMOJIS.field} **Warning Case**`,
                    `#${warningCase}`,
                ].join(
                    '\n',
                ),
            )
            .setTimestamp();


    if (
        image
    ) {
        embed.setImage(
            `attachment://${MODERATION_IMAGE_NAME}`,
        );
    }


    await channel.send({
        embeds: [
            embed,
        ],

        files:
            image
                ? [image]
                : [],
    });
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
            );


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
