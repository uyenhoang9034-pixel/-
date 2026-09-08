import { getAutoReactsKey } from '../../utils/database/keys.js';
import { PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_CONFIG = {
    enabled: true,
    reactions: [],
};

function normalizeKeyword(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

function normalizeConfig(data) {
    if (!data || typeof data !== 'object') {
        return {
            ...DEFAULT_CONFIG,
            reactions: [],
        };
    }

    return {
        enabled: data.enabled !== false,

        reactions: Array.isArray(data.reactions)
            ? data.reactions
                .filter(
                    item =>
                        item &&
                        typeof item.id === 'string' &&
                        typeof item.keyword === 'string' &&
                        typeof item.emojiId === 'string',
                )
                .map(item => ({
                    id: item.id,

                    keyword:
                        normalizeKeyword(
                            item.keyword,
                        ),

                    displayKeyword:
                        item.displayKeyword ||
                        item.keyword,

                    emojiId:
                        item.emojiId,

                    emojiName:
                        item.emojiName ||
                        null,

                    animated:
                        item.animated === true,

                    enabled:
                        item.enabled !== false,

                    createdAt:
                        item.createdAt ||
                        new Date().toISOString(),

                    updatedAt:
                        item.updatedAt ||
                        item.createdAt ||
                        new Date().toISOString(),
                }))
            : [],
    };
}

export async function getAutoReactConfig(
    client,
    guildId,
) {
    try {
        const data =
            await client.db.get(
                getAutoReactsKey(guildId),
                null,
            );

        return normalizeConfig(data);
    } catch (error) {
        logger.error(
            `Failed to load auto-react config for ${guildId}:`,
            error,
        );

        throw error;
    }
}

export async function saveAutoReactConfig(
    client,
    guildId,
    config,
) {
    await client.db.set(
        getAutoReactsKey(guildId),
        normalizeConfig(config),
    );

    return true;
}

export function canManageAutoReact(
    member,
) {
    if (!member) {
        return false;
    }

    if (
        member.guild?.ownerId ===
        member.id
    ) {
        return true;
    }

    return (
        member.permissions.has(
            PermissionFlagsBits.Administrator,
        ) ||
        member.permissions.has(
            PermissionFlagsBits.ManageGuild,
        )
    );
}

export async function addAutoReact(
    client,
    guildId,
    {
        keyword,
        emoji,
    },
) {
    const normalizedKeyword =
        normalizeKeyword(keyword);

    if (!normalizedKeyword) {
        return {
            success: false,
            reason: 'invalid_keyword',
        };
    }

    if (!emoji?.id) {
        return {
            success: false,
            reason: 'invalid_emoji',
        };
    }

    const config =
        await getAutoReactConfig(
            client,
            guildId,
        );

    const duplicate =
        config.reactions.some(
            item =>
                normalizeKeyword(
                    item.keyword,
                ) === normalizedKeyword,
        );

    if (duplicate) {
        return {
            success: false,
            reason: 'duplicate_keyword',
        };
    }

    const now =
        new Date().toISOString();

    const reaction = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        keyword:
            normalizedKeyword,

        displayKeyword:
            String(keyword).trim(),

        emojiId:
            emoji.id,

        emojiName:
            emoji.name || null,

        animated:
            emoji.animated === true,

        enabled: true,

        createdAt: now,
        updatedAt: now,
    };

    config.reactions.push(
        reaction,
    );

    await saveAutoReactConfig(
        client,
        guildId,
        config,
    );

    return {
        success: true,
        reaction,
    };
}

export async function removeAutoReact(
    client,
    guildId,
    reactionId,
) {
    const config =
        await getAutoReactConfig(
            client,
            guildId,
        );

    const index =
        config.reactions.findIndex(
            item =>
                item.id === reactionId,
        );

    if (index === -1) {
        return {
            success: false,
            reason: 'not_found',
        };
    }

    const [
        reaction,
    ] = config.reactions.splice(
        index,
        1,
    );

    await saveAutoReactConfig(
        client,
        guildId,
        config,
    );

    return {
        success: true,
        reaction,
    };
}

export async function toggleAutoReact(
    client,
    guildId,
    reactionId,
    enabled,
) {
    const config =
        await getAutoReactConfig(
            client,
            guildId,
        );

    const reaction =
        config.reactions.find(
            item =>
                item.id === reactionId,
        );

    if (!reaction) {
        return {
            success: false,
            reason: 'not_found',
        };
    }

    reaction.enabled =
        enabled === true;

    reaction.updatedAt =
        new Date().toISOString();

    await saveAutoReactConfig(
        client,
        guildId,
        config,
    );

    return {
        success: true,
        reaction,
    };
}

export async function setAutoReactEnabled(
    client,
    guildId,
    enabled,
) {
    const config =
        await getAutoReactConfig(
            client,
            guildId,
        );

    config.enabled =
        enabled === true;

    await saveAutoReactConfig(
        client,
        guildId,
        config,
    );

    return config;
}

export function findMatchingAutoReacts(
    content,
    reactions,
) {
    if (
        !content ||
        !Array.isArray(reactions)
    ) {
        return [];
    }

    const normalizedContent =
        String(content).toLowerCase();

    return reactions
        .filter(
            item =>
                item.enabled !== false &&
                item.keyword,
        )
        .filter(
            item =>
                normalizedContent.includes(
                    normalizeKeyword(
                        item.keyword,
                    ),
                ),
        )
        .sort(
            (a, b) =>
                normalizeKeyword(
                    b.keyword,
                ).length -
                normalizeKeyword(
                    a.keyword,
                ).length,
        );
}
