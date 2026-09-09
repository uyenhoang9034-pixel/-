import {
    VOICE_LEVEL_INTERVAL_MS,
    LEVELING_MAX_LEVEL,
    formatLevelNumber,
} from '../../config/leveling/levelingSystem.js';

import {
    getUserLevelData,
    saveUserLevelData,
    getLevelingConfig,
} from './leveling.js';

import {
    syncHighestLevelRole,
} from './levelRoleService.js';

import {
    sendLevelChangeAnnouncements,
} from './levelAnnouncementService.js';

import {
    logger,
} from '../../utils/logger.js';

import {
    Mutex,
} from '../../utils/mutex.js';

/**
 * =========================================================
 * USAGI VOICE LEVEL SERVICE
 * =========================================================
 *
 * 30 phút Voice = +1 Level.
 *
 * - Không cần rời Voice mới nhận level.
 * - Đổi từ voice này sang voice khác không reset timer.
 * - Phần thời gian dư được lưu vào database.
 * - Restart bot không làm mất phần thời gian đã lưu.
 *
 * MILESTONES:
 *
 * Lv.1
 * Lv.10
 * Lv.20
 * Lv.40
 * Lv.70
 * Lv.100
 * Lv.200
 * Lv.300
 * Lv.500
 * Lv.999
 * Lv.1.999
 * Lv.3.999
 * Lv.6.999
 * Lv.9.999
 *
 * Khi Voice đưa user tới/vượt milestone:
 *
 * -> levelAnnouncementService tự chọn:
 *
 * Phá Cảnh · Phi Thăng
 * Phá Cảnh · Tiên Lộ
 * Phá Cảnh · Cực Cảnh
 *
 * Role luôn được đồng bộ để chỉ giữ
 * role cảnh giới cao nhất.
 * =========================================================
 */

/**
 * Bot kiểm tra mỗi 30 giây.
 *
 * Đây KHÔNG phải:
 *
 * 30 giây = 1 level.
 *
 * Mà là:
 *
 * mỗi 30 giây kiểm tra thời gian đã tích.
 *
 * Đủ:
 *
 * 30 phút = +1 Level.
 */

const VOICE_CHECK_INTERVAL_MS =
    30 * 1000;

/**
 * =========================================================
 * ACTIVE SESSION MAP
 * =========================================================
 *
 * key:
 *
 * guildId:userId
 *
 * value:
 *
 * {
 *     member,
 *     lastCheckedAt,
 *     interval
 * }
 */

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
 * READ ACCUMULATED VOICE TIME
 * =========================================================
 */

async function getStoredVoiceTime(
    client,
    guildId,
    userId,
) {
    const dbKey =
        getVoiceTimeKey(
            guildId,
            userId,
        );

    const stored =
        await client.db
            .get(
                dbKey,
            )
            .catch(
                () => null,
            );

    const milliseconds =
        Number(
            stored?.milliseconds ??
            stored ??
            0,
        );

    if (
        !Number.isFinite(
            milliseconds,
        ) ||
        milliseconds < 0
    ) {
        return 0;
    }

    return milliseconds;
}

/**
 * =========================================================
 * SAVE ACCUMULATED VOICE TIME
 * =========================================================
 */

async function saveStoredVoiceTime(
    client,
    guildId,
    userId,
    milliseconds,
) {
    const safeMilliseconds =
        Math.max(
            0,
            Number(
                milliseconds,
            ) || 0,
        );

    await client.db.set(
        getVoiceTimeKey(
            guildId,
            userId,
        ),
        {
            milliseconds:
                safeMilliseconds,
        },
    );
}

/**
 * =========================================================
 * CHECK MEMBER IN VOICE
 * =========================================================
 */

function isMemberInVoice(
    member,
) {
    return Boolean(
        member
            ?.voice
            ?.channelId,
    );
}

/**
 * =========================================================
 * START SESSION
 * =========================================================
 */

export function startVoiceLevelSession(
    client,
    member,
) {
    if (
        !client ||
        !member ||
        member.user?.bot ||
        !isMemberInVoice(
            member,
        )
    ) {
        return;
    }

    const key =
        getSessionKey(
            member.guild.id,
            member.id,
        );

    /**
     * Session đã có rồi.
     */
    if (
        activeSessions.has(
            key,
        )
    ) {
        return;
    }

    const session = {
        member,

        lastCheckedAt:
            Date.now(),

        interval:
            null,
    };

    /**
     * =====================================================
     * TIMER
     * =====================================================
     */

    session.interval =
        setInterval(
            async () => {
                try {
                    await processVoiceSession(
                        client,
                        key,
                    );
                } catch (
                    error
                ) {
                    logger.error(
                        `[VOICE LEVEL] Timer error for ${key}:`,
                        error,
                    );
                }
            },
            VOICE_CHECK_INTERVAL_MS,
        );

    /**
     * Timer này không được giữ
     * Node process sống một mình.
     */

    session.interval
        ?.unref?.();

    activeSessions.set(
        key,
        session,
    );

    logger.debug(
        `[VOICE LEVEL] Started session for ${member.user.tag}`,
    );
}

/**
 * =========================================================
 * PROCESS ACTIVE SESSION
 * =========================================================
 */

async function processVoiceSession(
    client,
    sessionKey,
) {
    const session =
        activeSessions.get(
            sessionKey,
        );

    if (
        !session
    ) {
        return;
    }

    const member =
        session.member;

    /**
     * Member đã rời Voice nhưng
     * voiceStateUpdate chưa xử lý kịp.
     */

    if (
        !isMemberInVoice(
            member,
        )
    ) {
        await stopVoiceLevelSession(
            client,
            member,
        );

        return;
    }

    const now =
        Date.now();

    const elapsed =
        Math.max(
            0,
            now -
                session.lastCheckedAt,
        );

    if (
        elapsed <= 0
    ) {
        return;
    }

    /**
     * Update trước để tránh
     * tính trùng nếu DB chậm.
     */

    session.lastCheckedAt =
        now;

    await addVoiceDuration(
        client,
        member,
        elapsed,
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
        !client ||
        !member ||
        member.user?.bot
    ) {
        return;
    }

    const sessionKey =
        getSessionKey(
            member.guild.id,
            member.id,
        );

    const session =
        activeSessions.get(
            sessionKey,
        );

    if (
        !session
    ) {
        return;
    }

    /**
     * Xóa khỏi map trước.
     */

    activeSessions.delete(
        sessionKey,
    );

    if (
        session.interval
    ) {
        clearInterval(
            session.interval,
        );
    }

    /**
     * Tính phần thời gian từ
     * lần check cuối tới lúc rời.
     */

    const now =
        Date.now();

    const elapsed =
        Math.max(
            0,
            now -
                session.lastCheckedAt,
        );

    if (
        elapsed > 0
    ) {
        try {
            await addVoiceDuration(
                client,
                member,
                elapsed,
            );
        } catch (
            error
        ) {
            logger.error(
                `[VOICE LEVEL] Failed saving final duration for ${member.user.tag}:`,
                error,
            );
        }
    }

    logger.debug(
        `[VOICE LEVEL] Stopped session for ${member.user.tag}`,
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
    const safeDuration =
        Math.max(
            0,
            Number(
                duration,
            ) || 0,
        );

    if (
        safeDuration <= 0
    ) {
        return;
    }

    const guild =
        member.guild;

    /**
     * =====================================================
     * USER LOCK
     * =====================================================
     *
     * Tránh:
     *
     * timer
     * +
     * voiceStateUpdate
     *
     * cùng ghi DB.
     */

    const lockKey =
        `voice-level:${guild.id}:${member.id}`;

    await Mutex.runExclusive(
        lockKey,
        async () => {
            /**
             * =============================================
             * LEVEL CONFIG
             * =============================================
             */

            const levelingConfig =
                await getLevelingConfig(
                    client,
                    guild.id,
                );

            if (
                !levelingConfig
                    ?.enabled
            ) {
                return;
            }

            /**
             * =============================================
             * CURRENT LEVEL
             * =============================================
             *
             * Nếu đã Lv.9.999 thì
             * không cần tiếp tục tích giờ.
             */

            const currentData =
                await getUserLevelData(
                    client,
                    guild.id,
                    member.id,
                );

            if (
                Number(
                    currentData.level,
                ) >=
                LEVELING_MAX_LEVEL
            ) {
                await saveStoredVoiceTime(
                    client,
                    guild.id,
                    member.id,
                    0,
                );

                return;
            }

            /**
             * =============================================
             * ACCUMULATED TIME
             * =============================================
             */

            let accumulated =
                await getStoredVoiceTime(
                    client,
                    guild.id,
                    member.id,
                );

            accumulated +=
                safeDuration;

            /**
             * =============================================
             * LEVELS EARNED
             * =============================================
             */

            const levelsEarned =
                Math.floor(
                    accumulated /
                        VOICE_LEVEL_INTERVAL_MS,
                );

            const remainder =
                accumulated %
                VOICE_LEVEL_INTERVAL_MS;

            /**
             * Luôn lưu phần dư.
             */

            await saveStoredVoiceTime(
                client,
                guild.id,
                member.id,
                remainder,
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
        },
    );
}

/**
 * =========================================================
 * AWARD VOICE LEVELS
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
        Math.max(
            0,
            Number(
                levelData.level,
            ) || 0,
        );

    /**
     * =====================================================
     * ALREADY MAX LEVEL
     * =====================================================
     */

    if (
        oldLevel >=
        LEVELING_MAX_LEVEL
    ) {
        await saveStoredVoiceTime(
            client,
            guild.id,
            member.id,
            0,
        );

        return;
    }

    /**
     * =====================================================
     * NEW LEVEL
     * =====================================================
     */

    const safeLevelsEarned =
        Math.max(
            0,
            Math.floor(
                Number(
                    levelsEarned,
                ) || 0,
            ),
        );

    if (
        safeLevelsEarned <= 0
    ) {
        return;
    }

    const newLevel =
        Math.min(
            LEVELING_MAX_LEVEL,
            oldLevel +
                safeLevelsEarned,
        );

    if (
        newLevel <=
        oldLevel
    ) {
        return;
    }

    /**
     * Voice tăng Level trực tiếp.
     *
     * XP chat hiện tại vẫn giữ nguyên.
     *
     * Ví dụ:
     *
     * Lv.1998 + 50 XP
     *
     * Voice đủ 30 phút
     *
     * -> Lv.1999 + 50 XP
     */

    levelData.level =
        newLevel;

    const savedData =
        await saveUserLevelData(
            client,
            guild.id,
            member.id,
            levelData,
        );

    const finalLevel =
        Number(
            savedData
                ?.level ??
            newLevel,
        ) || newLevel;

    /**
     * =====================================================
     * ROLE SYNC
     * =====================================================
     *
     * Ví dụ:
     *
     * Lv.999
     * -> Chân Tiên
     *
     * Lv.1999
     * -> gỡ Chân Tiên
     * -> Đại La Kim Tiên
     *
     * Lv.3999
     * -> Tiên Vương
     *
     * Lv.6999
     * -> Tiên Đế
     *
     * Lv.9999
     * -> Đạo Tổ
     */

    try {
        await syncHighestLevelRole(
            member,
            finalLevel,
        );
    } catch (
        roleError
    ) {
        logger.warn(
            `[VOICE LEVEL] Failed syncing role for ${member.user.tag}:`,
            roleError,
        );
    }

    /**
     * =====================================================
     * ANNOUNCEMENT
     * =====================================================
     *
     * Không vượt milestone:
     *
     * -> TU VI TINH TIẾN
     *
     * Đạt / vượt:
     *
     * 999
     * -> Phi Thăng
     *
     * 1999 / 3999 / 6999
     * -> Tiên Lộ
     *
     * 9999
     * -> Cực Cảnh
     */

    try {
        await sendLevelChangeAnnouncements({
            guild,

            member,

            oldLevel,

            newLevel:
                finalLevel,

            source:
                'voice',
        });
    } catch (
        announcementError
    ) {
        logger.warn(
            `[VOICE LEVEL] Failed sending announcement for ${member.user.tag}:`,
            announcementError,
        );
    }

    logger.info(
        `[VOICE LEVEL] ${member.user.tag}: Lv.${formatLevelNumber(oldLevel)} -> Lv.${formatLevelNumber(finalLevel)}`,
    );

    /**
     * =====================================================
     * MAX LEVEL
     * =====================================================
     */

    if (
        finalLevel >=
        LEVELING_MAX_LEVEL
    ) {
        await saveStoredVoiceTime(
            client,
            guild.id,
            member.id,
            0,
        );

        logger.info(
            `[VOICE LEVEL] ${member.user.tag} reached MAX Lv.${formatLevelNumber(LEVELING_MAX_LEVEL)}.`,
        );
    }
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
     * =====================================================
     * SAME CHANNEL
     * =====================================================
     *
     * mute
     * unmute
     * deaf
     * undeaf
     *
     * không reset timer.
     */

    if (
        oldChannelId ===
        newChannelId
    ) {
        return;
    }

    /**
     * =====================================================
     * JOIN
     * =====================================================
     */

    if (
        !oldChannelId &&
        newChannelId
    ) {
        startVoiceLevelSession(
            client,
            member,
        );

        return;
    }

    /**
     * =====================================================
     * LEAVE
     * =====================================================
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
     * =====================================================
     * MOVE CHANNEL
     * =====================================================
     *
     * Voice A -> Voice B
     *
     * Timer không reset.
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

        const session =
            activeSessions.get(
                key,
            );

        if (
            session
        ) {
            session.member =
                member;

            return;
        }

        /**
         * Bot vừa restart hoặc
         * session bị thiếu.
         */

        startVoiceLevelSession(
            client,
            member,
        );
    }
}

/**
 * =========================================================
 * RESTORE ACTIVE VOICE SESSIONS
 * =========================================================
 *
 * Chạy từ ready.js.
 *
 * Thời gian bot OFF:
 *
 * KHÔNG được tính.
 *
 * Phần thời gian đã lưu trước restart:
 *
 * VẪN được giữ.
 */

export function restoreVoiceLevelSessions(
    client,
) {
    let restored =
        0;

    for (
        const guild
        of client.guilds.cache
            .values()
    ) {
        for (
            const member
            of guild.members.cache
                .values()
        ) {
            if (
                member.user.bot ||
                !member.voice
                    ?.channelId
            ) {
                continue;
            }

            startVoiceLevelSession(
                client,
                member,
            );

            restored +=
                1;
        }
    }

    logger.info(
        `[VOICE LEVEL] Restored ${restored} active voice session(s).`,
    );

    return restored;
}

/**
 * =========================================================
 * STOP ALL SESSIONS
 * =========================================================
 */

export async function stopAllVoiceLevelSessions(
    client,
) {
    const sessions =
        [
            ...activeSessions
                .values(),
        ];

    for (
        const session
        of sessions
    ) {
        try {
            await stopVoiceLevelSession(
                client,
                session.member,
            );
        } catch (
            error
        ) {
            logger.warn(
                '[VOICE LEVEL] Failed stopping voice session:',
                error,
            );
        }
    }
}
