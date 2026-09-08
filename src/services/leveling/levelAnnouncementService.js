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
 * Ví dụ:
 *
 * Lv.9 -> Lv.21
 *
 * trả về:
 *
 * Lv.10
 * Lv.20
 *
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

    if (
        safeNewLevel <=
        safeOldLevel
    ) {
        return [];
    }

    return LEVEL_MILESTONES
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
 * BUILD BY TYPE
 * =========================================================
 */

export function buildLevelAnnouncementEmbed({
    member,
    level,
    source = 'chat',
    forceType = null,
}) {
    /**
     * TEST:
     * ép giao diện Phi Thăng.
     *
     * Nếu level không phải milestone
     * thì fallback sang thông báo thường.
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
     * TEST:
     * ép giao diện Phá Cảnh thường.
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
     * Thông báo thật:
     * nếu đúng milestone thì
     * Phi Thăng luôn được ưu tiên.
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
     * Voice thường.
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
     * Chat / Admin thường.
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

    if (
        !channel ||
        !channel.isTextBased()
    ) {
        logger.warn(
            `Level announcement channel ${LEVEL_ANNOUNCEMENT_CHANNEL_ID} not found in guild ${guild.id}`,
        );

        return null;
    }

    const botMember =
        guild.members.me;

    if (
        !botMember
    ) {
        return null;
    }

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
            `Missing permission to send level announcement in ${channel.id}`,
        );

        return null;
    }

    return channel;
}

/**
 * =========================================================
 * SEND SINGLE ANNOUNCEMENT
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
            'Failed to send level announcement:',
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
 * Dùng khi level tăng nhiều cấp cùng lúc.
 *
 * Ví dụ:
 *
 * Lv.9 -> Lv.21
 *
 * -> Phi Thăng Lv.10
 * -> Phi Thăng Lv.20
 *
 * Không gửi thêm Lv.21 thường để tránh spam.
 *
 * Nếu không vượt milestone:
 *
 * Lv.8 -> Lv.9
 *
 * -> gửi Lv.9 thường.
 *
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
            Number(
                oldLevel,
            ) || 0;

        const safeNewLevel =
            Number(
                newLevel,
            ) || 0;

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

        const crossedMilestones =
            getCrossedMilestones(
                safeOldLevel,
                safeNewLevel,
            );

        /**
         * =================================================
         * NO MILESTONE
         * =================================================
         */

        if (
            crossedMilestones.length ===
            0
        ) {
            const sent =
                await sendLevelAnnouncement({
                    guild,
                    member,

                    level:
                        safeNewLevel,

                    source,
                });

            return {
                sent:
                    sent
                        ? 1
                        : 0,

                milestones:
                    [],
            };
        }

        /**
         * =================================================
         * CROSSED MILESTONES
         * =================================================
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
            'Failed sending level change announcements:',
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
