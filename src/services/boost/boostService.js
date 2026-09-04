import {
    EmbedBuilder,
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
        '{member} vừa **Boost Server**!\n\n' +
        '👑 **TỶ PHÚ** đã được trao cho {member}.\n\n' +
        'Cảm ơn bạn đã ủng hộ và đồng hành cùng server! ✨',

    color: '#F5A9C6',

    image: null,

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
// PLACEHOLDER
// ============================================================

function replacePlaceholders(
    text,
    {
        member,
        guild,
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
                    },
                ),
            )
            .setDescription(
                replacePlaceholders(
                    config.description,
                    {
                        member,
                        guild,
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
    }


    // ----------------------------------------------------------
    // Main Image
    // ----------------------------------------------------------

    if (
        config.image
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
// GIVE TY PHU ROLE
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
            'ManageRoles',
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
// REMOVE TY PHU ROLE
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
// TEST
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
