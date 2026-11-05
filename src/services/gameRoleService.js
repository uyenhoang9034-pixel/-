import {
    AttachmentBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
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
    DEFAULT_GAME_ROLE_ID,
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
 * =========================================================
 * PATHS
 * =========================================================
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
 * PANEL STORAGE
 * =========================================================
 */

const GAME_ROLE_PANEL_KEY_PREFIX =
    'gameRolePanel:';


function getPanelKey(
    guildId,
) {
    return `${GAME_ROLE_PANEL_KEY_PREFIX}${guildId}`;
}


/**
 * =========================================================
 * NOTIFICATION DEDUPE
 * =========================================================
 *
 * Chỉ gửi notification khi member chủ động pick role qua Reaction Panel.
 * Dedupe để ngăn spam/click nhanh nhiều lần liên tục.
 */

const recentRoleNotifications =
    new Map();

const ROLE_NOTIFICATION_DEDUPE_MS =
    5000;


function getNotificationDedupeKey(
    memberId,
    roleId,
) {
    return `${memberId}:${roleId}`;
}


function shouldSkipDuplicateNotification(
    memberId,
    roleId,
) {
    const key =
        getNotificationDedupeKey(
            memberId,
            roleId,
        );

    const now =
        Date.now();

    const previous =
        recentRoleNotifications.get(
            key,
        );

    if (
        previous &&
        now - previous <
            ROLE_NOTIFICATION_DEDUPE_MS
    ) {
        return true;
    }

    recentRoleNotifications.set(
        key,
        now,
    );

    setTimeout(
        () => {
            const stored =
                recentRoleNotifications.get(
                    key,
                );

            if (
                stored === now
            ) {
                recentRoleNotifications.delete(
                    key,
                );
            }
        },
        ROLE_NOTIFICATION_DEDUPE_MS +
            1000,
    );

    return false;
}


/**
 * =========================================================
 * SAVE PANEL
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


/**
 * =========================================================
 * GET PANEL
 * =========================================================
 */

export async function getGameRolePanel(
    client,
    guildId,
) {
    try {
        if (
            !client?.db
        ) {
            logger.warn(
                'Database unavailable while reading Game Role panel.',
            );

            return null;
        }

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
         * DB wrapper:
         *
         * {
         *   ok,
         *   value
         * }
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
        logger.warn(
            'Failed to read Game Role panel from DB:',
            error,
        );

        return null;
    }
}


/**
 * =========================================================
 * CHECK GAME ROLE PANEL
 * =========================================================
 *
 * Ưu tiên:
 *
 * 1. Check messageId trong DB.
 * 2. Nếu DB mất data sau restart:
 *    nhận diện bằng message của bot + title Get Role (hỗ trợ cả Embed và Components V2).
 * 3. Khôi phục panel vào DB.
 */

export async function isGameRolePanel(
    message,
    client,
) {
    try {
        if (
            !message ||
            !message.guildId ||
            !message.id
        ) {
            return false;
        }

        const botId =
            client?.user?.id ??
            message.guild?.members?.me?.id;

        if (
            !botId ||
            message.author?.id !== botId
        ) {
            return false;
        }

        /**
         * =============================================
         * CHECK DATABASE
         * =============================================
         */

        const panel =
            await getGameRolePanel(
                client,
                message.guildId,
            );

        if (
            panel &&
            panel.messageId ===
                message.id
        ) {
            return true;
        }

        /**
         * =============================================
         * FALLBACK
         * =============================================
         *
         * Panel vẫn còn trên Discord nhưng DB mất.
         */

        let isMatch = false;

        // 1. Check Embed (dạng cũ)
        const embed =
            message.embeds?.[0];

        if (embed) {
            const title =
                embed.title ??
                '';
            const desc =
                embed.description ??
                '';

            if (
                title.includes('𝓖𝓸́𝓬 𝓵𝓪̂́𝔂 𝓻𝓸𝓵𝓮') ||
                title.toUpperCase().includes('GÓC LẤY ROLE') ||
                desc.includes('rules trước khi lấy role')
            ) {
                isMatch = true;
            }
        }

        // 2. Check Components V2 / Content (dạng mới)
        if (!isMatch) {
            let compsString = '';
            try {
                compsString = JSON.stringify(message.components ?? []);
            } catch {
                compsString = '';
            }

            const rawText = `${message.content ?? ''} ${compsString}`;

            if (
                rawText.includes('GÓC LẤY ROLE') ||
                rawText.includes('rules trước khi lấy role') ||
                rawText.includes('1546040703375904801') ||
                rawText.includes('1546040818261954610') ||
                rawText.includes('1541364885789745213') ||
                rawText.includes('Ấn emoji để chọn game')
            ) {
                isMatch = true;
            }
        }

        if (isMatch) {
            logger.warn(
                `Game Role panel ${message.id} detected through fallback.`,
            );

            /**
             * Khôi phục panel vào DB.
             */
            try {
                if (
                    client?.db
                ) {
                    await saveGameRolePanel(
                        client,
                        message.guildId,
                        {
                            channelId:
                                message.channelId,
                            messageId:
                                message.id,
                            createdAt:
                                new Date().toISOString(),
                        },
                    );

                    logger.info(
                        `Recovered Game Role panel ${message.id} into database.`,
                    );
                }
            } catch (saveError) {
                logger.warn(
                    'Could not recover Game Role panel:',
                    saveError,
                );
            }

            return true;
        }

        return false;

    } catch (error) {
        logger.error(
            'Failed to identify Game Role panel:',
            error,
        );

        return false;
    }
}


export async function isGameRolePanelReaction(
    reaction,
    client,
) {
    try {
        const message =
            reaction?.message;

        if (
            !message?.guildId ||
            !message?.id
        ) {
            return false;
        }

        /**
         * Emoji phải thuộc 11 Game Roles.
         */
        const gameRole =
            getGameRoleByEmoji(
                reaction?.emoji,
            );

        if (!gameRole) {
            return false;
        }

        return await isGameRolePanel(
            message,
            client,
        );

    } catch (error) {
        logger.error(
            'Failed to identify Game Role reaction:',
            error,
        );

        return false;
    }
}


/**
 * =========================================================
 * GET CONFIG FROM REACTION
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
 * FETCH MEMBER
 * =========================================================
 */

async function fetchGuildMember(
    reaction,
    user,
) {
    const guild =
        reaction?.message?.guild;

    if (!guild) {
        return null;
    }

    const cached =
        guild.members.cache.get(
            user.id,
        );

    if (cached) {
        return cached;
    }

    return await guild.members
        .fetch(
            user.id,
        )
        .catch(
            () =>
                null,
        );
}


/**
 * =========================================================
 * BOT CAN MANAGE ROLE
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
        logger.warn(
            'Could not fetch bot guild member.',
        );

        return false;
    }


    if (
        !me.permissions.has(
            PermissionFlagsBits.ManageRoles,
        )
    ) {
        logger.warn(
            'Bot is missing Manage Roles permission.',
        );

        return false;
    }


    if (
        role.managed
    ) {
        logger.warn(
            `Role ${role.name} is managed and cannot be assigned.`,
        );

        return false;
    }


    if (
        role.position >=
        me.roles.highest.position
    ) {
        logger.warn(
            `Bot role hierarchy too low for ${role.name}. Bot=${me.roles.highest.position}, Role=${role.position}`,
        );

        return false;
    }


    return true;
}


/**
 * =========================================================
 * ADD ROLE FROM REACTION
 * =========================================================
 */

export async function addGameRoleFromReaction(
    reaction,
    user,
) {
    try {
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
            logger.warn(
                `Reaction emoji is not mapped to a Game Role: ${reaction?.emoji?.id ?? reaction?.emoji?.name}`,
            );

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
                `Could not fetch member ${user.id}.`,
            );

            return false;
        }


        /**
         * =============================================
         * FETCH ROLE
         * =============================================
         */

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
                `Game role does not exist: ${config.label} (${config.roleId})`,
            );

            return false;
        }


        /**
         * =============================================
         * PERMISSION CHECK
         * =============================================
         */

        const manageable =
            await canBotManageRole(
                guild,
                role,
            );

        if (!manageable) {
            return false;
        }


        /**
         * =============================================
         * MEMBER ALREADY HAS ROLE
         * =============================================
         */

        if (
            member.roles.cache.has(
                role.id,
            )
        ) {
            logger.info(
                `${member.user.tag} already has Game Role ${role.name}.`,
            );

            return true;
        }


        /**
         * =============================================
         * ADD ROLE
         * =============================================
         */

       /**
 * =============================================
 * ADD ROLE
 * =============================================
 */

await member.roles.add(
    role.id,
    `Game Role reaction: ${config.label}`,
);

logger.info(
    `Discord accepted Game Role add: ${role.name} (${role.id}) -> ${member.user.tag}.`,
);


/**
 * =============================================
 * VERIFY ROLE REALLY EXISTS
 * =============================================
 *
 * Không tin cache ngay sau khi add.
 * Fetch member mới hoàn toàn từ Discord.
 */

await new Promise(
    (resolve) =>
        setTimeout(
            resolve,
            750,
        ),
);


let freshMember =
    await guild.members
        .fetch(
            {
                user:
                    member.id,

                force:
                    true,
            },
        )
        .catch(
            () =>
                null,
        );


if (
    !freshMember
) {
    logger.error(
        `Could not refetch ${member.user.tag} after adding Game Role ${role.name}.`,
    );

    return false;
}


/**
 * Role vừa add nhưng đã biến mất.
 *
 * Có thể do:
 * - reaction bị remove ngay lập tức
 * - bot khác đang gỡ role
 * - automation khác trong server can thiệp
 */

if (
    !freshMember.roles.cache.has(
        role.id,
    )
) {
    logger.warn(
        `Game Role ${role.name} disappeared immediately after assignment for ${member.user.tag}. Retrying once...`,
    );


    /**
     * Retry một lần.
     */

    await freshMember.roles.add(
        role.id,
        `Game Role verification retry: ${config.label}`,
    );


    await new Promise(
        (resolve) =>
            setTimeout(
                resolve,
                750,
            ),
    );


    freshMember =
        await guild.members
            .fetch(
                {
                    user:
                        member.id,

                    force:
                        true,
                },
            )
            .catch(
                () =>
                    null,
            );


    if (
        !freshMember ||
        !freshMember.roles.cache.has(
            role.id,
        )
    ) {
        logger.error(
            `Game Role ${role.name} was removed again after retry for ${member.user.tag}. Another bot/system is most likely removing it.`,
        );

        return false;
    }
}


/**
 * =============================================
 * VERIFIED
 * =============================================
 */

logger.info(
    `Verified Game Role ${role.name} is present on ${member.user.tag}.`,
);


/**
 * Chỉ thông báo SAU KHI verify role còn tồn tại.
 */

await sendGameRoleNotification(
    freshMember,
    role.id,
);


return true;

    } catch (error) {
        logger.error(
            `Failed to add Game Role from reaction for ${user?.tag ?? user?.id}:`,
            error,
        );

        return false;
    }
}


/**
 * =========================================================
 * REMOVE ROLE FROM REACTION
 * =========================================================
 */

export async function removeGameRoleFromReaction(
    reaction,
    user,
) {
    try {
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


        await member.roles.remove(
            role,
            `Game Role reaction removed: ${config.label}`,
        );


        logger.info(
            `Removed Game Role ${role.name} (${role.id}) from ${member.user.tag}.`,
        );


        /**
         * Gỡ role KHÔNG gửi notification.
         */

        return true;

    } catch (error) {
        logger.error(
            `Failed to remove Game Role from reaction for ${user?.tag ?? user?.id}:`,
            error,
        );

        return false;
    }
}


/**
 * =========================================================
 * ROLE IMAGE
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
        return null;
    }


    return imagePath;
}


/**
 * =========================================================
 * ENSURE DEFAULT GAME ROLE
 * =========================================================
 * Tự động cấp role mặc định (ID: 1541431506910584934) cho thành viên
 * khi họ chọn bất kỳ role game nào hoặc khi được Admin cấp.
 * Nếu đã có sẵn role này rồi thì bỏ qua an toàn không cấp lại.
 */
export async function ensureDefaultGameRole(member) {
    try {
        if (!member?.guild) return false;
        const roleId = DEFAULT_GAME_ROLE_ID;
        if (!roleId) return false;

        const hasRole =
            member.roles?.cache?.has?.(roleId) ||
            (Array.isArray(member._roles) && member._roles.includes(roleId)) ||
            (Array.isArray(member.roles) && member.roles.includes(roleId));

        if (hasRole) {
            return false;
        }

        await member.roles.add(roleId, 'Game Role: Tự động cấp role game mặc định khi chọn role').catch((err) => {
            logger.warn(`[GAME ROLE] Không thể cấp role mặc định ${roleId} cho ${member.id}:`, err.message);
        });

        logger.info(`[GAME ROLE] Đã cấp role mặc định ${roleId} cho ${member.user?.tag || member.id}`);
        return true;
    } catch (err) {
        logger.warn(`[GAME ROLE] Lỗi khi cấp role mặc định ${DEFAULT_GAME_ROLE_ID} cho ${member?.id}:`, err.message);
        return false;
    }
}


/**
 * =========================================================
 * SEND GAME ROLE NOTIFICATION
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


        if (
            member.user.bot
        ) {
            return false;
        }

        // Tự động đảm bảo thành viên sở hữu role mặc định 1541431506910584934
        await ensureDefaultGameRole(member);


        /**
         * =============================================
         * DEDUPE
         * =============================================
         */

        if (
            shouldSkipDuplicateNotification(
                member.id,
                roleId,
            )
        ) {
            logger.debug(
                `Skipped duplicate Game Role notification: member=${member.id}, role=${roleId}`,
            );

            return false;
        }


        /**
         * =============================================
         * CONFIG
         * =============================================
         */

        const config =
            getGameRoleByRoleId(
                roleId,
            );

        if (!config) {
            logger.warn(
                `Notification ignored because role ${roleId} is not a configured Game Role.`,
            );

            return false;
        }


        const guild =
            member.guild;


        /**
         * =============================================
         * NOTIFICATION CHANNEL
         * =============================================
         */

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
                `Game Role notification channel not found: ${GAME_ROLE_NOTIFICATION_CHANNEL_ID}`,
            );

            return false;
        }


        /**
         * =============================================
         * BOT MEMBER
         * =============================================
         */

        const botMember =
            guild.members.me ??
            await guild.members
                .fetchMe()
                .catch(
                    () =>
                        null,
                );


        if (!botMember) {
            logger.warn(
                'Could not fetch bot member before notification.',
            );

            return false;
        }


        /**
         * =============================================
         * CHANNEL PERMISSIONS
         * =============================================
         */

        const permissions =
            notificationChannel.permissionsFor(
                botMember,
            );


        const requiredPermissions = [
            [
                PermissionFlagsBits.ViewChannel,
                'View Channel',
            ],

            [
                PermissionFlagsBits.SendMessages,
                'Send Messages',
            ],

            [
                PermissionFlagsBits.EmbedLinks,
                'Embed Links',
            ],

            [
                PermissionFlagsBits.AttachFiles,
                'Attach Files',
            ],
        ];


        const missingPermissions =
            requiredPermissions
                .filter(
                    ([permission]) =>
                        !permissions?.has(
                            permission,
                        ),
                )
                .map(
                    ([, label]) =>
                        label,
                );


        if (
            missingPermissions.length >
            0
        ) {
            logger.warn(
                `Game Role notification channel missing permissions: ${missingPermissions.join(', ')}`,
            );

            return false;
        }


        /**
         * =============================================
         * TITLE & DESCRIPTION
         * =============================================
         */

        const titleText = '<a:trangtrig50:1567818385306165301> **ĐÃ CẤP ROLE** <a:trangtrig51:1567818549794439229>';

        let descriptionLine1 = `<a:trangtrig53:1567819189866201219> Chúc mừng ${member} đã được cấp role <@&${config.roleId}> và nhận được những đặc quyền liên quan đến role.`;

        if (config.channelId) {
            descriptionLine1 += ` Đồng thời mở khóa kênh <#${config.channelId}>!`;
        } else {
            descriptionLine1 += '!';
        }

        const descriptionLine2 = '<a:trangtrig53:1567819189866201219> Chúc bạn chơi zui zẻ ở server bọn mình và nhớ chăm chỉ up level để nhận thưởng khi đạt mốc nhé!';

        // Ghép 2 câu với nhau mà không có đường kẻ ở giữa
        const fullDescription = `${descriptionLine1}\n\n${descriptionLine2}`;


        /**
         * =============================================
         * LINK BUTTON (XEM HỆ THỐNG LEVEL)
         * =============================================
         */

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Xem Hệ Thống Level')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.com/channels/1541279801183178754/1541861950680600648'),
        );


        /**
         * =============================================
         * IMAGE
         * =============================================
         */

        const files = [];
        const localImagePath = getRoleImagePath(config);
        let imageUrl = null;

        if (localImagePath) {
            const attachmentName = `game-role-${config.key}.png`;

            files.push(
                new AttachmentBuilder(
                    localImagePath,
                    {
                        name: attachmentName,
                    },
                ),
            );

            imageUrl = `attachment://${attachmentName}`;
        } else if (config?.imageUrl) {
            imageUrl = config.imageUrl;
        }


        /**
         * =============================================
         * COMPONENTS V2 CONTAINER
         * =============================================
         */

        const container = new ContainerBuilder();

        // 1. Tiêu đề
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${titleText}`,
            ),
        );

        // 2. Đường kẻ sau tiêu đề
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

        // 3. Hai câu thông báo (không có đường kẻ ở giữa 2 câu này)
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                fullDescription,
            ),
        );

        // 4. Đường kẻ trước ảnh và ảnh minh họa Media Gallery (nếu có ảnh)
        if (imageUrl) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
            );
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(imageUrl)
                        .setDescription(config.label || 'Game Role'),
                ),
            );
        }

        // 5. Nút bấm link chuyển tiếp kênh Level
        container.addActionRowComponents(actionRow);


        /**
         * =============================================
         * SEND WITH V2 & FALLBACK
         * =============================================
         */

        try {
            await notificationChannel.send({
                components: [container],
                files,
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: {
                    users: [member.id],
                    roles: [],
                },
            });
        } catch (v2Error) {
            logger.warn('[GAME ROLE] Gửi thông báo V2 thất bại, chuyển sang fallback embed:', v2Error);
            const fallbackEmbed = new EmbedBuilder()
                .setTitle(titleText)
                .setDescription(fullDescription)
                .setColor(GAME_ROLE_EMBED_COLOR);

            if (imageUrl) {
                fallbackEmbed.setImage(imageUrl);
            }

            await notificationChannel.send({
                embeds: [fallbackEmbed],
                components: [actionRow],
                files,
                allowedMentions: {
                    users: [member.id],
                    roles: [],
                },
            });
        }


        logger.info(
            `Sent Game Role notification: ${member.user.tag} -> ${config.label}`,
        );


        return true;

    } catch (error) {
        logger.error(
            `Failed to send Game Role notification for member=${member?.id}, role=${roleId}:`,
            error,
        );

        return false;
    }
}


/**
 * =========================================================
 * ADD ALL PANEL REACTIONS
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


            logger.debug(
                `Added panel emoji ${config.label}: ${config.emoji.id ?? config.emoji.name}`,
            );

        } catch (error) {
            logger.error(
                `Failed to react ${config.label} (${config.emoji.id ?? config.emoji.name}):`,
                error,
            );
        }
    }
}
