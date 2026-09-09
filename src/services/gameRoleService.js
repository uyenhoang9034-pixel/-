import {
    AttachmentBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import fs from 'fs';
import path from 'path';
import {
    fileURLToPath,
} from 'url';

import {
    GAME_ROLES,
    GAME_ROLE_NOTIFICATION_CHANNEL_ID,
    GAME_ROLE_EMBED_COLOR,
    getGameRoleByEmoji,
    getGameRoleByRoleId,
    getReactionToken,
} from '../config/gameRoles.js';

import {
    logger,
} from '../utils/logger.js';


const __filename =
    fileURLToPath(
        import.meta.url,
    );

const __dirname =
    path.dirname(
        __filename,
    );


/**
 * Project root:
 *
 * src/services/gameRoleService.js
 * -> ../../
 * -> project root
 */

const PROJECT_ROOT =
    path.resolve(
        __dirname,
        '../..',
    );


const ROLE_ASSET_DIRECTORY =
    path.join(
        PROJECT_ROOT,
        'assets',
        'role',
    );


/**
 * =========================================================
 * PANEL DATA
 * =========================================================
 *
 * Chỉ cần một panel role chính.
 *
 * Message ID được lưu DB sau khi chạy:
 *
 * /reactroles setup
 */

const GAME_ROLE_PANEL_KEY_PREFIX =
    'gameRolePanel:';


function getPanelKey(
    guildId,
) {
    return (
        `${GAME_ROLE_PANEL_KEY_PREFIX}${guildId}`
    );
}


/**
 * =========================================================
 * PANEL STORAGE
 * =========================================================
 */

export async function saveGameRolePanel(
    client,
    guildId,
    data,
) {
    await client.db.set(
        getPanelKey(
            guildId,
        ),
        {
            guildId,

            channelId:
                data.channelId,

            messageId:
                data.messageId,

            createdAt:
                data.createdAt ??
                new Date().toISOString(),
        },
    );
}


export async function getGameRolePanel(
    client,
    guildId,
) {
    try {
        const result =
            await client.db.get(
                getPanelKey(
                    guildId,
                ),
            );

        if (!result) {
            return null;
        }

        /**
         * Hỗ trợ cả DB wrapper:
         *
         * { ok, value }
         *
         * và DB trả object trực tiếp.
         */

        if (
            result?.ok &&
            result?.value
        ) {
            return result.value;
        }

        if (
            result?.value &&
            typeof result.value ===
                'object'
        ) {
            return result.value;
        }

        return result;

    } catch (error) {
        logger.error(
            'Failed to get game role panel:',
            error,
        );

        return null;
    }
}


/**
 * =========================================================
 * CHECK PANEL REACTION
 * =========================================================
 */

export async function isGameRolePanelReaction(
    reaction,
    client,
) {
    const message =
        reaction?.message;

    if (
        !message?.guildId ||
        !message?.id
    ) {
        return false;
    }

    const panel =
        await getGameRolePanel(
            client,
            message.guildId,
        );

    if (!panel) {
        return false;
    }

    return (
        panel.messageId ===
            message.id &&
        panel.channelId ===
            message.channelId
    );
}


/**
 * =========================================================
 * REACTION ROLE LOOKUP
 * =========================================================
 */

export function getGameRoleConfigFromReaction(
    reaction,
) {
    return getGameRoleByEmoji(
        reaction?.emoji,
    );
}


/**
 * =========================================================
 * MEMBER FETCH
 * =========================================================
 */

async function fetchGuildMember(
    reaction,
    user,
) {
    const guild =
        reaction.message.guild;

    if (!guild) {
        return null;
    }

    return (
        guild.members.cache.get(
            user.id,
        ) ??
        await guild.members
            .fetch(
                user.id,
            )
            .catch(
                () =>
                    null,
            )
    );
}


/**
 * =========================================================
 * ROLE SAFETY
 * =========================================================
 */

async function canBotManageRole(
    guild,
    role,
) {
    const me =
        guild.members.me ??
        await guild.members
            .fetchMe()
            .catch(
                () =>
                    null,
            );

    if (!me) {
        return false;
    }

    if (
        !me.permissions.has(
            PermissionFlagsBits.ManageRoles,
        )
    ) {
        return false;
    }

    if (
        role.managed
    ) {
        return false;
    }

    return (
        role.position <
        me.roles.highest.position
    );
}


/**
 * =========================================================
 * ADD ROLE FROM REACTION
 * =========================================================
 *
 * Notification KHÔNG gửi tại đây.
 *
 * Khi role được thêm:
 *
 * member.roles.add()
 *        ↓
 * GuildMemberUpdate
 *        ↓
 * sendGameRoleNotification()
 *
 * Nhờ vậy:
 *
 * Reaction cấp role
 * Admin cấp role
 * Command cấp role
 *
 * đều dùng chung notification.
 */

export async function addGameRoleFromReaction(
    reaction,
    user,
) {
    if (
        !reaction ||
        !user ||
        user.bot
    ) {
        return false;
    }

    const config =
        getGameRoleConfigFromReaction(
            reaction,
        );

    if (!config) {
        return false;
    }

    const guild =
        reaction.message.guild;

    if (!guild) {
        return false;
    }

    const member =
        await fetchGuildMember(
            reaction,
            user,
        );

    if (!member) {
        logger.warn(
            `Could not fetch member ${user.id} for game role reaction.`,
        );

        return false;
    }

    const role =
        guild.roles.cache.get(
            config.roleId,
        ) ??
        await guild.roles
            .fetch(
                config.roleId,
            )
            .catch(
                () =>
                    null,
            );

    if (!role) {
        logger.warn(
            `Game role ${config.roleId} (${config.label}) does not exist.`,
        );

        return false;
    }

    const manageable =
        await canBotManageRole(
            guild,
            role,
        );

    if (!manageable) {
        logger.warn(
            `Bot cannot manage game role ${role.name} (${role.id}).`,
        );

        return false;
    }

    /**
     * User đã có role.
     *
     * Không add lại.
     */

    if (
        member.roles.cache.has(
            role.id,
        )
    ) {
        return true;
    }

    try {
        await member.roles.add(
            role,
            `Game role reaction: ${config.label}`,
        );

        logger.info(
            `Added game role ${role.name} to ${member.user.tag} via reaction.`,
        );

        return true;

    } catch (error) {
        logger.error(
            `Failed to add game role ${role.id} to ${member.user.tag}:`,
            error,
        );

        return false;
    }
}


/**
 * =========================================================
 * REMOVE ROLE FROM REACTION
 * =========================================================
 *
 * Không gửi notification khi gỡ role.
 */

export async function removeGameRoleFromReaction(
    reaction,
    user,
) {
    if (
        !reaction ||
        !user ||
        user.bot
    ) {
        return false;
    }

    const config =
        getGameRoleConfigFromReaction(
            reaction,
        );

    if (!config) {
        return false;
    }

    const guild =
        reaction.message.guild;

    if (!guild) {
        return false;
    }

    const member =
        await fetchGuildMember(
            reaction,
            user,
        );

    if (!member) {
        return false;
    }

    const role =
        guild.roles.cache.get(
            config.roleId,
        ) ??
        await guild.roles
            .fetch(
                config.roleId,
            )
            .catch(
                () =>
                    null,
            );

    if (!role) {
        return false;
    }

    const manageable =
        await canBotManageRole(
            guild,
            role,
        );

    if (!manageable) {
        return false;
    }

    if (
        !member.roles.cache.has(
            role.id,
        )
    ) {
        return true;
    }

    try {
        await member.roles.remove(
            role,
            `Game role reaction removed: ${config.label}`,
        );

        logger.info(
            `Removed game role ${role.name} from ${member.user.tag} via reaction.`,
        );

        return true;

    } catch (error) {
        logger.error(
            `Failed to remove game role ${role.id} from ${member.user.tag}:`,
            error,
        );

        return false;
    }
}


/**
 * =========================================================
 * IMAGE
 * =========================================================
 */

function getRoleImagePath(
    config,
) {
    if (
        !config?.image
    ) {
        return null;
    }

    const imagePath =
        path.join(
            ROLE_ASSET_DIRECTORY,
            config.image,
        );

    if (
        !fs.existsSync(
            imagePath,
        )
    ) {
        logger.warn(
            `Game role image not found: ${imagePath}`,
        );

        return null;
    }

    return imagePath;
}


/**
 * =========================================================
 * ROLE NOTIFICATION
 * =========================================================
 */

export async function sendGameRoleNotification(
    member,
    roleId,
) {
    try {
        if (
            !member?.guild ||
            !member?.user
        ) {
            return false;
        }

        /**
         * Không gửi thông báo cho bot.
         */

        if (
            member.user.bot
        ) {
            return false;
        }

        const config =
            getGameRoleByRoleId(
                roleId,
            );

        if (!config) {
            return false;
        }

        const guild =
            member.guild;

        const notificationChannel =
            guild.channels.cache.get(
                GAME_ROLE_NOTIFICATION_CHANNEL_ID,
            ) ??
            await guild.channels
                .fetch(
                    GAME_ROLE_NOTIFICATION_CHANNEL_ID,
                )
                .catch(
                    () =>
                        null,
                );

        if (
            !notificationChannel ||
            !notificationChannel.isTextBased?.()
        ) {
            logger.warn(
                `Game role notification channel ${GAME_ROLE_NOTIFICATION_CHANNEL_ID} not found.`,
            );

            return false;
        }

        /**
         * =================================================
         * DESCRIPTION
         * =================================================
         */

        let description =
            `<a:heartg5:1546906071199907972> Chúc mừng ${member} đã được cấp role <@&${config.roleId}> và nhận được những đặc quyền liên quan đến role.`;

        /**
         * Role game bình thường:
         * thêm channel được mở khóa.
         *
         * no_game:
         * config.channelId = null
         * nên không thêm đoạn này.
         */

        if (
            config.channelId
        ) {
            description +=
                ` Đồng thời mở khóa kênh <#${config.channelId}>!`;
        } else {
            description +=
                '!';
        }

        description +=
            '\n\n<a:heartg5:1546906071199907972> Chúc bạn chơi zui zẻ ở server bọn mình và nhớ chăm chỉ up level để nhận thưởng khi đạt mốc 300 nhé!';


        /**
         * =================================================
         * EMBED
         * =================================================
         */

        const embed =
            new EmbedBuilder()
                .setTitle(
                    '<a:trangtrig2:1546040703375904801> 𝓡𝓸𝓵𝓮𝓼 𝓱𝓪𝓿𝓮 𝓬𝓱𝓪𝓷𝓰𝓮𝓭 <a:trangtrig3:1546040818261954610>',
                )
                .setDescription(
                    description,
                )
                .setColor(
                    GAME_ROLE_EMBED_COLOR,
                );


        /**
         * =================================================
         * ATTACH ROLE IMAGE
         * =================================================
         */

        const imagePath =
            getRoleImagePath(
                config,
            );

        const files = [];

        if (
            imagePath
        ) {
            const attachmentName =
                `game-role-${config.key}.png`;

            const attachment =
                new AttachmentBuilder(
                    imagePath,
                    {
                        name:
                            attachmentName,
                    },
                );

            files.push(
                attachment,
            );

            embed.setImage(
                `attachment://${attachmentName}`,
            );
        }


        /**
         * =================================================
         * SEND
         * =================================================
         */

        await notificationChannel.send({
            embeds: [
                embed,
            ],

            files,
        });


        logger.info(
            `Sent game role notification for ${member.user.tag}: ${config.label}`,
        );

        return true;

    } catch (error) {
        logger.error(
            `Failed to send game role notification for role ${roleId}:`,
            error,
        );

        return false;
    }
}


/**
 * =========================================================
 * REACT PANEL
 * =========================================================
 */

export async function addAllGameRoleReactions(
    message,
) {
    for (
        const config
        of GAME_ROLES
    ) {
        try {
            await message.react(
                getReactionToken(
                    config,
                ),
            );

        } catch (error) {
            logger.error(
                `Failed to add reaction ${config.label} (${config.emoji.id ?? config.emoji.name}) to game role panel:`,
                error,
            );
        }
    }
}
