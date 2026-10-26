import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from './witchHunterService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const SQLITE_FILE_PATH = path.join(DATA_DIR, 'witch_hunter.sqlite');
const QUESTS_JSON_PATH = path.join(DATA_DIR, 'witch_hunter_quests.json');
const QUESTIONS_JSON_PATH = path.join(__dirname, '../data/puzzleQuestions.json');

/**
 * =========================================================
 * TIMEZONE & DATE UTILITIES (VIETNAM GMT+7)
 * =========================================================
 */
export function getVietnamDate(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const y = vnTime.getUTCFullYear();
  const m = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vnTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getVietnamWeekIdentifier(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const target = new Date(vnTime.valueOf());
  const dayNr = (vnTime.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = vnTime.getUTCFullYear();
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

export function isPuzzleWeekendOpen(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const dayOfWeek = vnTime.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Mở suốt cả 2 ngày Thứ Bảy (day 6) và Chủ Nhật (day 0)
  return dayOfWeek === 6 || dayOfWeek === 0;
}

/**
 * =========================================================
 * STORAGE ENGINE CHO NHIỆM VỤ & GIẢI MÃ CỔ NGỮ
 * =========================================================
 */
class WitchHunterQuestStorage {
  constructor() {
    this.sqliteDb = null;
    this.isSqlite = false;
    this.memoryData = {
      daily_rituals: {},
      weekly_quests: {},
      puzzle_records: {},
      questions: [],
    };
    this.flushTimeout = null;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Khởi tạo SQLite nếu có node:sqlite
      try {
        if (typeof process !== 'undefined' && process.versions && parseInt(process.versions.node) >= 22) {
          import('node:sqlite').then((mod) => {
            const { DatabaseSync } = mod;
            if (DatabaseSync) {
              this.sqliteDb = new DatabaseSync(SQLITE_FILE_PATH);
              this.sqliteDb.exec(`
                CREATE TABLE IF NOT EXISTS daily_rituals (
                  user_id TEXT PRIMARY KEY,
                  last_candle_date TEXT,
                  candle_streak INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS weekly_quests (
                  user_id TEXT PRIMARY KEY,
                  voice_days_done INTEGER DEFAULT 0,
                  last_voice_date TEXT,
                  chat_days_done INTEGER DEFAULT 0,
                  chat_count_today INTEGER DEFAULT 0,
                  last_chat_date TEXT,
                  react_count_week INTEGER DEFAULT 0,
                  react_done INTEGER DEFAULT 0,
                  last_weekly_reset TEXT
                );

                CREATE TABLE IF NOT EXISTS puzzle_questions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  question TEXT NOT NULL,
                  option_a TEXT NOT NULL,
                  option_b TEXT NOT NULL,
                  option_c TEXT NOT NULL,
                  option_d TEXT NOT NULL,
                  correct_option TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS puzzle_records (
                  user_id TEXT,
                  week_identifier TEXT,
                  score INTEGER DEFAULT 0,
                  reward_pumpkins INTEGER DEFAULT 0,
                  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (user_id, week_identifier)
                );
              `);
              this.isSqlite = true;
              this.seedQuestions();
              logger.info('🔮 [WitchHunterQuest] Storage Engine: SQLite đã sẵn sàng.');
            }
          }).catch(() => null);
        }
      } catch (err) {
        // Fallback về JSON
      }

      // Nạp JSON backup nếu có
      if (fs.existsSync(QUESTS_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(QUESTS_JSON_PATH, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.memoryData = {
              daily_rituals: parsed.daily_rituals || {},
              weekly_quests: parsed.weekly_quests || {},
              puzzle_records: parsed.puzzle_records || {},
              questions: parsed.questions || [],
            };
          }
        } catch (e) {
          logger.warn('⚠️ [WitchHunterQuest] Không thể parse file JSON nhiệm vụ:', e.message);
        }
      }

      // Nạp ngân hàng câu hỏi từ JSON
      this.loadQuestionsFromJson();

      // Đồng bộ dữ liệu với PostgreSQL
      this.syncWithPersistentDb().catch(() => null);
    } catch (error) {
      logger.error('❌ [WitchHunterQuest] Lỗi khởi tạo Quest Storage:', error);
    }
  }

  flushJson() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(QUESTS_JSON_PATH, JSON.stringify(this.memoryData, null, 2), 'utf-8');
    } catch (err) {
      logger.error('❌ [WitchHunterQuest] Lỗi ghi file backup JSON:', err);
    }
  }

  async syncWithPersistentDb() {
    try {
      const { getFromDb, setInDb } = await import('../utils/database.js');
      const pgData = await getFromDb('temp:witch_hunter:quests_data');
      if (pgData && typeof pgData === 'object') {
        this.memoryData.daily_rituals = { ...(pgData.daily_rituals || {}), ...this.memoryData.daily_rituals };
        this.memoryData.weekly_quests = { ...(pgData.weekly_quests || {}), ...this.memoryData.weekly_quests };
        this.memoryData.puzzle_records = { ...(pgData.puzzle_records || {}), ...this.memoryData.puzzle_records };
        this.flushJson();
        logger.info('🔮 [WitchHunterQuest] Đã nạp dữ liệu nhiệm vụ từ PostgreSQL Database.');
      } else if (Object.keys(this.memoryData.daily_rituals).length > 0) {
        await setInDb('temp:witch_hunter:quests_data', this.memoryData);
      }
    } catch (err) {
      logger.warn('⚠️ [WitchHunterQuest] Không thể đồng bộ PostgreSQL:', err.message);
    }
  }

  schedulePgSave() {
    if (this.pgSaveTimeout) return;
    this.pgSaveTimeout = setTimeout(async () => {
      this.pgSaveTimeout = null;
      try {
        const { setInDb } = await import('../utils/database.js');
        await setInDb('temp:witch_hunter:quests_data', this.memoryData);
      } catch (err) {
        logger.warn('⚠️ [WitchHunterQuest] Lỗi khi lưu dữ liệu lên PostgreSQL:', err.message);
      }
    }, 500);
  }

  loadQuestionsFromJson() {
    try {
      if (fs.existsSync(QUESTIONS_JSON_PATH)) {
        const raw = fs.readFileSync(QUESTIONS_JSON_PATH, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          this.memoryData.questions = list;
          logger.info(`🔮 [WitchHunterQuest] Đã nạp ${list.length} câu hỏi Giải Mã Cổ Ngữ từ JSON.`);
        }
      }
    } catch (e) {
      logger.error('❌ [WitchHunterQuest] Lỗi đọc câu hỏi từ puzzleQuestions.json:', e);
    }
  }

  seedQuestions() {
    if (!this.isSqlite || !this.sqliteDb) return;
    try {
      if (Array.isArray(this.memoryData.questions) && this.memoryData.questions.length > 0) {
        const checkStmt = this.sqliteDb.prepare('SELECT id FROM puzzle_questions WHERE question = ?');
        const insertStmt = this.sqliteDb.prepare(`
          INSERT INTO puzzle_questions (question, option_a, option_b, option_c, option_d, correct_option)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        let inserted = 0;
        for (const q of this.memoryData.questions) {
          const exists = checkStmt.get(q.question);
          if (!exists) {
            insertStmt.run(q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option);
            inserted++;
          }
        }
        if (inserted > 0) {
          logger.info(`🔮 [WitchHunterQuest] Đã nạp thêm ${inserted} câu hỏi mới vào SQLite.`);
        }
      }
    } catch (err) {
      logger.warn('⚠️ [WitchHunterQuest] Lỗi khi seed câu hỏi vào SQLite:', err.message);
    }
  }

  scheduleFlush() {
    this.flushJson();
    this.schedulePgSave();
  }

  // --- Daily Rituals ---
  getDailyRitual(userId) {
    if (!userId) return null;
    if (this.memoryData.daily_rituals[userId]) {
      return this.memoryData.daily_rituals[userId];
    }

    // Kiểm tra chéo với dữ liệu người dùng chính
    const mainUser = witchHunterStorage.getUser(userId);
    if (mainUser && mainUser.last_candle_date) {
      const res = {
        user_id: userId,
        last_candle_date: mainUser.last_candle_date,
        candle_streak: Number(mainUser.candle_streak) || 0,
      };
      this.memoryData.daily_rituals[userId] = res;
      return res;
    }

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare('SELECT * FROM daily_rituals WHERE user_id = ?');
        const row = stmt.get(userId);
        if (row) {
          const res = {
            user_id: row.user_id,
            last_candle_date: row.last_candle_date,
            candle_streak: Number(row.candle_streak) || 0,
          };
          this.memoryData.daily_rituals[userId] = res;
          return res;
        }
      } catch (e) {
        logger.error('❌ [WitchHunterQuest] SQLite getDailyRitual error:', e);
      }
    }
    return null;
  }

  saveDailyRitual(userId, lastCandleDate, candleStreak) {
    if (!userId) return;
    const record = {
      user_id: userId,
      last_candle_date: lastCandleDate,
      candle_streak: Number(candleStreak) || 0,
    };
    this.memoryData.daily_rituals[userId] = record;
    this.flushJson();
    this.schedulePgSave();

    // Lưu đồng thời vào user record chính của WitchHunter
    const mainUser = witchHunterStorage.getUser(userId);
    if (mainUser) {
      mainUser.last_candle_date = lastCandleDate;
      mainUser.candle_streak = Number(candleStreak) || 0;
      witchHunterStorage.saveUser(mainUser, true);
    }

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO daily_rituals (user_id, last_candle_date, candle_streak)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            last_candle_date = excluded.last_candle_date,
            candle_streak = excluded.candle_streak
        `);
        stmt.run(userId, lastCandleDate, Number(candleStreak) || 0);
      } catch (e) {
        logger.error('❌ [WitchHunterQuest] SQLite saveDailyRitual error:', e);
      }
    }
  }

  // --- Weekly Quests ---
  getWeeklyQuest(userId) {
    const currentWeek = getVietnamWeekIdentifier();
    const today = getVietnamDate();
    let record = this.memoryData.weekly_quests[userId];

    if (!record && this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare('SELECT * FROM weekly_quests WHERE user_id = ?');
        const row = stmt.get(userId);
        if (row) {
          record = {
            user_id: row.user_id,
            voice_days_done: Number(row.voice_days_done) || 0,
            last_voice_date: row.last_voice_date || null,
            chat_days_done: Number(row.chat_days_done) || 0,
            chat_count_today: Number(row.chat_count_today) || 0,
            last_chat_date: row.last_chat_date || null,
            react_count_week: Number(row.react_count_week) || 0,
            react_done: Number(row.react_done) || 0,
            last_weekly_reset: row.last_weekly_reset || currentWeek,
          };
          this.memoryData.weekly_quests[userId] = record;
        }
      } catch (e) {
        logger.error('❌ [WitchHunterQuest] SQLite getWeeklyQuest error:', e);
      }
    }

    if (!record) {
      record = {
        user_id: userId,
        voice_days_done: 0,
        last_voice_date: null,
        chat_days_done: 0,
        chat_count_today: 0,
        last_chat_date: today,
        react_count_week: 0,
        react_done: 0,
        last_weekly_reset: currentWeek,
      };
      this.saveWeeklyQuest(record);
      return record;
    }

    // Reset tuần nếu sang tuần mới
    let modified = false;
    if (record.last_weekly_reset !== currentWeek) {
      record.voice_days_done = 0;
      record.last_voice_date = null;
      record.chat_days_done = 0;
      record.chat_count_today = 0;
      record.last_chat_date = today;
      record.react_count_week = 0;
      record.react_done = 0;
      record.last_weekly_reset = currentWeek;
      modified = true;
    } else if (record.last_chat_date !== today) {
      // Reset số tin chat trong ngày nếu sang ngày mới
      record.chat_count_today = 0;
      record.last_chat_date = today;
      modified = true;
    }

    if (modified) {
      this.saveWeeklyQuest(record);
    }

    return record;
  }

  saveWeeklyQuest(record) {
    this.memoryData.weekly_quests[record.user_id] = { ...record };
    this.scheduleFlush();

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO weekly_quests (
            user_id, voice_days_done, last_voice_date,
            chat_days_done, chat_count_today, last_chat_date,
            react_count_week, react_done, last_weekly_reset
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            voice_days_done = excluded.voice_days_done,
            last_voice_date = excluded.last_voice_date,
            chat_days_done = excluded.chat_days_done,
            chat_count_today = excluded.chat_count_today,
            last_chat_date = excluded.last_chat_date,
            react_count_week = excluded.react_count_week,
            react_done = excluded.react_done,
            last_weekly_reset = excluded.last_weekly_reset
        `);
        stmt.run(
          record.user_id,
          record.voice_days_done,
          record.last_voice_date,
          record.chat_days_done,
          record.chat_count_today,
          record.last_chat_date,
          record.react_count_week,
          record.react_done,
          record.last_weekly_reset
        );
      } catch (e) {
        logger.error('❌ [WitchHunterQuest] SQLite saveWeeklyQuest error:', e);
      }
    }
  }

  // --- Puzzle Records ---
  getPuzzleRecord(userId, weekIdentifier) {
    if (!userId || !weekIdentifier) return null;
    const key = `${userId}:${weekIdentifier}`;
    if (this.memoryData.puzzle_records[key]) {
      return this.memoryData.puzzle_records[key];
    }

    // Kiểm tra chéo với dữ liệu người dùng chính
    const mainUser = witchHunterStorage.getUser(userId);
    if (mainUser && mainUser.last_puzzle_week === weekIdentifier) {
      const res = {
        user_id: userId,
        week_identifier: weekIdentifier,
        score: Number(mainUser.last_puzzle_score) || 0,
        reward_pumpkins: (Number(mainUser.last_puzzle_score) || 0) * 2,
        completed_at: mainUser.last_puzzle_completed_at || new Date().toISOString(),
      };
      this.memoryData.puzzle_records[key] = res;
      return res;
    }

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare('SELECT * FROM puzzle_records WHERE user_id = ? AND week_identifier = ?');
        const row = stmt.get(userId, weekIdentifier);
        if (row) {
          const res = {
            user_id: row.user_id,
            week_identifier: row.week_identifier,
            score: Number(row.score) || 0,
            reward_pumpkins: Number(row.reward_pumpkins) || 0,
            completed_at: row.completed_at,
          };
          this.memoryData.puzzle_records[key] = res;
          return res;
        }
      } catch (e) {
        logger.error('❌ [WitchHunterQuest] SQLite getPuzzleRecord error:', e);
      }
    }
    return null;
  }

  savePuzzleRecord(userId, weekIdentifier, score, rewardPumpkins) {
    if (!userId || !weekIdentifier) return;
    const key = `${userId}:${weekIdentifier}`;
    const record = {
      user_id: userId,
      week_identifier: weekIdentifier,
      score: Number(score) || 0,
      reward_pumpkins: Number(rewardPumpkins) || 0,
      completed_at: new Date().toISOString(),
    };
    this.memoryData.puzzle_records[key] = record;
    this.flushJson();
    this.schedulePgSave();

    // Lưu đồng thời vào user record chính của WitchHunter
    const mainUser = witchHunterStorage.getUser(userId);
    if (mainUser) {
      mainUser.last_puzzle_week = weekIdentifier;
      mainUser.last_puzzle_session = weekIdentifier;
      mainUser.last_puzzle_score = Number(score) || 0;
      mainUser.last_puzzle_completed_at = record.completed_at;
      witchHunterStorage.saveUser(mainUser, true);
    }

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO puzzle_records (user_id, week_identifier, score, reward_pumpkins)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, week_identifier) DO UPDATE SET
            score = excluded.score,
            reward_pumpkins = excluded.reward_pumpkins,
            completed_at = CURRENT_TIMESTAMP
        `);
        stmt.run(userId, weekIdentifier, Number(score) || 0, Number(rewardPumpkins) || 0);
      } catch (e) {
        logger.error('❌ [WitchHunterQuest] SQLite savePuzzleRecord error:', e);
      }
    }
  }

  getAllQuestions() {
    if (Array.isArray(this.memoryData.questions) && this.memoryData.questions.length > 0) {
      return this.memoryData.questions;
    }
    return [];
  }
}

export const witchHunterQuestStorage = new WitchHunterQuestStorage();

/**
 * =========================================================
 * WITCH HUNTER QUEST SERVICE
 * =========================================================
 */
export class WitchHunterQuestService {
  // Bộ nhớ đệm chống click spam / race condition
  static pendingCandles = new Set();
  static chatCooldowns = new Map(); // Map<userId, timestamp>
  static puzzleSessions = new Map(); // Map<sessionId, { userId, questions, currentIdx, score, timer }>

  /**
   * =======================================================
   * PHẦN I: THẮP NẾN CẦU NGUYỆN (DAILY RITUAL)
   * =======================================================
   */
  static buildDailyCandleEmbed() {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} 𝓝𝓰𝓱𝓲 𝓣𝓱𝓾̛́𝓬 𝓣𝓱𝓪̆́𝓹 𝓝𝓮̂́𝓷 𝓒𝓪̂̀𝓾 𝓝𝓰𝓾𝔂𝓮̣̂𝓷 ${emojis.titleRight}`)
      .setDescription(
        `Giữa màn đêm vĩnh hằng của đại ngàn phù thủy và tiếng hú rợn người từ lũ quái thú bóng tối, ngọn nến cổ đại chính là ngọn hải đăng duy trì khế ước linh hồn của các chiến binh.\n\n` +
        `<a:trangtrig48:1563552038883958855> **QUY TẮC CẦU NGUYỆN HẰNG NGÀY:**\n` +
        `> Mỗi ngày một lần, hãy thành tâm bấm nút bên dưới để thắp nến.\n` +
        `> Nhận ngay: +1 Bí Ngô <a:bingo:1563061901800243253>.\n` +
        `> May mắn **Trăng Máu Chiếu Rọi (1%)**: Nổ hũ nhận ngay **+10 Bí Ngô** <a:bingo:1563061901800243253>!\n` +
        `> Chuỗi 7 ngày liên tục: Thưởng chuyên cần thêm **+5 Bí Ngô** <a:bingo:1563061901800243253>.\n` +
        `> Lượt thắp nến làm mới tự động vào đúng 00:00 mỗi ngày.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Thắp sáng hy vọng, đánh thức ma lực tiềm ẩn bên trong ngươi...*`
      )
      .setFooter({ text: 'Witch Hunter Daily Ritual' })
      .setTimestamp();
  }

  static buildDailyCandleButton() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_daily_candle')
        .setLabel('Thắp Nến Cầu Nguyện')
        .setEmoji('<a:trangtrig48:1563552038883958855>')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  static async handleDailyCandle(guild, member) {
    const userId = member?.user?.id || member?.id || (typeof member === 'string' ? member : null);
    if (!userId) {
      return {
        success: false,
        message: 'Không thể xác định danh tính thành viên!',
      };
    }

    if (this.pendingCandles.has(userId)) {
      return {
        success: false,
        isSpamming: true,
        message: '⏳ Thao tác đang được xử lý, vui lòng không nhấn liên tục!',
      };
    }

    this.pendingCandles.add(userId);

    try {
      const today = getVietnamDate();
      const existing = witchHunterQuestStorage.getDailyRitual(userId);
      const mainUser = witchHunterStorage.getUser(userId);

      // CẤU TRÚC EARLY RETURN (GUARD CLAUSE) TUYỆT ĐỐI:
      // Nếu đã thắp nến trong ngày hôm nay: Dừng ngay lập tức, tuyệt đối không lọt xuống lệnh cộng điểm hay streak
      if ((existing && existing.last_candle_date === today) || (mainUser && mainUser.last_candle_date === today)) {
        return {
          success: false,
          alreadyLit: true,
          message: 'Ngọn nến hôm nay đã cháy hết. Hãy quay lại vào lúc nửa đêm (00:00) để tiếp tục nghi thức!',
        };
      }

      // Chỉ khi người dùng CHƯA thắp nến hôm nay mới chạy xuống đây
      // 2. Tính toán chuỗi liên tục (Streak)
      let streak = 1;
      const lastDateStr = existing?.last_candle_date || mainUser?.last_candle_date;
      const prevStreak = existing?.candle_streak || mainUser?.candle_streak || 0;

      if (lastDateStr) {
        const lastDate = new Date(lastDateStr + 'T00:00:00Z');
        const currDate = new Date(today + 'T00:00:00Z');
        const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak = prevStreak + 1;
        } else {
          streak = 1;
        }
      }

      // 3. Tỷ lệ may mắn 1% Trăng Máu
      const isJackpot = Math.random() < 0.01;
      const basePumpkins = isJackpot ? 10 : 1;

      // Chuỗi chuyên cần 7 ngày liên tục
      const isStreakBonus = streak % 7 === 0;
      const bonusPumpkins = isStreakBonus ? 5 : 0;
      const totalAward = basePumpkins + bonusPumpkins;

      // 4. Lưu lại mốc ngày mới vào database NGAY LẬP TỨC trước khi cộng điểm
      witchHunterQuestStorage.saveDailyRitual(userId, today, streak);

      // 5. Cộng điểm Bí Ngô vào hệ thống
      await WitchHunterService.awardPumpkins(guild, userId, totalAward, {
        reason: isJackpot ? `Thắp Nến Nổ Hũ Trăng Máu (+${basePumpkins})` : `Thắp Nến Cầu Nguyện (+${basePumpkins})`,
        source: 'Nhiệm Vụ Thắp Nến',
        notifyDM: false,
        notifyAdminLog: true,
      });

      return {
        success: true,
        isJackpot,
        streak,
        isStreakBonus,
        totalAward,
      };
    } finally {
      // Giữ lock 2 giây để ngăn chặn triệt để race condition click liên tục
      setTimeout(() => {
        this.pendingCandles.delete(userId);
      }, 2000);
    }
  }

  /**
   * =======================================================
   * PHẦN II: NHIỆM VỤ TUẦN (WEEKLY BOUNTY BOARD)
   * =======================================================
   */
  static buildProgressBar(current, max, length = 5) {
    const filled = Math.min(length, Math.max(0, Math.round((current / max) * length)));
    const empty = length - filled;
    return `[${'■'.repeat(filled)}${'□'.repeat(empty)}]`;
  }

  static buildWeeklyQuestsEmbed(user, guild) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const questData = witchHunterQuestStorage.getWeeklyQuest(user.id);

    const voiceBar = this.buildProgressBar(questData.voice_days_done, 3);
    const chatBar = this.buildProgressBar(questData.chat_days_done, 2);

    const voiceDoneText = questData.voice_days_done >= 3 ? ' *(Hoàn thành)*' : '';
    const chatDoneText = questData.chat_days_done >= 2 ? ' *(Hoàn thành)*' : '';
    const reactDoneText = questData.react_done >= 1 ? ' *(Hoàn thành)*' : '';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} 𝓑𝓪̉𝓷𝓰 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓣𝓾𝓪̂̀𝓷: ${user.username} ${emojis.titleRight}`)
      .setDescription(
        `Tiến trình thực hiện khế ước rèn luyện trong tuần này của ngươi:\n\n` +
        `<a:trangtrig30:1546905942476464178> **1. Tụ Họp Quán Rượu (Voice Level)**\n` +
        `> Yêu cầu: Đạt 2 cấp voice trong ngày (60p voice).\n` +
        `> Tiến độ tuần: \`${voiceBar} ${questData.voice_days_done}/3 lần\`${voiceDoneText} • Thưởng: +1 <a:bingo:1563061901800243253> / lần (Tối đa +3 <a:bingo:1563061901800243253>/tuần)\n\n` +
        `<a:trangtrig30:1546905942476464178> **2. Mật Thư Chiến Trường (Hoạt động Chat)**\n` +
        `> Yêu cầu: Gửi ≥ 30 tin nhắn hợp lệ trong ngày.\n` +
        `> Hôm nay: \`${questData.chat_count_today}/30 tin\` | Tiến độ tuần: \`${chatBar} ${questData.chat_days_done}/2 lần\`${chatDoneText} (+${questData.chat_days_done} <a:bingo:1563061901800243253>)\n\n` +
        `<a:trangtrig30:1546905942476464178> **3. Tán Dương Đồng Đội (Reaction thành viên khác)**\n` +
        `> Yêu cầu: Thả ≥ 10 reaction vào tin nhắn của thành viên khác.\n` +
        `> Tiến độ tuần: \`${questData.react_count_week}/10 reactions\`${reactDoneText} • Thưởng: +1 <a:bingo:1563061901800243253> (Tối đa 1 lần/tuần)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Tiến trình sẽ được làm mới vào 00:00 sáng Thứ Hai tuần sau.*`
      )
      .setFooter({ text: 'Witch Hunter Weekly Bounty' })
      .setTimestamp();
  }

  // Hook 1: Voice Level Up (đạt 2 cấp voice trong ngày)
  static async onVoiceLevelGained(userId, levelsGained, guild) {
    try {
      const today = getVietnamDate();
      const record = witchHunterQuestStorage.getWeeklyQuest(userId);

      // Nếu tuần này đã hoàn thành tối đa 3 lần hoặc hôm nay đã nhận thưởng voice rồi
      if (record.voice_days_done >= 3 || record.last_voice_date === today) {
        return;
      }

      // Kiểm tra tổng cấp voice hôm nay từ pumpkinGrowthTracker
      const { pumpkinGrowthTracker } = await import('./pumpkinGrowthTracker.js');
      const todayStats = pumpkinGrowthTracker.getTodayUserStats(userId);
      const todayVoiceLevels = todayStats?.voiceLevels || 0;

      if (todayVoiceLevels >= 2) {
        record.voice_days_done += 1;
        record.last_voice_date = today;
        witchHunterQuestStorage.saveWeeklyQuest(record);

        // Ban thưởng +1 Bí Ngô
        await WitchHunterService.awardPumpkins(guild, userId, 1, {
          reason: `Nhiệm vụ tuần: Tụ Họp Quán Rượu (+1 Bí Ngô, lần ${record.voice_days_done}/3)`,
          source: 'Khế Ước Tuần (Voice)',
          notifyDM: false,
          notifyAdminLog: true,
        });

        logger.info(`🔮 [WitchHunterQuest] User ${userId} hoàn thành nhiệm vụ Tụ Họp Quán Rượu (+1 Bí Ngô, lần ${record.voice_days_done}/3).`);
      }
    } catch (e) {
      logger.error('❌ [WitchHunterQuest] Lỗi onVoiceLevelGained:', e);
    }
  }

  // Hook 2: Chat Activity (≥ 30 tin nhắn trong ngày)
  static async onChatMessage(message) {
    try {
      if (!message || message.author.bot || !message.guild) return;
      const content = message.content ? message.content.trim() : '';

      // Điều kiện lọc spam: độ dài >= 3, không phải chỉ sticker/emoji
      if (content.length < 3 || message.stickers?.size > 0) return;

      const userId = message.author.id;
      const now = Date.now();
      const lastChat = this.chatCooldowns.get(userId) || 0;

      // Cooldown chống spam 3s/tin
      if (now - lastChat < 3000) return;
      this.chatCooldowns.set(userId, now);

      const today = getVietnamDate();
      const record = witchHunterQuestStorage.getWeeklyQuest(userId);

      // Tăng biến đếm tin nhắn hôm nay
      record.chat_count_today = (record.chat_count_today || 0) + 1;
      record.last_chat_date = today;

      // Kiểm tra mốc 30 tin nhắn (tối đa 2 lần/tuần)
      if (record.chat_count_today >= 30 && record.chat_days_done < 2) {
        // Kiểm tra xem hôm nay đã nhận thưởng chat chưa (thông qua last_chat_claimed)
        if (record.last_chat_claimed_date !== today) {
          record.chat_days_done += 1;
          record.last_chat_claimed_date = today;

          // Ban thưởng +1 Bí Ngô
          await WitchHunterService.awardPumpkins(message.guild, userId, 1, {
            reason: `Nhiệm vụ tuần: Mật Thư Chiến Trường (+1 Bí Ngô, lần ${record.chat_days_done}/2)`,
            source: 'Khế Ước Tuần (Chat)',
            notifyDM: false,
            notifyAdminLog: true,
          });

          logger.info(`🔮 [WitchHunterQuest] User ${userId} hoàn thành nhiệm vụ Mật Thư Chiến Trường (+1 Bí Ngô, lần ${record.chat_days_done}/2).`);
        }
      }

      witchHunterQuestStorage.saveWeeklyQuest(record);
    } catch (e) {
      logger.error('❌ [WitchHunterQuest] Lỗi onChatMessage:', e);
    }
  }

  // Hook 3: Reaction Activity (≥ 10 reaction trong tuần)
  static async onReactionAdd(reaction, user) {
    try {
      if (!user || user.bot || !reaction.message.guild) return;

      const messageAuthorId = reaction.message.author?.id;
      // Không tính tự react vào tin nhắn của chính mình
      if (messageAuthorId && messageAuthorId === user.id) return;

      const record = witchHunterQuestStorage.getWeeklyQuest(user.id);

      // Nếu đã nhận thưởng react tuần này rồi thì thôi
      if (record.react_done >= 1) return;

      record.react_count_week = (record.react_count_week || 0) + 1;

      // Khi đạt đủ 10 reactions
      if (record.react_count_week >= 10 && record.react_done === 0) {
        record.react_done = 1;

        // Ban thưởng +1 Bí Ngô
        await WitchHunterService.awardPumpkins(reaction.message.guild, user.id, 1, {
          reason: 'Nhiệm vụ tuần: Tán Dương Đồng Đội (+1 Bí Ngô)',
          source: 'Khế Ước Tuần (Reaction)',
          notifyDM: false,
          notifyAdminLog: true,
        });

        logger.info(`🔮 [WitchHunterQuest] User ${user.id} hoàn thành nhiệm vụ Tán Dương Đồng Đội (+1 Bí Ngô).`);
      }

      witchHunterQuestStorage.saveWeeklyQuest(record);
    } catch (e) {
      logger.error('❌ [WitchHunterQuest] Lỗi onReactionAdd:', e);
    }
  }

  /**
   * =======================================================
   * PHẦN III: SỰ KIỆN CUỐI TUẦN — GIẢI MÃ CỔ NGỮ (QUICK PUZZLE)
   * =======================================================
   */
  static buildPuzzleNoticeEmbed() {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓲́ 𝓛𝓾𝔂𝓮̣̂𝓷 𝓒𝓾𝓸̂́𝓲 𝓣𝓾𝓪̂̀𝓷: 𝓖𝓲𝓪̉𝓲 𝓜𝓪̃ 𝓒𝓸̂̉ 𝓝𝓰𝓾̛̃ ${emojis.titleRight}`)
      .setDescription(
        `Cánh cổng tàn tích ngàn năm đã hé mở! Những dòng ký tự cổ ngữ chứa đựng tri thức ma thuật tối thượng và những bí ẩn thời đại đang chờ đón những bộ óc thông tuệ nhất đến khai phá!\n\n` +
        `<:trangtri1:1546093044535660644> **QUY TẮC THI ĐẤU:**\n` +
        `> Bốc ngẫu nhiên 10 câu trắc nghiệm.\n` +
        `> Trả lời hoàn toàn qua tin nhắn ẩn bảo mật.\n` +
        `> Mỗi câu đúng: Nhận ngay **+2** <a:bingo:1563061901800243253>\n` +
        `> Đúng tối đa **10/10 câu**: Nhận trọn vẹn **+20** <a:bingo:1563061901800243253>\n` +
        `> Hạn chót: Đến hết **23:59 Chủ Nhật** tuần này.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setFooter({ text: 'Witch Hunter Weekend Puzzle' })
      .setTimestamp();
  }

  static buildPuzzleNoticeButton() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_start_puzzle')
        .setLabel('Bắt Đầu Giải Mã Cổ Ngữ')
        .setEmoji('<:trangtri1:1546093044535660644>')
        .setStyle(ButtonStyle.Primary)
    );
  }

  static startPuzzleSession(userId) {
    const currentWeek = getVietnamWeekIdentifier();

    // 1. Kiểm tra khung giờ: Chỉ mở Thứ 7 & Chủ Nhật hàng tuần
    if (!isPuzzleWeekendOpen()) {
      return {
        success: false,
        message: '⏳ Thí luyện Giải Mã Cổ Ngữ chỉ mở vào **Thứ 7 & Chủ Nhật** hằng tuần thôi nè lữ khách ơi! Hãy quay lại vào kỳ trăng tới nhé 💕',
      };
    }

    // 2. KHÓA GIỚI HẠN 1 LẦN / TUẦN: Kiểm tra đã hoàn thành bài thi tuần này chưa (áp dụng cho tất cả người chơi)
    const weekendKey = WitchHunterService.getWeekendSessionKey?.() || currentWeek;
    const record = witchHunterQuestStorage.getPuzzleRecord(userId, currentWeek);
    const mainUser = witchHunterStorage.getUser(userId);

    if (
      record ||
      (mainUser && (
        mainUser.last_puzzle_week === currentWeek ||
        mainUser.last_puzzle_week === weekendKey ||
        mainUser.last_puzzle_session === weekendKey ||
        mainUser.last_puzzle_session === currentWeek
      ))
    ) {
      return {
        success: false,
        message: 'Bạn đã hoàn thành thí luyện giải mã cổ ngữ của tuần này rồi. Hãy quay lại vào cuối tuần sau nhé! 💕',
      };
    }

    // 3. Kiểm tra xem người dùng có đang trong phiên làm bài dở dang không
    for (const [sId, existingSession] of this.puzzleSessions.entries()) {
      if (existingSession.userId === userId && existingSession.weekIdentifier === currentWeek) {
        if (Date.now() - existingSession.createdAt < 15 * 60 * 1000) {
          return {
            success: false,
            message: '⚠️ Bạn đang có một bài thí luyện dở dang chưa hoàn thành! Vui lòng trả lời tiếp câu hỏi trên tin nhắn ẩn trước đó.',
          };
        } else {
          this.puzzleSessions.delete(sId);
        }
      }
    }

    // 3. Lấy 10 câu hỏi và xáo trộn ngẫu nhiên
    const allQuestions = witchHunterQuestStorage.getAllQuestions();
    if (!allQuestions || allQuestions.length === 0) {
      return {
        success: false,
        message: '⚠️ Ngân hàng câu hỏi hiện đang được Hội Đồng Ma Thuật hiệu chỉnh. Vui lòng thử lại sau!',
      };
    }

    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5).slice(0, 10);
    const sessionId = `${userId}_${Date.now()}`;

    const session = {
      sessionId,
      userId,
      weekIdentifier: currentWeek,
      questions: shuffled,
      currentIdx: 0,
      score: 0,
      createdAt: Date.now(),
    };

    this.puzzleSessions.set(sessionId, session);

    // Timeout phiên sau 15 phút để giải phóng RAM
    setTimeout(() => {
      this.puzzleSessions.delete(sessionId);
    }, 15 * 60 * 1000);

    return {
      success: true,
      session,
    };
  }

  static buildQuestionEmbed(session) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const currentNum = session.currentIdx + 1;
    const currentQ = session.questions[session.currentIdx];

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`<a:trangtrig18:1546068102817775626> CỔ NGỮ THỨ ${currentNum} / 10 • Điểm hiện tại: ${session.score}/10`)
      .setDescription(
        `**Câu hỏi:**\n` +
        `${currentQ.question}\n\n` +
        `**[ A ]** ${currentQ.option_a}\n` +
        `**[ B ]** ${currentQ.option_b}\n` +
        `**[ C ]** ${currentQ.option_c}\n` +
        `**[ D ]** ${currentQ.option_d}`
      );
  }

  static buildQuestionButtons(sessionId) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_puzzle_ans:A:${sessionId}`)
        .setLabel('A')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`btn_puzzle_ans:B:${sessionId}`)
        .setLabel('B')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`btn_puzzle_ans:C:${sessionId}`)
        .setLabel('C')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`btn_puzzle_ans:D:${sessionId}`)
        .setLabel('D')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  static async submitAnswer(sessionId, chosenOption, guild) {
    const session = this.puzzleSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        expired: true,
        message: '⏳ Phiên làm bài đã hết hạn hoặc không tìm thấy. Vui lòng bấm bắt đầu lại!',
      };
    }

    const currentQ = session.questions[session.currentIdx];
    if (chosenOption === currentQ.correct_option) {
      session.score += 1;
    }

    session.currentIdx += 1;

    // Nếu vẫn còn câu hỏi tiếp theo
    if (session.currentIdx < session.questions.length) {
      return {
        success: true,
        isFinished: false,
        session,
      };
    }

    // ĐÃ HOÀN THÀNH 10 CÂU!
    this.puzzleSessions.delete(sessionId);
    const finalScore = session.score;
    const rewardPumpkins = finalScore * 2;

    // Lưu vết kết quả bài thi
    witchHunterQuestStorage.savePuzzleRecord(
      session.userId,
      session.weekIdentifier,
      finalScore,
      rewardPumpkins
    );

    const weekendKey = WitchHunterService.getWeekendSessionKey?.() || session.weekIdentifier;
    await WitchHunterService.markUserPuzzleCompleted(session.userId, weekendKey).catch(() => null);
    await WitchHunterService.markUserPuzzleCompleted(session.userId, session.weekIdentifier).catch(() => null);

    // Ban thưởng Bí Ngô nếu điểm > 0
    if (rewardPumpkins > 0) {
      await WitchHunterService.awardPumpkins(guild, session.userId, rewardPumpkins, {
        reason: `Giải Mã Cổ Ngữ (${finalScore}/10 câu đúng, +${rewardPumpkins} Bí Ngô)`,
        source: 'Thí Luyện Cổ Ngữ',
        notifyDM: false,
        notifyAdminLog: true,
      });
    }

    return {
      success: true,
      isFinished: true,
      finalScore,
      rewardPumpkins,
    };
  }
}
