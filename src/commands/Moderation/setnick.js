import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';

import {
    memberHasConfiguredModeratorRole,
} from '../../utils/permissionGuard.js';

import {
    getGuildConfig,
} from '../../services/config/guildConfig.js';

import {
    InteractionHelper,
} from '../../utils/interactionHelper.js';

import {
    replyUserError,
    ErrorTypes,
} from '../../utils/errorHandler.js';

import {
    logger,
} from '../../utils/logger.js';

const SETNICK_CHANNEL_ID =
    '1541364885789745213';

function resolveUserId(value) {
    if (!value) {
        return null;
    }

    const mentionMatch =
        value.match(/^<@!?(\d+)>$/);

    if (mentionMatch) {
        return mentionMatch[1];
    }

    if (/^\d{17,20}$/.test(value)) {
        return value;
    }

    return null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('setnick')
        .setDescription(
            'Change a member nickname.',
        )
        .addStringOption(option =>
            option
                .setName('user')
                .setDescription(
                    'User mention or user ID.',
                )
                .setRequired(true),
        )
        .addStringOption(option =>
            option
                .setName('nickname')
                .setDescription(
                    'New nickname.',
                )
                .setRequired(true)
                .setMaxLength(32),
        )
        .setDMPermission(false),

    category: 'moderation',

    // This command is intended to work
    // through the prefix system.
    prefixOnly: true,

    async execute(
        interaction,
        config,
        client,
    ) {
        try {
            const guild =
                interaction.guild;

            if (!guild) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.VALIDATION,
                        message:
                            'This command can only be used inside a server.',
                    },
                );
            }

            const guildConfig =
                await getGuildConfig(
                    client,
                    guild.id,
                );

            /*
             * ONLY the configured Moderator Role
             * may use SetNick.
             *
             * Administrator / ManageGuild alone
             * is intentionally NOT enough.
             */
            if (
                !memberHasConfiguredModeratorRole(
                    interaction.member,
                    guildConfig,
                )
            ) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.PERMISSION,
                        message:
                            'Bạn không có role quản lý để sử dụng lệnh này.',
                    },
                );
            }

            const rawUser =
                interaction.options.getString(
                    'user',
                );

            const nickname =
                interaction.options.getString(
                    'nickname',
                )?.trim();

            const userId =
                resolveUserId(rawUser);

            if (!userId) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.USER_INPUT,
                        message:
                            'Vui lòng tag user hoặc nhập đúng User ID.',
                    },
                );
            }

            if (
                !nickname ||
                nickname.length === 0
            ) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.VALIDATION,
                        message:
                            'Nickname không được để trống.',
                    },
                );
            }

            if (nickname.length > 32) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.VALIDATION,
                        message:
                            'Nickname tối đa 32 ký tự.',
                    },
                );
            }

            const targetMember =
                await guild.members
                    .fetch(userId)
                    .catch(() => null);

            if (!targetMember) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.USER_INPUT,
                        message:
                            'Không tìm thấy user này trong server.',
                    },
                );
            }

            const botMember =
                guild.members.me;

            if (!botMember) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.UNKNOWN,
                        message:
                            'Không tìm thấy bot trong server.',
                    },
                );
            }

            /*
             * Bot must have Manage Nicknames.
             */
            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.ManageNicknames,
                )
            ) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.PERMISSION,
                        message:
                            'Bot chưa có quyền **Manage Nicknames**.',
                    },
                );
            }

            /*
             * Bot cannot modify:
             * - Server owner
             * - Members above/equal bot role
             */
            if (
                !targetMember.manageable
            ) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.PERMISSION,
                        message:
                            'Bot không thể đổi nickname của user này vì role của user cao hơn hoặc ngang role của bot.',
                    },
                );
            }

            /*
             * Save old nickname before changing.
             */
            const oldNickname =
                targetMember.nickname ||
                targetMember.user.username;

            /*
             * Change nickname.
             */
            await targetMember.setNickname(
                nickname,
                `SetNick by ${client.user?.tag || 'bot'}`,
            );

            /*
             * Get fixed notification channel.
             */
            const notificationChannel =
                guild.channels.cache.get(
                    SETNICK_CHANNEL_ID,
                ) ||
                await guild.channels
                    .fetch(
                        SETNICK_CHANNEL_ID,
                    )
                    .catch(() => null);

            /*
             * Send notification.
             */
            if (
                notificationChannel?.isTextBased()
            ) {
                const botMention =
                    client.user
                        ? `<@${client.user.id}>`
                        : 'Bot';

                const embed =
                    new EmbedBuilder()
                        .setColor(
                            '#F6B6D6',
                        )
                        .setTitle(
                            '⋆.ೃ࿔🌸*:･𝓝𝓲𝓬𝓴𝓷𝓪𝓶𝓮 𝓤𝓹𝓭𝓪𝓽𝓮𝓭',
                        )
                        .setDescription(
                            [
                                `👤 𝙼𝚎𝚖𝚋𝚎𝚛: ${targetMember}`,
                                `✏️ 𝙽𝚎𝚠 𝚗𝚒𝚌𝚔𝚗𝚊𝚖𝚎: ${nickname}`,
                                `🛡️ 𝙲𝚑𝚊𝚗𝚐𝚎𝚍 𝚋𝚢: ${botMention}`,
                            ].join('\n'),
                        );

                await notificationChannel
                    .send({
                        embeds: [embed],
                    })
                    .catch(error => {
                        logger.warn(
                            '[SetNick] Failed to send notification',
                            {
                                guildId:
                                    guild.id,
                                channelId:
                                    SETNICK_CHANNEL_ID,
                                error:
                                    error?.message,
                            },
                        );
                    });
            } else {
                logger.warn(
                    '[SetNick] Notification channel not found',
                    {
                        guildId:
                            guild.id,
                        channelId:
                            SETNICK_CHANNEL_ID,
                    },
                );
            }

            /*
             * Prefix command confirmation.
             */
            return InteractionHelper.universalReply(
                interaction,
                {
                    content:
                        `🌸 Đã đổi nickname của ${targetMember} từ \`${oldNickname}\` thành **${nickname}**.`,
                },
            );
        } catch (error) {
            logger.error(
                '[SetNick] Command failed',
                {
                    guildId:
                        interaction.guildId,
                    userId:
                        interaction.user?.id,
                    error:
                        error?.message,
                },
            );

            return replyUserError(
                interaction,
                {
                    type:
                        ErrorTypes.UNKNOWN,
                    message:
                        'Không thể đổi nickname. Vui lòng thử lại.',
                },
            );
        }
    },
};
