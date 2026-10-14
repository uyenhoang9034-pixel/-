import { EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

/**
 * ID kênh than vãn tư bản duy nhất được phép kích hoạt tính năng.
 */
export const THAN_VAN_CHANNEL_ID = '1559832849798926357';

/**
 * Thời gian cooldown giữa các lần trả lời cùng loại từ khóa trong kênh (2 phút).
 */
export const COOLDOWN_MS = 2 * 60 * 1000; // 120.000 ms = 2 phút

/**
 * Map lưu timestamp kích hoạt gần nhất để tính cooldown theo từng kênh và từ khóa.
 * Key dạng: `${type}-${channelId}`
 */
const cooldowns = new Map();

/**
 * Regex nhận diện các từ khóa Tan Làm / Chuồn khỏi tư bản.
 * Hỗ trợ cả tiếng Việt có dấu và không dấu (đặc biệt là 'tan làm' và 'được về').
 */
const TAN_LAM_REGEX = /(tan làm|được về|tan ca|mấy giờ về|giờ chuồn|bao giờ về|khi nào về|giờ về|chuồn khỏi tư bản)/i;
const TAN_LAM_NO_ACCENT_REGEX = /(tan lam|duoc ve|tan ca|may gio ve|gio chuon|bao gio ve|khi nao ve|gio ve|chuon khoi tu ban)/i;

/**
 * Regex nhận diện các từ khóa Ngày Lương / Hóng Ting Ting.
 * Hỗ trợ các cụm từ như ting ting, phát lương, ngày lương, tiền về, hóng lương, bao giờ có lương...
 */
const LUONG_REGEX = /(phát lương|ngày lương|ting\s*ting|bao giờ.*lương|khi nào.*lương|tiền về|hóng lương|sắp có lương|lương.*về|hóng ting ting)/i;
const LUONG_NO_ACCENT_REGEX = /(phat luong|ngay luong|ting\s*ting|bao gio.*luong|khi nao.*luong|tien ve|hong luong|sap co luong|luong.*ve|hong ting ting)/i;

/**
 * Loại bỏ dấu tiếng Việt để đối soát linh hoạt khi người dùng gõ không dấu.
 * @param {string} str
 * @returns {string}
 */
function removeAccents(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Kiểm tra và cập nhật cooldown cho từng loại từ khóa trong kênh.
 * @param {string} type 'tanlam' | 'luong'
 * @param {string} channelId
 * @param {number} timeLimit
 * @returns {boolean} true nếu đang bị cooldown (không phản hồi), false nếu hợp lệ
 */
export function checkCooldown(type, channelId, timeLimit = COOLDOWN_MS) {
  const key = `${type}-${channelId}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;

  if (now - last < timeLimit) {
    return true;
  }

  cooldowns.set(key, now);

  // Dọn dẹp cache định kỳ tránh phình to bộ nhớ
  if (cooldowns.size > 200) {
    const expiredThreshold = now - 600000; // 10 phút
    for (const [k, timestamp] of cooldowns.entries()) {
      if (timestamp < expiredThreshold) {
        cooldowns.delete(k);
      }
    }
  }

  return false;
}

/**
 * Lấy đối tượng Date tính theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7).
 * Đảm bảo logic thời gian chính xác tuyệt đối bất kể bot chạy trên VPS/máy chủ nào.
 * @param {Date} date
 * @returns {Date}
 */
export function getVietnamTime(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = parseInt(part.value, 10);
    }
  }

  const hour = map.hour === 24 ? 0 : map.hour;
  return new Date(map.year, map.month - 1, map.day, hour, map.minute, map.second);
}

/**
 * Tạo thanh tiến trình trực quan dạng [████████░░].
 * @param {number} percent Phần trăm từ 0 đến 100
 * @param {number} length Độ dài thanh bar (mặc định 10 ký tự)
 * @returns {string}
 */
export function formatProgressBar(percent, length = 10) {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const filled = Math.min(length, Math.max(0, Math.round((clampedPercent / 100) * length)));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

/**
 * Xây dựng Embed ĐỒNG HỒ ĐẾM NGƯỢC: GIỜ CHUỒN KHỎI TƯ BẢN.
 * @param {Date} nowVN Thời gian hiện tại theo giờ Việt Nam
 * @returns {EmbedBuilder}
 */
export function buildTanLamEmbed(nowVN = getVietnamTime()) {
  const endHour = 17;
  const endMinute = 30;
  const endSecond = 0;

  // Giờ bắt đầu làm việc buổi sáng (08:00)
  const startHour = 8;
  const startMinute = 0;
  const startSecond = 0;

  const targetDate = new Date(
    nowVN.getFullYear(),
    nowVN.getMonth(),
    nowVN.getDate(),
    endHour,
    endMinute,
    endSecond,
  );

  const startDate = new Date(
    nowVN.getFullYear(),
    nowVN.getMonth(),
    nowVN.getDate(),
    startHour,
    startMinute,
    startSecond,
  );

  const diffMs = targetDate.getTime() - nowVN.getTime();
  const totalWorkMs = targetDate.getTime() - startDate.getTime();

  let remainingText = '';
  let percent = 0;

  if (diffMs <= 0) {
    remainingText = '🎉 **ĐÃ HẾT GIỜ HÀNH CHÍNH!** Còn ngồi đó làm gì nữa, xách xe về ngay!';
    percent = 100;
  } else {
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    remainingText = `${hours} giờ ${minutes} phút ${seconds} giây`;

    if (nowVN.getTime() < startDate.getTime()) {
      percent = 0;
    } else {
      const elapsedMs = nowVN.getTime() - startDate.getTime();
      percent = Math.min(99, Math.max(1, Math.floor((elapsedMs / totalWorkMs) * 100)));
    }
  }

  const progressBar = formatProgressBar(percent, 10);

  const description = [
    `Giờ chuẩn tan làm: 17:30:00`,
    ``,
    `Còn lại: ${remainingText}`,
    ``,
    `Tiến độ ngày cày cuốc: [${progressBar}] ${percent}%`,
  ].join('\n');

  return new EmbedBuilder()
    .setTitle(
      '<a:trangtrig2:1546040703375904801> **ĐỒNG HỒ ĐẾM NGƯỢC: GIỜ CHUỒN KHỎI TƯ BẢN** <a:trangtrig3:1546040818261954610>',
    )
    .setColor('#FFB6C1') // Hồng pastel
    .setDescription(description)
    .setFooter({
      text: 'Thu dọn balo dần và alt-tab sẵn đi là vừa!',
    });
}

/**
 * Xây dựng Embed LỊCH HÓNG TING TING.
 * @param {Date} nowVN Thời gian hiện tại theo giờ Việt Nam
 * @returns {EmbedBuilder}
 */
export function buildLuongEmbed(nowVN = getVietnamTime()) {
  const payday = 10; // Dự kiến ngày 10 hàng tháng
  const currentYear = nowVN.getFullYear();
  const currentMonth = nowVN.getMonth();
  const currentDate = nowVN.getDate();

  let targetDate;
  let prevDate;

  if (currentDate === payday) {
    targetDate = new Date(currentYear, currentMonth, payday, 0, 0, 0);
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    prevDate = new Date(prevYear, prevMonth, payday, 0, 0, 0);
  } else if (currentDate < payday) {
    targetDate = new Date(currentYear, currentMonth, payday, 0, 0, 0);
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    prevDate = new Date(prevYear, prevMonth, payday, 0, 0, 0);
  } else {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    targetDate = new Date(nextYear, nextMonth, payday, 0, 0, 0);
    prevDate = new Date(currentYear, currentMonth, payday, 0, 0, 0);
  }

  let remainingText = '';
  let percent = 0;

  if (currentDate === payday) {
    remainingText = '🎉 **HÔM NAY LÀ NGÀY TING TING!** Mau mở app ngân hàng hồi sinh tài khoản thôi!';
    percent = 100;
  } else {
    const diffMs = targetDate.getTime() - nowVN.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    remainingText = `${diffDays} ngày nữa mới hồi sinh tài khoản`;

    const totalPeriodMs = targetDate.getTime() - prevDate.getTime();
    const elapsedMs = nowVN.getTime() - prevDate.getTime();
    percent = Math.min(99, Math.max(1, Math.floor((elapsedMs / totalPeriodMs) * 100)));
  }

  const progressBar = formatProgressBar(percent, 10);

  const description = [
    `Dự kiến ngày ting ting: Ngày 10 hàng tháng`,
    ``,
    `Còn lại: ${remainingText}`,
    ``,
    `Thời gian tồn tại bằng mì gói: [${progressBar}] ${percent}% chặng đường`,
  ].join('\n');

  return new EmbedBuilder()
    .setTitle(
      '<a:trangtrig2:1546040703375904801> **LỊCH HÓNG TING TING** <a:trangtrig3:1546040818261954610>',
    )
    .setColor('#FFB6C1') // Hồng pastel
    .setDescription(description)
    .setFooter({
      text: 'Cố lên culi, đừng để tiền đình trước khi tiền về!',
    });
}

/**
 * Xử lý tự động phản hồi trong kênh Than Vãn Tư Bản (ID: 1559832849798926357).
 * Lắng nghe từ khóa Tan Làm / Chuồn khỏi tư bản và Ngày Lương / Ting Ting.
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} true nếu tin nhắn thuộc kênh than vãn và được xử lý/chặn bởi cooldown, false nếu bỏ qua
 */
export async function handleThanVanTuBan(message) {
  try {
    if (!message.guild || message.author?.bot || !message.content?.trim()) {
      return false;
    }

    // Chỉ nhận cố định ở ID kênh 1559832849798926357 (hoặc thread con thuộc kênh này)
    const isTargetChannel =
      message.channelId === THAN_VAN_CHANNEL_ID ||
      message.channel?.parentId === THAN_VAN_CHANNEL_ID;

    if (!isTargetChannel) {
      return false;
    }

    const content = message.content.trim();
    const unaccented = removeAccents(content);

    // 1. Kiểm tra từ khóa Tan Làm / Được về / Giờ chuồn
    const isTanLam =
      TAN_LAM_REGEX.test(content) || TAN_LAM_NO_ACCENT_REGEX.test(unaccented);

    if (isTanLam) {
      // Cooldown 2 phút chống spam
      if (checkCooldown('tanlam', message.channelId, COOLDOWN_MS)) {
        logger.debug(
          `[ThanVanTuBan] Từ khóa tan làm kích hoạt nhưng đang trong thời gian cooldown 2 phút tại kênh ${message.channelId}`,
        );
        return true;
      }

      const embed = buildTanLamEmbed();

      await message
        .reply({
          embeds: [embed],
          allowedMentions: { repliedUser: false },
        })
        .catch(async () => {
          await message.channel.send({ embeds: [embed] }).catch(() => {});
        });

      logger.info(
        `[ThanVanTuBan] Đã gửi đồng hồ đếm ngược tan làm cho ${message.author.tag} (${message.author.id}) tại kênh ${message.channelId}`,
      );

      return true;
    }

    // 2. Kiểm tra từ khóa Lương / Ting Ting / Tiền về
    const isLuong =
      LUONG_REGEX.test(content) || LUONG_NO_ACCENT_REGEX.test(unaccented);

    if (isLuong) {
      // Cooldown 2 phút chống spam
      if (checkCooldown('luong', message.channelId, COOLDOWN_MS)) {
        logger.debug(
          `[ThanVanTuBan] Từ khóa lương kích hoạt nhưng đang trong thời gian cooldown 2 phút tại kênh ${message.channelId}`,
        );
        return true;
      }

      const embed = buildLuongEmbed();

      await message
        .reply({
          embeds: [embed],
          allowedMentions: { repliedUser: false },
        })
        .catch(async () => {
          await message.channel.send({ embeds: [embed] }).catch(() => {});
        });

      logger.info(
        `[ThanVanTuBan] Đã gửi lịch hóng ting ting cho ${message.author.tag} (${message.author.id}) tại kênh ${message.channelId}`,
      );

      return true;
    }

    return false;
  } catch (error) {
    logger.error('[ThanVanTuBan] Lỗi khi xử lý auto-responder kênh than vãn:', error);
    return false;
  }
}
