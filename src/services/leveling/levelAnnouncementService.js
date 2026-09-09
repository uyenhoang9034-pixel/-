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
 * LOCAL IMAGE DIRECTORY
 * =========================================================
 */

const LEVEL_IMAGE_DIR =
    path.resolve(
        process.cwd(),
        'assets',
        'level',
    );


/**
 * =========================================================
 * CREATE LOCAL IMAGE ATTACHMENT
 * =========================================================
 */

async function createLevelImageAttachment(
    imageName,
) {
    if (
        !imageName
    ) {
        return null;
    }


    const imagePath =
        path.join(
            LEVEL_IMAGE_DIR,
            imageName,
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
                imageName,
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
            `attachment://${milestone.image}`,
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


    if (
        forceType ===
        'pha_canh'
    ) {
        return buildNormalLevelEmbed(
            member,
            level,
        );
    }


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


    if (
        source ===
        'voice'
    ) {
        return buildVoiceLevelEmbed(
            member,
            level,
        );
    }


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
                logger.warn(
                    `[LEVEL] Cannot send milestone image for Lv.${level}: ${milestone.image}`,
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
