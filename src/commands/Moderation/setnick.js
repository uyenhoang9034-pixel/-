import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';

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


/*
 * ============================================================
 * SETNICK CONFIGURATION
 * ============================================================
 */

const SETNICK_CHANNEL_ID =
    '1541364885789745213';

/*
 * Role quản lý được phép sử dụng /setnick
 */
const SETNICK_MANAGEMENT_ROLE_ID =
    '1545305594712432640';

/*
 * Custom animated emoji của server
 */
const SERVER_EMOJI =
    '<a:chiikawag6:1541427271930220554>';

const NICKNAME_PREFIX =
    '⋆˚࿔ ';

const NICKNAME_SUFFIX =
    ' ♡';

const MAX_NICKNAME_LENGTH =
    32;


/*
 * ============================================================
 * RESOLVE USER ID
 * ============================================================
 *
 * Hỗ trợ:
 *
 * @User
 * <@123456789>
 * <@!123456789>
 * 123456789
 */

function resolveUserId(value) {
    if (!value) {
        return null;
    }

    const mentionMatch =
        value.match(
            /^<@!?(\d+)>$/,
        );

    if (mentionMatch) {
        return mentionMatch[1];
    }

    if (
        /^\d{17,20}$/.test(
            value,
        )
    ) {
        return value;
    }

    return null;
}


/*
 * ============================================================
 * BUILD NICKNAME
 * ============================================================
 *
 * Người dùng nhập:
 *
 *     linh
 *
 * Bot đổi thành:
 *
 *     ⋆˚࿔ linh ♡
 */

function buildNickname(name) {
    return `${NICKNAME_PREFIX}${name}${NICKNAME_SUFFIX}`;
}


/*
 * ============================================================
 * SLASH COMMAND
 * ============================================================
 */

export default {
    data:
        new SlashCommandBuilder()
            .setName('setnick')
            .setDescription(
                'Đổi nickname cho một thành viên trong server.',
            )

            .addStringOption(
                option =>
                    option
                        .setName('user')
                        .setDescription(
                            'Tag thành viên hoặc nhập User ID.',
                        )
                        .setRequired(true),
            )

            .addStringOption(
                option =>
                    option
                        .setName('nickname')
                        .setDescription(
                            'Nickname mới.',
                        )
                        .setRequired(true)
                        .setMaxLength(28),
            )

            .setDMPermission(false),

    category:
        'moderation',

    /*
     * Đây là Slash Command.
     *
     * Không sử dụng prefix command cho SetNick.
     */
    prefixOnly:
        false,


    /*
     * ========================================================
     * EXECUTE
     * ========================================================
     */

    async execute(
        interaction,
        config,
        client,
    ) {
        try {

            /*
             * ------------------------------------------------
             * SERVER CHECK
             * ------------------------------------------------
             */

            const guild =
                interaction.guild;

            if (!guild) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.VALIDATION,

                        message:
                            'Lệnh này chỉ có thể sử dụng trong server.',
                    },
                );
            }


            /*
             * ------------------------------------------------
             * MANAGEMENT ROLE CHECK
             * ------------------------------------------------
             *
             * Chỉ role:
             *
             * 1545305594712432640
             *
             * được sử dụng /setnick.
             */

            if (
                !interaction.member.roles.cache.has(
                    SETNICK_MANAGEMENT_ROLE_ID,
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


            /*
             * ------------------------------------------------
             * READ OPTIONS
             * ------------------------------------------------
             */

            const rawUser =
                interaction.options.getString(
                    'user',
                );

            const nicknameInput =
                interaction.options.getString(
                    'nickname',
                )?.trim();


            /*
             * ------------------------------------------------
             * RESOLVE USER
             * ------------------------------------------------
             */

            const userId =
                resolveUserId(
                    rawUser,
                );

            if (!userId) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.USER_INPUT,

                        message:
                            'Vui lòng tag thành viên hoặc nhập đúng User ID.',
                    },
                );
            }


            /*
             * ------------------------------------------------
             * NICKNAME VALIDATION
             * ------------------------------------------------
             */

            if (
                !nicknameInput ||
                nicknameInput.length === 0
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


            /*
             * ------------------------------------------------
             * BUILD FINAL NICKNAME
             * ------------------------------------------------
             */

            const nickname =
                buildNickname(
                    nicknameInput,
                );


            /*
             * ------------------------------------------------
             * DISCORD NICKNAME LIMIT
             * ------------------------------------------------
             */

            if (
                nickname.length >
                MAX_NICKNAME_LENGTH
            ) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.VALIDATION,

                        message:
                            `Nickname "${nicknameInput}" quá dài. Sau khi thêm ký tự trang trí phải tối đa ${MAX_NICKNAME_LENGTH} ký tự.`,
                    },
                );
            }


            /*
             * ------------------------------------------------
             * FETCH TARGET MEMBER
             * ------------------------------------------------
             */

            const targetMember =
                await guild.members
                    .fetch(
                        userId,
                    )
                    .catch(
                        () => null,
                    );

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


            /*
             * ------------------------------------------------
             * BOT MEMBER
             * ------------------------------------------------
             */

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
             * ------------------------------------------------
             * BOT PERMISSION
             * ------------------------------------------------
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
                            'Bot chưa có quyền Manage Nicknames.',
                    },
                );
            }


            /*
             * ------------------------------------------------
             * ROLE HIERARCHY
             * ------------------------------------------------
             *
             * Bot không thể đổi nickname:
             *
             * - Server Owner
             * - Người có role ngang/cao hơn bot
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
             * ------------------------------------------------
             * OLD NICKNAME
             * ------------------------------------------------
             */

            const oldNickname =
                targetMember.nickname ||
                targetMember.user.username;


            /*
             * ------------------------------------------------
             * CHANGE NICKNAME
             * ------------------------------------------------
             */

            await targetMember.setNickname(
                nickname,
                `SetNick by ${client.user?.tag || 'bot'}`,
            );


            /*
             * ------------------------------------------------
             * NOTIFICATION CHANNEL
             * ------------------------------------------------
             */

            const notificationChannel =
                guild.channels.cache.get(
                    SETNICK_CHANNEL_ID,
                ) ||
                await guild.channels
                    .fetch(
                        SETNICK_CHANNEL_ID,
                    )
                    .catch(
                        () => null,
                    );


            /*
             * ------------------------------------------------
             * SEND NOTIFICATION
             * ------------------------------------------------
             *
             * Tất cả emoji ở đây dùng đúng:
             *
             * <a:chiikawag6:1541427271930220554>
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
                            `${SERVER_EMOJI} 𝓝𝓲𝓬𝓴𝓷𝓪𝓶𝓮 𝓤𝓹𝓭𝓪𝓽𝓮𝓭`,
                        )

                        .setDescription(
                            [
                                `${SERVER_EMOJI} 𝙼𝚎𝚖𝚋𝚎𝚛: ${targetMember}`,

                                `${SERVER_EMOJI} 𝙽𝚎𝚠 𝚗𝚒𝚌𝚔𝚗𝚊𝚖𝚎: ${nickname}`,

                                `${SERVER_EMOJI} 𝙲𝚑𝚊𝚗𝚐𝚎𝚍 𝚋𝚢: ${botMention}`,
                            ].join(
                                '\n',
                            ),
                        );


                await notificationChannel
                    .send({
                        embeds: [
                            embed,
                        ],
                    })
                    .catch(
                        error => {
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
                        },
                    );
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
             * ------------------------------------------------
             * SUCCESS RESPONSE
             * ------------------------------------------------
             */

            return InteractionHelper.universalReply(
                interaction,
                {
                    content:
                        `${SERVER_EMOJI} Đã đổi nickname của ${targetMember} từ \`${oldNickname}\` thành **${nickname}**.`,
                },
            );

        } catch (error) {

            /*
             * ------------------------------------------------
             * ERROR LOG
             * ------------------------------------------------
             */

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


            /*
             * ------------------------------------------------
             * ERROR RESPONSE
             * ------------------------------------------------
             */

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
