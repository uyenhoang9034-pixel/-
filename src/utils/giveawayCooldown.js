// giveawayCooldown.js

import { logger } from './logger.js';
import { getGuildGiveaways } from './giveaways.js';

export const GIVEAWAY_COOLDOWN_COUNT = 2;
export const GIVEAWAY_COOLDOWN_EPOCH_KEY = 'temp:giveaway_cooldown_epoch';
export const GIVEAWAY_COOLDOWN_REJECT_MESSAGE =
    'Bạn vừa mới trúng giveaway gần đây rồi nè, xin hãy đợi giveaway tiếp tiếp theo để tham gia nhé (cách 2 tính từ GA vừa trúng)!';

const DISCORD_EPOCH_MS = 1420070400000n;
const clientEpochCache = new WeakMap();

export function parseTimestampMs(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 ? value : null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d+$/.test(trimmed)) {
            const numeric = Number(trimmed);
            return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
        }
        const parsed = Date.parse(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

export function parseSnowflakeBigInt(messageId) {
    if (typeof messageId === 'bigint') {
        return messageId;
    }
    const raw = String(messageId ?? '').trim();
    if (!/^\d+$/.test(raw)) {
        return null;
    }
    try {
        return BigInt(raw);
    } catch {
        return null;
    }
}

export function snowflakeToTimestampMs(messageId) {
    const id = parseSnowflakeBigInt(messageId);
    if (id === null || id < 4194304n) {
        return null;
    }
    const msBigInt = (id >> 22n) + DISCORD_EPOCH_MS;
    const ms = Number(msBigInt);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function getGiveawayCreatedMs(giveaway) {
    if (!giveaway) return 0;
    return (
        parseTimestampMs(giveaway.createdAt) ??
        snowflakeToTimestampMs(giveaway.messageId) ??
        0
    );
}

export function getGiveawayEndedMs(giveaway) {
    if (!giveaway) return null;
    return (
        parseTimestampMs(giveaway.endedAt) ??
        parseTimestampMs(giveaway.endsAt ?? giveaway.endTime) ??
        null
    );
}

export function isGiveawayResultFinal(giveaway) {
    if (!giveaway) return false;
    const ended = giveaway.ended === true || giveaway.isEnded === true;
    return ended && giveaway.announcementPending !== true;
}

export function getGiveawayWinnerIds(giveaway) {
    if (!giveaway) return [];
    const primary = Array.isArray(giveaway.winnerIds) ? giveaway.winnerIds : [];
    const legacy = Array.isArray(giveaway.winners) ? giveaway.winners : [];
    return [...new Set([...primary, ...legacy].map((id) => String(id || '').trim()).filter(Boolean))];
}

export function compareGiveawaysChronologically(a, b) {
    const timeA = getGiveawayCreatedMs(a);
    const timeB = getGiveawayCreatedMs(b);
    if (timeA !== timeB) {
        return timeA - timeB;
    }

    const snowA = parseSnowflakeBigInt(a?.messageId);
    const snowB = parseSnowflakeBigInt(b?.messageId);
    if (snowA !== null && snowB !== null && snowA !== snowB) {
        return snowA < snowB ? -1 : 1;
    }

    return String(a?.messageId || '').localeCompare(String(b?.messageId || ''));
}

export function isGiveawayInCooldownScope(giveaway, enabledAtMs) {
    if (!giveaway || !giveaway.messageId) {
        return false;
    }
    if (giveaway.bypassWinnerCooldown === true) {
        return false;
    }
    if (!Number.isFinite(enabledAtMs) || enabledAtMs <= 0) {
        return true;
    }

    const createdMs = getGiveawayCreatedMs(giveaway);
    if (createdMs >= enabledAtMs) {
        return true;
    }

    const endsMs = parseTimestampMs(giveaway.endsAt ?? giveaway.endTime);

    if (giveaway.ended === true || giveaway.isEnded === true) {
        if (giveaway.announcementPending === true) {
            const refMs = getGiveawayEndedMs(giveaway) ?? endsMs ?? createdMs;
            return refMs >= enabledAtMs;
        }
        const endedMs = getGiveawayEndedMs(giveaway) ?? createdMs;
        return endedMs >= enabledAtMs;
    }

    if (endsMs !== null) {
        return endsMs >= enabledAtMs;
    }

    return false;
}

function buildScopedTimeline(giveaways, targetGiveaway, enabledAtMs) {
    const byId = new Map();
    if (Array.isArray(giveaways)) {
        for (const item of giveaways) {
            if (item?.messageId) {
                byId.set(String(item.messageId), item);
            }
        }
    }
    if (targetGiveaway?.messageId) {
        byId.set(String(targetGiveaway.messageId), targetGiveaway);
    }

    const scoped = [];
    const targetId = targetGiveaway?.messageId ? String(targetGiveaway.messageId) : null;
    for (const item of byId.values()) {
        if ((targetId && String(item.messageId) === targetId) || isGiveawayInCooldownScope(item, enabledAtMs)) {
            scoped.push(item);
        }
    }

    scoped.sort(compareGiveawaysChronologically);
    return scoped;
}

function evaluateCooldownForWin(scoped, winningGiveaway, targetGiveaway, cooldownGap) {
    if (!winningGiveaway || !targetGiveaway) return null;
    if (String(winningGiveaway.messageId) === String(targetGiveaway.messageId)) {
        return null;
    }
    if (!isGiveawayResultFinal(winningGiveaway)) {
        return null;
    }

    const winMs = getGiveawayEndedMs(winningGiveaway) ?? getGiveawayCreatedMs(winningGiveaway);
    const relation = compareGiveawaysChronologically(winningGiveaway, targetGiveaway);

    if (relation < 0) {
        // Standard & concurrent-after-win: targetGiveaway was created AFTER winningGiveaway.
        // Only count subsequent GAs that did not already finish before winningGiveaway picked winners.
        const afterWin = scoped.filter((g) => {
            if (compareGiveawaysChronologically(winningGiveaway, g) >= 0) {
                return false;
            }
            if (!isGiveawayResultFinal(g)) {
                return true;
            }
            const gEndMs = getGiveawayEndedMs(g) ?? getGiveawayCreatedMs(g);
            return gEndMs >= winMs;
        });

        const idx = afterWin.findIndex((g) => String(g.messageId) === String(targetGiveaway.messageId));
        if (idx !== -1 && idx < cooldownGap) {
            return {
                reason: 'after_win',
                winningGiveaway,
                positionInCooldown: idx + 1,
                cooldownGap,
            };
        }
        return null;
    }

    // Out-of-order end case: targetGiveaway was created BEFORE winningGiveaway,
    // yet winningGiveaway already ended while targetGiveaway was open.
    const targetCreatedMs = getGiveawayCreatedMs(targetGiveaway);
    if (winMs >= targetCreatedMs) {
        const completedAfterWin = scoped.filter((g) => {
            if (String(g.messageId) === String(targetGiveaway.messageId)) {
                return false;
            }
            if (compareGiveawaysChronologically(winningGiveaway, g) >= 0) {
                return false;
            }
            if (!isGiveawayResultFinal(g)) {
                return false;
            }
            const gEndMs = getGiveawayEndedMs(g) ?? getGiveawayCreatedMs(g);
            return gEndMs >= winMs;
        });

        if (completedAfterWin.length < cooldownGap) {
            return {
                reason: 'concurrent_win',
                winningGiveaway,
                positionInCooldown: completedAfterWin.length + 1,
                cooldownGap,
            };
        }
    }

    return null;
}

export function checkGiveawayCooldownFromList(
    giveaways,
    targetGiveaway,
    userId,
    { enabledAtMs = 0, cooldownGap = GIVEAWAY_COOLDOWN_COUNT } = {},
) {
    if (!targetGiveaway?.messageId || !userId || !Number.isFinite(cooldownGap) || cooldownGap <= 0) {
        return { blocked: false, cooldownGap };
    }

    if (!isGiveawayInCooldownScope(targetGiveaway, enabledAtMs)) {
        return { blocked: false, cooldownGap };
    }

    const normalizedUserId = String(userId).trim();
    const scoped = buildScopedTimeline(giveaways, targetGiveaway, enabledAtMs);

    // Check from newest winning giveaway backwards so we surface the most recent win.
    for (let i = scoped.length - 1; i >= 0; i -= 1) {
        const candidate = scoped[i];
        if (String(candidate.messageId) === String(targetGiveaway.messageId)) {
            continue;
        }
        if (!isGiveawayResultFinal(candidate)) {
            continue;
        }
        const winnerIds = getGiveawayWinnerIds(candidate);
        if (!winnerIds.includes(normalizedUserId)) {
            continue;
        }

        const match = evaluateCooldownForWin(scoped, candidate, targetGiveaway, cooldownGap);
        if (match) {
            return {
                blocked: true,
                ...match,
            };
        }
    }

    return { blocked: false, cooldownGap };
}

export function getCooldownExcludedUserIdsFromList(
    giveaways,
    targetGiveaway,
    { enabledAtMs = 0, cooldownGap = GIVEAWAY_COOLDOWN_COUNT } = {},
) {
    if (!targetGiveaway?.messageId || !Number.isFinite(cooldownGap) || cooldownGap <= 0) {
        return [];
    }

    if (!isGiveawayInCooldownScope(targetGiveaway, enabledAtMs)) {
        return [];
    }

    const scoped = buildScopedTimeline(giveaways, targetGiveaway, enabledAtMs);
    const excluded = new Set();

    for (const candidate of scoped) {
        if (String(candidate.messageId) === String(targetGiveaway.messageId)) {
            continue;
        }
        if (!isGiveawayResultFinal(candidate)) {
            continue;
        }
        const winnerIds = getGiveawayWinnerIds(candidate);
        if (winnerIds.length === 0) {
            continue;
        }

        const match = evaluateCooldownForWin(scoped, candidate, targetGiveaway, cooldownGap);
        if (match) {
            for (const winnerId of winnerIds) {
                excluded.add(winnerId);
            }
        }
    }

    return Array.from(excluded);
}

export async function initializeGiveawayCooldownEpoch(client) {
    const now = Date.now();
    try {
        if (!client?.db || typeof client.db.get !== 'function' || typeof client.db.set !== 'function') {
            return now;
        }

        const isDegraded = typeof client.db.isDegraded === 'function' && client.db.isDegraded();
        const existing = await client.db.get(GIVEAWAY_COOLDOWN_EPOCH_KEY, null);
        const existingMs = parseTimestampMs(existing?.enabledAt ?? existing);

        if (existingMs !== null) {
            if (!isDegraded) {
                clientEpochCache.set(client, existingMs);
            }
            return existingMs;
        }

        const payload = {
            enabledAt: now,
            enabledAtIso: new Date(now).toISOString(),
        };
        await client.db.set(GIVEAWAY_COOLDOWN_EPOCH_KEY, payload);

        if (!isDegraded) {
            clientEpochCache.set(client, now);
        }

        logger.info(`[GiveawayCooldown] Initialized giveaway cooldown epoch at ${payload.enabledAtIso}`);
        return now;
    } catch (error) {
        logger.warn('[GiveawayCooldown] Failed to initialize cooldown epoch, using current timestamp:', error?.message || error);
        return now;
    }
}

export async function getGiveawayCooldownEpochMs(client) {
    if (!client) {
        return Date.now();
    }

    const isDegraded = typeof client.db?.isDegraded === 'function' && client.db.isDegraded();
    if (!isDegraded && clientEpochCache.has(client)) {
        return clientEpochCache.get(client);
    }

    return initializeGiveawayCooldownEpoch(client);
}

export async function checkUserGiveawayCooldown(client, guildId, targetGiveaway, userId, options = {}) {
    try {
        if (!targetGiveaway || !userId) {
            return { blocked: false, cooldownGap: GIVEAWAY_COOLDOWN_COUNT };
        }

        const enabledAtMs =
            options.enabledAtMs ??
            (await getGiveawayCooldownEpochMs(client));

        const giveaways =
            Array.isArray(options.giveaways)
                ? options.giveaways
                : (client?.db && guildId ? await getGuildGiveaways(client, guildId) : []);

        return checkGiveawayCooldownFromList(giveaways, targetGiveaway, userId, {
            enabledAtMs,
            cooldownGap: options.cooldownGap ?? GIVEAWAY_COOLDOWN_COUNT,
        });
    } catch (error) {
        logger.error(`Error checking giveaway cooldown for user ${userId} in guild ${guildId}:`, error);
        return { blocked: false, cooldownGap: GIVEAWAY_COOLDOWN_COUNT };
    }
}

export async function getCooldownExcludedWinners(client, guildId, targetGiveaway, options = {}) {
    try {
        if (!targetGiveaway) {
            return [];
        }

        const enabledAtMs =
            options.enabledAtMs ??
            (await getGiveawayCooldownEpochMs(client));

        const giveaways =
            Array.isArray(options.giveaways)
                ? options.giveaways
                : (client?.db && guildId ? await getGuildGiveaways(client, guildId) : []);

        return getCooldownExcludedUserIdsFromList(giveaways, targetGiveaway, {
            enabledAtMs,
            cooldownGap: options.cooldownGap ?? GIVEAWAY_COOLDOWN_COUNT,
        });
    } catch (error) {
        logger.error(`Error getting cooldown excluded winners for guild ${guildId}:`, error);
        return [];
    }
}
