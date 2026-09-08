import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';

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

const MODERATION_IMAGE_URL =
    'https://cdn.phototourl.com/free/2026-09-08-9fd00794-554a-4eca-91fd-8f5cd6c3dae9.jpg';

const EMOJIS = {
    decoration:
        '<a:bang3:1546891744237461635>',

    warn:
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
                    `<@${moderator.id}>`,

                    '',
                    `${EMOJIS.warn} **Lý do**`,
                    reason,

                    '',
                    `${EMOJIS.warn} **Tổng cảnh cáo**`,
                    `**${totalCount}**`,

                    '',
                    `${EMOJIS.warn} **Warning Case**`,
                    `#${warningCase}`,
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
        /**
         * =================================================
         * DEFER
         * =================================================
         */

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

        /**
         * =================================================
         * OPTIONS
         * =================================================
         */

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

        /**
         * =================================================
         * VALIDATION
         * =================================================
         */

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

        /**
         * =================================================
         * HIERARCHY CHECK
         * =================================================
         */

        ModerationService.assertModerationHierarchy(
            interaction.member,
            member,
            'warn',
        );

        /**
         * =================================================
         * SAVE WARNING
         * =================================================
         */

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

        /**
         * =================================================
         * EXISTING MODERATION LOG
         * =================================================
         *
         * Giữ nguyên hệ thống log/case hiện tại.
         */

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

        /**
         * =================================================
         * USAGI WARN LOG
         * =================================================
         */

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

        /**
         * =================================================
         * COMMAND RESPONSE
         * =================================================
         */

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
                        ].join('\n'),
                    ),
                ],
            },
        );
    },
};
