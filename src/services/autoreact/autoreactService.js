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
 * NORMALIZE KEYWORD
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

/**
 * =========================================================
 * NORMALIZE EMOJI
 * =========================================================
 */

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

/**
 * =========================================================
 * NORMALIZE CONFIG
 * =========================================================
 */

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
                            let emojis = [];

                            /**
                             * =============================================
                             * FORMAT MỚI
                             * =============================================
                             *
                             * emojis: [
                             *   {
                             *     id,
                             *     name,
                             *     animated
                             *   }
                             * ]
                             */

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

                            /**
                             * =============================================
                             * MIGRATION FORMAT CŨ
                             * =============================================
                             *
                             * emojiId
                             * emojiName
                             * animated
                             *
                             * ->
                             *
                             * emojis[]
                             */

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
                             * =============================================
                             * REMOVE DUPLICATE EMOJIS
                             * =============================================
                             */

                            const uniqueEmojis = [];

                            const seenEmojiIds =
                                new Set();

                            for (
                                const emoji of
                                emojis
                            ) {
                                if (
                                    seenEmojiIds.has(
                                        emoji.id,
                                    )
                                ) {
                                    continue;
                                }

                                seenEmojiIds.add(
                                    emoji.id,
                                );

                                uniqueEmojis.push(
                                    emoji,
                                );

                                /**
                                 * Tối đa 5 emoji
                                 * cho mỗi keyword.
                                 */

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
 * GET CONFIG
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

/**
 * =========================================================
 * SAVE CONFIG
 * =========================================================
 */

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
 * PERMISSIONS
 * =========================================================
 */

export function canManageAutoReact(
    member,
) {
    if (!member) {
        return false;
    }

    /**
     * Server Owner
     */

    if (
        member.guild?.ownerId ===
        member.id
    ) {
        return true;
    }

    /**
     * Administrator
     */

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator,
        )
    ) {
        return true;
    }

    /**
     * Manage Server
     */

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
 * ADD AUTO REACT
 * =========================================================
 *
 * Ví dụ:
 *
 * keyword: +1
 *
 * Lần 1:
 *
 * +1
 * └ emoji1
 *
 * Lần 2:
 *
 * +1
 * ├ emoji1
 * └ emoji2
 *
 * ...
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

    /**
     * Keyword rỗng.
     */

    if (!normalizedKeyword) {
        return {
            success: false,
            reason:
                'invalid_keyword',
        };
    }

    /**
     * Emoji không hợp lệ.
     */

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
     * CHECK KEYWORD ĐÃ TỒN TẠI
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

    /**
     * =====================================================
     * KEYWORD ĐÃ TỒN TẠI
     * =====================================================
     *
     * Không tạo keyword duplicate.
     *
     * Thêm emoji vào keyword cũ.
     */

    if (existing) {
        existing.emojis =
            Array.isArray(
                existing.emojis,
            )
                ? existing.emojis
                : [];

        /**
         * Check emoji duplicate.
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
         * Check limit.
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
         * Add emoji.
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
     * CREATE NEW KEYWORD
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
 * REMOVE ENTIRE KEYWORD
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
 * REMOVE ONE EMOJI
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
     * Nếu keyword không còn emoji nào
     * thì xóa luôn keyword.
     */

    const keywordDeleted =
        reaction.emojis.length ===
        0;

    if (
        keywordDeleted
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

        keywordDeleted,
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
 * ENABLE / DISABLE ENTIRE SYSTEM
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
 * FIND MATCHING AUTO REACTS
 * =========================================================
 *
 * QUAN TRỌNG:
 *
 * Đây là CONTAINS MATCH.
 *
 * Không yêu cầu message === keyword.
 *
 * Chỉ cần message CÓ CHỨA keyword.
 *
 * Ví dụ keyword:
 *
 * +1
 *
 * Những message sau ĐỀU MATCH:
 *
 * +1
 * cho bạn +1
 * ok +1 nha
 * abc+1xyz
 * +100
 *
 * -----------------------------------------
 *
 * Keyword:
 *
 * usagi
 *
 * Match:
 *
 * usagi
 * hello usagi
 * usagi cute
 * hôm nay usagi cute quá
 *
 * -----------------------------------------
 *
 * Không phân biệt hoa / thường.
 *
 * Usagi
 * USAGI
 * usagi
 *
 * đều match keyword "usagi".
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

    /**
     * Normalize toàn bộ message.
     */

    const normalizedContent =
        String(
            content,
        )
            .toLowerCase();

    return reactions

        /**
         * Chỉ lấy rule đang bật
         * và có emoji.
         */

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

        /**
         * =================================================
         * CONTAINS MATCH
         * =================================================
         *
         * Đây chính là phần giúp:
         *
         * keyword = "+1"
         *
         * "hello +1 nha"
         *
         * vẫn được nhận diện.
         */

        .filter(
            item => {
                const keyword =
                    normalizeKeyword(
                        item.keyword,
                    );

                if (!keyword) {
                    return false;
                }

                return (
                    normalizedContent
                        .includes(
                            keyword,
                        )
                );
            },
        )

        /**
         * Keyword dài hơn ưu tiên trước.
         *
         * Ví dụ:
         *
         * +1
         * +100
         *
         * Nếu message chứa +100
         * thì +100 được xử lý trước.
         */

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
