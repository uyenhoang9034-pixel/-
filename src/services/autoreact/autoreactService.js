import { PermissionFlagsBits } from 'discord.js';

import {
    getAutoReactsKey,
} from '../../utils/database/keys.js';

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

function normalizeKeyword(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

function normalizeEmoji(emoji) {
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
 *
 * Format hiện tại:
 *
 * {
 *   enabled: true,
 *   reactions: [
 *     {
 *       id: "...",
 *       keyword: "+1",
 *       displayKeyword: "+1",
 *       emojis: [
 *         {
 *           id: "...",
 *           name: "...",
 *           animated: false
 *         }
 *       ],
 *       enabled: true
 *     }
 *   ]
 * }
 *
 * Có migration từ format emojiId cũ.
 */

function normalizeConfig(data) {
    if (
        !data ||
        typeof data !== 'object'
    ) {
        return {
            ...DEFAULT_CONFIG,
            reactions: [],
        };
    }

    const reactions =
        Array.isArray(data.reactions)
            ? data.reactions
            : [];

    const normalizedReactions =
        reactions
            .filter(
                item =>
                    item &&
                    typeof item === 'object' &&
                    typeof item.id === 'string' &&
                    typeof item.keyword === 'string',
            )
            .map(item => {
                let emojis = [];

                /**
                 * =========================================
                 * FORMAT MỚI
                 * =========================================
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
                 * =========================================
                 * MIGRATION FORMAT CŨ
                 * =========================================
                 *
                 * {
                 *   emojiId,
                 *   emojiName,
                 *   animated
                 * }
                 *
                 * ->
                 *
                 * {
                 *   emojis: [...]
                 * }
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

                    if (legacyEmoji) {
                        emojis.push(
                            legacyEmoji,
                        );
                    }
                }

                /**
                 * =========================================
                 * REMOVE DUPLICATE EMOJIS
                 * =========================================
                 */

                const uniqueEmojis = [];

                const seenEmojiIds =
                    new Set();

                for (
                    const emoji of emojis
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
                     * Tối đa 5 emoji / keyword.
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
                        item.enabled !== false,

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
            })
            .filter(
                item =>
                    item.keyword &&
                    item.emojis.length > 0,
            );

    return {
        enabled:
            data.enabled !== false,

        reactions:
            normalizedReactions,
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
    const normalized =
        normalizeConfig(
            config,
        );

    await client.db.set(
        getAutoReactsKey(
            guildId,
        ),
        normalized,
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

    /**
     * Server Owner.
     */

    if (
        member.guild?.ownerId ===
        member.id
    ) {
        return true;
    }

    /**
     * Administrator.
     */

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator,
        )
    ) {
        return true;
    }

    /**
     * Manage Server.
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
 * Keyword chưa tồn tại:
 *
 * +1
 * └── emoji A
 *
 * Sau khi /autoreact add lại:
 *
 * +1
 * ├── emoji A
 * └── emoji B
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
     * Keyword không hợp lệ.
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
     * TÌM KEYWORD ĐÃ TỒN TẠI
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
     * Không tạo rule duplicate.
     * Thêm emoji vào rule hiện tại.
     */

    if (existing) {
        if (
            !Array.isArray(
                existing.emojis,
            )
        ) {
            existing.emojis = [];
        }

        /**
         * Emoji này đã tồn tại.
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
         * Đã đủ 5 emoji.
         */

        if (
            existing.emojis.length >=
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
                emoji.animated === true,
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
                    emoji.animated === true,
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
        config.reactions.findIndex(
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
 * REMOVE ONE EMOJI FROM KEYWORD
 * =========================================================
 *
 * Nếu xóa emoji cuối cùng của keyword,
 * keyword cũng sẽ bị xóa.
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

    const keywordDeleted =
        reaction.emojis.length ===
        0;

    /**
     * Không còn emoji nào
     * -> xóa luôn keyword.
     */

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
 * Đây là CONTAINS MATCH.
 *
 * Ví dụ keyword:
 *
 * +1
 *
 * Tất cả đều match:
 *
 * +1
 * cho bạn +1
 * +1 nhận quà
 * hello +1 nha
 * abc+1xyz
 * +100
 *
 * Vì:
 *
 * "+1 nhận quà".includes("+1") === true
 *
 * Không phân biệt hoa/thường.
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
        /**
         * Rule phải:
         *
         * - đang bật
         * - có keyword
         * - có ít nhất 1 emoji
         */
        .filter(
            item =>
                item.enabled !== false &&
                item.keyword &&
                Array.isArray(
                    item.emojis,
                ) &&
                item.emojis.length > 0,
        )

        /**
         * CONTAINS MATCH
         *
         * Keyword có thể nằm ở bất kỳ
         * vị trí nào trong message.
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

                return normalizedContent
                    .includes(
                        keyword,
                    );
            },
        )

        /**
         * Keyword dài hơn xử lý trước.
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
