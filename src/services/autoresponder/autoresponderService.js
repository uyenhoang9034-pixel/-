import {
    getAutorespondersKey,
} from '../../utils/database/keys.js';

import {
    PermissionFlagsBits,
} from 'discord.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    normalizeAutoresponderResponse,
    validateAutoresponderResponse,
} from './responseValidator.js';

const DEFAULT_CONFIG = {
    managerRoleId: null,
    responders: [],
};

const builderSessions = new Map();

function normalizeConfig(data) {
    if (
        !data ||
        typeof data !== 'object'
    ) {
        return {
            ...DEFAULT_CONFIG,
            responders: [],
        };
    }

    return {
        managerRoleId:
            typeof data.managerRoleId === 'string'
                ? data.managerRoleId
                : null,

        responders:
            Array.isArray(data.responders)
                ? data.responders
                    .filter(
                        responder =>
                            responder &&
                            typeof responder === 'object' &&
                            typeof responder.id === 'string' &&
                            typeof responder.keyword === 'string',
                    )
                    .map(
                        responder => ({
                            ...responder,

                            keyword:
                                normalizeKeyword(
                                    responder.keyword,
                                ),

                            displayKeyword:
                                responder.displayKeyword ||
                                responder.keyword,

                            type:
                                responder.type === 'manager'
                                    ? 'manager'
                                    : 'everyone',

                            enabled:
                                responder.enabled !== false,

                            response:
                                normalizeAutoresponderResponse(
                                    responder.response,
                                ),
                        }),
                    )
                : [],
    };
}
function normalizeKeyword(keyword) {
    return String(keyword || '')
        .trim()
        .toLowerCase();
}

export async function getAutoresponderConfig(
    client,
    guildId,
) {
    const key =
        getAutorespondersKey(guildId);

    try {
        const data =
            await client.db.get(
                key,
                null,
            );

        return normalizeConfig(data);
    } catch (error) {
        logger.error(
            `Failed to load autoresponders for ${guildId}:`,
            error,
        );

        throw error;
    }
}

export async function saveAutoresponderConfig(
    client,
    guildId,
    config,
) {
    const key =
        getAutorespondersKey(guildId);

    await client.db.set(
        key,
        normalizeConfig(config),
    );

    return true;
}

export function createBuilderSession({
    userId,
    guildId,
    mode = 'create',
    responderId = null,
    keyword = '',
    type = 'everyone',
    response = {},
}) {
    const sessionId =
        `${Date.now()}_${userId}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

    const session = {
        sessionId,
        userId,
        guildId,
        mode,
        responderId,
        keyword,
        type,
        response:
            normalizeAutoresponderResponse(
                response,
            ),
        createdAt: Date.now(),
    };

    builderSessions.set(
        sessionId,
        session,
    );

    return session;
}

export function getBuilderSession(
    sessionId,
) {
    return builderSessions.get(
        sessionId,
    );
}

export function deleteBuilderSession(
    sessionId,
) {
    builderSessions.delete(
        sessionId,
    );
}

export function updateBuilderSession(
    sessionId,
    updates = {},
) {
    const session =
        builderSessions.get(
            sessionId,
        );

    if (!session) {
        return null;
    }

    Object.assign(
        session,
        updates,
    );

    if (updates.response) {
        session.response =
            normalizeAutoresponderResponse(
                updates.response,
            );
    }

    return session;
}

export function canManageAutoresponder(
    member,
    config,
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

    return Boolean(
        config.managerRoleId &&
        member.roles.cache.has(
            config.managerRoleId,
        ),
    );
}

export function canTriggerResponder(
    member,
    responder,
    config,
) {
    if (
        responder.type ===
        'everyone'
    ) {
        return true;
    }

    if (
        responder.type ===
        'manager'
    ) {
        return Boolean(
            config.managerRoleId &&
            member?.roles?.cache?.has(
                config.managerRoleId,
            ),
        );
    }

    return false;
}

export function findMatchingResponder(
    content,
    responders,
) {
    if (
        !content ||
        !Array.isArray(responders)
    ) {
        return null;
    }

    const normalizedContent =
        content.toLowerCase();

    return responders
        .filter(
            responder =>
                responder.enabled !== false,
        )
.filter(
    responder => {
        const keyword =
            normalizeKeyword(
                responder.keyword,
            );

        return (
            keyword.length > 0 &&
            normalizedContent.includes(
                keyword,
            )
        );
    },
)
        .sort(
            (a, b) =>
                normalizeKeyword(
                    b.keyword,
                ).length -
                normalizeKeyword(
                    a.keyword,
                ).length,
        )[0] || null;
}

export async function createAutoresponder(
    client,
    guildId,
    data,
) {
    const config =
        await getAutoresponderConfig(
            client,
            guildId,
        );

    const keyword =
        normalizeKeyword(
            data.keyword,
        );

    if (!keyword) {
        return {
            success: false,
            reason: 'invalid_keyword',
        };
    }

    const duplicate =
        config.responders.some(
            responder =>
                normalizeKeyword(
                    responder.keyword,
                ) === keyword,
        );

    if (duplicate) {
        return {
            success: false,
            reason: 'duplicate_keyword',
        };
    }

    const validation =
        validateAutoresponderResponse(
            data.response,
        );

    if (!validation.valid) {
        return {
            success: false,
            reason: 'invalid_response',
            message:
                validation.error,
        };
    }

    const now =
        new Date().toISOString();

    const responder = {
        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        keyword,

        displayKeyword:
            String(data.keyword).trim(),

        type:
            data.type === 'manager'
                ? 'manager'
                : 'everyone',

        response:
            validation.response,

        enabled: true,

        createdAt: now,
        updatedAt: now,
    };

    config.responders.push(
        responder,
    );

    await saveAutoresponderConfig(
        client,
        guildId,
        config,
    );

    return {
        success: true,
        responder,
    };
}

export async function updateAutoresponder(
    client,
    guildId,
    responderId,
    updates = {},
) {
    const config =
        await getAutoresponderConfig(
            client,
            guildId,
        );

    const responder =
        config.responders.find(
            item =>
                item.id === responderId,
        );

    if (!responder) {
        return {
            success: false,
            reason: 'not_found',
        };
    }

    if (
        updates.keyword !==
        undefined
    ) {
        const keyword =
            normalizeKeyword(
                updates.keyword,
            );

        const duplicate =
            config.responders.some(
                item =>
                    item.id !==
                        responderId &&
                    normalizeKeyword(
                        item.keyword,
                    ) === keyword,
            );

        if (duplicate) {
            return {
                success: false,
                reason:
                    'duplicate_keyword',
            };
        }

        responder.keyword =
            keyword;

        responder.displayKeyword =
            String(
                updates.keyword,
            ).trim();
    }

    if (
        updates.type !==
        undefined
    ) {
        responder.type =
            updates.type ===
            'manager'
                ? 'manager'
                : 'everyone';
    }

    if (
        updates.response !==
        undefined
    ) {
        const validation =
            validateAutoresponderResponse(
                updates.response,
            );

        if (!validation.valid) {
            return {
                success: false,
                reason:
                    'invalid_response',
                message:
                    validation.error,
            };
        }

        responder.response =
            validation.response;
    }

    if (
        updates.enabled !==
        undefined
    ) {
        responder.enabled =
            updates.enabled === true;
    }

    responder.updatedAt =
        new Date().toISOString();

    await saveAutoresponderConfig(
        client,
        guildId,
        config,
    );

    return {
        success: true,
        responder,
    };
}

export async function deleteAutoresponder(
    client,
    guildId,
    responderId,
) {
    const config =
        await getAutoresponderConfig(
            client,
            guildId,
        );

    const index =
        config.responders.findIndex(
            item =>
                item.id === responderId,
        );

    if (index === -1) {
        return {
            success: false,
            reason: 'not_found',
        };
    }

    const [
        responder,
    ] = config.responders.splice(
        index,
        1,
    );

    await saveAutoresponderConfig(
        client,
        guildId,
        config,
    );

    return {
        success: true,
        responder,
    };
}

export async function setManagerRole(
    client,
    guildId,
    roleId,
) {
    const config =
        await getAutoresponderConfig(
            client,
            guildId,
        );

    config.managerRoleId =
        roleId || null;

    await saveAutoresponderConfig(
        client,
        guildId,
        config,
    );

    return config;
}
