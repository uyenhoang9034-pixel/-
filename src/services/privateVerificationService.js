import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

const PRIVATE_VERIFY_ROLE_ID = '1556533290561839104';

const CONFIG_KEY = guildId => `guild:${guildId}:private_verify:config`;
const VERIFIED_KEY = (guildId, userId) =>
    `guild:${guildId}:private_verify:verified:${userId}`;

export async function getPrivateVerificationConfig(client, guildId) {
    return client.db.get(CONFIG_KEY(guildId), null);
}

export async function isPrivateVerified(client, guildId, userId) {
    return Boolean(await client.db.get(VERIFIED_KEY(guildId, userId), false));
}

export async function markPrivateVerified(client, guildId, userId) {
    await client.db.set(VERIFIED_KEY(guildId, userId), true);
}

function buildPanel() {
    const embed = new EmbedBuilder()
        .setColor(0xf6b6d6)
        .setTitle('🔞 Xác nhận trước khi tham gia')
        .setDescription(
            'Bạn cần xác nhận trước khi có thể gửi tin nhắn trong kênh này.\n\n' +
            'Nhấn **Đồng ý & tiếp tục** để mở quyền trò chuyện.',
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('private_verify_accept')
            .setLabel('Đồng ý & tiếp tục')
            .setStyle(ButtonStyle.Success),
    );

    return { embeds: [embed], components: [row] };
}

export async function setupPrivateVerification(client, guild, channel) {
    let config = await getPrivateVerificationConfig(client, guild.id);
    const role = await guild.roles.fetch(PRIVATE_VERIFY_ROLE_ID).catch(() => null);

    if (!role) {
        throw new Error(
            `Private verification role ${PRIVATE_VERIFY_ROLE_ID} was not found in this server.`,
        );
    }

    // Keep the channel visible, but prevent unverified members from sending.
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
        ViewChannel: true,
        SendMessages: false,
        AddReactions: false,
    });

    await channel.permissionOverwrites.edit(role, {
        ViewChannel: true,
        SendMessages: true,
        AddReactions: true,
        ReadMessageHistory: true,
    });

    let panelMessage = null;
    if (config?.channelId === channel.id && config?.panelMessageId) {
        panelMessage = await channel.messages.fetch(config.panelMessageId).catch(() => null);
    }

    if (panelMessage) {
        await panelMessage.edit(buildPanel());
    } else {
        panelMessage = await channel.send(buildPanel());
    }

    config = {
        channelId: channel.id,
        roleId: PRIVATE_VERIFY_ROLE_ID,
        panelMessageId: panelMessage.id,
    };

    await client.db.set(CONFIG_KEY(guild.id), config);
    return config;
}

export async function verifyPrivateMember(client, interaction) {
    const config = await getPrivateVerificationConfig(client, interaction.guildId);
    if (!config || interaction.channelId !== config.channelId) {
        return { ok: false, reason: 'wrong_channel' };
    }

    const role = await interaction.guild.roles.fetch(PRIVATE_VERIFY_ROLE_ID).catch(() => null);
    if (!role) {
        return { ok: false, reason: 'missing_role' };
    }

    const alreadyVerified = await isPrivateVerified(
        client,
        interaction.guildId,
        interaction.user.id,
    );

    if (!interaction.member.roles.cache.has(role.id)) {
        await interaction.member.roles.add(role, 'Accepted private channel verification');
    }

    if (!alreadyVerified) {
        await markPrivateVerified(client, interaction.guildId, interaction.user.id);
    }

    return { ok: true, alreadyVerified, roleId: role.id };
}
