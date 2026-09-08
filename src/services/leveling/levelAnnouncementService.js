import {
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    LEVEL_ANNOUNCEMENT_CHANNEL_ID,
    LEVEL_EMOJIS,
    LEVEL_MILESTONES,
    getExactMilestone,
} from '../../config/leveling/levelingSystem.js';

import {
    logger,
} from '../../utils/logger.js';

/**
 * =========================================================
 * COLOR
 * =========================================================
 */

const LEVEL_EMBED_COLOR =
    0xffffff;

/**
 * =========================================================
 * NORMAL LEVEL
 * =========================================================
 */

export function buildNormalLevelEmbed(
    member,
    level,
) {
    return new EmbedBuilder()
        .setColor(
            LEVEL_EMBED_COLOR,
        )
        .setTitle(
            `${LEVEL_EMOJIS.left} 𝓟𝓱𝓪́ 𝓒𝓪̉𝓷𝓱 ${LEVEL_EMOJIS.right}`,
        )
        .setDescription(
            [
                `${LEVEL_EMOJIS.title} **CẢNH GIỚI ĐỘT PHÁ**`,

                '',

                `${LEVEL_EMOJIS.line} *Linh khí hội tụ, đạo vận tương tùy.*`,

                `${member} đã phá tan bình cảnh, tu vi tiến thêm một tầng!`,

                '',

                `${LEVEL_EMOJIS.line} Cảnh giới hiện tại: **Lv.${level}**`,

                '',

                'Tiên lộ mênh mang, đạo hữu hãy tiếp tục tiến bước...',
            ].join(
                '\n',
            ),
        );
}

/**
 * =========================================================
 * VOICE LEVEL
 * =========================================================
 */

export function buildVoiceLevelEmbed(
    member,
    level,
) {
    return new EmbedBuilder()
        .setColor(
            LEVEL_EMBED_COLOR,
        )
        .setTitle(
            `${LEVEL_EMOJIS.left} 𝓟𝓱𝓪́ 𝓒𝓪̉𝓷𝓱 ${LEVEL_EMOJIS.right}`,
        )
        .setDescription(
            [
                `${LEVEL_EMOJIS.title} **TU VI TINH TIẾN**`,

                '',

                `${LEVEL_EMOJIS.line} *Linh khí tích tụ, tu vi lại tăng.*`,

                `${member} đã tích đủ thời gian tu luyện trong Voice, đạo hạnh tiến thêm một tầng!`,

                '',

                `${LEVEL_EMOJIS.line} Cảnh giới hiện tại:`,
                `**Lv.${level}**`,

                '',

                'Tiên lộ mênh mang, từng bước tu hành — ắt có ngày chạm tới đại đạo.',
            ].join(
                '\n',
            ),
        );
}

/**
 * =========================================================
 * PHÁ CẢNH · PHI THĂNG
 * =========================================================
 */

export function buildMilestoneLevelEmbed(
    member,
    level,
) {
    const milestone =
        getExactMilestone(
            level,
        );

    if (
        !milestone
    ) {
        return null;
    }

    const embed =
        new EmbedBuilder()
            .setColor(
                LEVEL_EMBED_COLOR,
            )
            .setTitle(
                `${LEVEL_EMOJIS.left} 𝓟𝓱𝓪́ 𝓒𝓪̉𝓷𝓱 · 𝓟𝓱𝓲 𝓣𝓱𝓪̆𝓷𝓰 ${LEVEL_EMOJIS.right}`,
            )
            .setDescription(
                [
                    `${LEVEL_EMOJIS.title} **${milestone.heading}**`,

                    '',

                    `${LEVEL_EMOJIS.line} ${milestone.intro}`,

                    `${member} ${milestone.body}`,

                    '',

                    `${LEVEL_EMOJIS.line} Cảnh giới hiện tại:`,
                    `**${milestone.realm}**`,
                    `**Lv.${level}**`,

                    '',

                    milestone.ending,
                ].join(
                    '\n',
                ),
            );

    /**
     * Chỉ Phi Thăng mới có ảnh.
     *
     * 1 / 10 / 20 / 40 / 70
     * 100 / 200 / 300
     * 500
     * 999
     *
     * Ảnh được lấy từ levelingSystem.js.
     */

    if (
        milestone.image
    ) {
        embed.setImage(
            milestone.image,
        );
    }

    return embed;
}

/**
 * =========================================================
 * GET CROSSED MILESTONES
 * =========================================================
 *
 * Tìm tất cả cảnh giới mà user đã vượt qua
 * khi tăng nhiều level cùng một lúc.
 *
 * Ví dụ:
 *
 * Lv.9 -> Lv.21
 *
 * kết quả:
 *
 * Lv.10 Trúc Cơ
 * Lv.20 Kim Đan
 *
 * ---------------------------------------------------------
 *
 * LEVEL_MILESTONES là OBJECT:
 *
 * {
 *   1: {...},
 *   10: {...},
 *   20: {...},
 *   ...
 * }
 *
 * Vì vậy KHÔNG được dùng:
 *
 * LEVEL_MILESTONES.filter(...)
 *
 * mà phải chuyển Object -> Array trước.
 * =========================================================
 */

export function getCrossedMilestones(
    oldLevel,
    newLevel,
) {
    const safeOldLevel =
        Math.max(
            0,
            Number(
                oldLevel,
            ) || 0,
        );

    const safeNewLevel =
        Math.max(
            0,
            Number(
                newLevel,
            ) || 0,
        );

    /**
     * Không tăng level.
     */

    if (
        safeNewLevel <=
        safeOldLevel
    ) {
        return [];
    }

    /**
     * Chuyển:
     *
     * {
     *   10: {
     *      realm: 'Trúc Cơ Kỳ',
     *      ...
     *   }
     * }
     *
     * thành:
     *
     * [
     *   {
     *      level: 10,
     *      realm: 'Trúc Cơ Kỳ',
     *      ...
     *   }
     * ]
     */

    return Object.entries(
        LEVEL_MILESTONES,
    )
        .map(
            ([
                level,
                milestone,
            ]) => ({
                level:
                    Number(
                        level,
                    ),

                ...milestone,
            }),
        )
        .filter(
            milestone =>
                milestone.level >
                    safeOldLevel &&
                milestone.level <=
                    safeNewLevel,
        )
        .sort(
            (
                a,
                b,
            ) =>
                a.level -
                b.level,
        );
}

/**
 * =========================================================
 * BUILD ANNOUNCEMENT BY TYPE
 * =========================================================
 */

export function buildLevelAnnouncementEmbed({
    member,
    level,
    source = 'chat',
    forceType = null,
}) {
    /**
     * =====================================================
     * TEST PHI THĂNG
     * =====================================================
     *
     * /leveltest dùng forceType này.
     *
     * Nếu level đúng milestone:
     * -> Phi Thăng.
     *
     * Nếu không:
     * -> fallback Phá Cảnh thường.
     */

    if (
        forceType ===
        'phi_thang'
    ) {
        return (
            buildMilestoneLevelEmbed(
                member,
                level,
            ) ||
            buildNormalLevelEmbed(
                member,
                level,
            )
        );
    }

    /**
     * =====================================================
     * TEST PHÁ CẢNH THƯỜNG
     * =====================================================
     */

    if (
        forceType ===
        'pha_canh'
    ) {
        return buildNormalLevelEmbed(
            member,
            level,
        );
    }

    /**
     * =====================================================
     * THÔNG BÁO THẬT
     * =====================================================
     *
     * Nếu level chính xác là milestone
     * thì Phi Thăng luôn được ưu tiên.
     */

    const milestoneEmbed =
        buildMilestoneLevelEmbed(
            member,
            level,
        );

    if (
        milestoneEmbed
    ) {
        return milestoneEmbed;
    }

    /**
     * =====================================================
     * VOICE THƯỜNG
     * =====================================================
     */

    if (
        source ===
        'voice'
    ) {
        return buildVoiceLevelEmbed(
            member,
            level,
        );
    }

    /**
     * =====================================================
     * CHAT / ADMIN THƯỜNG
     * =====================================================
     */

    return buildNormalLevelEmbed(
        member,
        level,
    );
}

/**
 * =========================================================
 * GET ANNOUNCEMENT CHANNEL
 * =========================================================
 */

async function getAnnouncementChannel(
    guild,
) {
    const channel =
        guild.channels.cache.get(
            LEVEL_ANNOUNCEMENT_CHANNEL_ID,
        ) ||
        await guild.channels
            .fetch(
                LEVEL_ANNOUNCEMENT_CHANNEL_ID,
            )
            .catch(
                () => null,
            );

    /**
     * Channel không tồn tại.
     */

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        logger.warn(
            `[LEVEL] Announcement channel ${LEVEL_ANNOUNCEMENT_CHANNEL_ID} not found in guild ${guild.id}`,
        );

        return null;
    }

    /**
     * Bot member.
     */

    const botMember =
        guild.members.me;

    if (
        !botMember
    ) {
        logger.warn(
            `[LEVEL] Bot member not available in guild ${guild.id}`,
        );

        return null;
    }

    /**
     * Kiểm tra permission.
     */

    const permissions =
        channel.permissionsFor(
            botMember,
        );

    if (
        !permissions ||
        !permissions.has(
            PermissionFlagsBits.SendMessages,
        ) ||
        !permissions.has(
            PermissionFlagsBits.EmbedLinks,
        )
    ) {
        logger.warn(
            `[LEVEL] Missing SendMessages/EmbedLinks permission in channel ${channel.id}`,
        );

        return null;
    }

    return channel;
}

/**
 * =========================================================
 * SEND SINGLE ANNOUNCEMENT
 * =========================================================
 *
 * Dùng khi chỉ cần gửi đúng 1 thông báo.
 *
 * Ví dụ:
 *
 * Chat lên Lv.35
 * Voice lên Lv.35
 * /levelset -> Lv.999
 * /leveltest
 * =========================================================
 */

export async function sendLevelAnnouncement({
    guild,
    member,
    level,
    source = 'chat',
    forceType = null,
}) {
    try {
        const channel =
            await getAnnouncementChannel(
                guild,
            );

        if (
            !channel
        ) {
            return false;
        }

        const embed =
            buildLevelAnnouncementEmbed({
                member,
                level,
                source,
                forceType,
            });

        await channel.send({
            embeds: [
                embed,
            ],
        });

        return true;
    } catch (
        error
    ) {
        logger.error(
            '[LEVEL] Failed to send level announcement:',
            error,
        );

        return false;
    }
}

/**
 * =========================================================
 * SEND LEVEL CHANGE ANNOUNCEMENTS
 * =========================================================
 *
 * Dùng cho trường hợp level tăng.
 *
 * ---------------------------------------------------------
 * CASE 1
 *
 * Lv.8 -> Lv.9
 *
 * Không vượt milestone.
 *
 * -> gửi thông báo thường Lv.9
 *
 * ---------------------------------------------------------
 * CASE 2
 *
 * Lv.9 -> Lv.10
 *
 * Vượt milestone Lv.10.
 *
 * -> Phi Thăng Lv.10
 *
 * ---------------------------------------------------------
 * CASE 3
 *
 * Lv.46 -> Lv.76
 *
 * Vượt milestone Lv.70.
 *
 * -> Phi Thăng Lv.70
 *
 * ---------------------------------------------------------
 * CASE 4
 *
 * Lv.9 -> Lv.76
 *
 * Vượt:
 *
 * Lv.10
 * Lv.20
 * Lv.40
 * Lv.70
 *
 * -> gửi 4 thông báo Phi Thăng.
 *
 * Không gửi thêm Lv.76 thường để tránh spam.
 * =========================================================
 */

export async function sendLevelChangeAnnouncements({
    guild,
    member,
    oldLevel,
    newLevel,
    source = 'admin',
}) {
    try {
        const safeOldLevel =
            Math.max(
                0,
                Number(
                    oldLevel,
                ) || 0,
            );

        const safeNewLevel =
            Math.max(
                0,
                Number(
                    newLevel,
                ) || 0,
            );

        /**
         * Không tăng level.
         */

        if (
            safeNewLevel <=
            safeOldLevel
        ) {
            return {
                sent:
                    0,

                milestones:
                    [],
            };
        }

        /**
         * Tìm milestone đã vượt.
         */

        const crossedMilestones =
            getCrossedMilestones(
                safeOldLevel,
                safeNewLevel,
            );

        /**
         * =================================================
         * KHÔNG VƯỢT MILESTONE
         * =================================================
         *
         * Gửi thông báo level cuối cùng.
         *
         * Chat/Admin:
         * -> CẢNH GIỚI ĐỘT PHÁ
         *
         * Voice:
         * -> TU VI TINH TIẾN
         */

        if (
            crossedMilestones.length ===
            0
        ) {
            const success =
                await sendLevelAnnouncement({
                    guild,
                    member,

                    level:
                        safeNewLevel,

                    source,
                });

            return {
                sent:
                    success
                        ? 1
                        : 0,

                milestones:
                    [],
            };
        }

        /**
         * =================================================
         * CÓ VƯỢT MILESTONE
         * =================================================
         *
         * Gửi từng Phi Thăng theo thứ tự tăng dần.
         */

        let sent =
            0;

        for (
            const milestone
            of crossedMilestones
        ) {
            const success =
                await sendLevelAnnouncement({
                    guild,
                    member,

                    level:
                        milestone.level,

                    source,
                });

            if (
                success
            ) {
                sent +=
                    1;
            }
        }

        return {
            sent,

            milestones:
                crossedMilestones,
        };
    } catch (
        error
    ) {
        logger.error(
            '[LEVEL] Failed sending level change announcements:',
            error,
        );

        return {
            sent:
                0,

            milestones:
                [],
        };
    }
}
