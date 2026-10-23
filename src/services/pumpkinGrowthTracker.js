import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
import { WitchHunterService } from './witchHunterService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const MONTHLY_LOG_PATH = path.join(DATA_DIR, 'pumpkin_monthly_logs.jsonl');

/**
 * Service theo dõi tăng trưởng cấp ma thuật hằng ngày & tổng hợp điểm Bí Ngô tháng.
 * Ghi nhận CHÍNH XÁC theo hệ thống Leveling thực tế của server:
 * - Voice: 30 phút Voice = +1 cấp
 * - Chat: Cấp tăng thực tế theo hệ thống XP của Tu Tiên (XP = 5(level²) + 50(level) + 50)
 */
class PumpkinGrowthTracker {
  constructor() {
    // Bộ nhớ tạm trong ngày: Map<userId, { voiceMs: number, messageCount: number, chatLevels: number, voiceLevels: number }>
    this.todayBuffer = new Map();
    this.ensureDataDir();
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      logger.error('❌ [PumpkinTracker] Không thể tạo thư mục data:', e);
    }
  }

  getOrCreateUserEntry(userId) {
    let entry = this.todayBuffer.get(userId);
    if (!entry) {
      entry = {
        voiceMs: 0,
        messageCount: 0,
        chatLevels: 0,
        voiceLevels: 0,
      };
      this.todayBuffer.set(userId, entry);
    }
    return entry;
  }

  /**
   * Ghi nhận thời gian Voice của người dùng (tính bằng mili-giây)
   */
  recordVoiceDuration(userId, durationMs) {
    if (!userId || durationMs <= 0) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.voiceMs += Number(durationMs) || 0;
  }

  /**
   * Ghi nhận 1 tin nhắn chat hợp lệ của người dùng
   */
  recordChatMessage(userId) {
    if (!userId) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.messageCount += 1;
  }

  /**
   * Ghi nhận cấp tăng THỰC TẾ từ Chat (khi đủ XP lên level trong xpSystem.js)
   */
  recordChatLevelUp(userId, levelsGained = 1) {
    if (!userId || levelsGained <= 0) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.chatLevels += Number(levelsGained) || 1;
  }

  /**
   * Ghi nhận cấp tăng THỰC TẾ từ Voice (mỗi 30 phút voice = +1 level trong voiceLevelService.js)
   */
  recordVoiceLevelUp(userId, levelsGained = 1) {
    if (!userId || levelsGained <= 0) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.voiceLevels += Number(levelsGained) || 1;
  }

  /**
   * Lấy số liệu hoạt động trong ngày hôm nay của 1 người
   */
  getTodayStats(userId) {
    const stats = this.todayBuffer.get(userId) || {
      voiceMs: 0,
      messageCount: 0,
      chatLevels: 0,
      voiceLevels: 0,
    };
    const voiceMinutes = Math.floor(stats.voiceMs / 60000);
    const calculatedVoiceLevels = stats.voiceLevels > 0 ? stats.voiceLevels : Math.floor(voiceMinutes / 30);
    const totalLevels = calculatedVoiceLevels + stats.chatLevels;

    return {
      voiceMinutes,
      voiceLevels: calculatedVoiceLevels,
      messageCount: stats.messageCount,
      chatLevels: stats.chatLevels,
      totalLevels,
    };
  }

  /**
   * Kích hoạt vào 00:00 mỗi ngày:
   * 1. Tính toán cấp tăng trong ngày của từng thành viên
   * 2. Ghi nối tiếp vào file pumpkin_monthly_logs.jsonl
   * 3. Gửi báo cáo bí mật hằng ngày vào Kênh Admin (dailyReportChannelId)
   * 4. Dọn sạch bộ nhớ tạm hôm nay & giải phóng RAM
   */
  async flushDailyReport(client) {
    try {
      if (this.todayBuffer.size === 0) {
        logger.info('🎃 [PumpkinTracker] Hôm nay không có hoạt động Voice/Chat nào cần lưu.');
        return;
      }

      const todayStr = new Date().toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const recordsToWrite = [];
      const userSummaryList = [];

      for (const [userId, stats] of this.todayBuffer.entries()) {
        const voiceMinutes = Math.floor(stats.voiceMs / 60000);
        // Cấp voice ưu tiên lấy từ event awardVoiceLevels thực tế, hoặc quy đổi 30p = 1 cấp
        const voiceLevels = stats.voiceLevels > 0 ? stats.voiceLevels : Math.floor(voiceMinutes / 30);
        const chatLevels = stats.chatLevels || 0;
        const totalLevels = voiceLevels + chatLevels;

        // Chỉ ghi nhận nếu thành viên có hoạt động
        if (voiceMinutes > 0 || stats.messageCount > 0 || totalLevels > 0) {
          recordsToWrite.push({
            date: todayStr,
            userId,
            voiceMinutes,
            voiceLevels,
            messageCount: stats.messageCount,
            chatLevels,
            totalLevels,
            timestamp: Date.now(),
          });

          userSummaryList.push({
            userId,
            voiceMinutes,
            voiceLevels,
            messageCount: stats.messageCount,
            chatLevels,
            totalLevels,
          });
        }
      }

      // 1. Ghi vào file log tháng dưới dạng JSON Lines (Stream Append)
      if (recordsToWrite.length > 0) {
        const lines = recordsToWrite.map((r) => JSON.stringify(r)).join('\n') + '\n';
        fs.appendFileSync(MONTHLY_LOG_PATH, lines, 'utf-8');
        logger.info(`🎃 [PumpkinTracker] Đã ghi nhận ${recordsToWrite.length} bản ghi hoạt động ngày ${todayStr}.`);
      }

      // 2. Gửi Embed báo cáo bí mật vào kênh Admin
      const { channels, colors, emojis } = WITCH_HUNTER_CONFIG;
      const reportChannelId = channels.dailyReportChannelId;

      if (reportChannelId && client) {
        try {
          const reportChannel = client.channels.cache.get(reportChannelId) ||
            await client.channels.fetch(reportChannelId).catch(() => null);

          if (reportChannel) {
            // Sắp xếp người tăng nhiều cấp nhất lên đầu
            userSummaryList.sort((a, b) => b.totalLevels - a.totalLevels || b.voiceMinutes - a.voiceMinutes);

            const topActive = userSummaryList.slice(0, 25);
            const descriptionLines = topActive.map((item, index) => {
              const profile = WitchHunterService.getUserProfile(item.userId);
              const factionTag = profile?.faction
                ? profile.faction === 'hunter'
                  ? `[${emojis.hunterButton} Thợ Săn]`
                  : `[${emojis.witchButton} Phù Thủy]`
                : `*(Chưa chọn phe)*`;

              return (
                `**#${index + 1}.** <@${item.userId}> ${factionTag}\n` +
                `> 🎙️ Voice: \`${item.voiceMinutes.toLocaleString('vi-VN')} phút\` $\\rightarrow$ **+${item.voiceLevels} cấp**\n` +
                `> 💬 Chat: \`${item.messageCount.toLocaleString('vi-VN')} tin nhắn\` $\\rightarrow$ **+${item.chatLevels} cấp thực tế**\n` +
                `> ⭐ **Tổng cấp tăng hôm nay: +${item.totalLevels} cấp**`
              );
            });

            const embed = new EmbedBuilder()
              .setColor(colors.pastelPurple) // Màu tím pastel nhạt nhạt cố định
              .setTitle(`${emojis.titleLeft} 𝓑𝓪́𝓸 𝓒𝓪́𝓸 𝓗𝓸𝓪̣𝓽 Đ𝓸̣̂𝓷𝓰 𝓗𝓪̆̀𝓷𝓰 𝓝𝓰𝓪̀𝔂: ${todayStr} ${emojis.titleRight}`)
              .setDescription(
                `Dưới đây là tổng kết hoạt động rèn luyện ma thuật (Voice + Chat) trong ngày **${todayStr}**:\n` +
                `*(Báo cáo gửi tự động lúc 00:00 dành riêng cho Ban Quản Trị)*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                (descriptionLines.length > 0 ? descriptionLines.join('\n\n') : '*Không có thành viên nào hoạt động hôm nay.*')
              )
              .setFooter({
                text: `Witch Hunter Daily Tracker • Em bot Usagi múp rụp phục vụ vợ của Kim Nong 💕`,
              })
              .setTimestamp();

            await reportChannel.send({ embeds: [embed] });
          }
        } catch (reportErr) {
          logger.error('❌ [PumpkinTracker] Lỗi gửi báo cáo ngày cho Admin:', reportErr);
        }
      }

      // 3. Reset bộ nhớ tạm trong ngày & thu gom rác GC
      this.todayBuffer.clear();
      if (typeof global.gc === 'function') {
        global.gc();
      }
      logger.info('🎃 [PumpkinTracker] Đã dọn sạch bộ nhớ tạm trong ngày.');
    } catch (error) {
      logger.error('❌ [PumpkinTracker] Lỗi trong flushDailyReport:', error);
    }
  }

  /**
   * Tổng hợp Bảng Xếp Hạng Tháng từ file JSONL:
   * Sử dụng NodeJS Stream đọc từng dòng, cực kỳ tiết kiệm RAM (< 1MB).
   * Cộng dồn tất cả cấp tăng của từng người trong tháng.
   */
  async getMonthlyLeaderboard() {
    const userAggregates = new Map();

    // 1. Đọc từ file pumpkin_monthly_logs.jsonl nếu tồn tại
    if (fs.existsSync(MONTHLY_LOG_PATH)) {
      try {
        const fileStream = fs.createReadStream(MONTHLY_LOG_PATH);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        for await (const line of rl) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            const userId = data.userId;
            if (!userId) continue;

            const existing = userAggregates.get(userId) || {
              userId,
              voiceMinutes: 0,
              voiceLevels: 0,
              messageCount: 0,
              chatLevels: 0,
              totalLevels: 0,
            };

            existing.voiceMinutes += Number(data.voiceMinutes) || 0;
            existing.voiceLevels += Number(data.voiceLevels) || 0;
            existing.messageCount += Number(data.messageCount) || 0;
            existing.chatLevels += Number(data.chatLevels) || 0;
            existing.totalLevels += Number(data.totalLevels) || 0;

            userAggregates.set(userId, existing);
          } catch (lineErr) {
            // Bỏ qua dòng lỗi
          }
        }
      } catch (err) {
        logger.error('❌ [PumpkinTracker] Lỗi đọc file monthly log:', err);
      }
    }

    // 2. Cộng dồn thêm phần dữ liệu của ngày hôm nay đang nằm trong todayBuffer (nếu chưa flush)
    for (const [userId, stats] of this.todayBuffer.entries()) {
      const voiceMinutes = Math.floor(stats.voiceMs / 60000);
      const voiceLevels = stats.voiceLevels > 0 ? stats.voiceLevels : Math.floor(voiceMinutes / 30);
      const chatLevels = stats.chatLevels || 0;
      const totalLevels = voiceLevels + chatLevels;

      if (voiceMinutes > 0 || stats.messageCount > 0 || totalLevels > 0) {
        const existing = userAggregates.get(userId) || {
          userId,
          voiceMinutes: 0,
          voiceLevels: 0,
          messageCount: 0,
          chatLevels: 0,
          totalLevels: 0,
        };

        existing.voiceMinutes += voiceMinutes;
        existing.voiceLevels += voiceLevels;
        existing.messageCount += stats.messageCount;
        existing.chatLevels += chatLevels;
        existing.totalLevels += totalLevels;

        userAggregates.set(userId, existing);
      }
    }

    const leaderboard = Array.from(userAggregates.values());

    // Sắp xếp theo tổng cấp tăng trong tháng giảm dần
    leaderboard.sort((a, b) => {
      if (b.totalLevels !== a.totalLevels) {
        return b.totalLevels - a.totalLevels;
      }
      return b.voiceMinutes + b.messageCount - (a.voiceMinutes + a.messageCount);
    });

    return leaderboard;
  }

  /**
   * Lưu trữ file log tháng cũ và làm mới để bắt đầu tháng mới sau khi chốt BXH
   */
  archiveAndResetMonth(thangName = '') {
    try {
      if (fs.existsSync(MONTHLY_LOG_PATH)) {
        const safeName = (thangName || 'archive')
          .replace(/[^a-zA-Z0-9_\-]/g, '_')
          .toLowerCase();
        const archivePath = path.join(DATA_DIR, `pumpkin_monthly_${safeName}_${Date.now()}.jsonl`);
        fs.renameSync(MONTHLY_LOG_PATH, archivePath);
        logger.info(`🎃 [PumpkinTracker] Đã lưu trữ file log tháng thành công sang: ${archivePath}`);
      }
      this.todayBuffer.clear();
      if (typeof global.gc === 'function') {
        global.gc();
      }
    } catch (e) {
      logger.error('❌ [PumpkinTracker] Lỗi khi lưu trữ và reset log tháng:', e);
    }
  }
}

export const pumpkinGrowthTracker = new PumpkinGrowthTracker();
export default pumpkinGrowthTracker;
