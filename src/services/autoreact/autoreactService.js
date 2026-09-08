import {
    getAutoReactsKey,
} from '../../utils/database/keys.js';

import {
    PermissionFlagsBits,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

export const AUTO_REACT_MAX_EMOJIS_PER_KEYWORD = 5;

const DEFAULT_CONFIG = {
    enabled: true,
    reactions: [],
};

/**
 * =========================================================
 * NORMALIZE
 * =========================================================
 */

function normalizeKeyword(
    value,
) {
    return String(
        value ?? '',
    )
        .trim()
        .toLowerCase();
}

function normalizeEmoji(
    emoji,
) {
    if (
        !emoji ||
        typeof emoji !== 'object'
    ) {
        return null;
    }

    const id =
        emoji.id ||
        emoji.emojiId;

    if (
        !id ||
        typeof id !== 'string'
    ) {
        return null;
    }

    return {
        id,

        name:
            emoji.name ||
            emoji.emojiName ||
            null,

        animated:
            emoji.animated === true,
    };
}

function normalizeConfig(
    data,
) {
    if (
        !data ||
        typeof data !== 'object'
    ) {
        return {
            ...DEFAULT_CONFIG,
            reactions: [],
        };
    }

    return {
        enabled:
            data.enabled !== false,

        reactions:
            Array.isArray(
                data.reactions,
            )
                ? data.reactions
                    .filter(
                        item =>
                            item &&
                            typeof item ===
                                'object' &&
                            typeof item.id ===
                                'string' &&
                            typeof item.keyword ===
                                'string',
                    )
                    .map(
                        item => {
                            /**
                             * =============================================
                             * MIGRATION
                             * =============================================
                             *
                             * Format cũ:
                             *
                             * emojiId
                             * emojiName
                             * animated
                             *
                             * Format mới:
                             *
                             * emojis: []
                             *
                             * Nhờ đoạn này data cũ vẫn dùng được.
                             */

                            let emojis = [];

                            if (
                                Array.isArray(
                                    item.emojis,
                                )
                            ) {
                                emojis =
                                    item.emojis
                                        .map(
                                            normalizeEmoji,
                                        )
                                        .filter(
                                            Boolean,
                                        );
                            }

                            if (
                                emojis.length === 0 &&
                                item.emojiId
                            ) {
                                const legacyEmoji =
                                    normalizeEmoji({
                                        id:
                                            item.emojiId,

                                        name:
                                            item.emojiName,

                                        animated:
                                            item.animated,
                                    });

                                if (
                                    legacyEmoji
                                ) {
                                    emojis.push(
                                        legacyEmoji,
                                    );
                                }
                            }

                            /**
                             * Không cho duplicate emoji
                             * trong cùng một keyword.
                             */

                            const uniqueEmojis = [];

                            const seen =
                                new Set();

                            for (
                                const emoji of
                                emojis
                            ) {
                                if (
                                    seen.has(
                                        emoji.id,
                                    )
                                ) {
                                    continue;
                                }

                                seen.add(
                                    emoji.id,
                                );

                                uniqueEmojis.push(
                                    emoji,
                                );

                                if (
                                    uniqueEmojis.length >=
                                    AUTO_REACT_MAX_EMOJIS_PER_KEYWORD
                                ) {
                                    break;
                                }
                            }

                            return {
                                id:
                                    item.id,

                                keyword:
                                    normalizeKeyword(
                                        item.keyword,
                                    ),

                                displayKeyword:
                                    item.displayKeyword ||
                                    item.keyword,

                                emojis:
                                    uniqueEmojis,

                                enabled:
                                    item.enabled !==
                                    false,

                                createdAt:
                                    item.createdAt ||
                                    new Date()
                                        .toISOString(),

                                updatedAt:
                                    item.updatedAt ||
                                    item.createdAt ||
                                    new Date()
                                        .toISOString(),
                            };
                        },
                    )
                    .filter(
                        item =>
                            item.keyword &&
                            item.emojis.length >
                                0,
                    )
                : [],
    };
}

/**
 * =========================================================
 * DATABASE
 * =========================================================
 */

export async function getAutoReactConfig(
    client,
    guildId,
) {
    try {
        const data =
            await client.db.get(
                getAutoReactsKey(
                    guildId,
                ),
                null,
            );

        return normalizeConfig(
            data,
        );
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
        getAutoReactsKey(
            guildId,
        ),
        normalizeConfig(
            config,
        ),
    );

    return true;
}

/**
 * =========================================================
 * PERMISSION
 * =========================================================
 */

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

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator,
        )
    ) {
        return true;
    }

    if (
        member.permissions.has(
            PermissionFlagsBits.ManageGuild,
        )
    ) {
        return true;
    }

    return false;
}

/**
 * =========================================================
 * ADD
 * =========================================================
 *
 * Nếu keyword chưa tồn tại:
 *
 * usagi -> [emoji1]
 *
 * Nếu keyword đã tồn tại:
 *
 * usagi -> [emoji1, emoji2, ...]
 *
 * Tối đa 5 emoji / keyword.
 */

export async function addAutoReact(
    client,
    guildId,
    {
        keyword,
        emoji,
    },
) {
    const normalizedKeyword =
        normalizeKeyword(
            keyword,
        );

    if (!normalizedKeyword) {
        return {
            success: false,
            reason:
                'invalid_keyword',
        };
    }

    if (
        !emoji ||
        !emoji.id
    ) {
        return {
            success: false,
            reason:
                'invalid_emoji',
        };
    }

    const config =
        await getAutoReactConfig(
            client,
            guildId,
        );

    /**
     * =====================================================
     * KEYWORD ĐÃ TỒN TẠI
     * =====================================================
     */

    const existing =
        config.reactions.find(
            item =>
                normalizeKeyword(
                    item.keyword,
                ) ===
                normalizedKeyword,
        );

    if (existing) {
        existing.emojis =
            Array.isArray(
                existing.emojis,
            )
                ? existing.emojis
                : [];

        /**
         * Emoji đã có trong keyword.
         */

        const emojiAlreadyExists =
            existing.emojis.some(
                item =>
                    item.id ===
                    emoji.id,
            );

        if (
            emojiAlreadyExists
        ) {
            return {
                success: false,
                reason:
                    'duplicate_emoji',
                reaction:
                    existing,
            };
        }

        /**
         * Tối đa 5 emoji.
         */

        if (
            existing.emojis
                .length >=
            AUTO_REACT_MAX_EMOJIS_PER_KEYWORD
        ) {
            return {
                success: false,
                reason:
                    'emoji_limit',
                reaction:
                    existing,
            };
        }

        /**
         * Thêm emoji mới.
         */

        existing.emojis.push({
            id:
                emoji.id,

            name:
                emoji.name ||
                null,

            animated:
                emoji.animated ===
                true,
        });

        existing.updatedAt =
            new Date()
                .toISOString();

        await saveAutoReactConfig(
            client,
            guildId,
            config,
        );

        return {
            success: true,

            reaction:
                existing,

            addedToExisting:
                true,
        };
    }

    /**
     * =====================================================
     * KEYWORD MỚI
     * =====================================================
     */

    const now =
        new Date()
            .toISOString();

    const reaction = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        keyword:
            normalizedKeyword,

        displayKeyword:
            String(
                keyword,
            ).trim(),

        emojis: [
            {
                id:
                    emoji.id,

                name:
                    emoji.name ||
                    null,

                animated:
                    emoji.animated ===
                        true,
            },
        ],

        enabled:
            true,

        createdAt:
            now,

        updatedAt:
            now,
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

        addedToExisting:
            false,
    };
}

/**
 * =========================================================
 * REMOVE KEYWORD
 * =========================================================
 */

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
        config.reactions
            .findIndex(
                item =>
                    item.id ===
                    reactionId,
            );

    if (
        index === -1
    ) {
        return {
            success: false,
            reason:
                'not_found',
        };
    }

    const [
        reaction,
    ] =
        config.reactions.splice(
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

/**
 * =========================================================
 * REMOVE EMOJI FROM KEYWORD
 * =========================================================
 */

export async function removeAutoReactEmoji(
    client,
    guildId,
    reactionId,
    emojiId,
) {
    const config =
        await getAutoReactConfig(
            client,
            guildId,
        );

    const reaction =
        config.reactions.find(
            item =>
                item.id ===
                reactionId,
        );

    if (!reaction) {
        return {
            success: false,
            reason:
                'not_found',
        };
    }

    const index =
        reaction.emojis.findIndex(
            emoji =>
                emoji.id ===
                emojiId,
        );

    if (
        index === -1
    ) {
        return {
            success: false,
            reason:
                'emoji_not_found',
        };
    }

    const [
        removedEmoji,
    ] =
        reaction.emojis.splice(
            index,
            1,
        );

    /**
     * Nếu xóa emoji cuối cùng,
     * xóa luôn keyword.
     */

    if (
        reaction.emojis.length ===
        0
    ) {
        config.reactions =
            config.reactions.filter(
                item =>
                    item.id !==
                    reactionId,
            );
    } else {
        reaction.updatedAt =
            new Date()
                .toISOString();
    }

    await saveAutoReactConfig(
        client,
        guildId,
        config,
    );

    return {
        success: true,

        reaction,

        removedEmoji,

        keywordDeleted:
            reaction.emojis.length ===
            0,
    };
}

/**
 * =========================================================
 * TOGGLE ONE KEYWORD
 * =========================================================
 */

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
                item.id ===
                reactionId,
        );

    if (!reaction) {
        return {
            success: false,
            reason:
                'not_found',
        };
    }

    reaction.enabled =
        enabled === true;

    reaction.updatedAt =
        new Date()
            .toISOString();

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

/**
 * =========================================================
 * ENABLE / DISABLE SYSTEM
 * =========================================================
 */

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

/**
 * =========================================================
 * MATCH MESSAGE
 * =========================================================
 */

export function findMatchingAutoReacts(
    content,
    reactions,
) {
    if (
        !content ||
        !Array.isArray(
            reactions,
        )
    ) {
        return [];
    }

    const normalizedContent =
        String(
            content,
        )
            .toLowerCase();

    return reactions
        .filter(
            item =>
                item.enabled !==
                    false &&
                item.keyword &&
                Array.isArray(
                    item.emojis,
                ) &&
                item.emojis.length >
                    0,
        )
        .filter(
            item =>
                normalizedContent
                    .includes(
                        normalizeKeyword(
                            item.keyword,
                        ),
                    ),
        )
        .sort(
            (
                a,
                b,
            ) =>
                normalizeKeyword(
                    b.keyword,
                ).length -
                normalizeKeyword(
                    a.keyword,
                ).length,
        );
}
