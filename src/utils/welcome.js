// welcome.js

import path from 'node:path';
import fsSync from 'node:fs';
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
    AttachmentBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { logger } from './logger.js';

export const WELCOME_IMAGE_PATH = path.resolve(
    process.cwd(),
    'assets',
    'welcomegoodbye',
    'welcome.png',
);

export const GOODBYE_IMAGE_PATH = path.resolve(
    process.cwd(),
    'assets',
    'welcomegoodbye',
    'goodbye.png',
);

export const RULES_LINK_URL =
    'https://discord.com/channels/1541279801183178754/1541283961957912620/1566157458123128893';

export function formatFooterTimestamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = String(date.getFullYear()).slice(-2);
    return `${hours}:${minutes} ${day}/${month}/${year}`;
}

const DEFAULT_TEMPLATES = {
    welcome: 'Welcome {user} to {server}!',
    goodbye: '{user.tag} has left the server.'
};

function replaceAll(message, token, value) {
    if (value === undefined || value === null) {
        return message;
    }
    return message.split(token).join(String(value));
}

export function truncateForEmbedField(value, maxLength = 1024) {
    const text = String(value ?? '').trim();
    if (!text) {
        return '—';
    }
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function formatWelcomeMessage(message, data) {

    let str = message;
    if (typeof str === 'object' && str !== null) {
        str = str.text || str.content || str.value || '';
    }

    if (typeof str !== 'string' || !str) return '';

    let result = str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

    if (!data || typeof data !== 'object') return result;

    const user = data?.user;
    const guild = data?.guild;

    if (!user || typeof user !== 'object') {
        logger.warn('Invalid user object passed to formatWelcomeMessage');
    }
    if (!guild || typeof guild !== 'object') {
        logger.warn('Invalid guild object passed to formatWelcomeMessage');
    }

    const tokens = {
        '{user}': user?.toString?.() || 'User',
        '{user.mention}': user?.toString?.() || 'User',
        '{user.tag}': user?.tag || 'Unknown#0000',
        '{user.username}': user?.username || 'Unknown',
        '{username}': user?.username || 'Unknown',
        '{user_name}': user?.username || 'Unknown',
        '{user.discriminator}': user?.discriminator || '0000',
        '{user.id}': user?.id || 'unknown',
        '{server}': guild?.name || 'Server',
        '{server.name}': guild?.name || 'Server',
        '{server_name}': guild?.name || 'Server',
        '{guild.name}': guild?.name || 'Server',
        '{guild.id}': guild?.id || 'unknown',
        '{guild.memberCount}': guild?.memberCount?.toString?.() || '0',
        '{memberCount}': guild?.memberCount?.toString?.() || '0',
        '{membercount}': guild?.memberCount?.toString?.() || '0',
        '{time_stamp}': `Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
        '{timestamp}': `Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
        '{time}': new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };

    for (const [token, value] of Object.entries(tokens)) {
        if (value === undefined || value === null) continue;
        result = replaceAll(result, token, String(value));
    }

    return result;
}

export function getDefaultWelcomeMessage() {
    return DEFAULT_TEMPLATES.welcome;
}

export function getDefaultGoodbyeMessage() {
    return DEFAULT_TEMPLATES.goodbye;
}

// ============================================================
// BUILD WELCOME PAYLOAD (V2 CONTAINER)
// ============================================================

export function buildWelcomePayload({ user, guild }) {
    const userMention = user?.toString?.() || 'bạn';
    const memberCount = guild?.memberCount ?? 0;
    const timeStr = formatFooterTimestamp();

    const titleText = '<a:trangtrig2:1546040703375904801> **𝓦𝓮𝓵𝓬𝓸𝓶𝓮 𝓽𝓸 𝓢𝓮𝓻𝓮𝓷𝓭𝓲𝓹𝓲𝓽𝔂** <a:trangtrig3:1546040818261954610>';

    const bodyText = [
        `Ní hảo ${userMention}!`,
        `> <a:heartg1:1545307544808071258> Tadaaaa rất vui được chào đón bạn đến với server của bọn mình!`,
        `> <a:heartg1:1545307544808071258> Chúc bạn chơi vui và enjoy cái moment này.`,
        '',
        `<a:bang2:1546891483250954290> Hãy ấn vào nút bên dưới để đọc nội quy cũng như xem hướng dẫn sử dụng các kênh của server nhé!`,
    ].join('\n');

    const footerText = `-# Ní là bét fen thứ ${memberCount} của bọn mình roài nè hì hì ^^ • ${timeStr}`;

    const files = [];
    const hasImage = fsSync.existsSync(WELCOME_IMAGE_PATH);
    if (hasImage) {
        files.push(new AttachmentBuilder(WELCOME_IMAGE_PATH, { name: 'welcome.png' }));
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# ${titleText}`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(bodyText)
        );

    if (hasImage) {
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        );
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://welcome.png')
            )
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footerText)
    );

    const rulesButton = new ButtonBuilder()
        .setLabel('Rules')
        .setStyle(ButtonStyle.Link)
        .setURL(RULES_LINK_URL);
    const buttonRow = new ActionRowBuilder().addComponents(rulesButton);
    container.addActionRowComponents(buttonRow);

    return {
        content: null,
        embeds: [],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        files,
    };
}

export function buildWelcomeFallbackEmbed({ user, guild }) {
    const userMention = user?.toString?.() || 'bạn';
    const memberCount = guild?.memberCount ?? 0;
    const timeStr = formatFooterTimestamp();

    const bodyText = [
        `Ní hảo ${userMention}!`,
        `> <a:heartg1:1545307544808071258> Tadaaaa rất vui được chào đón bạn đến với server của bọn mình!`,
        `> <a:heartg1:1545307544808071258> Chúc bạn chơi vui và enjoy cái moment này.`,
        '',
        `<a:bang2:1546891483250954290> Hãy ấn vào nút bên dưới để đọc nội quy cũng như xem hướng dẫn sử dụng các kênh của server nhé!`,
    ].join('\n');

    const hasImage = fsSync.existsSync(WELCOME_IMAGE_PATH);
    const files = hasImage
        ? [new AttachmentBuilder(WELCOME_IMAGE_PATH, { name: 'welcome.png' })]
        : [];

    const embed = new EmbedBuilder()
        .setTitle('𝓦𝓮𝓵𝓬𝓸𝓶𝓮 𝓽𝓸 𝓢𝓮𝓻𝓮𝓷𝓭𝓲𝓹𝓲𝓽𝔂')
        .setDescription(bodyText)
        .setFooter({ text: `Ní là bét fen thứ ${memberCount} của bọn mình roài nè hì hì ^^ • ${timeStr}` });

    if (hasImage) {
        embed.setImage('attachment://welcome.png');
    }

    const rulesButton = new ButtonBuilder()
        .setLabel('Rules')
        .setStyle(ButtonStyle.Link)
        .setURL(RULES_LINK_URL);
    const buttonRow = new ActionRowBuilder().addComponents(rulesButton);

    return {
        content: null,
        embeds: [embed],
        components: [buttonRow],
        files,
    };
}

// ============================================================
// BUILD GOODBYE PAYLOAD (V2 CONTAINER)
// ============================================================

export function buildGoodbyePayload({ user, guild }) {
    const userMention = user?.toString?.() || 'bạn';
    const memberCount = guild?.memberCount ?? 0;
    const timeStr = formatFooterTimestamp();

    const titleText = '<a:trangtrig2:1546040703375904801> **𝓖𝓸𝓸𝓭𝓫𝔂𝓮 𝓱𝓾𝓱𝓾** <a:trangtrig3:1546040818261954610>';

    const bodyText = [
        `Tạm biệt ${userMention}!`,
        '',
        `<a:heartg1:1545307544808071258> Cuộc vui nào cũng đến lúc tàn, ta tạm chia tay ${userMention} ở đây thôi.`,
    ].join('\n');

    const footerText = `-# Không sao bọn mình vẫn còn ${memberCount} bét fen :< • ${timeStr}`;

    const files = [];
    const hasImage = fsSync.existsSync(GOODBYE_IMAGE_PATH);
    if (hasImage) {
        files.push(new AttachmentBuilder(GOODBYE_IMAGE_PATH, { name: 'goodbye.png' }));
    }

    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# ${titleText}`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(bodyText)
        );

    if (hasImage) {
        container.addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        );
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://goodbye.png')
            )
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footerText)
    );

    return {
        content: null,
        embeds: [],
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        files,
    };
}

export function buildGoodbyeFallbackEmbed({ user, guild }) {
    const userMention = user?.toString?.() || 'bạn';
    const memberCount = guild?.memberCount ?? 0;
    const timeStr = formatFooterTimestamp();

    const bodyText = [
        `Tạm biệt ${userMention}!`,
        '',
        `<a:heartg1:1545307544808071258> Cuộc vui nào cũng đến lúc tàn, ta tạm chia tay ${userMention} ở đây thôi.`,
    ].join('\n');

    const hasImage = fsSync.existsSync(GOODBYE_IMAGE_PATH);
    const files = hasImage
        ? [new AttachmentBuilder(GOODBYE_IMAGE_PATH, { name: 'goodbye.png' })]
        : [];

    const embed = new EmbedBuilder()
        .setTitle('𝓖𝓸𝓸𝓭𝓫𝔂𝓮 𝓱𝓾𝓱𝓾')
        .setDescription(bodyText)
        .setFooter({ text: `Không sao bọn mình vẫn còn ${memberCount} bét fen :< • ${timeStr}` });

    if (hasImage) {
        embed.setImage('attachment://goodbye.png');
    }

    return {
        content: null,
        embeds: [embed],
        files,
    };
}