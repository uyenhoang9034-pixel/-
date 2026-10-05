import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';
import { getUserBirthday } from './birthdayService.js';

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
        .setColor(0xF6B6D6)
        .setTitle('<a:trangtrig2:1546040703375904801> 𝓣𝓪̂𝓶 𝓢𝓾̛̣ 𝓥𝓾̀𝓷𝓰 𝓚𝓲́𝓷 <a:trangtrig3:1546040818261954610>')
        .setDescription(
            'Đây là không gian dành cho những cuộc trò chuyện riêng tư và nhạy cảm.\n' +
            'Trước khi tham gia, hãy xác nhận rằng bạn đủ điều kiện truy cập nội dung giới hạn độ tuổi của Discord và đồng ý với những điều sau:\n' +
            '<:bunny2:1546149280463716413> Tôn trọng câu chuyện và quyền riêng tư của mọi người.\n' +
            '<:bunny2:1546149280463716413> Không mang nội dung, hình ảnh hoặc câu chuyện của thành viên ra ngoài khi chưa được đồng ý.\n' +
            '<:bunny2:1546149280463716413> Tự chịu trách nhiệm với nội dung mình chia sẻ và tiếp nhận tại đây.\n' +
            '<:bunny2:1546149280463716413> Tuân thủ Nội quy Server và Điều khoản của Discord.\n\n' +
            '**Xác nhận một lần duy nhất để mở quyền trò chuyện tại kênh.**',
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('private_verify_accept')
            .setLabel('Đồng ý & tiếp tục')
            .setEmoji({ id: '1546085874763178094', name: 'dog19' })
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

function isAtLeast18(birthday, now = new Date()) {
    if (!birthday?.year || !birthday?.month || !birthday?.day) {
        return false;
    }

    let age = now.getFullYear() - birthday.year;
    const birthdayPassed =
        now.getMonth() + 1 > birthday.month ||
        (now.getMonth() + 1 === birthday.month && now.getDate() >= birthday.day);

    if (!birthdayPassed) {
        age -= 1;
    }

    return age >= 18;
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

    const birthday = await getUserBirthday(
        client,
        interaction.guildId,
        interaction.user.id,
    );

    if (!birthday?.year) {
        return { ok: false, reason: 'birthday_missing' };
    }

    if (!isAtLeast18(birthday)) {
        return { ok: false, reason: 'underage' };
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
