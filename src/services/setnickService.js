import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { logger } from '../utils/logger.js';

export const SETNICK_CONFIG = {
    channelId: '1541364885789745213',
    managementRoleId: '1545305594712432640',
    prefix: '⋆˚࿔ ',
    suffix: ' ♡',
    maxInputLength: 20,
    maxTotalLength: 32,
};

export const SETNICK_EMOJIS = {
    titleLeft: '<a:trangtrig2:1546040703375904801>',
    titleRight: '<a:trangtrig3:1546040818261954610>',
    heart: '<a:heartg1:1545307544808071258>',
    notice: '<a:bang2:1546891483250954290>',
};

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

    // 5. 2 nút màu xám (Secondary), không cần emoji
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

    return {
        container,
        actionRow,
        v2: {
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        },
        fallback: {
            embeds: [
                new EmbedBuilder()
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
                    ),
            ],
            components: [actionRow],
        },
    };
}

/**
 * Gửi thông báo log Nickname Updated về kênh log
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
    } catch (err) {
        logger.error('Error sending setnick log:', err);
    }
}
