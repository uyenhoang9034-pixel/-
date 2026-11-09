import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { logger } from '../utils/logger.js';
import { hasRoleTier } from '../config/commands/roleAccess.js';

export const SETNICK_CONFIG = {
    channelId: '1541364885789745213',
    managementRoleId: '1545295139390619768',
    panelImageUrl: 'https://cdn.phototourl.com/member/2026-11-03-83e89905-920b-4692-8d3f-94ee9e1bb22b.png',
    prefix: '⋆˚࿔ ',
    suffix: ' ♡',
    maxInputLength: 20,
    maxTotalLength: 32,
    cooldownMs: 2 * 24 * 60 * 60 * 1000, // Giới hạn 1 lần / 2 ngày (48 giờ)
};

export const SETNICK_EMOJIS = {
    titleLeft: '<a:trangtrig2:1546040703375904801>',
    titleRight: '<a:trangtrig3:1546040818261954610>',
    heart: '<a:heartg1:1545307544808071258>',
    notice: '<a:bang2:1546891483250954290>',
};

let cachedPanelMessageId = null;
let isRefreshing = false;
let pendingRefresh = false;

// Bộ nhớ đệm tạm thời cho Cooldown đổi tên
const setnickCooldownCache = new Map();

/**
 * Kiểm tra xem thành viên có đang bị giới hạn thời gian đổi biệt danh (1 lần / 2 ngày) không.
 * Miễn trừ cho Admin và vai trò Quản lý.
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} userId
 * @param {import('discord.js').GuildMember|null} member
 * @returns {Promise<{ isOnCooldown: boolean, remainingMs: number, nextTimestamp: number, message: string }>}
 */
export async function checkSetnickCooldown(client, guildId, userId, member = null) {
    try {
        // Kiểm tra quyền miễn trừ: Hỗ trợ / Quản trị viên
        if (member && hasRoleTier(member, 'STAFF_TICKET', member.guild)) {
            return { isOnCooldown: false, remainingMs: 0, nextTimestamp: 0, message: '' };
        }

        const cacheKey = `${guildId}:${userId}`;
        const dbKey = `setnick:cooldown:${guildId}:${userId}`;

        let lastTime = setnickCooldownCache.get(cacheKey);

        if (!lastTime && client?.db?.get) {
            lastTime = await client.db.get(dbKey, null).catch(() => null);
            if (lastTime) {
                setnickCooldownCache.set(cacheKey, Number(lastTime));
            }
        }

        if (!lastTime) {
            return { isOnCooldown: false, remainingMs: 0, nextTimestamp: 0, message: '' };
        }

        const elapsed = Date.now() - Number(lastTime);
        if (elapsed < SETNICK_CONFIG.cooldownMs) {
            const remainingMs = SETNICK_CONFIG.cooldownMs - elapsed;
            const nextTimestamp = Math.floor((Date.now() + remainingMs) / 1000);

            const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
            let relativeText;
            if (remainingHours <= 1) {
                const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
                relativeText = `khoảng ${remainingMinutes} phút nữa`;
            } else {
                relativeText = `khoảng ${remainingHours} giờ nữa`;
            }

            const message = `${SETNICK_EMOJIS.notice} Bạn đã đạt đến giới hạn đổi biệt danh. Xin vui lòng thử lại vào <t:${nextTimestamp}:f> (${relativeText})!`;

            return {
                isOnCooldown: true,
                remainingMs,
                nextTimestamp,
                message,
            };
        }

        return { isOnCooldown: false, remainingMs: 0, nextTimestamp: 0, message: '' };
    } catch (err) {
        logger.warn(`[SetNick] Lỗi kiểm tra cooldown cho ${userId}:`, err.message);
        return { isOnCooldown: false, remainingMs: 0, nextTimestamp: 0, message: '' };
    }
}

/**
 * Ghi nhận thời điểm thành viên đổi biệt danh thành công
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {string} userId
 */
export async function recordSetnickCooldown(client, guildId, userId) {
    try {
        const now = Date.now();
        setnickCooldownCache.set(`${guildId}:${userId}`, now);
        const dbKey = `setnick:cooldown:${guildId}:${userId}`;
        if (client?.db?.set) {
            await client.db.set(dbKey, now).catch((err) => {
                logger.warn(`[SetNick] Không thể lưu cooldown vào DB cho ${userId}:`, err.message);
            });
        }
    } catch (err) {
        logger.warn(`[SetNick] Lỗi ghi nhận cooldown cho ${userId}:`, err.message);
    }
}

export function buildNickname(name) {
    return `${SETNICK_CONFIG.prefix}${name}${SETNICK_CONFIG.suffix}`;
}

/**
 * Tạo Container V2 và ActionRow cho bảng Panel tự đổi nickname
 */
export function createSetnickPanelPayload() {
    const container = new ContainerBuilder();

    // 1. Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${SETNICK_EMOJIS.titleLeft} **TỰ ĐỔI NICKNAME** ${SETNICK_EMOJIS.titleRight}`,
        ),
    );

    // Đường kẻ 1
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // 2. Dòng 1
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${SETNICK_EMOJIS.heart} Bạn có thể tự đổi biệt danh cho chính mình tại đây.`,
        ),
    );

    // Đường kẻ 2
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // 3. Dòng 2
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [
                `${SETNICK_EMOJIS.heart} Định dạng hiển thị tự động:`,
                `> - Tên bạn nhập: Từ 1 đến 20 ký tự.`,
                `> - Bot tự động thêm tiền tố và hậu tố.`,
            ].join('\n'),
        ),
    );

    // Đường kẻ 3
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // 4. Dòng 3
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${SETNICK_EMOJIS.notice} Bấm vào nút bên dưới để thay đổi tên!`,
        ),
    );

    // Đường kẻ 4 (dưới dòng bấm vào...)
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // 5. Ảnh trang trí mini
    if (SETNICK_CONFIG.panelImageUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(SETNICK_CONFIG.panelImageUrl),
            ),
        );
    }

    // 6. 2 nút màu xám (Secondary), không cần emoji
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setnick_change')
            .setLabel('Đổi Biệt Danh')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('setnick_reset')
            .setLabel('Khôi Phục Tên Gốc')
            .setStyle(ButtonStyle.Secondary),
    );

    container.addActionRowComponents(actionRow);

    const fallbackEmbed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setDescription(
            [
                `# ${SETNICK_EMOJIS.titleLeft} **TỰ ĐỔI NICKNAME** ${SETNICK_EMOJIS.titleRight}`,
                '---',
                `${SETNICK_EMOJIS.heart} Bạn có thể tự đổi biệt danh cho chính mình tại đây.`,
                '---',
                `${SETNICK_EMOJIS.heart} Định dạng hiển thị tự động:`,
                `> - Tên bạn nhập: Từ 1 đến 20 ký tự.`,
                `> - Bot tự động thêm tiền tố và hậu tố.`,
                '---',
                `${SETNICK_EMOJIS.notice} Bấm vào nút bên dưới để thay đổi tên!`,
            ].join('\n'),
        );

    if (SETNICK_CONFIG.panelImageUrl) {
        fallbackEmbed.setImage(SETNICK_CONFIG.panelImageUrl);
    }

    return {
        container,
        actionRow,
        v2: {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        },
        fallback: {
            embeds: [fallbackEmbed],
            components: [actionRow],
        },
    };
}

/**
 * Xóa panel cũ và gửi lại panel mới ở cuối kênh (Sticky Bottom Panel)
 */
export async function refreshSetnickPanel(client, guild, targetChannel = null) {
    if (isRefreshing) {
        pendingRefresh = true;
        return;
    }
    isRefreshing = true;

    try {
        const channel =
            targetChannel ||
            guild.channels.cache.get(SETNICK_CONFIG.channelId) ||
            await guild.channels.fetch(SETNICK_CONFIG.channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            logger.warn(`[SetNick] Panel channel not found or not text-based.`);
            return;
        }

        // 1. Xóa panel cũ theo ID lưu trữ (cache hoặc DB)
        let savedPanelId = cachedPanelMessageId;
        if (!savedPanelId && client?.db?.get) {
            savedPanelId = await client.db.get(`setnick:panel:${guild.id}`, null).catch(() => null);
        }

        if (savedPanelId) {
            await channel.messages.delete(savedPanelId).catch(() => {});
        }

        // 2. Quét dọn các panel cũ của bot trong 20 tin nhắn gần nhất để đảm bảo không bị sót
        const recentMessages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (recentMessages) {
            for (const msg of recentMessages.values()) {
                if (msg.author?.id !== client.user?.id) continue;

                let compsString = '';
                try {
                    compsString = JSON.stringify(msg.components ?? []);
                } catch {
                    compsString = '';
                }

                const isBotPanel =
                    compsString.includes('setnick_change') ||
                    compsString.includes('setnick_reset') ||
                    compsString.includes('TỰ ĐỔI NICKNAME') ||
                    msg.embeds?.some(e => e.description?.includes('TỰ ĐỔI NICKNAME'));

                if (isBotPanel) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        // 3. Gửi panel mới nhất xuống đáy kênh
        const payload = createSetnickPanelPayload();
        let newPanelMsg = null;
        try {
            newPanelMsg = await channel.send(payload.v2);
        } catch (v2Err) {
            logger.warn('[SetNick] Failed to send V2 panel in refresh, falling back to embed:', v2Err);
            newPanelMsg = await channel.send(payload.fallback);
        }

        if (newPanelMsg) {
            cachedPanelMessageId = newPanelMsg.id;
            if (client?.db?.set) {
                await client.db.set(`setnick:panel:${guild.id}`, newPanelMsg.id).catch(() => {});
            }
        }
    } catch (err) {
        logger.error('[SetNick] Error refreshing setnick panel:', err);
    } finally {
        isRefreshing = false;
        if (pendingRefresh) {
            pendingRefresh = false;
            // Chạy lại nếu có thêm yêu cầu trong lúc đang refresh
            await refreshSetnickPanel(client, guild, targetChannel);
        }
    }
}

/**
 * Gửi thông báo log Nickname Updated về kênh log, đồng thời tái tạo panel ở cuối kênh
 */
export async function sendSetnickLog({ client, guild, targetMember, nickname }) {
    try {
        const channel =
            guild.channels.cache.get(SETNICK_CONFIG.channelId) ||
            await guild.channels.fetch(SETNICK_CONFIG.channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            logger.warn(`Setnick log channel ${SETNICK_CONFIG.channelId} not found.`);
            return;
        }

        const userId = targetMember.id || targetMember.user?.id;
        const username = targetMember.user?.username || targetMember.username || userId;

        // Container V2
        const container = new ContainerBuilder();

        // 1. Header
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${SETNICK_EMOJIS.titleLeft} **NICKNAME UPDATED** ${SETNICK_EMOJIS.titleRight}`,
            ),
        );

        // 2. Đường kẻ
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

        // 3. Nội dung
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    `${SETNICK_EMOJIS.heart} Thành viên: <@${userId}> | ${username}`,
                    `${SETNICK_EMOJIS.heart} Nickname mới: ${nickname}`,
                ].join('\n'),
            ),
        );

        try {
            await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (v2Err) {
            logger.warn('Failed to send Setnick log as Components V2, falling back to embed:', v2Err);
            const fallbackEmbed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setDescription(
                    [
                        `# ${SETNICK_EMOJIS.titleLeft} **NICKNAME UPDATED** ${SETNICK_EMOJIS.titleRight}`,
                        '---',
                        `${SETNICK_EMOJIS.heart} Thành viên: <@${userId}> | ${username}`,
                        `${SETNICK_EMOJIS.heart} Nickname mới: ${nickname}`,
                    ].join('\n'),
                );

            await channel.send({
                embeds: [fallbackEmbed],
            });
        }

        // Tự động xóa panel cũ và gửi lại panel mới ở cuối kênh để không bao giờ bị trôi
        await refreshSetnickPanel(client, guild, channel);
    } catch (err) {
        logger.error('Error sending setnick log:', err);
    }
}
