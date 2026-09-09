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
 * LOCAL MODERATION IMAGE
 * =========================================================
 */

const MODERATION_IMAGE_NAME =
    'ban.webp';

const MODERATION_IMAGE_PATH =
    path.resolve(
        process.cwd(),
        'assets',
        'moderation',
        MODERATION_IMAGE_NAME,
    );


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
 * CREATE LOCAL IMAGE
 * =========================================================
 */

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
                    `${EMOJIS.field} **ĐÃ BAN!**`,

                    '',

                    `${EMOJIS.field} **Thành viên**`,
                    `<@${target.id}>`,

                    '',

                    `${EMOJIS.field} **Người xử lý**`,
                    `<@${moderator.id}>`,

                    '',

                    `${EMOJIS.field} **Lý do**`,
                    `Vi phạm nội quy: ${reason} ${EMOJIS.reasonEnd}`,

                    '',

                    `${EMOJIS.field} **Case**`,
                    `#${caseId}`,
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
                PermissionFlagsBits.BanMembers,
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
