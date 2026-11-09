import {
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import { logger } from '../../utils/logger.js';

export const QUYEN_LOI_ADMIN_ROLE_ID = '1545295139390619768';

export const QUYEN_LOI_EMOJIS = {
  titleLeft: '<a:trangtrig2:1546040703375904801>',
  titleRight: '<a:trangtrig3:1546040818261954610>',
};

const QUYEN_LOI_EMBED_TITLE = `${QUYEN_LOI_EMOJIS.titleLeft} BẢNG QUYỀN LỢI BOOSTER & DONATOR ${QUYEN_LOI_EMOJIS.titleRight}`;
const QUYEN_LOI_TITLE = `${QUYEN_LOI_EMOJIS.titleLeft} **BẢNG QUYỀN LỢI BOOSTER & DONATOR** ${QUYEN_LOI_EMOJIS.titleRight}`;

const QUYEN_LOI_PART_1 = [
  'Chân thành cảm ơn tình cảm và sự đóng góp của mọi người dành cho server! Dưới đây là chi tiết các mốc quyền lợi cùng các đặc quyền đi kèm.',
  '',
  '# QUYỀN LỢI NỀN TẢNG',
  '<a:1_:1563484001765949550> Kênh vinh danh: Bất kể giá trị bao nhiêu, mọi lượt Boost hay Donate đều được gửi lời cảm ơn và vinh danh tại kênh riêng.',
  '<a:2_:1563484061111156828> Phân định danh hiệu: Tách biệt rõ ràng giữa role **Starry Booster** và role **Crystal Supporter**.',
  '',
  '# STARRY BOOSTER (SERVER BOOSTER)',
  '<a:trangtrig8:1546047024334503997> Nhận ngay role <@&1541305195512856627> độc quyền với màu sắc và huy hiệu nhận diện riêng.',
  '<a:trangtrig8:1546047024334503997> Được hệ thống tự động ghi danh tại <#1541293511045947494> ngay khi kích hoạt Boost.',
  '',
  '# DONATOR CƠ BẢN (`< 20.000đ`)',
  '<a:trangtrig6:1546043036390260756> Nhận role <@&1568129166979764244> (hiển thị bên dưới role *Starry Booster*).',
  '<a:trangtrig6:1546043036390260756> Thông báo và cảm ơn tại <#1567185361900413089>.',
  '<a:trangtrig6:1546043036390260756> Kênh <#1568138061458444393>: Được mở khóa vào xem trước danh mục icon (chưa đủ số dư tối thiểu để đổi).',
  '',
  '# DONATOR BẠC (`20.000đ - 199.000đ`)',
  '<a:trangtrig6:1546043036390260756> Giữ role **Crystal Supporter**.',
  '<a:trangtrig6:1546043036390260756> Mở khóa đổi Icon: Đủ điều kiện sử dụng điểm/tiền tích lũy để đổi icon role hiển thị cạnh tên trong <#1568138061458444393>.',
  '<a:trangtrig6:1546043036390260756> Giá mỗi icon là khác nhau — tích lũy càng nhiều càng đổi được nhiều icon độc đáo và hiếm hơn!',
].join('\n');

const QUYEN_LOI_PART_2 = [
  '# DONATOR VÀNG (`≥ 200.000đ`)',
  '<a:trangtrig56:1567819562320134234> Role được cài đặt hiển thị riêng biệt và **nằm ở vị trí trên role Starry Booster**.',
  '<a:trangtrig56:1567819562320134234> Toàn quyền sử dụng và đổi icon trong <#1568138061458444393>.',
  '<a:trangtrig56:1567819562320134234> Giữ toàn bộ quyền lợi vinh danh từ các mốc trước.',
  '',
  '# SUPER DONATOR (`≥ 500.000đ`)',
  '<a:trangtrig57:1567819726371946578> Custom Role Đẳng Cấp: Tự do đặt tên role riêng + Màu role tự chọn theo mã HEX.',
  '> Mốc này không bao gồm custom role icon riêng, nhưng có thể dùng icon role trong shop role icon.',
  '<a:trangtrig57:1567819726371946578> Vị trí hiển thị Top 2: Role cá nhân được ghim tách biệt ở vị trí ngay dưới mốc Legendary Donator và Admin trên danh sách online.',
  '<a:trangtrig57:1567819726371946578> Toàn bộ quyền lợi đổi icon và vinh danh của các mốc trước.',
  '',
  '# LEGENDARY DONATOR (`≥ 1.000.000đ`)',
  '<a:trangtrig59:1567821308077539341> Custom Role Đẳng Cấp: Đặt tên role riêng + Màu role tự chọn theo mã HEX.',
  '<a:trangtrig59:1567821308077539341> Custom Icon Role Độc Quyền: Cài đặt 1 icon riêng biệt theo role cá nhân (duy nhất mốc này sở hữu).',
  '<a:trangtrig59:1567821308077539341> Vị trí hiển thị Top 1: Role cá nhân được ghim độc lập ở **Top đầu** danh sách thành viên online.',
  '<a:trangtrig59:1567821308077539341> Voice riêng vĩnh viễn: Sở hữu 1 phòng thoại cá nhân trọn đời (toàn quyền khóa phòng, đổi tên, đặt pass, giới hạn số người).',
  '<a:trangtrig59:1567821308077539341> Bot Auto-responder cá nhân: Cài đặt câu thoại riêng bằng Bot — mỗi khi có ai ping/tag bạn, Bot sẽ tự động trả lời bằng nội dung độc quyền do bạn cung cấp.',
  '<a:trangtrig59:1567821308077539341> Toàn bộ quyền lợi của các mốc trước.',
].join('\n');

const QUYEN_LOI_NOTE = [
  '<a:trangtrig49:1567818140375851018> **Lưu ý:**',
  '> - Số tiền donate được tính cộng dồn tích lũy theo thời gian.',
  '> - Khi đạt mốc hoặc muốn đổi icon role, các bạn vui lòng mở ticket tại <#1541385824484982794> để bọn mình hỗ trợ nhé!',
  '> - Nếu có sai sót, hoặc bot cấp thiếu role, mong các bạn thông cảm và mở ticket để bọn mình kịp thời hỗ trợ nhé!',
].join('\n');

function createDivider() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

/**
 * Kiểm tra quyền sử dụng lệnh &quyenloi (chỉ role Admin Support Ticket).
 * @param {import('discord.js').GuildMember | null | undefined} member
 * @returns {boolean}
 */
export function hasQuyenLoiPermission(member) {
  if (!member) return false;
  if (member.roles?.cache?.has?.(QUYEN_LOI_ADMIN_ROLE_ID)) return true;
  if (Array.isArray(member._roles) && member._roles.includes(QUYEN_LOI_ADMIN_ROLE_ID)) return true;
  if (Array.isArray(member.roles) && member.roles.includes(QUYEN_LOI_ADMIN_ROLE_ID)) return true;
  return false;
}

/**
 * Tạo payload giao diện Components V2 (2 container nối liền nhau, màu mặc định không thanh màu)
 * kèm payload fallback khi gửi.
 */
export function buildQuyenLoiPayloads() {
  const container1 = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${QUYEN_LOI_TITLE}`),
    )
    .addSeparatorComponents(createDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(QUYEN_LOI_PART_1),
    );

  const container2 = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(QUYEN_LOI_PART_2),
    )
    .addSeparatorComponents(createDivider())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(QUYEN_LOI_NOTE),
    );

  const embed1 = new EmbedBuilder()
    .setTitle(QUYEN_LOI_EMBED_TITLE)
    .setDescription(QUYEN_LOI_PART_1);

  const embed2 = new EmbedBuilder()
    .setDescription(`${QUYEN_LOI_PART_2}\n\n${QUYEN_LOI_NOTE}`);

  const noMentions = { parse: [] };

  return {
    v2Combined: {
      components: [container1, container2],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: noMentions,
    },
    v2First: {
      components: [container1],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: noMentions,
    },
    v2Second: {
      components: [container2],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: noMentions,
    },
    embedsFallback: {
      embeds: [embed1, embed2],
      allowedMentions: noMentions,
    },
  };
}

/**
 * Xử lý lệnh autoresponder `&quyenloi`.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>}
 */
export async function handleQuyenLoiCommand(message) {
  if (!message || !message.guild || message.author?.bot || message.system) {
    return false;
  }

  const content = String(message.content || '').trim();
  if (content.toLowerCase() !== '&quyenloi') {
    return false;
  }

  const member =
    message.member ||
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (!hasQuyenLoiPermission(member)) {
    const warnMsg = await message
      .reply({
        content: `Chỉ thành viên có role <@&${QUYEN_LOI_ADMIN_ROLE_ID}> mới được sử dụng lệnh \`&quyenloi\`.`,
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
    logger.warn(`[QuyenLoi] Bot thiếu quyền gửi tin nhắn trong kênh ${message.channel.id}`);
    return true;
  }

  await message.delete().catch((err) => {
    logger.debug('[QuyenLoi] Không thể xóa tin nhắn lệnh &quyenloi:', err?.message || err);
  });

  const payloads = buildQuyenLoiPayloads();

  try {
    await message.channel.send(payloads.v2Combined);
  } catch (v2CombinedErr) {
    logger.warn('[QuyenLoi] Gửi gộp 2 Container V2 thất bại, thử tách 2 tin nhắn nối tiếp:', v2CombinedErr?.message || v2CombinedErr);
    try {
      await message.channel.send(payloads.v2First);
      await message.channel.send(payloads.v2Second);
    } catch (v2SplitErr) {
      logger.warn('[QuyenLoi] Gửi Components V2 thất bại, chuyển sang Embed mặc định:', v2SplitErr?.message || v2SplitErr);
      await message.channel.send(payloads.embedsFallback).catch((fallbackErr) => {
        logger.error('[QuyenLoi] Không thể gửi bảng quyền lợi:', fallbackErr);
      });
    }
  }

  logger.info('[QuyenLoi] Sent benefits Components V2 panel', {
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.author.id,
  });

  return true;
}
