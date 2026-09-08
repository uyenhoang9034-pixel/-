import {
    VOICE_LEVEL_INTERVAL_MS,
    LEVELING_MAX_LEVEL,
} from '../../config/leveling/levelingSystem.js';

import {
    getUserLevelData,
    saveUserLevelData,
} from './leveling.js';

import {
    syncHighestLevelRole,
} from './levelRoleService.js';

import {
    sendLevelAnnouncement,
} from './levelAnnouncementService.js';

import {
    logger,
} from '../../utils/logger.js';

const activeSessions =
    new Map();

/**
 * =========================================================
 * DATABASE KEY
 * =========================================================
 */

function getVoiceTimeKey(
    guildId,
    userId,
) {
    return `levelVoice:${guildId}:${userId}`;
}

/**
 * =========================================================
 * SESSION KEY
 * =========================================================
 */

function getSessionKey(
    guildId,
    userId,
) {
    return `${guildId}:${userId}`;
}

/**
 * =========================================================
 * START SESSION
 * =========================================================
 */

export function startVoiceLevelSession(
    member,
) {
    if (
        !member ||
        member.user?.bot
    ) {
        return;
    }

    const key =
        getSessionKey(
            member.guild.id,
            member.id,
        );

    if (
        activeSessions.has(
            key,
        )
    ) {
        return;
    }

    activeSessions.set(
        key,
        Date.now(),
    );
}

/**
 * =========================================================
 * STOP SESSION
 * =========================================================
 */

export async function stopVoiceLevelSession(
    client,
    member,
) {
    if (
        !member ||
        member.user?.bot
    ) {
        return;
    }

    const guild =
        member.guild;

    const sessionKey =
        getSessionKey(
            guild.id,
            member.id,
        );

    const startedAt =
        activeSessions.get(
            sessionKey,
        );

    if (!startedAt) {
        return;
    }

    activeSessions.delete(
        sessionKey,
    );

    const sessionDuration =
        Math.max(
            0,
            Date.now() -
                startedAt,
        );

    if (
        sessionDuration <= 0
    ) {
        return;
    }

    await addVoiceDuration(
        client,
        member,
        sessionDuration,
    );
}

/**
 * =========================================================
 * ADD VOICE DURATION
 * =========================================================
 */

async function addVoiceDuration(
    client,
    member,
    duration,
) {
    const guild =
        member.guild;

    const dbKey =
        getVoiceTimeKey(
            guild.id,
            member.id,
        );

    const stored =
        await client.db
            .get(
                dbKey,
            )
            .catch(
                () => null,
            );

    let accumulated =
        Number(
            stored?.milliseconds ??
            stored ??
            0,
        );

    if (
        !Number.isFinite(
            accumulated,
        )
    ) {
        accumulated =
            0;
    }

    accumulated +=
        duration;

    const levelsEarned =
        Math.floor(
            accumulated /
                VOICE_LEVEL_INTERVAL_MS,
        );

    accumulated =
        accumulated %
        VOICE_LEVEL_INTERVAL_MS;

    await client.db.set(
        dbKey,
        {
            milliseconds:
                accumulated,
        },
    );

    if (
        levelsEarned <= 0
    ) {
        return;
    }

    await awardVoiceLevels(
        client,
        member,
        levelsEarned,
    );
}

/**
 * =========================================================
 * AWARD LEVELS
 * =========================================================
 */

async function awardVoiceLevels(
    client,
    member,
    levelsEarned,
) {
    const guild =
        member.guild;

    const levelData =
        await getUserLevelData(
            client,
            guild.id,
            member.id,
        );

    const oldLevel =
        levelData.level;

    if (
        oldLevel >=
        LEVELING_MAX_LEVEL
    ) {
        return;
    }

    const newLevel =
        Math.min(
            LEVELING_MAX_LEVEL,
            oldLevel +
                levelsEarned,
        );

    levelData.level =
        newLevel;

    /**
     * Khi level tăng trực tiếp từ Voice,
     * XP trong level hiện tại giữ nguyên.
     *
     * totalXp không dùng để tính level
     * trong thao tác Voice này.
     */

    await saveUserLevelData(
        client,
        guild.id,
        member.id,
        levelData,
    );

    await syncHighestLevelRole(
        member,
        newLevel,
    );

    await sendLevelAnnouncement({
        guild,
        member,
        level:
            newLevel,
        source:
            'voice',
    });

    logger.info(
        `[VOICE LEVEL] ${member.user.tag}: Lv.${oldLevel} -> Lv.${newLevel}`,
    );
}

/**
 * =========================================================
 * HANDLE VOICE STATE
 * =========================================================
 */

export async function handleVoiceLevelState(
    client,
    oldState,
    newState,
) {
    const member =
        newState.member ||
        oldState.member;

    if (
        !member ||
        member.user?.bot
    ) {
        return;
    }

    const oldChannelId =
        oldState.channelId;

    const newChannelId =
        newState.channelId;

    /**
     * Không đổi channel.
     *
     * Mute/deaf/server mute thay đổi
     * không reset timer.
     */
    if (
        oldChannelId ===
        newChannelId
    ) {
        return;
    }

    /**
     * JOIN VOICE
     */
    if (
        !oldChannelId &&
        newChannelId
    ) {
        startVoiceLevelSession(
            member,
        );

        return;
    }

    /**
     * LEAVE VOICE
     */
    if (
        oldChannelId &&
        !newChannelId
    ) {
        await stopVoiceLevelSession(
            client,
            member,
        );

        return;
    }

    /**
     * MOVE CHANNEL
     *
     * Vẫn đang trong Voice,
     * không reset thời gian.
     */
    if (
        oldChannelId &&
        newChannelId
    ) {
        const key =
            getSessionKey(
                member.guild.id,
                member.id,
            );

        if (
            !activeSessions.has(
                key,
            )
        ) {
            startVoiceLevelSession(
                member,
            );
        }
    }
}

/**
 * =========================================================
 * RESTORE ACTIVE USERS AFTER RESTART
 * =========================================================
 */

export function restoreVoiceLevelSessions(
    client,
) {
    for (
        const guild
        of client.guilds.cache.values()
    ) {
        for (
            const member
            of guild.members.cache.values()
        ) {
            if (
                member.user.bot ||
                !member.voice?.channelId
            ) {
                continue;
            }

            startVoiceLevelSession(
                member,
            );
        }
    }
}
