import {
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    LEVEL_ANNOUNCEMENT_CHANNEL_ID,
    LEVEL_EMOJIS,
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
            ].join('\n'),
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
            ].join('\n'),
        );
}

/**
 * =========================================================
 * PHI THANG
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

    if (!milestone) {
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
                ].join('\n'),
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
     * Test có thể ép loại thông báo.
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
     * milestone luôn ưu tiên.
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

    if (
        source === 'voice'
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
 * SEND
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

            return false;
        }

        const botMember =
            guild.members.me;

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
    } catch (error) {
        logger.error(
            'Failed to send level announcement:',
            error,
        );

        return false;
    }
}
