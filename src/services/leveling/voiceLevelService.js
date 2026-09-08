import {
    VOICE_LEVEL_INTERVAL_MS,
    LEVELING_MAX_LEVEL,
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
    sendLevelAnnouncement,
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
 * - Khi đạt milestone:
 *      Lv.1
 *      Lv.10
 *      Lv.20
 *      Lv.40
 *      Lv.70
 *      Lv.100
 *      Lv.200
 *      Lv.300
 *      Lv.500
 *      Lv.999
 *
 *   -> levelAnnouncementService tự chọn
 *      thông báo Phá Cảnh · Phi Thăng.
 *
 * - Role luôn được đồng bộ để chỉ giữ
 *   role cảnh giới cao nhất.
 * =========================================================
 */

/**
 * Kiểm tra mỗi 30 giây.
 *
 * Không phải 30 giây = XP.
 * Đây chỉ là khoảng thời gian bot kiểm tra
 * xem người dùng đã đủ 30 phút hay chưa.
 */
const VOICE_CHECK_INTERVAL_MS =
    30 * 1000;

/**
 * guildId:userId
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
 * READ ACCUMULATED TIME
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
 * SAVE ACCUMULATED TIME
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
 * CHECK WHETHER MEMBER IS STILL IN VOICE
 * =========================================================
 */

function isMemberInVoice(
    member,
) {
    return Boolean(
        member?.voice?.channelId,
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
     * Session đã tồn tại.
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
     *
     * Cứ 30 giây bot ghi nhận thời gian thực tế
     * đã trôi qua.
     *
     * Khi tổng tích lũy >= 30 phút
     * -> cấp level ngay.
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
                        `Voice level timer error for ${key}:`,
                        error,
                    );
                }
            },
            VOICE_CHECK_INTERVAL_MS,
        );

    /**
     * Không giữ Node process sống
     * chỉ vì timer này.
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
     * Người dùng đã rời voice nhưng event
     * chưa xử lý kịp.
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
     * Cập nhật trước để tránh tính trùng
     * nếu DB/service mất thời gian xử lý.
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
     * Gỡ session khỏi Map trước
     * để timer không chạy thêm.
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
     * Tính phần thời gian từ lần check cuối
     * đến lúc rời voice.
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
                `Failed saving final voice duration for ${member.user.tag}:`,
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
    if (
        !duration ||
        duration <= 0
    ) {
        return;
    }

    const guild =
        member.guild;

    /**
     * Khóa theo từng user.
     *
     * Tránh timer và voiceStateUpdate
     * cùng ghi DB một lúc.
     */

    const lockKey =
        `voice-level:${guild.id}:${member.id}`;

    await Mutex.runExclusive(
        lockKey,
        async () => {
            const levelingConfig =
                await getLevelingConfig(
                    client,
                    guild.id,
                );

            /**
             * Level system bị tắt:
             * không tính Voice.
             */
            if (
                !levelingConfig
                    ?.enabled
            ) {
                return;
            }

            let accumulated =
                await getStoredVoiceTime(
                    client,
                    guild.id,
                    member.id,
                );

            accumulated +=
                duration;

            /**
             * =================================================
             * CALCULATE LEVELS
             * =================================================
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
             * Luôn lưu phần thời gian dư.
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
        Number(
            levelData.level,
        ) || 0;

    /**
     * Đã max level.
     */
    if (
        oldLevel >=
        LEVELING_MAX_LEVEL
    ) {
        /**
         * Không cần giữ phút Voice dư nữa
         * khi đã Lv.999.
         */
        await saveStoredVoiceTime(
            client,
            guild.id,
            member.id,
            0,
        );

        return;
    }

    const newLevel =
        Math.min(
            LEVELING_MAX_LEVEL,
            oldLevel +
                levelsEarned,
        );

    if (
        newLevel <=
        oldLevel
    ) {
        return;
    }

    levelData.level =
        newLevel;

    /**
     * Voice tăng LEVEL trực tiếp.
     *
     * XP chat hiện tại vẫn được giữ nguyên.
     * Ví dụ:
     *
     * Lv.9 + 50 XP
     * Voice đủ 30 phút
     * -> Lv.10 + 50 XP
     */

    await saveUserLevelData(
        client,
        guild.id,
        member.id,
        levelData,
    );

    /**
     * =====================================================
     * ROLE
     * =====================================================
     *
     * syncHighestLevelRole sẽ:
     *
     * - tìm milestone cao nhất <= level
     * - gắn role đó
     * - xóa tất cả role milestone thấp hơn
     */

    try {
        await syncHighestLevelRole(
            member,
            newLevel,
        );
    } catch (
        roleError
    ) {
        logger.warn(
            `[VOICE LEVEL] Failed syncing level role for ${member.user.tag}:`,
            roleError,
        );
    }

    /**
     * =====================================================
     * ANNOUNCEMENT
     * =====================================================
     *
     * source: voice
     *
     * Nếu level mới là milestone:
     * -> Phá Cảnh · Phi Thăng
     *
     * Nếu không:
     * -> TU VI TINH TIẾN
     */

    try {
        await sendLevelAnnouncement({
            guild,

            member,

            level:
                newLevel,

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
        `[VOICE LEVEL] ${member.user.tag}: Lv.${oldLevel} -> Lv.${newLevel}`,
    );

    /**
     * Lv.999 = cap.
     */
    if (
        newLevel >=
        LEVELING_MAX_LEVEL
    ) {
        await saveStoredVoiceTime(
            client,
            guild.id,
            member.id,
            0,
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
     * mute / unmute / deaf / undeaf
     * không ảnh hưởng timer.
     */

    if (
        oldChannelId ===
        newChannelId
    ) {
        return;
    }

    /**
     * =====================================================
     * JOIN VOICE
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
     * LEAVE VOICE
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
     * MOVE VOICE CHANNEL
     * =====================================================
     *
     * Ví dụ:
     *
     * Voice A -> Voice B
     *
     * Timer KHÔNG reset.
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

        /**
         * Session đang tồn tại:
         * chỉ cập nhật member reference.
         */
        if (
            session
        ) {
            session.member =
                member;

            return;
        }

        /**
         * Trường hợp bot vừa restart
         * hoặc session bị thiếu.
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
 * Nếu bot restart trong lúc người dùng
 * đang ở Voice:
 *
 * - thời gian đã SAVE trong DB vẫn còn
 * - session mới bắt đầu tính tiếp từ lúc
 *   bot Ready
 *
 * Khoảng thời gian bot OFF không được tính.
 * =========================================================
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
 *
 * Có thể dùng khi bot shutdown/reload.
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
