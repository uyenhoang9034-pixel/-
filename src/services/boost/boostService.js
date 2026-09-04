import {
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import fs from 'node:fs/promises';
import path from 'node:path';


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
// DEFAULT CONFIG
// ============================================================

const DEFAULT_CONFIG = {
    enabled: true,

    channelId: null,

    tyPhuRoleId: null,

    title: '🌸 Server Boosted!',

    description:
        '<a:chiikawag9:1541427795786207313> {member} vừa **Boost Server**!\n\n' +
        '<a:pinkheart:1545307544808071258> **Boost hiện tại:** {boosts}\n' +
        '<a:pinkheart:1545307544808071258> **Boost Level:** {boostLevel}\n' +
        '<a:pinkheart:1545307544808071258> **Còn:** {boostsToNextLevel} boost để lên level tiếp theo!\n\n' +
        '👑 **TỶ PHÚ** đã được trao cho {member}.',

    color: '#F5A9C6',

    image: null,

    // 'member' = avatar người boost
    // URL = thumbnail tùy chỉnh
    // null = không có thumbnail
    thumbnail: 'member',

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
// BOOST LEVEL
// ============================================================

function getBoostLevelInfo(
    guild,
) {
    const boostCount =
        Number(
            guild.premiumSubscriptionCount || 0,
        );

    const currentLevel =
        Number(
            guild.premiumTier || 0,
        );


    let nextLevelBoosts = null;


    if (currentLevel <= 0) {
        nextLevelBoosts = 2;
    } else if (currentLevel === 1) {
        nextLevelBoosts = 7;
    } else if (currentLevel === 2) {
        nextLevelBoosts = 14;
    } else {
        nextLevelBoosts = null;
    }


    let boostsToNextLevel;


    if (
        nextLevelBoosts === null
    ) {
        boostsToNextLevel = 'MAX';
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
        typeof color !== 'string'
    ) {
        return 0xF5A9C6;
    }

    const normalized =
        color
            .replace('#', '')
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
    },
) {
    if (
        typeof text !== 'string'
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
            member.user.username,
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
            '{boosts}',
            String(
                boostInfo.boostCount,
            ),
        )
        .replaceAll(
            '{boostLevel}',
            String(
                boostInfo.currentLevel,
            ),
        )
        .replaceAll(
            '{boostsNeeded}',
            boostInfo.nextLevelBoosts === null
                ? 'MAX'
                : String(
                    boostInfo.nextLevelBoosts,
                ),
        )
        .replaceAll(
            '{boostsToNextLevel}',
            String(
                boostInfo.boostsToNextLevel,
            ),
        );
}


// ============================================================
// BUILD EMBED
// ============================================================

export function buildBoostEmbed(
    config,
    member,
) {
    const guild =
        member.guild;


    const boostInfo =
        getBoostLevelInfo(
            guild,
        );


    const embed =
        new EmbedBuilder()
            .setColor(
                resolveColor(
                    config.color,
                ),
            )
            .setTitle(
                replacePlaceholders(
                    config.title,
                    {
                        member,
                        guild,
                        boostInfo,
                    },
                ),
            )
            .setDescription(
                replacePlaceholders(
                    config.description,
                    {
                        member,
                        guild,
                        boostInfo,
                    },
                ),
            );


    // ----------------------------------------------------------
    // Thumbnail
    // ----------------------------------------------------------

    if (
        config.thumbnail === 'member'
    ) {
        embed.setThumbnail(
            member.user.displayAvatarURL({
                extension: 'png',
                size: 256,
            }),
        );
    } else if (
        typeof config.thumbnail === 'string' &&
        config.thumbnail.startsWith('http')
    ) {
        embed.setThumbnail(
            config.thumbnail,
        );
    }


    // ----------------------------------------------------------
    // Main Image
    // ----------------------------------------------------------

    if (
        typeof config.image === 'string' &&
        config.image.startsWith('http')
    ) {
        embed.setImage(
            config.image,
        );
    }


    // ----------------------------------------------------------
    // Footer
    // ----------------------------------------------------------

    if (
        config.footer
    ) {
        embed.setFooter({
            text:
                replacePlaceholders(
                    config.footer,
                    {
                        member,
                        guild,
                        boostInfo,
                    },
                ),
        });
    }


    // ----------------------------------------------------------
    // Timestamp
    // ----------------------------------------------------------

    if (
        config.timestamp
    ) {
        embed.setTimestamp();
    }


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
            reason: 'ROLE_NOT_CONFIGURED',
        };
    }


    const role =
        member.guild.roles.cache.get(
            roleId,
        );


    if (!role) {
        return {
            success: false,
            reason: 'ROLE_NOT_FOUND',
        };
    }


    const botMember =
        member.guild.members.me;


    if (!botMember) {
        return {
            success: false,
            reason: 'BOT_NOT_FOUND',
        };
    }


    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageRoles,
        )
    ) {
        return {
            success: false,
            reason: 'MISSING_MANAGE_ROLES',
        };
    }


    if (
        role.managed
    ) {
        return {
            success: false,
            reason: 'MANAGED_ROLE',
        };
    }


    if (
        role.position >=
        botMember.roles.highest.position
    ) {
        return {
            success: false,
            reason: 'ROLE_ABOVE_BOT',
        };
    }


    if (
        member.roles.cache.has(
            roleId,
        )
    ) {
        return {
            success: true,
            alreadyHadRole: true,
        };
    }


    try {
        await member.roles.add(
            role,
            'Automatic role for server boost',
        );

        return {
            success: true,
            alreadyHadRole: false,
        };
    } catch (error) {
        return {
            success: false,
            reason: 'ROLE_ADD_FAILED',
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
// SEND BOOST MESSAGE
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
            reason: 'DISABLED',
        };
    }


    if (
        !config.channelId
    ) {
        return {
            success: false,
            reason: 'CHANNEL_NOT_CONFIGURED',
        };
    }


    const channel =
        member.guild.channels.cache.get(
            config.channelId,
        ) ||
        await member.guild.channels.fetch(
            config.channelId,
        ).catch(
            () => null,
        );


    if (!channel) {
        return {
            success: false,
            reason: 'CHANNEL_NOT_FOUND',
        };
    }


    if (
        !channel.isTextBased()
    ) {
        return {
            success: false,
            reason: 'CHANNEL_NOT_TEXT',
        };
    }


    const embed =
        buildBoostEmbed(
            config,
            member,
        );


    try {
        await channel.send({
            embeds: [
                embed,
            ],
        });

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            reason: 'SEND_FAILED',
            error,
        };
    }
}


// ============================================================
// HANDLE BOOST START
// ============================================================

export async function handleBoostStarted(
    member,
) {
    const config =
        await getBoostConfig(
            member.guild.id,
        );


    const roleResult =
        await grantTyPhuRole(
            member,
            config.tyPhuRoleId,
        );


    const messageResult =
        await sendBoostNotification(
            member,
        );


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
    const config =
        await getBoostConfig(
            member.guild.id,
        );


    return removeTyPhuRole(
        member,
        config.tyPhuRoleId,
    );
}


// ============================================================
// TEST BOOST
// ============================================================

export async function sendTestBoost(
    member,
    targetChannel = null,
) {
    const config =
        await getBoostConfig(
            member.guild.id,
        );


    const embed =
        buildBoostEmbed(
            config,
            member,
        );


    const channel =
        targetChannel ||
        (
            config.channelId
                ? member.guild.channels.cache.get(
                    config.channelId,
                )
                : null
        );


    if (!channel) {
        return {
            success: false,
            reason: 'CHANNEL_NOT_CONFIGURED',
        };
    }


    try {
        await channel.send({
            embeds: [
                embed,
            ],
        });

        return {
            success: true,
        };
    } catch (error) {
        return {
            success: false,
            reason: 'SEND_FAILED',
            error,
        };
    }
}
