import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
import { WitchHunterService } from './witchHunterService.js';
import { logger } from '../utils/logger.js';
import { getFromDb, setInDb } from '../utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const MONTHLY_LOG_PATH = path.join(DATA_DIR, 'pumpkin_monthly_logs.jsonl');
const TODAY_BUFFER_PATH = path.join(DATA_DIR, 'pumpkin_today_buffer.json');

/**
 * Service theo dõi tăng trưởng cấp ma thuật hằng ngày & tổng hợp BXH tháng theo chu kỳ cố định:
 * - Chu kỳ tháng chốt sổ cố định vào 00:00 ngày 24 mỗi tháng.
 * - Dữ liệu tích lũy được tổng hợp CHÍNH XÁC từ các Báo Cáo Hoạt Động Hằng Ngày.
 * - Báo cáo hằng ngày được lưu trữ vĩnh viễn trên PostgreSQL Database (chống mất dữ liệu khi bot restart/redeploy).
 * - Nếu đến 00:00 ngày 24 mà Admin chưa gõ lệnh /chot-bxh: dữ liệu tháng cũ vẫn lưu nguyên vẹn chờ lệnh chốt,
 *   lệnh /preview-bxh sẽ tự động phân chia giữa "Tháng trước (Chờ chốt sổ)" và "Tháng này (Chu kỳ hiện tại)".
 * - Khi Admin chạy /chot-bxh: tổng hợp vinh danh, phát Bí Ngô, lưu trữ (archive) và xóa dữ liệu tháng đã chốt.
 */
class PumpkinGrowthTracker {
  constructor() {
    // Bộ nhớ tạm trong ngày: Map<userId, { voiceMs: number, messageCount: number, chatLevels: number, voiceLevels: number }>
    this.todayBuffer = new Map();
    // Danh sách bản ghi báo cáo ngày trong bộ nhớ (đồng bộ với DB): Array<Record>
    this.dailyLogs = [];
    // Danh sách các chu kỳ đã chốt sổ: Array<string> (Ví dụ: ['2026-09'])
    this.closedCycles = [];
    this.isSynced = false;
    this.bufferSaveTimeout = null;
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

  /**
   * Tính cycleKey dạng YYYY-MM cho một mốc thời gian (timezone Asia/Ho_Chi_Minh).
   * Mốc chốt sổ là 00:00 ngày 24 mỗi tháng:
   * - Ngày 24 lúc 00:00 là thời điểm tổng kết hoạt động ngày 23 (báo cáo cuối cùng của chu kỳ tháng đó).
   * - Sau 00:00 ngày 24 trở đi, toàn bộ hoạt động được tính cho chu kỳ tháng kế tiếp (chốt vào 00:00 ngày 24 tháng sau).
   */
  getCycleKeyForDate(dateObj = new Date()) {
    const vnDateStr = dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnTimeStr = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    const [mStr, dStr, yStr] = vnDateStr.split('/');
    const [hStr, minStr] = vnTimeStr.split(':');
    const day = parseInt(dStr, 10);
    const month = parseInt(mStr, 10);
    const year = parseInt(yStr, 10);
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(minStr, 10);

    if (day < 24 || (day === 24 && hours === 0 && minutes === 0)) {
      return `${year}-${String(month).padStart(2, '0')}`;
    } else {
      if (month === 12) {
        return `${year + 1}-01`;
      } else {
        return `${year}-${String(month + 1).padStart(2, '0')}`;
      }
    }
  }

  getPreviousCycleKey(cycleKey) {
    const [y, m] = cycleKey.split('-').map(Number);
    if (m === 1) {
      return `${y - 1}-12`;
    }
    return `${y}-${String(m - 1).padStart(2, '0')}`;
  }

  getCycleDisplayName(cycleKey) {
    if (!cycleKey || !cycleKey.includes('-')) return 'Tháng hiện tại';
    const [y, m] = cycleKey.split('-').map(Number);
    return `Tháng ${m}/${y}`;
  }

  /**
   * Đồng bộ dữ liệu báo cáo hằng ngày và các chu kỳ đã chốt từ PostgreSQL Database
   */
  async syncWithPersistentDb(client = null) {
    try {
      const pgLogs = await getFromDb('temp:witch_hunter:daily_logs');
      if (Array.isArray(pgLogs)) {
        this.dailyLogs = pgLogs;
      }

      const pgClosed = await getFromDb('temp:witch_hunter:closed_cycles');
      if (Array.isArray(pgClosed)) {
        this.closedCycles = pgClosed;
      }

      // Đọc bổ sung từ file JSONL cục bộ nếu có dữ liệu chưa lên DB
      if (fs.existsSync(MONTHLY_LOG_PATH)) {
        try {
          const raw = fs.readFileSync(MONTHLY_LOG_PATH, 'utf-8');
          const lines = raw.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const item = JSON.parse(line);
              if (item && item.userId && item.date) {
                const exists = this.dailyLogs.some(
                  (l) => l.userId === item.userId && l.date === item.date && (l.timestamp || 0) === (item.timestamp || 0)
                );
                if (!exists) {
                  if (!item.cycleKey) {
                    item.cycleKey = this.getCycleKeyForDate(item.timestamp ? new Date(item.timestamp) : new Date());
                  }
                  this.dailyLogs.push(item);
                }
              }
            } catch {}
          }
        } catch {}
      }

      // Nếu bộ nhớ DB còn trống (hoặc sau khi deploy lại container), quét kênh báo cáo để tự động phục hồi
      if (client && this.dailyLogs.length === 0) {
        await this.recoverFromDailyReportChannel(client);
      }

      // Khôi phục bộ nhớ hoạt động hôm nay (todayBuffer) từ DB/file nếu cùng ngày
      const todayStr = new Date().toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      let pgBuffer = await getFromDb('temp:witch_hunter:today_buffer').catch(() => null);
      if (!pgBuffer && fs.existsSync(TODAY_BUFFER_PATH)) {
        try {
          const raw = fs.readFileSync(TODAY_BUFFER_PATH, 'utf-8');
          pgBuffer = JSON.parse(raw);
        } catch {}
      }

      if (pgBuffer && pgBuffer.date === todayStr && pgBuffer.entries) {
        for (const [uId, stats] of Object.entries(pgBuffer.entries)) {
          this.todayBuffer.set(uId, {
            voiceMs: Number(stats.voiceMs) || 0,
            messageCount: Number(stats.messageCount) || 0,
            chatLevels: Number(stats.chatLevels) || 0,
            voiceLevels: Number(stats.voiceLevels) || 0,
          });
        }
        logger.info(`🎃 [PumpkinTracker] Đã khôi phục dữ liệu hoạt động hôm nay (${this.todayBuffer.size} thành viên) từ database.`);
      }

      this.isSynced = true;
      logger.info(`🎃 [PumpkinTracker] Đã nạp ${this.dailyLogs.length} bản ghi báo cáo ngày (${this.closedCycles.length} chu kỳ đã chốt).`);
    } catch (e) {
      logger.error('❌ [PumpkinTracker] Lỗi khi đồng bộ daily logs từ DB:', e);
    }
  }

  async saveDailyLogsToDb() {
    try {
      await setInDb('temp:witch_hunter:daily_logs', this.dailyLogs);
      // Ghi ra file JSONL cục bộ làm cache stream
      if (this.dailyLogs.length > 0) {
        const lines = this.dailyLogs.map((r) => JSON.stringify(r)).join('\n') + '\n';
        fs.writeFileSync(MONTHLY_LOG_PATH, lines, 'utf-8');
      } else if (fs.existsSync(MONTHLY_LOG_PATH)) {
        fs.unlinkSync(MONTHLY_LOG_PATH);
      }
    } catch (e) {
      logger.error('❌ [PumpkinTracker] Lỗi khi lưu daily logs vào DB:', e);
    }
  }

  async saveClosedCyclesToDb() {
    try {
      await setInDb('temp:witch_hunter:closed_cycles', this.closedCycles);
    } catch (e) {
      logger.error('❌ [PumpkinTracker] Lỗi khi lưu closed cycles vào DB:', e);
    }
  }

  /**
   * Quét các tin nhắn embed Báo Cáo Hằng Ngày đã gửi trong kênh Admin để tự động khôi phục dữ liệu
   */
  async recoverFromDailyReportChannel(client) {
    if (!client) return;
    try {
      const channelId = WITCH_HUNTER_CONFIG.channels.dailyReportChannelId;
      const channel = client.channels.cache.get(channelId) || (await client.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased()) return;

      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (!messages || messages.size === 0) return;

      let recoveredCount = 0;
      for (const msg of messages.values()) {
        if (!msg.embeds || msg.embeds.length === 0) continue;
        for (const embed of msg.embeds) {
          const title = embed.title || '';
          if (!title.includes('Báo Cáo Hoạt Động Hằng Ngày:')) continue;
          const matchDate = title.match(/(\d{2}\/\d{2}\/\d{4})/);
          if (!matchDate) continue;
          const reportDate = matchDate[1];
          const desc = embed.description || '';

          const userBlocks = desc.split(/\*\*#\d+\.\*\*/);
          for (const block of userBlocks) {
            const userMatch = block.match(/<@(\d+)>/);
            if (!userMatch) continue;
            const userId = userMatch[1];

            if (this.dailyLogs.some((l) => l.userId === userId && l.date === reportDate)) {
              continue;
            }

            const voiceMinMatch = block.match(/Voice:\s*`?([\d.,]+)\s*phút/i);
            const voiceLvlMatch =
              block.match(/Voice:.*?->\s*\*\*?\+?(\d+)\s*cấp/i) ||
              block.match(/Voice:.*?\$\\rightarrow\$\s*\*\*?\+?(\d+)\s*cấp/i);
            const chatMsgMatch = block.match(/Chat:\s*`?([\d.,]+)\s*tin/i);
            const chatLvlMatch =
              block.match(/Chat:.*?->\s*\*\*?\+?(\d+)\s*cấp/i) ||
              block.match(/Chat:.*?\$\\rightarrow\$\s*\*\*?\+?(\d+)\s*cấp/i);
            const totalLvlMatch = block.match(/Tổng cấp tăng hôm nay:\s*\*\*?\+?(\d+)\s*cấp/i);

            const voiceMinutes = voiceMinMatch ? parseInt(voiceMinMatch[1].replace(/[.,]/g, ''), 10) : 0;
            const voiceLevels = voiceLvlMatch ? parseInt(voiceLvlMatch[1], 10) : Math.floor(voiceMinutes / 30);
            const messageCount = chatMsgMatch ? parseInt(chatMsgMatch[1].replace(/[.,]/g, ''), 10) : 0;
            const chatLevels = chatLvlMatch ? parseInt(chatLvlMatch[1], 10) : 0;
            const totalLevels = totalLvlMatch ? parseInt(totalLvlMatch[1], 10) : voiceLevels + chatLevels;

            const [d, m, y] = reportDate.split('/').map(Number);
            const cycleKey =
              d <= 24
                ? `${y}-${String(m).padStart(2, '0')}`
                : m === 12
                ? `${y + 1}-01`
                : `${y}-${String(m + 1).padStart(2, '0')}`;

            this.dailyLogs.push({
              date: reportDate,
              userId,
              voiceMinutes,
              voiceLevels,
              messageCount,
              chatLevels,
              totalLevels,
              timestamp: msg.createdTimestamp,
              cycleKey,
            });
            recoveredCount++;
          }
        }
      }

      if (recoveredCount > 0) {
        await this.saveDailyLogsToDb();
        logger.info(`🎃 [PumpkinTracker] Đã tự động phục hồi ${recoveredCount} bản ghi từ kênh báo cáo Admin.`);
      }
    } catch (e) {
      logger.error('❌ [PumpkinTracker] Lỗi khi tự động phục hồi từ kênh báo cáo:', e);
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

  scheduleTodayBufferSave() {
    if (this.bufferSaveTimeout) return;
    this.bufferSaveTimeout = setTimeout(() => {
      this.bufferSaveTimeout = null;
      this.saveTodayBuffer();
    }, 5000);
  }

  saveTodayBuffer() {
    try {
      this.ensureDataDir();
      const todayStr = new Date().toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const payload = {
        date: todayStr,
        entries: Object.fromEntries(this.todayBuffer.entries()),
      };

      fs.writeFileSync(TODAY_BUFFER_PATH, JSON.stringify(payload, null, 2), 'utf-8');
      setInDb('temp:witch_hunter:today_buffer', payload).catch(() => null);
    } catch (err) {
      logger.error('❌ [PumpkinTracker] Lỗi lưu todayBuffer:', err);
    }
  }

  /**
   * Ghi nhận thời gian Voice của người dùng (tính bằng mili-giây)
   */
  recordVoiceDuration(userId, durationMs) {
    if (!userId || durationMs <= 0) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.voiceMs += Number(durationMs) || 0;
    this.scheduleTodayBufferSave();
  }

  /**
   * Ghi nhận 1 tin nhắn chat hợp lệ của người dùng
   */
  recordChatMessage(userId) {
    if (!userId) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.messageCount += 1;
    this.scheduleTodayBufferSave();
  }

  /**
   * Ghi nhận cấp tăng THỰC TẾ từ Chat (khi đủ XP lên level trong xpSystem.js)
   */
  recordChatLevelUp(userId, levelsGained = 1) {
    if (!userId || levelsGained <= 0) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.chatLevels += Number(levelsGained) || 1;
    this.scheduleTodayBufferSave();
  }

  /**
   * Ghi nhận cấp tăng THỰC TẾ từ Voice (mỗi 30 phút voice = +1 level trong voiceLevelService.js)
   */
  recordVoiceLevelUp(userId, levelsGained = 1) {
    if (!userId || levelsGained <= 0) return;
    const entry = this.getOrCreateUserEntry(userId);
    entry.voiceLevels += Number(levelsGained) || 1;
    this.scheduleTodayBufferSave();
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
   * Alias cho getTodayStats để tương thích ngược
   */
  getTodayUserStats(userId) {
    return this.getTodayStats(userId);
  }

  /**
   * Kích hoạt vào 00:00 mỗi ngày:
   * 1. Tính toán cấp tăng trong ngày của từng thành viên
   * 2. Ghi vào database (PostgreSQL) và file pumpkin_monthly_logs.jsonl
   * 3. Gửi báo cáo bí mật hằng ngày vào Kênh Admin (dailyReportChannelId)
   * 4. Dọn sạch bộ nhớ tạm hôm nay & giải phóng RAM
   */
  async flushDailyReport(client) {
    try {
      if (!this.isSynced) {
        await this.syncWithPersistentDb(client);
      }

      if (this.todayBuffer.size === 0) {
        logger.info('🎃 [PumpkinTracker] Hôm nay không có hoạt động Voice/Chat nào cần lưu.');
        return;
      }

      // Tại thời điểm 00:00, báo cáo là tổng kết của ngày hôm qua (vừa hoàn thành lúc 23:59:59)
      const reportDate = new Date(Date.now() - 60000);
      const todayStr = reportDate.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      // Chu kỳ tính theo ngày báo cáo (ngày 23 thuộc chu kỳ kết thúc ngày 24)
      const cycleKey = this.getCycleKeyForDate(reportDate);

      const recordsToWrite = [];
      const userSummaryList = [];

      for (const [userId, stats] of this.todayBuffer.entries()) {
        const voiceMinutes = Math.floor(stats.voiceMs / 60000);
        const voiceLevels = stats.voiceLevels > 0 ? stats.voiceLevels : Math.floor(voiceMinutes / 30);
        const chatLevels = stats.chatLevels || 0;
        const totalLevels = voiceLevels + chatLevels;

        if (voiceMinutes > 0 || stats.messageCount > 0 || totalLevels > 0) {
          const rec = {
            date: todayStr,
            userId,
            voiceMinutes,
            voiceLevels,
            messageCount: stats.messageCount,
            chatLevels,
            totalLevels,
            timestamp: Date.now(),
            cycleKey,
          };
          recordsToWrite.push(rec);
          this.dailyLogs.push(rec);

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

      // 1. Lưu vĩnh viễn vào PostgreSQL Database
      if (recordsToWrite.length > 0) {
        await this.saveDailyLogsToDb();
        logger.info(`🎃 [PumpkinTracker] Đã lưu ${recordsToWrite.length} bản ghi ngày ${todayStr} (Chu kỳ ${cycleKey}).`);
      }

      // 2. Gửi Embed báo cáo bí mật vào kênh Admin
      const { channels, colors, emojis } = WITCH_HUNTER_CONFIG;
      const reportChannelId = channels.dailyReportChannelId;

      if (reportChannelId && client) {
        try {
          const reportChannel =
            client.channels.cache.get(reportChannelId) || (await client.channels.fetch(reportChannelId).catch(() => null));

          if (reportChannel) {
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
              .setColor(colors.pastelPurple)
              .setTitle(`${emojis.titleLeft} 𝓑𝓪́𝓸 𝓒𝓪́𝓸 𝓗𝓸𝓪̣𝓽 Đ𝓸̣̂𝓷𝓰 𝓗𝓪̆̀𝓷𝓰 𝓝𝓰𝓪̀𝔂: ${todayStr} ${emojis.titleRight}`)
              .setDescription(
                `Dưới đây là tổng kết hoạt động rèn luyện ma thuật (Voice + Chat) trong ngày **${todayStr}**:\n` +
                  `*(Báo cáo gửi tự động lúc 00:00 dành riêng cho Ban Quản Trị)*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  (descriptionLines.length > 0 ? descriptionLines.join('\n\n') : '*Không có thành viên nào hoạt động hôm nay.*')
              )
              .setFooter({
                text: 'Witch Hunter Daily Tracker',
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
      try {
        if (fs.existsSync(TODAY_BUFFER_PATH)) {
          fs.unlinkSync(TODAY_BUFFER_PATH);
        }
      } catch {}
      setInDb('temp:witch_hunter:today_buffer', null).catch(() => null);

      if (typeof global.gc === 'function') {
        global.gc();
      }
      logger.info('🎃 [PumpkinTracker] Đã dọn sạch bộ nhớ tạm trong ngày.');
    } catch (error) {
      logger.error('❌ [PumpkinTracker] Lỗi trong flushDailyReport:', error);
    }
  }

  /**
   * Tổng hợp Bảng Xếp Hạng Level Tháng từ toàn bộ các báo cáo hằng ngày đã ghi nhận:
   * @param {Object} options
   * @param {'auto' | 'previous' | 'current'} [options.cycleMode='auto']
   * - 'previous': Xem chu kỳ tháng trước (chu kỳ kết thúc ngày 24 đang chờ chốt)
   * - 'current': Xem chu kỳ tháng này (bắt đầu từ 00:00 ngày 24 tới hiện tại)
   * - 'auto': Nếu chu kỳ trước chưa chốt -> ưu tiên xem tháng trước; nếu đã chốt rồi -> xem tháng này.
   */
  async getMonthlyLeaderboard(options = {}) {
    const { cycleMode = 'auto', client = null } = options;
    if (!this.isSynced || (client && this.dailyLogs.length === 0)) {
      await this.syncWithPersistentDb(client);
    }

    const currentCycleKey = this.getCycleKeyForDate(new Date());
    const previousCycleKey = this.getPreviousCycleKey(currentCycleKey);
    const isPreviousPending = !this.closedCycles.includes(previousCycleKey);

    let targetCycleKey = currentCycleKey;
    let isPendingView = false;

    if (cycleMode === 'previous') {
      targetCycleKey = previousCycleKey;
      isPendingView = isPreviousPending;
    } else if (cycleMode === 'current') {
      targetCycleKey = currentCycleKey;
      isPendingView = false;
    } else {
      // auto
      if (isPreviousPending) {
        targetCycleKey = previousCycleKey;
        isPendingView = true;
      } else {
        targetCycleKey = currentCycleKey;
        isPendingView = false;
      }
    }

    const userAggregates = new Map();

    // 1. Cộng dồn tất cả các Báo Cáo Hằng Ngày thuộc chu kỳ targetCycleKey
    for (const record of this.dailyLogs) {
      if (record.cycleKey !== targetCycleKey) continue;
      const userId = record.userId;
      if (!userId) continue;

      const existing = userAggregates.get(userId) || {
        userId,
        voiceMinutes: 0,
        voiceLevels: 0,
        messageCount: 0,
        chatLevels: 0,
        totalLevels: 0,
      };

      existing.voiceMinutes += Number(record.voiceMinutes) || 0;
      existing.voiceLevels += Number(record.voiceLevels) || 0;
      existing.messageCount += Number(record.messageCount) || 0;
      existing.chatLevels += Number(record.chatLevels) || 0;
      existing.totalLevels += Number(record.totalLevels) || 0;

      userAggregates.set(userId, existing);
    }

    // 2. Nếu đang xem chu kỳ hiện tại (thang_nay), cộng dồn thêm phần dữ liệu của ngày hôm nay đang nằm trong todayBuffer
    if (targetCycleKey === currentCycleKey) {
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
    }

    const leaderboard = Array.from(userAggregates.values());

    // Sắp xếp theo tổng cấp tăng trong tháng giảm dần
    leaderboard.sort((a, b) => {
      if (b.totalLevels !== a.totalLevels) {
        return b.totalLevels - a.totalLevels;
      }
      return b.voiceMinutes + b.messageCount - (a.voiceMinutes + a.messageCount);
    });

    return {
      leaderboard,
      targetCycleKey,
      displayName: this.getCycleDisplayName(targetCycleKey),
      isPendingView,
      isPreviousPending,
      currentCycleKey,
      previousCycleKey,
    };
  }

  /**
   * Chốt sổ chu kỳ tháng: Lưu trữ (archive), đánh dấu chu kỳ đã chốt và xóa toàn bộ các bản ghi của chu kỳ đó khỏi bộ nhớ/DB
   */
  async archiveAndCloseCycle(cycleKey, thangName = '') {
    try {
      if (!this.isSynced) {
        await this.syncWithPersistentDb();
      }

      const targetKey = cycleKey || this.getPreviousCycleKey(this.getCycleKeyForDate(new Date()));
      logger.info(`🎃 [PumpkinTracker] Bắt đầu lưu trữ và đóng chu kỳ: ${targetKey} (${thangName})`);

      // 1. Tách các bản ghi của chu kỳ được chốt ra để archive
      const cycleRecords = this.dailyLogs.filter((r) => r.cycleKey === targetKey);

      // Lưu archive vào PostgreSQL
      await setInDb(`temp:witch_hunter:archived_cycles:${targetKey}`, {
        cycleKey: targetKey,
        name: thangName,
        closedAt: Date.now(),
        records: cycleRecords,
      });

      // Lưu file archive cục bộ
      const safeName = (thangName || targetKey).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const archivePath = path.join(DATA_DIR, `pumpkin_monthly_${safeName}_${Date.now()}.jsonl`);
      if (cycleRecords.length > 0) {
        const lines = cycleRecords.map((r) => JSON.stringify(r)).join('\n') + '\n';
        fs.writeFileSync(archivePath, lines, 'utf-8');
      }

      // 2. Đánh dấu chu kỳ đã hoàn thành
      if (!this.closedCycles.includes(targetKey)) {
        this.closedCycles.push(targetKey);
        await this.saveClosedCyclesToDb();
      }

      // 3. XÓA BỎ toàn bộ các bản ghi thuộc chu kỳ đã chốt khỏi danh sách hoạt động (giữ lại các bản ghi của chu kỳ mới)
      this.dailyLogs = this.dailyLogs.filter((r) => r.cycleKey !== targetKey);
      await this.saveDailyLogsToDb();

      // Nếu đang chốt chu kỳ hiện tại thì dọn sạch todayBuffer
      const currentKey = this.getCycleKeyForDate(new Date());
      if (targetKey === currentKey) {
        this.todayBuffer.clear();
      }

      if (typeof global.gc === 'function') {
        global.gc();
      }
      logger.info(`🎃 [PumpkinTracker] Đã đóng và xóa dữ liệu chu kỳ ${targetKey} thành công.`);
    } catch (e) {
      logger.error('❌ [PumpkinTracker] Lỗi khi archive và close cycle:', e);
    }
  }

  // Alias tương thích ngược cho các lời gọi cũ
  async archiveAndResetMonth(thangName = '') {
    const currentKey = this.getCycleKeyForDate(new Date());
    const prevKey = this.getPreviousCycleKey(currentKey);
    const targetKey = !this.closedCycles.includes(prevKey) ? prevKey : currentKey;
    await this.archiveAndCloseCycle(targetKey, thangName);
  }
}

export const pumpkinGrowthTracker = new PumpkinGrowthTracker();
export default pumpkinGrowthTracker;
