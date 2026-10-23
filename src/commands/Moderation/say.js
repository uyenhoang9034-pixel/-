import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} from 'discord.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/validation.js';

const USAGI_PINK = '#FFB7D5';

const EMOJIS = {
    titleLeft: '<a:trangtrig2:1546040703375904801>',
    titleRight: '<a:trangtrig3:1546040818261954610>',
    bunny: '<a:bunnyg4:1541439959385374760>',
    heart: '<a:heartg3:1546047728314884226>',
    bullet: '<a:trangtrig6:1546043036390260756>',
    link: '<a:trangtrig13:1546047657963819048>',
    linkButtonEmoji: '1546047657963819048',
};

const TEXT_CHANNEL_TYPES = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
];

function resolveTargetChannel(interaction) {
    const selected = interaction.options.getChannel('channel');
    if (selected) {
        return selected;
    }

    if (!interaction.channel || !TEXT_CHANNEL_TYPES.includes(interaction.channel.type)) {
        return null;
    }

    return interaction.channel;
}

export default {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Gửi tin nhắn dưới danh nghĩa bot Usagi')
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('Nội dung tin nhắn bot cần nói')
                .setRequired(true)
                .setMaxLength(2000),
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Kênh cần gửi đến (mặc định: kênh hiện tại)')
                .addChannelTypes(...TEXT_CHANNEL_TYPES)
                .setRequired(false),
        )
        .addBooleanOption((option) =>
            option
                .setName('embed')
                .setDescription('Gửi dưới dạng Embed Usagi hồng múp rụp (Mặc định: false - chữ thường)')
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName('title')
                .setDescription('Tiêu đề cho Embed (nếu chọn chế độ embed)')
                .setRequired(false)
                .setMaxLength(256),
        )
        .addAttachmentOption((option) =>
            option
                .setName('image')
                .setDescription('Ảnh hoặc tệp đính kèm gửi cùng tin nhắn (tùy chọn)')
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    category: 'moderation',
    abuseProtection: { maxAttempts: 8, windowMs: 60_000 },

    async execute(interaction, _config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferSuccess) {
            logger.warn('Say interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'say',
            });
            return;
        }

        const rawMessage = interaction.options.getString('message');
        const message = sanitizeInput(rawMessage, 2000);
        const isEmbed = interaction.options.getBoolean('embed') || false;
        const customTitle = interaction.options.getString('title');
        const attachment = interaction.options.getAttachment('image');

        if (!message) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Tin nhắn không được để trống.',
            });
        }

        const channel = resolveTargetChannel(interaction);
        if (!channel) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Vui lòng chọn một kênh văn bản hoặc chạy lệnh trực tiếp trong kênh đó.',
            });
        }

        const memberPermissions = channel.permissionsFor(interaction.member);
        const botPermissions = channel.permissionsFor(interaction.guild.members.me);

        if (!memberPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Chị không có quyền gửi tin nhắn trong kênh ${channel}.`,
            });
        }

        if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Em không có quyền gửi tin nhắn trong kênh ${channel}. Chị cấp thêm quyền cho em với nhé!`,
            });
        }

        if (isEmbed && !botPermissions?.has(PermissionFlagsBits.EmbedLinks)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Em không có quyền chèn Embed (Embed Links) trong kênh ${channel}.`,
            });
        }

        if (attachment && !botPermissions?.has(PermissionFlagsBits.AttachFiles)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `Em không có quyền đính kèm tệp (Attach Files) trong kênh ${channel}.`,
            });
        }

        const sendPayload = {};

        if (isEmbed) {
            const embedTitle = customTitle
                ? `${EMOJIS.titleLeft} ${customTitle} ${EMOJIS.titleRight}`
                : `${EMOJIS.titleLeft} 𝓤𝓼𝓪𝓰𝓲 · 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 ${EMOJIS.titleRight}`;

            const sayEmbed = new EmbedBuilder()
                .setColor(USAGI_PINK)
                .setTitle(embedTitle)
                .setDescription(message)
                .setFooter({
                    text: `${interaction.guild.name} • 𝓤𝓼𝓪𝓰𝓲`,
                    iconURL: client.user.displayAvatarURL(),
                })
                .setTimestamp();

            if (attachment) {
                if (attachment.contentType?.startsWith('image/')) {
                    sayEmbed.setImage(attachment.url);
                } else {
                    sendPayload.files = [
                        new AttachmentBuilder(attachment.url, {
                            name: attachment.name,
                        }),
                    ];
                }
            }

            sendPayload.embeds = [sayEmbed];
        } else {
            sendPayload.content = message;
            if (attachment) {
                sendPayload.files = [
                    new AttachmentBuilder(attachment.url, {
                        name: attachment.name,
                    }),
                ];
            }
        }

        const sentMessage = await channel.send(sendPayload);

        await logEvent({
            client,
            guild: interaction.guild,
            event: {
                action: 'Bot Message Sent',
                target: `${channel} (${channel.id})`,
                executor: `${interaction.user.tag} (${interaction.user.id})`,
                reason: message.length > 200
                    ? `${message.slice(0, 197)}...`
                    : message,
                metadata: {
                    channelId: channel.id,
                    messageId: sentMessage.id,
                    moderatorId: interaction.user.id,
                    isEmbed,
                    hasAttachment: Boolean(attachment),
                    customTitle: customTitle || 'None',
                    messageLength: message.length,
                },
            },
        });

        const confirmDescription = [
            `Em đã gửi tin nhắn của chị vào ${channel} thành công mĩ mãn rồi nha! ${EMOJIS.heart}`,
            '',
            `${EMOJIS.bullet} **Kênh gửi:** ${channel}`,
            `${EMOJIS.bullet} **Định dạng:** ${isEmbed ? '🌸 Embed Usagi múp rụp' : '💬 Tin nhắn văn bản thuần'}`,
            customTitle ? `${EMOJIS.bullet} **Tiêu đề:** ${customTitle}` : null,
            attachment ? `${EMOJIS.bullet} **Tệp đính kèm:** [${attachment.name}](${attachment.url})` : null,
            `${EMOJIS.link} **Xem tin nhắn:** [Bấm vào đây để tới tin nhắn](${sentMessage.url})`,
            '',
            '**Nội dung đã gửi:**',
            `> ${message.length > 250 ? `${message.slice(0, 247)}...` : message}`,
        ]
            .filter(Boolean)
            .join('\n');

        const confirmEmbed = new EmbedBuilder()
            .setColor(USAGI_PINK)
            .setTitle(`${EMOJIS.bunny} 𝓤𝓼𝓪𝓰𝓲 · Đã Gửi Lời Nhắn Xong Rồi Nè!`)
            .setDescription(confirmDescription)
            .setFooter({
                text: `Usagi múp rụp luôn lắng nghe chị • ID: ${sentMessage.id}`,
                iconURL: client.user.displayAvatarURL(),
            })
            .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(sentMessage.url)
                .setLabel('Đi tới tin nhắn')
                .setEmoji(EMOJIS.linkButtonEmoji),
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [confirmEmbed],
            components: [actionRow],
            flags: MessageFlags.Ephemeral,
        });
    },
};
