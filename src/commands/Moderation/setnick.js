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

import {
    sendSetnickLog,
} from '../../services/setnickService.js';

import {
    hasRoleTier,
    buildRoleDeniedMessage,
} from '../../config/commands/roleAccess.js';


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
    '1545295139390619768';

/*
 * Emoji dùng cho tiêu đề:
 *
 * <a:chiikawag9:1541427795786207313>
 */
const TITLE_EMOJI =
    '<a:chiikawag9:1541427795786207313>';

/*
 * Emoji dùng cho 3 thông tin:
 *
 * Member
 * New nickname
 * Changed by
 *
 * <a:pinkheart:1545307544808071258>
 */
const INFO_EMOJI =
    '<a:pinkheart:1545307544808071258>';


/*
 * Nickname format
 *
 * Người dùng nhập:
 *
 *     linh
 *
 * Bot đổi thành:
 *
 *     ⋆˚࿔ linh ♡
 */

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

function resolveUserId(
    value,
) {
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
 */

function buildNickname(
    name,
) {
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

            .setDefaultMemberPermissions(0n)
            .setDMPermission(false),

    category:
        'moderation',

    /*
     * Đây là Slash Command.
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
             * Chỉ role Tier 1 (1545295139390619768) trở lên
             * được sử dụng /setnick.
             */

            if (
                !hasRoleTier(
                    interaction.member,
                    'STAFF_TICKET',
                    guild,
                    interaction.user,
                )
            ) {
                return replyUserError(
                    interaction,
                    {
                        type:
                            ErrorTypes.PERMISSION,

                        message:
                            buildRoleDeniedMessage('setnick'),
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
             *
             * Input:
             *
             *     linh
             *
             * Result:
             *
             *     ⋆˚࿔ linh ♡
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
             * SEND NOTIFICATION VIA SETNICK SERVICE
             * ------------------------------------------------
             */

            sendSetnickLog({
                client,
                guild,
                targetMember,
                nickname,
            }).catch((err) => {
                logger.error('[SetNick] Error sending setnick log:', err);
            });

            /*
             * ------------------------------------------------
             * SUCCESS RESPONSE
             * ------------------------------------------------
             */

            return InteractionHelper.universalReply(
                interaction,
                {
                    content:
                        `${INFO_EMOJI} Đã đổi nickname của ${targetMember} từ \`${oldNickname}\` thành **${nickname}**.`,
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
