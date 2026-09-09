import {
    EmbedBuilder,
    PermissionFlagsBits,
    AttachmentBuilder,
} from 'discord.js';

import fs from 'node:fs/promises';
import path from 'node:path';

import {
    LEVEL_ANNOUNCEMENT_CHANNEL_ID,
    LEVEL_EMOJIS,
    LEVEL_MILESTONES,
    formatLevelNumber,
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
    0xF5A9C6;

/**
 * =========================================================
 * IMAGE HELPERS
 * =========================================================
 */

async function createLevelImageAttachment(
    image,
) {
    if (
        !image ||
        !image.path ||
        !image.name
    ) {
        return null;
    }

    const imagePath =
        path.resolve(
            process.cwd(),
            image.path,
        );

    try {
        await fs.access(
            imagePath,
        );
    } catch {
        logger.warn(
            `[LEVEL] Image not found: ${imagePath}`,
        );

        return null;
    }

    return new AttachmentBuilder(
        imagePath,
        {
            name:
                image.name,
        },
    );
}

/**
 * =========================================================
 * NORMAL LEVEL
 * =========================================================
 */

export function buildNormalLevelEmbed(
    member,
    level,
) {
    const displayLevel =
        formatLevelNumber(
            level,
        );

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

                `${LEVEL_EMOJIS.line} Cảnh giới hiện tại: **Lv.${displayLevel}**`,

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
    const displayLevel =
        formatLevelNumber(
            level,
        );

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
                `**Lv.${displayLevel}**`,

                '',

                'Tiên lộ mênh mang, từng bước tu hành — ắt có ngày chạm tới đại đạo.',
            ].join(
                '\n',
            ),
        );
}

/**
 * =========================================================
 * MILESTONE TITLE
 * =========================================================
 */

function getMilestoneTitle(
    milestone,
) {
    switch (
        milestone.announcementType
    ) {
        case 'tien_lo':
            return (
                `${LEVEL_EMOJIS.left} ` +
                '𝓟𝓱𝓪́ 𝓒𝓪̉𝓷𝓱 · 𝓣𝓲𝓮̂𝓷 𝓛𝓸̣̂ ' +
                `${LEVEL_EMOJIS.right}`
            );

        case 'cuc_canh':
            return (
                `${LEVEL_EMOJIS.left} ` +
                '𝓟𝓱𝓪́ 𝓒𝓪̉𝓷𝓱 · 𝓒𝓾̛̣𝓬 𝓒𝓪̉𝓷𝓱 ' +
                `${LEVEL_EMOJIS.right}`
            );

        case 'phi_thang':
        default:
            return (
                `${LEVEL_EMOJIS.left} ` +
                '𝓟𝓱𝓪́ 𝓒𝓪̉𝓷𝓱 · 𝓟𝓱𝓲 𝓣𝓱𝓪̆𝓷𝓰 ' +
                `${LEVEL_EMOJIS.right}`
            );
    }
}

/**
 * =========================================================
 * OLD MILESTONE STYLE
 * =========================================================
 *
 * Lv.1 -> Lv.999
 */

function buildClassicMilestoneDescription(
    member,
    level,
    milestone,
) {
    const displayLevel =
        formatLevelNumber(
            level,
        );

    return [
        `${LEVEL_EMOJIS.title} **${milestone.heading}**`,

        '',

        `${LEVEL_EMOJIS.line} ${milestone.intro}`,

        `${member} ${milestone.body}`,

        '',

        `${LEVEL_EMOJIS.line} Cảnh giới hiện tại:`,
        `**${milestone.realm}**`,
        `**Lv.${displayLevel}**`,

        '',

        milestone.ending,
    ].join(
        '\n',
    );
}

/**
 * =========================================================
 * ADVANCED IMMORTAL STYLE
 * =========================================================
 *
 * Lv.1999
 * Lv.3999
 * Lv.6999
 * Lv.9999
 */

function buildAdvancedMilestoneDescription(
    member,
    level,
    milestone,
) {
    const displayLevel =
        formatLevelNumber(
            level,
        );

    return [
        `${LEVEL_EMOJIS.immortalTitle}${LEVEL_EMOJIS.title} **${milestone.heading}**`,

        '',

        `${LEVEL_EMOJIS.line} ${milestone.intro}`,

        `${member} ${milestone.body} ${LEVEL_EMOJIS.line}`,

        '',

        `${LEVEL_EMOJIS.line} Cảnh giới hiện tại:`,

        `${LEVEL_EMOJIS.realm} **${milestone.realm}**`,

        `${LEVEL_EMOJIS.realm} **Lv.${displayLevel}**`,

        '',

        `${LEVEL_EMOJIS.ending} ${milestone.ending} ${LEVEL_EMOJIS.ending}`,
    ].join(
        '\n',
    );
}

/**
 * =========================================================
 * BUILD MILESTONE EMBED
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

    const description =
        milestone.advancedStyle
            ? buildAdvancedMilestoneDescription(
                member,
                level,
                milestone,
            )
            : buildClassicMilestoneDescription(
                member,
                level,
                milestone,
            );

    const embed =
        new EmbedBuilder()
            .setColor(
                LEVEL_EMBED_COLOR,
            )
            .setTitle(
                getMilestoneTitle(
                    milestone,
                ),
            )
            .setDescription(
                description,
            );

    /**
     * Attachment URL phải dùng đúng filename.
     *
     * PNG:
     * lv1999.png
     * lv3999.png
     * lv6999.png
     *
     * GIF:
     * lv9999.gif
     */

    if (
        milestone.image?.name
    ) {
        embed.setImage(
            `attachment://${milestone.image.name}`,
        );
    }

    return embed;
}

/**
 * =========================================================
 * GET CROSSED MILESTONES
 * =========================================================
 */

export function getCrossedMilestones(
    oldLevel,
    newLevel,
) {
    const safeOldLevel =
        Math.max(
            0,
            Math.floor(
                Number(
                    oldLevel,
                ) || 0,
            ),
        );

    const safeNewLevel =
        Math.max(
            0,
            Math.floor(
                Number(
                    newLevel,
                ) || 0,
            ),
        );

    if (
        safeNewLevel <=
        safeOldLevel
    ) {
        return [];
    }

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
 * BUILD ANNOUNCEMENT
 * =========================================================
 */

export function buildLevelAnnouncementEmbed({
    member,
    level,
    source = 'chat',
    forceType = null,
}) {
    /**
     * Test bất kỳ milestone nào.
     */

    if (
        forceType ===
        'milestone' ||
        forceType ===
        'phi_thang' ||
        forceType ===
        'tien_lo' ||
        forceType ===
        'cuc_canh'
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
     * Test Phá Cảnh thường.
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
     * Milestone thật luôn ưu tiên.
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
     * Chat/Admin thường.
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
            `[LEVEL] Announcement channel ${LEVEL_ANNOUNCEMENT_CHANNEL_ID} not found in guild ${guild.id}`,
        );

        return null;
    }

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
        ) ||
        !permissions.has(
            PermissionFlagsBits.AttachFiles,
        )
    ) {
        logger.warn(
            `[LEVEL] Missing SendMessages/EmbedLinks/AttachFiles permission in channel ${channel.id}`,
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

        const milestone =
            getExactMilestone(
                level,
            );

        const files = [];

        /**
         * Chỉ milestone có ảnh mới attach.
         */

        if (
            milestone?.image
        ) {
            const attachment =
                await createLevelImageAttachment(
                    milestone.image,
                );

            if (
                attachment
            ) {
                files.push(
                    attachment,
                );
            } else {
                /**
                 * Nếu file ảnh bị thiếu,
                 * vẫn gửi embed nhưng bỏ image
                 * để Discord không báo
                 * Invalid Form Body.
                 */

                embed.setImage(
                    null,
                );

                logger.warn(
                    `[LEVEL] Milestone image unavailable for Lv.${level}`,
                );
            }
        }

        await channel.send({
            embeds: [
                embed,
            ],

            files,
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
                Math.floor(
                    Number(
                        oldLevel,
                    ) || 0,
                ),
            );

        const safeNewLevel =
            Math.max(
                0,
                Math.floor(
                    Number(
                        newLevel,
                    ) || 0,
                ),
            );

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
         * Không vượt cảnh giới.
         *
         * -> gửi level cuối.
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
         * Có vượt cảnh giới.
         *
         * Ví dụ:
         *
         * 998 -> 2000
         *
         * gửi:
         * Lv.999
         * Lv.1.999
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
