import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import { logger } from '../utils/logger.js';
import { ROLE_IDS, hasRoleTier } from '../config/commands/roleAccess.js';

export const DICH_VU_CUSTOMER_ROLE_ID = '1570327652873543751';
export const DICH_VU_ADMIN_ROLE_ID = ROLE_IDS.MID_ADMIN;

export const DICH_VU_BUTTON_IDS = Object.freeze({
  ADD: 'dichvu_role:add',
  REMOVE: 'dichvu_role:remove',
});

export const DICH_VU_EMOJIS = Object.freeze({
  titleLeft: '<a:trangtrig2:1546040703375904801>',
  titleRight: '<a:trangtrig3:1546040818261954610>',
  bullet: '<a:trangtrig61:1569559986550612051>',
  note: '<a:trangtrig49:1567818140375851018>',
  addBtn: '<a:trangtrig60:1569558191551942696>',
  removeBtn: '<a:trangtrig49:1567818140375851018>',
});

const DICH_VU_TITLE = `${DICH_VU_EMOJIS.titleLeft} **TRUY CẬP KHU VỰC DỊCH VỤ & MUA HÀNG** ${DICH_VU_EMOJIS.titleRight}`;

const DICH_VU_BODY = [
  'Chào mừng bạn đến với khu vực dành riêng cho thành viên có nhu cầu sử dụng dịch vụ tại server. Để giữ cho không gian trò chuyện chung luôn gọn gàng và tránh làm phiền những bạn không có nhu cầu, các kênh chi tiết hiện đang được ẩn đi.',
  '',
  'Cách mở khóa kênh - chỉ mở khi thực sự quan tâm:',
  `${DICH_VU_EMOJIS.bullet} Nhấn vào nút **nhận role** bên dưới để tự động nhận role Khách Hàng.`,
  `${DICH_VU_EMOJIS.bullet} Ngay sau khi có role, toàn bộ các kênh dịch vụ sẽ hiển thị ở danh mục bên dưới.`,
  '',
  `${DICH_VU_EMOJIS.note} Lưu ý: Bạn có thể gỡ role (ấn nút **gỡ role**) bất cứ lúc nào nếu không còn nhu cầu theo dõi thông báo từ khu vực này.`,
].join('\n');

function createDivider() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

export function buildDichVuActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(DICH_VU_BUTTON_IDS.ADD)
      .setLabel('Nhận role KH')
      .setEmoji(DICH_VU_EMOJIS.addBtn)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(DICH_VU_BUTTON_IDS.REMOVE)
      .setLabel('Gỡ role KH')
      .setEmoji(DICH_VU_EMOJIS.removeBtn)
      .setStyle(ButtonStyle.Secondary),
  );
}

export function hasDichVuSetupPermission(member, author = null) {
  return hasRoleTier(member, 'MID_ADMIN', member?.guild, author || member?.user);
}

export function buildDichVuPayloads() {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${DICH_VU_TITLE}`),
    )
    .addSeparatorComponents(createDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(DICH_VU_BODY),
    )
    .addActionRowComponents(buildDichVuActionRow());

  const fallbackEmbed = new EmbedBuilder()
    .setTitle(DICH_VU_TITLE)
    .setDescription(DICH_VU_BODY);

  const noMentions = { parse: [] };

  return {
    v2: {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: noMentions,
    },
    fallback: {
      embeds: [fallbackEmbed],
      components: [buildDichVuActionRow()],
      allowedMentions: noMentions,
    },
  };
}

export async function handleDichVuSetupCommand(message) {
  if (!message || !message.guild || message.author?.bot || message.system) {
    return false;
  }

  const content = String(message.content || '').trim();
  if (content.toLowerCase() !== '&setupdichvu') {
    return false;
  }

  const member =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (!hasDichVuSetupPermission(member, message.author)) {
    const warnMsg = await message
      .reply({
        content: `Chỉ thành viên có role <@&${DICH_VU_ADMIN_ROLE_ID}> mới được sử dụng lệnh \`&setupdichvu\`.`,
        allowedMentions: { parse: [], repliedUser: true },
      })
      .catch(() => null);

    if (warnMsg) {
      const timer = setTimeout(() => {
        warnMsg.delete().catch(() => {});
      }, 5000);
      timer.unref?.();
    }
    return true;
  }

  const me =
    message.guild.members.me ||
    (await message.guild.members.fetchMe().catch(() => null));
  const perms = me ? message.channel.permissionsFor?.(me) : null;
  const requiredSendPerm = message.channel.isThread?.()
    ? PermissionFlagsBits.SendMessagesInThreads
    : PermissionFlagsBits.SendMessages;

  if (perms && (!perms.has(PermissionFlagsBits.ViewChannel) || !perms.has(requiredSendPerm))) {
    logger.warn(`[DichVu] Bot thiếu quyền gửi tin nhắn trong kênh ${message.channel.id}`);
    return true;
  }

  await message.delete().catch((err) => {
    logger.debug('[DichVu] Không thể xóa tin nhắn lệnh &setupdichvu:', err?.message || err);
  });

  const payloads = buildDichVuPayloads();

  try {
    await message.channel.send(payloads.v2);
  } catch (v2Err) {
    logger.warn('[DichVu] Gửi Components V2 thất bại, chuyển sang Embed mặc định:', v2Err?.message || v2Err);
    await message.channel.send(payloads.fallback).catch((fallbackErr) => {
      logger.error('[DichVu] Không thể gửi bảng dịch vụ:', fallbackErr);
    });
  }

  logger.info('[DichVu] Sent service access Components V2 panel', {
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.author.id,
  });

  return true;
}

export async function toggleDichVuCustomerRole(interaction, action) {
  if (!interaction?.guild) {
    return {
      ok: false,
      message: '❌ Nút này chỉ hoạt động trong server.',
    };
  }

  if (action !== 'add' && action !== 'remove') {
    return {
      ok: false,
      message: '❌ Thao tác không hợp lệ.',
    };
  }

  const guild = interaction.guild;
  const member =
    interaction.member?.roles?.add
      ? interaction.member
      : await guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    return {
      ok: false,
      message: '❌ Không tìm thấy thông tin thành viên của bạn trong server.',
    };
  }

  const role = await guild.roles.fetch(DICH_VU_CUSTOMER_ROLE_ID).catch(() => null);
  if (!role) {
    return {
      ok: false,
      message: `❌ Không tìm thấy role Khách Hàng (<@&${DICH_VU_CUSTOMER_ROLE_ID}>) trong server. Vui lòng báo ban quản trị.`,
    };
  }

  if (role.managed || role.id === guild.id) {
    return {
      ok: false,
      message: '❌ Role này do hệ thống quản lý nên bot không thể tự cấp hoặc gỡ.',
    };
  }

  const me =
    guild.members.me ||
    (await guild.members.fetchMe().catch(() => null));

  if (me && !me.permissions?.has?.(PermissionFlagsBits.ManageRoles)) {
    return {
      ok: false,
      message: '❌ Bot chưa có quyền **Manage Roles** để gán hoặc gỡ role.',
    };
  }

  if (me?.roles?.highest && typeof me.roles.highest.comparePositionTo === 'function') {
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      return {
        ok: false,
        message: `❌ Role của bot đang nằm dưới <@&${role.id}> nên chưa thể thao tác. Vui lòng báo admin kéo role bot lên cao hơn.`,
      };
    }
  }

  const hasCustomerRole = Boolean(member.roles?.cache?.has?.(role.id));

  if (action === 'add') {
    if (hasCustomerRole) {
      return {
        ok: true,
        already: true,
        action,
        roleId: role.id,
        message: `Bạn đã có sẵn role <@&${role.id}> rồi! Bạn có thể xem các kênh dịch vụ hoặc bấm **Gỡ role KH** nếu muốn ẩn lại.`,
      };
    }

    try {
      await member.roles.add(role, 'Nhận role Khách Hàng qua nút dịch vụ');
    } catch (error) {
      logger.error('[DichVu] Lỗi khi cấp role Khách Hàng:', error);
      return {
        ok: false,
        message: `❌ Bot không thể cấp role <@&${role.id}> lúc này. Vui lòng thử lại sau hoặc liên hệ ban quản trị.`,
      };
    }

    return {
      ok: true,
      already: false,
      action,
      roleId: role.id,
      message: `✅ Đã cấp role <@&${role.id}> cho bạn! Toàn bộ các kênh dịch vụ hiện đã được mở khóa.`,
    };
  }

  if (!hasCustomerRole) {
    return {
      ok: true,
      already: true,
      action,
      roleId: role.id,
      message: `Bạn hiện chưa có role <@&${role.id}> nên không cần gỡ.`,
    };
  }

  try {
    await member.roles.remove(role, 'Gỡ role Khách Hàng qua nút dịch vụ');
  } catch (error) {
    logger.error('[DichVu] Lỗi khi gỡ role Khách Hàng:', error);
    return {
      ok: false,
      message: `❌ Bot không thể gỡ role <@&${role.id}> lúc này. Vui lòng thử lại sau hoặc liên hệ ban quản trị.`,
    };
  }

  return {
    ok: true,
    already: false,
    action,
    roleId: role.id,
    message: `✅ Đã gỡ role <@&${role.id}> thành công! Bạn có thể bấm **Nhận role KH** bất cứ lúc nào nếu cần mở lại.`,
  };
}

