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
    MessageFlags,
} from 'discord.js';

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { logger } from '../../utils/logger.js';


// ============================================================
// STORAGE
// ============================================================

const DATA_DIR = path.resolve(
    process.cwd(),
    'data',
);

const DATA_FILE = path.join(
    DATA_DIR,
    'boostConfig.json',
);


// ============================================================
// BOOST CDN IMAGE (Catbox & Local Asset)
// ============================================================

export const BOOST_IMAGE_PATH = path.resolve(
    process.cwd(),
    'assets',
    'boost',
    'boost.webp',
);

export const BOOST_IMAGE_URL =
    'https://files.catbox.moe/i0bq7c.webp';

export function getBoostImageAttachment() {
    try {
        if (fsSync.existsSync(BOOST_IMAGE_PATH)) {
            return new AttachmentBuilder(BOOST_IMAGE_PATH, { name: 'boost.webp' });
        }
    } catch (err) {
        logger.warn('Failed to read boost image asset from disk:', err);
    }
    return null;
}


// ============================================================
// DEFAULT CONFIG
// ============================================================

export const DEFAULT_TITLE =
    '<a:trangtrig2:1546040703375904801> **NGƯỜI GIÀU TỚI CHƠI** <a:trangtrig3:1546040818261954610>';

export const DEFAULT_DESCRIPTION =
    '<a:heartg2:1546031808364413019> Xĩe xĩe đại gia {member} đã boost cho server!\n\n' +
    '<a:trangtrig14:1546047912969113622> {member} trực tiếp thăng cấp lên role <@&{roleId}> của server và nhận được những đãi ngộ độc quyền!\n\n' +
    '<a:trangtrig8:1546047024334503997> Boost hiện tại: **{boosts}**\n' +
    '<a:trangtrig8:1546047024334503997> Boost level: **{boostLevel}**';

const DEFAULT_CONFIG = {
    enabled: true,

    channelId: null,

    tyPhuRoleId: '1541305195512856627',

    title: DEFAULT_TITLE,

    description: DEFAULT_DESCRIPTION,

    color: '#F5A9C6',

    thumbnail: 'none',

    footer: '{server}',

    timestamp: true,
};


// ============================================================
// STORAGE HELPERS
// ============================================================

async function ensureStorage() {
    await fs.mkdir(
        DATA_DIR,
        {
            recursive: true,
        },
    );

    try {
        await fs.access(
            DATA_FILE,
        );
    } catch {
        await fs.writeFile(
            DATA_FILE,
            JSON.stringify(
                {},
                null,
                4,
            ),
            'utf8',
        );
    }
}


async function readAllConfigs() {
    await ensureStorage();

    try {
        const content =
            await fs.readFile(
                DATA_FILE,
                'utf8',
            );

        return JSON.parse(
            content,
        );
    } catch {
        return {};
    }
}


async function writeAllConfigs(
    configs,
) {
    await ensureStorage();

    await fs.writeFile(
        DATA_FILE,
        JSON.stringify(
            configs,
            null,
            4,
        ),
        'utf8',
    );
}


// ============================================================
// CONFIG
// ============================================================

export async function getBoostConfig(
    guildId,
) {
    const configs =
        await readAllConfigs();

    return {
        ...DEFAULT_CONFIG,
        ...(configs[guildId] || {}),
    };
}


export async function setBoostConfig(
    guildId,
    updates,
) {
    const configs =
        await readAllConfigs();

    configs[guildId] = {
        ...DEFAULT_CONFIG,
        ...(configs[guildId] || {}),
        ...updates,
    };

    await writeAllConfigs(
        configs,
    );

    return configs[guildId];
}


// ============================================================
// BOOST IMAGE ATTACHMENT (DEPRECATED)
// ============================================================

async function createBoostImageAttachment() {
    return null;
}


// ============================================================
// BOOST LEVEL
// ============================================================

function getBoostLevelInfo(
    guild,
    overrides = {},
) {
    const realBoostCount =
        Number(
            guild.premiumSubscriptionCount ||
            0,
        );

    const realCurrentLevel =
        Number(
            guild.premiumTier ||
            0,
        );


    const overrideBoostCount =
        overrides.boostCount;

    const overrideCurrentLevel =
        overrides.currentLevel;


    const boostCount =
        overrideBoostCount === null ||
        overrideBoostCount === undefined
            ? realBoostCount
            : Math.max(
                Number(
                    overrideBoostCount,
                ) || 0,
                0,
            );


    const currentLevel =
        overrideCurrentLevel === null ||
        overrideCurrentLevel === undefined
            ? realCurrentLevel
            : Math.min(
                Math.max(
                    Number(
                        overrideCurrentLevel,
                    ) || 0,
                    0,
                ),
                3,
            );


    let nextLevelBoosts = null;


    if (
        currentLevel <= 0
    ) {
        nextLevelBoosts = 2;
    } else if (
        currentLevel === 1
    ) {
        nextLevelBoosts = 7;
    } else if (
        currentLevel === 2
    ) {
        nextLevelBoosts = 14;
    }


    let boostsToNextLevel;


    if (
        nextLevelBoosts === null
    ) {
        boostsToNextLevel =
            'MAX';
    } else {
        boostsToNextLevel =
            Math.max(
                nextLevelBoosts -
                boostCount,
                0,
            );
    }


    return {
        boostCount,

        currentLevel,

        nextLevelBoosts,

        boostsToNextLevel,
    };
}


// ============================================================
// COLOR
// ============================================================

function resolveColor(
    color,
) {
    if (
        typeof color !==
        'string'
    ) {
        return 0xF5A9C6;
    }


    const normalized =
        color
            .replace(
                '#',
                '',
            )
            .trim();


    if (
        !/^[0-9a-fA-F]{6}$/.test(
            normalized,
        )
    ) {
        return 0xF5A9C6;
    }


    return parseInt(
        normalized,
        16,
    );
}


// ============================================================
// PLACEHOLDERS
// ============================================================

function replacePlaceholders(
    text,
    {
        member,
        guild,
        boostInfo,
        memberBoosts = null,
        roleId = null,
    },
) {
    if (
        typeof text !==
        'string'
    ) {
        return '';
    }


    return text
        .replaceAll(
            '{member}',
            member.toString(),
        )
        .replaceAll(
            '{username}',
            member.user?.username || member.displayName || '',
        )
        .replaceAll(
            '{server}',
            guild.name,
        )
        .replaceAll(
            '{memberId}',
            member.id,
        )
        .replaceAll(
            '{memberBoosts}',
            memberBoosts === null ||
            memberBoosts === undefined
                ? ''
                : String(
                    memberBoosts,
                ),
        )
        .replaceAll(
            '{boosts}',
            String(
                boostInfo?.boostCount ?? 0,
            ),
        )
        .replaceAll(
            '{boostLevel}',
            String(
                boostInfo?.currentLevel ?? 0,
            ),
        )
        .replaceAll(
            '{boostsNeeded}',
            boostInfo?.nextLevelBoosts === null
                ? 'MAX'
                : String(
                    boostInfo?.nextLevelBoosts ?? 0,
                ),
        )
        .replaceAll(
            '{boostsToNextLevel}',
            String(
                boostInfo?.boostsToNextLevel ?? '',
            ),
        )
        .replaceAll(
            '{roleId}',
            roleId || '1541305195512856627',
        );
}


// ============================================================
// FOOTER TIMESTAMP HELPER
// ============================================================

function formatFooterTimestamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = String(date.getFullYear()).slice(-2);
    return `${hours}:${minutes} ${day}/${month}/${year}`;
}


// ============================================================
// BUILD BOOST CONTAINER (V2)
// ============================================================

export function buildBoostContainer(
    config,
    member,
    overrides = {},
) {
    const guild = member.guild;

    const boostInfo = getBoostLevelInfo(
        guild,
        {
            boostCount: overrides.boostCount,
            currentLevel: overrides.currentLevel,
        },
    );

    const placeholderData = {
        member,
        guild,
        boostInfo,
        memberBoosts: overrides.memberBoosts,
        roleId: config.tyPhuRoleId || '1541305195512856627',
    };

    const container = new ContainerBuilder()
        .setAccentColor(resolveColor(config.color));

    // 1. Header Title
    const rawTitle = replacePlaceholders(
        config.title || DEFAULT_TITLE,
        placeholderData,
    );
    const headerTitle = rawTitle.startsWith('#') ? rawTitle : `# ${rawTitle}`;
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(headerTitle),
    );

    // 2. Separator
    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
    );

    // 3. Message Body
    const descriptionText = replacePlaceholders(
        config.description || DEFAULT_DESCRIPTION,
        placeholderData,
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(descriptionText),
    );

    // 4. Separator
    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
    );

    // 5. Media Gallery (Banner ảnh Usagi trong assets)
    const imageUrl = fsSync.existsSync(BOOST_IMAGE_PATH)
        ? 'attachment://boost.webp'
        : BOOST_IMAGE_URL;

    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(imageUrl),
        ),
    );

    // 6. Separator
    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
    );

    // 7. Footer: tên server + ngày tháng như ảnh
    const baseFooter = config.footer
        ? replacePlaceholders(config.footer, placeholderData)
        : guild.name;
    const footerText = `-# ${baseFooter} • ${formatFooterTimestamp()}`;

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footerText),
    );

    return container;
}


// ============================================================
// BUILD BOOST EMBED (V1 FALLBACK)
// ============================================================

export function buildBoostEmbed(
    config,
    member,
    overrides = {},
) {
    const guild =
        member.guild;


    const boostInfo =
        getBoostLevelInfo(
            guild,
            {
                boostCount:
                    overrides.boostCount,

                currentLevel:
                    overrides.currentLevel,
            },
        );


    const placeholderData = {
        member,

        guild,

        boostInfo,

        memberBoosts:
            overrides.memberBoosts,

        roleId:
            config.tyPhuRoleId || '1541305195512856627',
    };


    const embed =
        new EmbedBuilder()
            .setColor(
                resolveColor(
                    config.color,
                ),
            )
            .setTitle(
                replacePlaceholders(
                    config.title || DEFAULT_TITLE,
                    placeholderData,
                ),
            )
            .setDescription(
                replacePlaceholders(
                    config.description || DEFAULT_DESCRIPTION,
                    placeholderData,
                ),
            )
            .setImage(
                fsSync.existsSync(BOOST_IMAGE_PATH)
                    ? 'attachment://boost.webp'
                    : BOOST_IMAGE_URL,
            );


    // ========================================================
    // THUMBNAIL (Đã tinh giản, không sử dụng thumbnail theo yêu cầu)
    // ========================================================


    // ========================================================
    // FOOTER (Tên server + ngày tháng như ảnh)
    // ========================================================

    const baseFooter = config.footer
        ? replacePlaceholders(
            config.footer,
            placeholderData,
        )
        : guild.name;

    embed.setFooter({
        text: `${baseFooter} • ${formatFooterTimestamp()}`,
    });


    return embed;
}


// ============================================================
// GIVE TỶ PHÚ ROLE
// ============================================================

export async function grantTyPhuRole(
    member,
    roleId,
) {
    if (!roleId) {
        return {
            success: false,

            reason:
                'ROLE_NOT_CONFIGURED',
        };
    }


    const role =
        member.guild.roles.cache.get(
            roleId,
        ) ||
        await member.guild.roles.fetch(
            roleId,
        ).catch(
            () => null,
        );


    if (!role) {
        return {
            success: false,

            reason:
                'ROLE_NOT_FOUND',
        };
    }


    const botMember =
        member.guild.members.me ||
        await member.guild.members.fetchMe().catch(
            () => null,
        );


    if (!botMember) {
        return {
            success: false,

            reason:
                'BOT_NOT_FOUND',
        };
    }


    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles,
        )
    ) {
        return {
            success: false,

            reason:
                'MISSING_MANAGE_ROLES',
        };
    }


    if (
        role.managed
    ) {
        return {
            success: false,

            reason:
                'MANAGED_ROLE',
        };
    }


    if (
        role.position >=
        botMember.roles.highest.position
    ) {
        return {
            success: false,

            reason:
                'ROLE_ABOVE_BOT',
        };
    }


    if (
        member.roles.cache.has(
            roleId,
        )
    ) {
        return {
            success: true,

            alreadyHadRole:
                true,
        };
    }


    try {
        await member.roles.add(
            role,
            'Automatic role for server boost',
        );


        return {
            success: true,

            alreadyHadRole:
                false,
        };
    } catch (error) {
        return {
            success: false,

            reason:
                'ROLE_ADD_FAILED',

            error,
        };
    }
}


// ============================================================
// REMOVE TỶ PHÚ ROLE
// ============================================================

export async function removeTyPhuRole(
    member,
    roleId,
) {
    if (!roleId) {
        return false;
    }


    if (
        !member.roles.cache.has(
            roleId,
        )
    ) {
        return true;
    }


    const role =
        member.guild.roles.cache.get(
            roleId,
        );


    if (!role) {
        return false;
    }


    try {
        await member.roles.remove(
            role,
            'Automatic role removal after server boost ended',
        );


        return true;
    } catch {
        return false;
    }
}


// ============================================================
// RESOLVE BOOST CHANNEL
// ============================================================

async function resolveBoostChannel(
    guild,
    channelId,
) {
    const targetId = channelId || guild.systemChannelId;
    if (!targetId) {
        return null;
    }


    const cachedChannel =
        guild.channels.cache.get(
            targetId,
        );


    if (
        cachedChannel
    ) {
        return cachedChannel;
    }


    return guild.channels.fetch(
        targetId,
    ).catch(
        () => null,
    );
}


// ============================================================
// SEND BOOST NOTIFICATION
// ============================================================

export async function sendBoostNotification(
    member,
) {
    const config =
        await getBoostConfig(
            member.guild.id,
        );


    if (
        !config.enabled
    ) {
        return {
            success: false,

            reason:
                'DISABLED',
        };
    }


    const targetChannelId =
        config.channelId ||
        member.guild.systemChannelId;


    if (
        !targetChannelId
    ) {
        return {
            success: false,

            reason:
                'CHANNEL_NOT_CONFIGURED',
        };
    }


    const channel =
        await resolveBoostChannel(
            member.guild,
            targetChannelId,
        );


    if (!channel) {
        return {
            success: false,

            reason:
                'CHANNEL_NOT_FOUND',
        };
    }


    if (
        !channel.isTextBased()
    ) {
        return {
            success: false,

            reason:
                'CHANNEL_NOT_TEXT',
        };
    }


    const attachment = getBoostImageAttachment();
    const files = attachment ? [attachment] : [];
    const container = buildBoostContainer(
        config,
        member,
    );

    try {
        await channel.send({
            content: null,
            embeds: [],
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            files,
        });

        return {
            success: true,
        };
    } catch (v2Error) {
        logger.warn('[Boost] Failed to send V2 container, falling back to Embed:', v2Error);
        const embed = buildBoostEmbed(
            config,
            member,
        );

        try {
            await channel.send({
                embeds: [
                    embed,
                ],
                files,
            });

            return {
                success: true,
            };
        } catch (error) {
            if (files.length > 0) {
                try {
                    embed.setImage(BOOST_IMAGE_URL);
                    await channel.send({
                        embeds: [embed],
                    });
                    return {
                        success: true,
                    };
                } catch (fallbackError) {
                    return {
                        success: false,
                        reason: 'SEND_FAILED',
                        error: fallbackError,
                    };
                }
            }
            return {
                success: false,
                reason: 'SEND_FAILED',
                error,
            };
        }
    }
}


// ============================================================
// DEBOUNCE MAP (ZERO RAM LEAK)
// ============================================================

const recentBoostTriggers = new Map();
const BOOST_DEBOUNCE_MS = 60_000;

function isRecentlyTriggered(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const lastTime = recentBoostTriggers.get(key);

    if (recentBoostTriggers.size > 50) {
        for (const [k, time] of recentBoostTriggers.entries()) {
            if (now - time > BOOST_DEBOUNCE_MS) {
                recentBoostTriggers.delete(k);
            }
        }
    }

    if (lastTime && (now - lastTime < BOOST_DEBOUNCE_MS)) {
        return true;
    }

    recentBoostTriggers.set(key, now);
    return false;
}


// ============================================================
// HANDLE BOOST START
// ============================================================

export async function handleBoostStarted(
    member,
) {
    if (isRecentlyTriggered(member.guild.id, member.id)) {
        logger.debug(
            `[Boost] Debounced boost event for ${member.user?.tag || member.id} (already triggered recently).`,
        );
        return {
            roleResult: { success: true, alreadyHandled: true },
            messageResult: { success: true, alreadyHandled: true },
        };
    }

    logger.info(
        `[Boost] Handling boost start for ${member.user?.tag || member.id} in ${member.guild.name} (${member.guild.id})`,
    );

    const config =
        await getBoostConfig(
            member.guild.id,
        );


    const roleResult =
        await grantTyPhuRole(
            member,
            config.tyPhuRoleId,
        );

    if (roleResult.success) {
        if (roleResult.alreadyHadRole) {
            logger.info(
                `[Boost] Member ${member.user?.tag} already had TỶ PHÚ role.`,
            );
        } else {
            logger.info(
                `[Boost] Successfully granted TỶ PHÚ role (${config.tyPhuRoleId}) to ${member.user?.tag}.`,
            );
        }
    } else {
        logger.warn(
            `[Boost] Could not grant TỶ PHÚ role to ${member.user?.tag}: ${roleResult.reason}`,
        );
    }


    const messageResult =
        await sendBoostNotification(
            member,
        );

    if (messageResult.success) {
        logger.info(
            `[Boost] Successfully sent boost notification for ${member.user?.tag}.`,
        );
    } else {
        logger.warn(
            `[Boost] Could not send boost notification for ${member.user?.tag}: ${messageResult.reason}`,
        );
    }


    return {
        roleResult,

        messageResult,
    };
}


// ============================================================
// HANDLE BOOST END
// ============================================================

export async function handleBoostEnded(
    member,
) {
    recentBoostTriggers.delete(`${member.guild.id}:${member.id}`);

    logger.info(
        `[Boost] Handling boost end for ${member.user?.tag || member.id} in ${member.guild.name}`,
    );

    const config =
        await getBoostConfig(
            member.guild.id,
        );


    const result = await removeTyPhuRole(
        member,
        config.tyPhuRoleId,
    );

    if (result) {
        logger.info(
            `[Boost] Successfully removed TỶ PHÚ role from ${member.user?.tag}.`,
        );
    }

    return result;
}


// ============================================================
// TEST BOOST
// ============================================================

export async function sendTestBoost(
    member,
    targetChannel = null,
    overrides = {},
) {
    const config =
        await getBoostConfig(
            member.guild.id,
        );


    let channel =
        targetChannel;


    if (
        !channel
    ) {
        const targetId =
            config.channelId ||
            member.guild.systemChannelId;

        if (
            !targetId
        ) {
            return {
                success: false,

                reason:
                    'CHANNEL_NOT_CONFIGURED',
            };
        }


        channel =
            await resolveBoostChannel(
                member.guild,
                targetId,
            );
    }


    if (!channel) {
        return {
            success: false,

            reason:
                'CHANNEL_NOT_FOUND',
        };
    }


    if (
        !channel.isTextBased()
    ) {
        return {
            success: false,

            reason:
                'CHANNEL_NOT_TEXT',
        };
    }


    const attachment = getBoostImageAttachment();
    const files = attachment ? [attachment] : [];
    const container = buildBoostContainer(
        config,
        member,
        overrides,
    );

    try {
        await channel.send({
            content: null,
            embeds: [],
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            files,
        });

        return {
            success: true,
        };
    } catch (v2Error) {
        logger.warn('[Boost] Failed to send test boost with V2 container, falling back to Embed:', v2Error);
        const embed = buildBoostEmbed(
            config,
            member,
            overrides,
        );

        try {
            await channel.send({
                embeds: [
                    embed,
                ],
                files,
            });

            return {
                success: true,
            };
        } catch (error) {
            if (files.length > 0) {
                try {
                    embed.setImage(BOOST_IMAGE_URL);
                    await channel.send({
                        embeds: [embed],
                    });
                    return {
                        success: true,
                    };
                } catch (fallbackError) {
                    return {
                        success: false,
                        reason: 'SEND_FAILED',
                        error: fallbackError,
                    };
                }
            }
            return {
                success: false,
                reason: 'SEND_FAILED',
                error,
            };
        }
    }
}
