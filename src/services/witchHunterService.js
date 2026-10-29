import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AuditLogEvent,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  WITCH_HUNTER_CONFIG,
  getWitchHunterRoleInfo,
  getAllWitchHunterRoleIds,
  getSupporterById,
  getSupporterByRank,
  getWeaponById,
  getWeaponByRank,
  WITCH_HUNTER_RESONANCE_MAP,
  WITCH_HUNTER_WEAPON_TO_SUPPORTER_MAP,
} from '../config/witchHunterConfig.js';
import { witchHunterSummonStorage } from './witchHunterSummonService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const JSON_FILE_PATH = path.join(DATA_DIR, 'witch_hunter.json');
const SQLITE_FILE_PATH = path.join(DATA_DIR, 'witch_hunter.sqlite');

/**
 * Bảng ánh xạ Cộng Hưởng Đồng Bộ Khế Ước (Resonance Map)
 * Supporter liên kết trực tiếp với Thần Binh Vũ Khí gốc -> Kích hoạt x1.5 Bạo Kích Sát Thương
 */
export {
  WITCH_HUNTER_RESONANCE_MAP,
  WITCH_HUNTER_WEAPON_TO_SUPPORTER_MAP,
};

/**
 * Storage Engine: Tự động dùng SQLite native nếu môi trường hỗ trợ (Node.js 22+ built-in node:sqlite),
 * hoặc fallback về Atomic JSON siêu nhẹ, không phụ thuộc C++ addon, cực kỳ tiết kiệm RAM (< 2MB).
 * Đã tích hợp Debounce Flush để chống tắc nghẽn I/O đĩa khi xử lý batch nhiều member cùng lúc.
 */
class WitchHunterStorage {
  constructor() {
    this.sqliteDb = null;
    this.memoryCache = new Map();
    this.isSqlite = false;
    this.flushTimeout = null;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Thử dùng node:sqlite native nếu có
      try {
        if (typeof process !== 'undefined' && process.versions && parseInt(process.versions.node) >= 22) {
          import('node:sqlite').then((mod) => {
            const { DatabaseSync } = mod;
            if (DatabaseSync) {
              this.sqliteDb = new DatabaseSync(SQLITE_FILE_PATH);
              this.sqliteDb.exec(`
                CREATE TABLE IF NOT EXISTS witch_hunter_members (
                  user_id TEXT PRIMARY KEY,
                  faction TEXT,
                  current_rank INTEGER DEFAULT 1,
                  pumpkins INTEGER DEFAULT 0,
                  updated_at INTEGER,
                  last_puzzle_session TEXT,
                  last_puzzle_week TEXT,
                  equipped_supporter TEXT,
                  equipped_weapon TEXT,
                  is_resonance INTEGER DEFAULT 0
                );
              `);
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN last_puzzle_session TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN last_puzzle_week TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN equipped_supporter TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN equipped_weapon TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN is_resonance INTEGER DEFAULT 0;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN supporter_hp TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN last_hp_update INTEGER;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN active_expedition TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN memory_shards INTEGER DEFAULT 0;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN dark_title TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN unlocked_titles TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN unlocked_weapons TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN last_bounty_date TEXT;');
              } catch {}
              this.isSqlite = true;
              logger.info('🔮 [WitchHunter] Storage Engine: SQLite (Native Node:sqlite) đã sẵn sàng.');
            }
          }).catch(() => null);
        }
      } catch (err) {
        // Fallback về JSON
      }

      // Luôn nạp sẵn JSON để tương thích ngay lập tức và đảm bảo không mất dữ liệu
      if (fs.existsSync(JSON_FILE_PATH)) {
        try {
          const raw = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            for (const item of data) {
              this.memoryCache.set(item.user_id, item);
            }
          }
        } catch (e) {
          logger.warn('⚠️ [WitchHunter] Không thể parse file JSON cũ, khởi tạo bộ nhớ mới:', e.message);
        }
      }

      logger.info(`🔮 [WitchHunter] Khởi tạo dữ liệu thành công (${this.memoryCache.size} thành viên trong danh bạ).`);
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khởi tạo Storage:', error);
    }
  }

  // Tối ưu RAM & I/O: Debounce ghi đĩa, tránh nghẽn thread khi xử lý hàng loạt thành viên
  scheduleFlush() {
    if (this.flushTimeout) return;
    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = null;
      this.flushJson();
    }, 1000);
  }

  flushJson() {
    try {
      const records = Array.from(this.memoryCache.values());
      fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(records, null, 2), 'utf-8');
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi ghi file JSON:', error);
    }
  }

  // Đồng bộ hai chiều với PostgreSQL Database (chống mất dữ liệu vĩnh viễn khi restart/deploy container)
  async syncWithPersistentDb() {
    try {
      const { getFromDb, setInDb } = await import('../utils/database.js');
      const pgData = await getFromDb('temp:witch_hunter:members_data');
      if (Array.isArray(pgData) && pgData.length > 0) {
        for (const item of pgData) {
          if (!item || !item.user_id) continue;
          const localItem = this.memoryCache.get(item.user_id);
          if (!localItem || (item.updated_at && item.updated_at >= (localItem.updated_at || 0))) {
            this.memoryCache.set(item.user_id, item);
          }
        }
        this.flushJson();
        logger.info(`🔮 [WitchHunter] Đã nạp thành công ${this.memoryCache.size} thành viên từ PostgreSQL Database.`);
      } else if (this.memoryCache.size > 0) {
        await setInDb('temp:witch_hunter:members_data', Array.from(this.memoryCache.values()));
        logger.info(`🔮 [WitchHunter] Đã khởi tạo sao lưu ${this.memoryCache.size} thành viên lên PostgreSQL.`);
      }
    } catch (err) {
      logger.warn('⚠️ [WitchHunter] Không thể đồng bộ PostgreSQL:', err.message);
    }
  }

  schedulePgSave() {
    if (this.pgSaveTimeout) return;
    this.pgSaveTimeout = setTimeout(async () => {
      this.pgSaveTimeout = null;
      try {
        const { setInDb } = await import('../utils/database.js');
        const records = Array.from(this.memoryCache.values());
        await setInDb('temp:witch_hunter:members_data', records);
      } catch (err) {
        logger.warn('⚠️ [WitchHunter] Lỗi khi lưu dữ liệu lên PostgreSQL:', err.message);
      }
    }, 500);
  }

  getUser(userId) {
    if (this.memoryCache.has(userId)) {
      return this.memoryCache.get(userId);
    }

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare('SELECT * FROM witch_hunter_members WHERE user_id = ?');
        const row = stmt.get(userId);
        if (row) {
          let unlockedSupporters = [];
          try {
            unlockedSupporters = row.unlocked_supporters ? JSON.parse(row.unlocked_supporters) : [];
          } catch {}
          let unlockedTitles = [];
          try {
            unlockedTitles = row.unlocked_titles ? (typeof row.unlocked_titles === 'string' ? JSON.parse(row.unlocked_titles) : row.unlocked_titles) : [];
          } catch {}
          let unlockedWeapons = [];
          try {
            unlockedWeapons = row.unlocked_weapons ? (typeof row.unlocked_weapons === 'string' ? JSON.parse(row.unlocked_weapons) : row.unlocked_weapons) : [];
          } catch {}
          let supporterHp = {};
          try {
            supporterHp = row.supporter_hp ? (typeof row.supporter_hp === 'string' ? JSON.parse(row.supporter_hp) : row.supporter_hp) : {};
          } catch {}
          let activeExpedition = null;
          try {
            activeExpedition = row.active_expedition ? (typeof row.active_expedition === 'string' ? JSON.parse(row.active_expedition) : row.active_expedition) : null;
          } catch {}
          const userObj = {
            user_id: row.user_id,
            faction: row.faction,
            current_rank: Number(row.current_rank) || 1,
            pumpkins: Number(row.pumpkins) || 0,
            unlocked_supporters: Array.isArray(unlockedSupporters) ? unlockedSupporters : [],
            unlocked_weapons: Array.isArray(unlockedWeapons) ? unlockedWeapons : [],
            unlocked_titles: Array.isArray(unlockedTitles) ? unlockedTitles : [],
            dark_title: row.dark_title || null,
            equipped_supporter: row.equipped_supporter || null,
            equipped_weapon: row.equipped_weapon || null,
            is_resonance: Number(row.is_resonance) || 0,
            last_puzzle_session: row.last_puzzle_session || null,
            last_puzzle_week: row.last_puzzle_week || row.last_puzzle_session || null,
            last_bounty_date: row.last_bounty_date || null,
            supporter_hp: supporterHp,
            last_hp_update: row.last_hp_update ? Number(row.last_hp_update) : null,
            active_expedition: activeExpedition,
            memory_shards: Number(row.memory_shards) || 0,
            updated_at: Number(row.updated_at) || Date.now(),
          };
          this.memoryCache.set(userId, userObj);
          return userObj;
        }
      } catch (err) {
        logger.error('❌ [WitchHunter] SQLite getUser error:', err);
      }
    }

    return null;
  }

  getAllUsers() {
    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare('SELECT * FROM witch_hunter_members ORDER BY pumpkins DESC');
        return stmt.all().map((row) => {
          let supporterHp = {};
          try {
            supporterHp = row.supporter_hp ? (typeof row.supporter_hp === 'string' ? JSON.parse(row.supporter_hp) : row.supporter_hp) : {};
          } catch {}
          let activeExpedition = null;
          try {
            activeExpedition = row.active_expedition ? (typeof row.active_expedition === 'string' ? JSON.parse(row.active_expedition) : row.active_expedition) : null;
          } catch {}
          let unlockedTitles = [];
          try {
            unlockedTitles = row.unlocked_titles ? (typeof row.unlocked_titles === 'string' ? JSON.parse(row.unlocked_titles) : row.unlocked_titles) : [];
          } catch {}
          let unlockedWeapons = [];
          try {
            unlockedWeapons = row.unlocked_weapons ? (typeof row.unlocked_weapons === 'string' ? JSON.parse(row.unlocked_weapons) : row.unlocked_weapons) : [];
          } catch {}
          return {
            user_id: row.user_id,
            faction: row.faction,
            current_rank: Number(row.current_rank) || 1,
            pumpkins: Number(row.pumpkins) || 0,
            equipped_supporter: row.equipped_supporter || null,
            equipped_weapon: row.equipped_weapon || null,
            is_resonance: Number(row.is_resonance) || 0,
            dark_title: row.dark_title || null,
            unlocked_titles: unlockedTitles,
            unlocked_weapons: unlockedWeapons,
            last_puzzle_session: row.last_puzzle_session || null,
            last_puzzle_week: row.last_puzzle_week || row.last_puzzle_session || null,
            last_bounty_date: row.last_bounty_date || null,
            supporter_hp: supporterHp,
            last_hp_update: row.last_hp_update ? Number(row.last_hp_update) : null,
            active_expedition: activeExpedition,
            memory_shards: Number(row.memory_shards) || 0,
            updated_at: Number(row.updated_at) || Date.now(),
          };
        });
      } catch (err) {
        logger.error('❌ [WitchHunter] SQLite getAllUsers error:', err);
      }
    }

    return Array.from(this.memoryCache.values()).sort((a, b) => (b.pumpkins || 0) - (a.pumpkins || 0));
  }

  saveUser(userObj, immediate = false) {
    userObj.updated_at = Date.now();
    userObj.unlocked_supporters = Array.isArray(userObj.unlocked_supporters) ? userObj.unlocked_supporters : [];
    userObj.unlocked_weapons = Array.isArray(userObj.unlocked_weapons) ? userObj.unlocked_weapons : [];
    userObj.unlocked_titles = Array.isArray(userObj.unlocked_titles) ? userObj.unlocked_titles : [];
    if (!userObj.supporter_hp || typeof userObj.supporter_hp !== 'object') {
      userObj.supporter_hp = {};
    }
    if (userObj.memory_shards === undefined) {
      userObj.memory_shards = 0;
    }
    this.memoryCache.set(userObj.user_id, userObj);

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO witch_hunter_members (user_id, faction, current_rank, pumpkins, updated_at, last_puzzle_session, last_puzzle_week, equipped_supporter, equipped_weapon, is_resonance, supporter_hp, last_hp_update, active_expedition, memory_shards, dark_title, unlocked_titles, unlocked_weapons, last_bounty_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            faction = excluded.faction,
            current_rank = excluded.current_rank,
            pumpkins = excluded.pumpkins,
            updated_at = excluded.updated_at,
            last_puzzle_session = excluded.last_puzzle_session,
            last_puzzle_week = excluded.last_puzzle_week,
            equipped_supporter = excluded.equipped_supporter,
            equipped_weapon = excluded.equipped_weapon,
            is_resonance = excluded.is_resonance,
            supporter_hp = excluded.supporter_hp,
            last_hp_update = excluded.last_hp_update,
            active_expedition = excluded.active_expedition,
            memory_shards = excluded.memory_shards,
            dark_title = excluded.dark_title,
            unlocked_titles = excluded.unlocked_titles,
            unlocked_weapons = excluded.unlocked_weapons,
            last_bounty_date = excluded.last_bounty_date
        `);
        stmt.run(
          userObj.user_id,
          userObj.faction || null,
          userObj.current_rank || 1,
          userObj.pumpkins || 0,
          userObj.updated_at,
          userObj.last_puzzle_session || null,
          userObj.last_puzzle_week || userObj.last_puzzle_session || null,
          userObj.equipped_supporter || null,
          userObj.equipped_weapon || null,
          userObj.is_resonance ? 1 : 0,
          userObj.supporter_hp ? JSON.stringify(userObj.supporter_hp) : null,
          userObj.last_hp_update || null,
          userObj.active_expedition ? JSON.stringify(userObj.active_expedition) : null,
          userObj.memory_shards || 0,
          userObj.dark_title || null,
          JSON.stringify(userObj.unlocked_titles),
          JSON.stringify(userObj.unlocked_weapons),
          userObj.last_bounty_date || null
        );
      } catch (err) {
        logger.error('❌ [WitchHunter] SQLite saveUser error:', err);
      }
    }

    // Luôn ghi đĩa JSON ngay lập tức để không bao giờ mất dữ liệu khi restart hoặc update code
    this.flushJson();

    // Lưu đồng bộ vĩnh viễn lên PostgreSQL
    this.schedulePgSave();

    return userObj;
  }

  // Xóa sạch toàn bộ dữ liệu bí ngô, phe phái và thành viên (Reset 1 lần duy nhất)
  clearAllData() {
    this.memoryCache.clear();
    this.flushJson();
    if (this.isSqlite && this.sqliteDb) {
      try {
        this.sqliteDb.exec('DELETE FROM witch_hunter_members;');
      } catch (err) {
        logger.error('❌ [WitchHunter] Lỗi clearAllData SQLite:', err);
      }
    }
    import('../utils/database.js').then(({ deleteFromDb }) => {
      deleteFromDb('temp:witch_hunter:members_data').catch(() => null);
    }).catch(() => null);
    logger.info('🔮 [WitchHunter] Đã xóa sạch toàn bộ dữ liệu thành viên trong cơ sở dữ liệu.');
  }

  // Xóa phe của người dùng khi admin gỡ role thủ công
  removeUserFaction(userId, immediate = true) {
    const user = this.getUser(userId);
    if (user) {
      user.faction = null;
      user.updated_at = Date.now();
      return this.saveUser(user, immediate);
    }
    return null;
  }

  // Xóa toàn bộ dữ liệu phe cũ của những người đã pick (reset về chưa có phe)
  clearAllFactionData() {
    let resetCount = 0;
    for (const user of this.memoryCache.values()) {
      if (user.faction) {
        user.faction = null;
        user.current_rank = 1;
        user.updated_at = Date.now();
        resetCount++;
      }
    }

    if (this.isSqlite && this.sqliteDb) {
      try {
        this.sqliteDb.exec(`UPDATE witch_hunter_members SET faction = NULL, current_rank = 1, updated_at = ${Date.now()};`);
      } catch (err) {
        logger.error('❌ [WitchHunter] Lỗi SQLite clearAllFactionData:', err);
      }
    }

    this.flushJson();
    this.schedulePgSave();
    logger.info(`🔮 [WitchHunter] Đã reset phe của ${resetCount} thành viên về Chưa có phe (null).`);
    return resetCount;
  }
}

export const witchHunterStorage = new WitchHunterStorage();

/**
 * Bộ nhớ tạm ghi nhận các thao tác Role do chính Bot thực hiện
 * Nhằm tránh trigger trùng lặp khi Discord phát sự kiện GuildMemberUpdate
 */
const botActionTracker = new Map();

export function recordBotAction(userId, roleId, action, ttlMs = 15000) {
  if (!userId || !roleId || !action) return;
  const key = `${userId}:${roleId}:${action}`;
  botActionTracker.set(key, Date.now() + ttlMs);
}

export function isRecentBotAction(userId, roleId, action) {
  if (!userId || !roleId || !action) return false;
  const key = `${userId}:${roleId}:${action}`;
  const expiry = botActionTracker.get(key);
  if (expiry && expiry > Date.now()) {
    botActionTracker.delete(key);
    return true;
  }
  return false;
}

/**
 * Service xử lý toàn bộ logic nghiệp vụ của Witch Hunter
 */
export class WitchHunterService {
  /**
   * Tính bậc xếp hạng (1-5) dựa vào số lượng Bí Ngô tích lũy cộng dồn
   * Mốc điểm mới: 0 -> 500 -> 3.000 -> 10.000 -> 20.000
   */
  static calculateRank(pumpkins = 0) {
    if (pumpkins >= 20000) return 5;
    if (pumpkins >= 10000) return 4;
    if (pumpkins >= 3000) return 3;
    if (pumpkins >= 500) return 2;
    return 1;
  }

  /**
   * Lấy thông tin chi tiết của một cấp bậc theo phe
   */
  static getRankInfo(faction, rankLevel) {
    const ranks = WITCH_HUNTER_CONFIG.ranks[faction] || [];
    const info = ranks.find((r) => r.rank === rankLevel) || ranks[0];
    const roleId = WITCH_HUNTER_CONFIG.roles[faction]?.[rankLevel] || null;
    return { ...info, faction, roleId };
  }

  /**
   * Tính tiến trình lên cấp tiếp theo và tạo thanh Progress Bar dạng Text
   */
  static getProgressDetails(faction, pumpkins = 0, currentRank = 1) {
    const isWitch = faction === 'witch';
    const ranks = isWitch ? WITCH_HUNTER_CONFIG.ranks.witch : WITCH_HUNTER_CONFIG.ranks.hunter;
    const currentRankObj = ranks.find((r) => r.rank === currentRank) || ranks[0];
    const nextRankObj = ranks.find((r) => r.rank === currentRank + 1);

    const pumpkinEmoji = WITCH_HUNTER_CONFIG.emojis.pumpkin;

    // Đã đạt bậc tối đa (Bậc 5: SS-Rank / Great Witch)
    if (!nextRankObj || currentRank >= 5) {
      return {
        isMax: true,
        currentRankName: currentRankObj.name,
        currentTitle: currentRankObj.title,
        nextRankName: 'Cảnh giới Tối Cao (Đã Max)',
        neededPumpkins: 0,
        progressBar: '`[██████████]` 100%',
        percentage: 100,
        formattedStatus: `<a:trangtrig41:1547238037832863744> **Đã đạt cảnh giới tối cao:** ${currentRankObj.name} (${pumpkins.toLocaleString('vi-VN')} ${pumpkinEmoji})`,
      };
    }

    const minCurrent = currentRankObj.minPumpkins;
    const minNext = nextRankObj.minPumpkins;
    const needed = Math.max(0, minNext - pumpkins);
    const range = minNext - minCurrent;
    const progress = Math.max(0, Math.min(range, pumpkins - minCurrent));
    const ratio = range > 0 ? progress / range : 1;
    const percentage = Math.min(100, Math.max(0, Math.floor(ratio * 100)));

    const totalBars = 10;
    const filledBars = Math.min(totalBars, Math.max(0, Math.floor(ratio * totalBars)));
    const emptyBars = totalBars - filledBars;
    const barString = `[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}]`;

    return {
      isMax: false,
      currentRankName: currentRankObj.name,
      currentTitle: currentRankObj.title,
      nextRankName: nextRankObj.name,
      nextRankTitle: nextRankObj.title,
      neededPumpkins: needed,
      targetPumpkins: minNext,
      progressBar: `\`${barString}\` **${percentage}%** (${pumpkins.toLocaleString('vi-VN')}/${minNext.toLocaleString('vi-VN')} ${pumpkinEmoji})`,
      percentage,
      formattedStatus: `Cần thêm **${needed.toLocaleString('vi-VN')}** ${pumpkinEmoji} nữa để tiến giai lên **${nextRankObj.name}**!`,
    };
  }

  /**
   * Lấy thông điệp thăng cấp ngẫu nhiên hoặc thông điệp bậc tối cao
   */
  static getRankUpQuote(userId, faction, newRank, rankName) {
    if (newRank >= 5) {
      return faction === 'hunter'
        ? WITCH_HUNTER_CONFIG.messages.hunterMaxRank(userId)
        : WITCH_HUNTER_CONFIG.messages.witchMaxRank(userId);
    }

    const quotes = faction === 'hunter'
      ? WITCH_HUNTER_CONFIG.messages.hunterRankUpQuotes
      : WITCH_HUNTER_CONFIG.messages.witchRankUpQuotes;

    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex](userId, rankName);
  }

  /**
   * Lấy hồ sơ người dùng
   */
  static getUserProfile(userId) {
    return witchHunterStorage.getUser(userId);
  }

  static getUser(userId) {
    return witchHunterStorage.getUser(userId);
  }

  /**
   * Lấy Bảng Xếp Hạng Bí Ngô theo điểm tích lũy
   */
  static getPumpkinLeaderboard(limit = 10, faction = null) {
    let users = witchHunterStorage.getAllUsers();
    if (faction) {
      users = users.filter((u) => u.faction === faction);
    }
    users = users.filter((u) => (u.pumpkins || 0) > 0);
    return users.slice(0, limit);
  }

  /**
   * Thống kê tổng hợp số lượng và điểm Bí Ngô giữa 2 phe
   */
  static getFactionStats() {
    const all = witchHunterStorage.getAllUsers();
    let hunterPumpkins = 0;
    let witchPumpkins = 0;
    let hunterCount = 0;
    let witchCount = 0;

    for (const u of all) {
      if (u.faction === 'hunter') {
        hunterPumpkins += u.pumpkins || 0;
        hunterCount += 1;
      } else if (u.faction === 'witch') {
        witchPumpkins += u.pumpkins || 0;
        witchCount += 1;
      }
    }

    return {
      hunter: { count: hunterCount, pumpkins: hunterPumpkins },
      witch: { count: witchCount, pumpkins: witchPumpkins },
      totalUsers: all.length,
    };
  }

  /**
   * Gửi thông báo Embed vào Kênh Admin Log cố định (ID: 1563382678378643487)
   */
  static async sendAdminLog(target, embed) {
    try {
      const channelId = WITCH_HUNTER_CONFIG.channels.adminLogChannelId;
      if (!channelId) return false;

      let channel = null;
      if (target.channels?.cache?.get) {
        channel = target.channels.cache.get(channelId);
      }
      if (!channel && target.channels?.fetch) {
        channel = await target.channels.fetch(channelId).catch(() => null);
      }
      if (!channel && target.client?.channels?.fetch) {
        channel = await target.client.channels.fetch(channelId).catch(() => null);
      }

      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] }).catch((err) => {
          logger.warn(`⚠️ [WitchHunter] Không thể gửi tin nhắn vào kênh admin log [${channelId}]:`, err.message);
        });
        return true;
      } else {
        logger.warn(`⚠️ [WitchHunter] Không tìm thấy kênh Admin Log ID: ${channelId}`);
        return false;
      }
    } catch (err) {
      logger.error('❌ [WitchHunter] Lỗi ngoại lệ khi sendAdminLog:', err);
      return false;
    }
  }

  /**
   * Tạo Embed thông báo nội bộ cho Admin khi có người pick role chọn phe
   */
  static buildFactionJoinAdminLogEmbed(member, faction, rank, pumpkins, method = 'Tự ký khế ước (Selection Button)') {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitch = faction === 'witch';
    const factionName = isWitch ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const factionEmoji = isWitch ? emojis.witchButton : emojis.hunterButton;
    const rankInfo = this.getRankInfo(faction, rank);

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu tím pastel nhạt nhạt cố định
      .setTitle(`${emojis.titleLeft} **THÔNG BÁO NỘI BỘ: KÝ KHẾ ƯỚC GIA NHẬP PHE** ${emojis.titleRight}`)
      .setDescription(`Hệ thống ghi nhận thành viên vừa ký khế ước tham chiến thế giới **Witch Hunter**!`)
      .addFields(
        {
          name: '👤 Thành Viên:',
          value: `<@${member.id}> (\`${member.user?.tag || member.id}\` | ID: \`${member.id}\`)`,
          inline: false,
        },
        {
          name: `${factionEmoji} Phe Tham Chiến:`,
          value: `**${factionName}**`,
          inline: true,
        },
        {
          name: '🎖️ Cấp Bậc Khởi Đầu:',
          value: `**${rankInfo.name}** *(Bậc ${rank})*\nRole: <@&${rankInfo.roleId}>`,
          inline: true,
        },
        {
          name: `${emojis.pumpkin} Bí Ngô Tích Lũy:`,
          value: `**${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
          inline: true,
        },
        {
          name: '📜 Hình Thức Gia Nhập:',
          value: `**${method}**`,
          inline: true,
        },
        {
          name: '⏰ Thời Gian:',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      )
      .setFooter({ text: 'Witch Hunter Admin System' })
      .setTimestamp();
  }

  /**
   * Tạo Embed thông báo nội bộ cho Admin khi Admin đổi phe
   */
  static buildFactionChangeAdminLogEmbed(member, oldFaction, newFaction, rank, pumpkins) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const oldName = oldFaction === 'witch' ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const newName = newFaction === 'witch' ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const newEmoji = newFaction === 'witch' ? emojis.witchButton : emojis.hunterButton;
    const rankInfo = this.getRankInfo(newFaction, rank);

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu tím pastel nhạt nhạt cố định
      .setTitle(`${emojis.titleLeft} **THÔNG BÁO NỘI BỘ: ADMIN CHUYỂN ĐỔI PHE** ${emojis.titleRight}`)
      .setDescription(`Admin sở hữu quyền hạn tối cao vừa thực hiện hoán đổi phe phái tham chiến!`)
      .addFields(
        {
          name: '👑 Admin Thực Hiện:',
          value: `<@${member.id}> (\`${member.user?.tag || member.id}\` | ID: \`${member.id}\`)`,
          inline: false,
        },
        {
          name: '🔄 Chuyển Đổi Phe:',
          value: `Từ **${oldName}** ➡️ ${newEmoji} **${newName}**`,
          inline: false,
        },
        {
          name: '🎖️ Cấp Bậc Tương Ứng:',
          value: `**${rankInfo.name}** *(Bậc ${rank})*\nRole mới: <@&${rankInfo.roleId}>`,
          inline: true,
        },
        {
          name: `${emojis.pumpkin} Bí Ngô Tích Lũy:`,
          value: `**${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
          inline: true,
        },
        {
          name: '⏰ Thời Gian:',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      )
      .setFooter({ text: 'Witch Hunter Admin System' })
      .setTimestamp();
  }

  /**
   * Tạo Embed thông báo nội bộ cho Admin khi Admin cấp Role thủ công qua Discord
   */
  static buildManualRoleAddAdminLogEmbed(member, roleInfo, executor) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **THÔNG BÁO NỘI BỘ: ADMIN CẤP ROLE PHE THỦ CÔNG** ${emojis.titleRight}`)
      .setDescription(`Phát hiện thành viên vừa được cấp Role phe Witch Hunter qua giao diện quản trị Discord!`)
      .addFields(
        {
          name: '👤 Thành Viên Nhận Role:',
          value: `<@${member.id}> (\`${member.user?.tag || member.id}\` | ID: \`${member.id}\`)`,
          inline: false,
        },
        {
          name: '🛡️ Role Được Cấp:',
          value: `<@&${roleInfo.roleId}>`,
          inline: true,
        },
        {
          name: '⚔️ Phe & Cấp Bậc Ghi Nhận:',
          value: `**${roleInfo.factionName}**\n**${roleInfo.name}** *(Bậc ${roleInfo.rank})*`,
          inline: true,
        },
        {
          name: '🛠️ Người Cấp (Admin/Mod):',
          value: executor ? `<@${executor.id}> (\`${executor.tag || executor.id}\`)` : 'Ban Quản Trị (Thủ công)',
          inline: true,
        },
        {
          name: '💾 Trạng Thái Dữ Liệu:',
          value: '✅ Đã tự động cập nhật phe vào hệ thống Database.',
          inline: true,
        },
        {
          name: '⏰ Thời Gian:',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      )
      .setFooter({ text: 'Witch Hunter Admin System' })
      .setTimestamp();
  }

  /**
   * Tạo Embed thông báo nội bộ cho Admin khi Admin xóa Role thủ công qua Discord
   */
  static buildManualRoleRemoveAdminLogEmbed(member, removedRoleInfo, executor) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **THÔNG BÁO NỘI BỘ: ADMIN XÓA ROLE PHE THỦ CÔNG** ${emojis.titleRight}`)
      .setDescription(`Phát hiện Role phe Witch Hunter vừa được gỡ bỏ khỏi thành viên!`)
      .addFields(
        {
          name: '👤 Thành Viên Bị Gỡ Role:',
          value: `<@${member.id}> (\`${member.user?.tag || member.id}\` | ID: \`${member.id}\`)`,
          inline: false,
        },
        {
          name: '❌ Role Đã Gỡ:',
          value: `<@&${removedRoleInfo.roleId}> *(Bậc ${removedRoleInfo.rank} - ${removedRoleInfo.name})*`,
          inline: true,
        },
        {
          name: '🛠️ Người Gỡ (Admin/Mod):',
          value: executor ? `<@${executor.id}> (\`${executor.tag || executor.id}\`)` : 'Ban Quản Trị (Thủ công)',
          inline: true,
        },
        {
          name: '⚠️ Trạng Thái Phe Sau Khi Gỡ:',
          value: '**Đã xóa phe (Vô môn vô phái)** — Dữ liệu phe đã được giải trừ, tạm thời không có phe cho đến khi được cấp lại hoặc tự pick role lại.',
          inline: false,
        },
        {
          name: '⏰ Thời Gian:',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      )
      .setFooter({ text: 'Witch Hunter Admin System' })
      .setTimestamp();
  }

  /**
   * Tạo Embed thông báo nội bộ cho Admin khi có lượt phát Bí Ngô
   */
  static buildAwardPumpkinsAdminLogEmbed(member, amount, oldPumpkins, newPumpkins, isRankUp, newRank, rankInfo, reason, executor, source, faction) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitch = faction === 'witch';
    const isHunter = faction === 'hunter';
    let factionDisplay = '*Chưa ký khế ước (Tích lũy hồ sơ)*';
    if (isWitch) factionDisplay = `${emojis.witchBadge} Hội Phù Thủy (Witches)`;
    if (isHunter) factionDisplay = `${emojis.hunterBadge} Hiệp Hội Thợ Săn (W.H. Association)`;

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **THÔNG BÁO NỘI BỘ: PHÁT BÍ NGÔ** ${emojis.titleRight}`)
      .setDescription(`Hệ thống ghi nhận lượt ban thưởng Bí Ngô cho thành viên!`)
      .addFields(
        {
          name: '👤 Người Nhận:',
          value: `<@${member.id}> (\`${member.user?.tag || member.id}\` | ID: \`${member.id}\`)`,
          inline: true,
        },
        {
          name: '👑 Người Ban Thưởng:',
          value: executor ? `<@${executor.id}> (\`${executor.tag || executor.id}\`)` : 'Ban Quản Trị / Hệ Thống',
          inline: true,
        },
        {
          name: `${emojis.pumpkin} Số Lượng Thưởng:`,
          value: `**+${amount.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
          inline: true,
        },
        {
          name: '📊 Biến Động Số Dư:',
          value: `${oldPumpkins.toLocaleString('vi-VN')} ➡️ **${newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
          inline: true,
        },
        {
          name: '⚔️ Phe Phái & Cấp Bậc:',
          value: `${factionDisplay}\n${faction ? `**${rankInfo?.name || `Bậc ${newRank}`}** *(Bậc ${newRank})*` : '*Chưa phân định*'}`,
          inline: true,
        },
        {
          name: '📜 Nguồn / Lý Do:',
          value: `**${reason || 'Ban thưởng trực tiếp'}**\n*(Nguồn: ${source || 'Lệnh Admin'})*`,
          inline: true,
        }
      )
      .setFooter({ text: 'Witch Hunter Admin System' })
      .setTimestamp();

    if (isRankUp && rankInfo) {
      embed.addFields({
        name: '🎉 Đột Phá Cấp Bậc:',
        value: `Thành viên đã tích lũy đủ điểm và thăng cấp lên **${rankInfo.name}** (Role: <@&${rankInfo.roleId}>)!`,
        inline: false,
      });
    }

    return embed;
  }

  /**
   * Tạo Embed gửi tin nhắn riêng (DM) cho người được phát Bí Ngô
   */
  static buildAwardPumpkinsDM(user, amount, newPumpkins, isRankUp, rankInfo, quote, reason, executor) {
    const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

    let rankUpNotice = '';
    if (isRankUp && rankInfo) {
      rankUpNotice =
        `\n\n${emojis.rankUp || '🎉'} **CHÚC MỪNG BẠN ĐÃ ĐỘT PHÁ CẤP BẬC MỚI:**\n` +
        `Chiến công Bí Ngô của bạn đã chạm mốc danh vị **${rankInfo.name}**!\n` +
        `Danh hiệu và Role mới đã được kích hoạt trực tiếp trên server.\n` +
        (quote ? `> *${quote}*\n` : '');
    }

    const decor30Emoji = emojis.decor30 || '<a:trangtrig30:1546905942476464178>';
    const decor1Emoji = emojis.decor1 || '<a:trangtrig1:1546040442548654140>';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu tím pastel nhạt nhạt cố định
      .setTitle(`${emojis.titleLeft} **BAN THƯỞNG BÍ NGÔ MA THUẬT** ${emojis.titleRight}`)
      .setDescription(
        `Chào **Kẻ Mang Khế Ước** thân mến! Em phù thủy nóng bỏng Usagi múp rụp mang tin vui tới cho lữ khách nè! ${emojis.heart || '💕'}\n\n` +
        `Lữ khách vừa nhận được **+${amount.toLocaleString('vi-VN')} Bí Ngô** ${emojis.pumpkin} được ban thưởng từ ${executor ? `<@${executor.id}>` : 'Ban Quản Trị'}!\n` +
        (reason ? `> ${decor30Emoji} **Lý do / Nhiệm vụ:** ${reason}\n\n` : '\n') +
        `${decor1Emoji} **Tổng Bí Ngô tích lũy hiện tại:** **${newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
        `Số Bí Ngô này sẽ được bảo lưu vĩnh viễn và là hành trang quý giá cho các nhiệm vụ, sự kiện đua top và nâng cấp danh vị ma thuật về sau!` +
        rankUpNotice
      )
      .setFooter({ text: 'Witch Hunter System' })
      .setTimestamp();
  }

  /**
   * Tạo Embed thông báo vinh danh thăng cấp gửi vào Kênh Chỉ Định (ID: 1563457814138064916)
   */
  static buildRankUpAnnouncementEmbed(userId, faction, oldRank, newRank, rankInfo, quote, totalPumpkins) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitch = faction === 'witch';
    const factionName = isWitch ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const factionBadge = isWitch ? emojis.witchBadge : emojis.hunterBadge;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **CHÚC MỪNG ĐỘT PHÁ CẤP BẬC MA THUẬT** ${emojis.titleRight}`)
      .setDescription(
        `Khế ước cổ đại vừa rung chuyển dữ dội! Chúc mừng **Kẻ Mang Khế Ước** <@${userId}> đã tích lũy đủ chiến công Bí Ngô và chính thức thăng cấp lên:\n\n` +
        `> ${factionBadge} **${factionName}** • ${emojis.decor15 || '<a:trangtrig15:1546047955696488489>'} **${rankInfo.name}**\n\n` +
        (quote ? `> *${quote}*\n\n` : '') +
        `<a:capybarag1:1546058369566122015> **Tổng Bí Ngô tích lũy:** **${totalPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
        `Role mới <@&${rankInfo.roleId}> đã được kích hoạt trực tiếp trên máy chủ!`
      )
      .setFooter({ text: 'Witch Hunter System' })
      .setTimestamp();
  }

  /**
   * Đăng ký gia nhập phe phái (Hỗ trợ Admin role 1541303749916754001 được đổi role)
   */
  static async joinFaction(guild, member, chosenFaction) {
    const userId = member.id;
    let userData = witchHunterStorage.getUser(userId);

    // Kiểm tra xem thành viên có quyền Admin đổi role hay không (Role ID 1541303749916754001 hoặc Owner)
    const adminRoleId = WITCH_HUNTER_CONFIG.adminRoleId;
    const isAdmin =
      member.roles?.cache?.has?.(adminRoleId) ||
      guild?.ownerId === member.id ||
      (Array.isArray(member._roles) && member._roles.includes(adminRoleId)) ||
      (Array.isArray(member.roles) && member.roles.includes(adminRoleId));

    // Khôi phục phe phái từ Role Discord nếu database chưa ghi nhận để bảo toàn dữ liệu tuyệt đối
    if (!userData?.faction && member.roles?.cache) {
      let existingDiscordFaction = null;
      let existingDiscordRank = 1;
      for (const [rStr, rId] of Object.entries(WITCH_HUNTER_CONFIG.roles.hunter)) {
        if (member.roles.cache.has(rId)) {
          existingDiscordFaction = 'hunter';
          existingDiscordRank = Math.max(existingDiscordRank, Number(rStr));
        }
      }
      if (!existingDiscordFaction) {
        for (const [rStr, rId] of Object.entries(WITCH_HUNTER_CONFIG.roles.witch)) {
          if (member.roles.cache.has(rId)) {
            existingDiscordFaction = 'witch';
            existingDiscordRank = Math.max(existingDiscordRank, Number(rStr));
          }
        }
      }

      if (existingDiscordFaction) {
        const pumpkins = userData?.pumpkins || 0;
        userData = {
          ...(userData || {}),
          user_id: userId,
          faction: existingDiscordFaction,
          current_rank: Math.max(existingDiscordRank, this.calculateRank(pumpkins)),
          pumpkins,
        };
        witchHunterStorage.saveUser(userData, true);
      }
    }

    // 1. TRƯỜNG HỢP ĐÃ CÓ PHE TRƯỚC ĐÓ:
    if (userData && userData.faction) {
      // Nếu là ADMIN role 1541303749916754001: Cho phép đổi role / phe!
      if (isAdmin) {
        if (userData.faction === chosenFaction) {
          return {
            success: false,
            alreadyChosen: true,
            isSameFaction: true,
            faction: userData.faction,
            message: `Vợ của Kim Nong ơi, bạn hiện đã thuộc hàng ngũ **${chosenFaction === 'witch' ? 'Hội Phù Thủy' : 'Hiệp Hội Thợ Săn'}** rồi nè! 💕`,
          };
        }

        // Tiến hành hoán đổi phe cho Admin
        const oldFaction = userData.faction;
        const currentPumpkins = userData.pumpkins || 0;
        const calculatedRank = this.calculateRank(currentPumpkins);

        userData.faction = chosenFaction;
        userData.current_rank = calculatedRank;
        witchHunterStorage.saveUser(userData, true);

        // Đồng bộ Role: Gỡ role phe cũ và cấp role phe mới
        const roleSyncResult = await this.syncRankRole(guild, member, calculatedRank, chosenFaction);

        // Gửi thông báo nội bộ cho Admin vào kênh 1563382678378643487
        const adminLogEmbed = this.buildFactionChangeAdminLogEmbed(member, oldFaction, chosenFaction, calculatedRank, currentPumpkins);
        await this.sendAdminLog(guild, adminLogEmbed);

        return {
          success: true,
          changedFaction: true,
          oldFaction,
          faction: chosenFaction,
          rank: calculatedRank,
          pumpkins: currentPumpkins,
          roleSyncResult,
        };
      }

      // Thành viên bình thường => Chặn tuyệt đối không cho phản bội phe
      return {
        success: false,
        alreadyChosen: true,
        faction: userData.faction,
        message: WITCH_HUNTER_CONFIG.messages.alreadyChosen,
      };
    }

    // 2. TRƯỜNG HỢP CHƯA CÓ PHE (Gia nhập mới):
    const currentPumpkins = userData?.pumpkins || 0;
    const calculatedRank = this.calculateRank(currentPumpkins);

    userData = {
      ...(userData || {}),
      user_id: userId,
      faction: chosenFaction,
      current_rank: calculatedRank,
      pumpkins: currentPumpkins,
    };

    witchHunterStorage.saveUser(userData, true);

    // Đồng bộ Role bậc 1 (hoặc bậc tương ứng nếu đã tích lũy điểm từ trước)
    const roleSyncResult = await this.syncRankRole(guild, member, calculatedRank, chosenFaction);

    // Gửi DM thông báo trao Supporter Bậc 1 khởi đầu (hoặc thức tỉnh nếu bậc cao hơn)
    await this.notifySupporterUnlock(guild.client, userId, chosenFaction, calculatedRank, calculatedRank === 1);

    // Gửi thông báo nội bộ cho Admin vào kênh 1563382678378643487
    const adminLogEmbed = this.buildFactionJoinAdminLogEmbed(member, chosenFaction, calculatedRank, currentPumpkins, 'Tự ký khế ước (Selection Button)');
    await this.sendAdminLog(guild, adminLogEmbed);

    return {
      success: true,
      alreadyChosen: false,
      faction: chosenFaction,
      rank: calculatedRank,
      pumpkins: currentPumpkins,
      roleSyncResult,
    };
  }

  /**
   * Đổi phe cho thành viên do Admin thực hiện (Lệnh /doi-phe)
   */
  static async changeMemberFaction(guild, executor, member, newFaction) {
    const userId = member.id;
    let userData = witchHunterStorage.getUser(userId);

    const oldFaction = userData?.faction || null;
    const currentPumpkins = userData?.pumpkins || 0;
    const calculatedRank = this.calculateRank(currentPumpkins);

    if (oldFaction === newFaction) {
      return {
        success: false,
        isSameFaction: true,
        faction: newFaction,
        message: `Thành viên <@${userId}> hiện đã thuộc hàng ngũ **${newFaction === 'witch' ? 'Hội Phù Thủy' : 'Hiệp Hội Thợ Săn'}** rồi nè!`,
      };
    }

    if (!userData) {
      userData = {
        user_id: userId,
        faction: newFaction,
        current_rank: calculatedRank,
        pumpkins: currentPumpkins,
        unlocked_supporters: [`${newFaction}:${calculatedRank}`],
      };
    } else {
      userData.faction = newFaction;
      userData.current_rank = calculatedRank;
      userData.unlocked_supporters = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];
      const supporterKey = `${newFaction}:${calculatedRank}`;
      if (!userData.unlocked_supporters.includes(supporterKey)) {
        userData.unlocked_supporters.push(supporterKey);
      }
    }

    // Lưu Database ngay lập tức
    witchHunterStorage.saveUser(userData, true);

    // Gỡ tất cả role của cả 2 phe Witch Hunter hiện có trên Discord
    const allRoleIds = getAllWitchHunterRoleIds();
    const rolesToRemove = [];
    for (const rId of allRoleIds) {
      if (member.roles.cache.has(rId)) {
        rolesToRemove.push(rId);
        recordBotAction(userId, rId, 'remove');
      }
    }
    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove, 'Witch Hunter: Đổi phe do Admin thực hiện').catch(() => null);
    }

    // Cấp role mới tương ứng cấp bậc
    const newRoleId = WITCH_HUNTER_CONFIG.roles[newFaction][calculatedRank];
    if (newRoleId) {
      recordBotAction(userId, newRoleId, 'add');
      await member.roles.add(newRoleId, 'Witch Hunter: Cấp role phe mới do Admin thực hiện').catch(() => null);
    }

    const rankInfo = this.getRankInfo(newFaction, calculatedRank);
    const newFactionName = newFaction === 'witch' ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const newEmoji = newFaction === 'witch' ? WITCH_HUNTER_CONFIG.emojis.witchButton : WITCH_HUNTER_CONFIG.emojis.hunterButton;

    // Gửi DM riêng cho người chơi
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(WITCH_HUNTER_CONFIG.colors.pastelPurple)
        .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} **KHẾ ƯỚC MA THUẬT: CHUYỂN ĐỔI PHE PHÁI** ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
        .setDescription(
          `Chào **${member.user?.username || member.displayName}** thân mến! Em phù thủy nóng bỏng Usagi múp rụp gửi thông báo tới lữ khách nè!\n\n` +
          `Ban Quản Trị vừa tiến hành phê chuẩn chuyển đổi phe phái của bạn trong thế giới **Witch Hunter**:\n\n` +
          `> ${newEmoji} **Phe phái mới:** **${newFactionName}**\n` +
          `> 🎖️ **Cấp bậc tương ứng:** **${rankInfo.name}** *(Bậc ${calculatedRank})*\n` +
          `> ${WITCH_HUNTER_CONFIG.emojis.pumpkin} **Bí Ngô tích lũy:** **${currentPumpkins.toLocaleString('vi-VN')}** ${WITCH_HUNTER_CONFIG.emojis.pumpkin}\n` +
          `> 🛡️ **Role mới:** <@&${rankInfo.roleId}>\n\n` +
          `*Toàn bộ role của phe cũ đã được thu hồi và role phe mới đã được trao gửi thành công!* 💕`
        )
        .setFooter({ text: 'Witch Hunter System' })
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] }).catch(() => null);
    } catch {}

    // Gửi DM trao/thức tỉnh Supporter của phe mới
    await this.notifySupporterUnlock(guild.client, userId, newFaction, calculatedRank, calculatedRank === 1, true);

    // Gửi thông báo kênh Admin Log
    const adminLogEmbed = new EmbedBuilder()
      .setColor(WITCH_HUNTER_CONFIG.colors.pastelPurple)
      .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} **THÔNG BÁO: ADMIN ĐỔI PHE CHO THÀNH VIÊN** ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
      .setDescription(`Admin vừa thực hiện lệnh \`/doi-phe\` chuyển đổi phe phái cho thành viên!`)
      .addFields(
        {
          name: '👑 Admin Thực Hiện:',
          value: `<@${executor.id}> (\`${executor.tag || executor.username}\`)`,
          inline: true,
        },
        {
          name: '👤 Thành Viên Được Đổi:',
          value: `<@${userId}> (\`${member.user?.tag || member.user?.username}\`)`,
          inline: true,
        },
        {
          name: '🔄 Chuyển Đổi:',
          value: `Từ **${oldFaction ? (oldFaction === 'witch' ? 'Hội Phù Thủy' : 'Hiệp Hội Thợ Săn') : 'Chưa có phe'}** ➡️ ${newEmoji} **${newFactionName}**`,
          inline: false,
        },
        {
          name: '🎖️ Cấp Bậc & Role Mới:',
          value: `**${rankInfo.name}** *(Bậc ${calculatedRank})* — <@&${rankInfo.roleId}>`,
          inline: true,
        },
        {
          name: `${WITCH_HUNTER_CONFIG.emojis.pumpkin} Bí Ngô Hiện Có:`,
          value: `**${currentPumpkins.toLocaleString('vi-VN')}** ${WITCH_HUNTER_CONFIG.emojis.pumpkin}`,
          inline: true,
        }
      )
      .setFooter({ text: 'Witch Hunter System' })
      .setTimestamp();

    await this.sendAdminLog(guild, adminLogEmbed);

    return {
      success: true,
      oldFaction,
      newFaction,
      newFactionName,
      newEmoji,
      rank: calculatedRank,
      rankInfo,
      pumpkins: currentPumpkins,
      member,
    };
  }

  /**
   * Ban thưởng Bí Ngô cho thành viên hoặc Admin (Hỗ trợ từ lệnh Admin hoặc các module nhiệm vụ về sau)
   * Tự động cộng dồn, kiểm tra điều kiện thăng cấp và cập nhật Role nếu đủ điểm.
   * 
   * @param {import('discord.js').Guild} guild 
   * @param {string|import('discord.js').GuildMember} memberOrId 
   * @param {number} amount 
   * @param {object} options 
   */
  static async awardPumpkins(guild, memberOrId, amount, options = {}) {
    const {
      reason = 'Ban thưởng trực tiếp từ Admin',
      executor = null,
      source = 'Lệnh /phat-bi-ngo',
      notifyDM = true,
      notifyAdminLog = true,
    } = options;

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      return {
        success: false,
        reason: 'INVALID_AMOUNT',
        message: 'Số lượng Bí Ngô ban thưởng phải là một số nguyên dương lớn hơn 0!',
      };
    }

    const userId = typeof memberOrId === 'string' ? memberOrId : memberOrId.id;
    let member = typeof memberOrId === 'object' && memberOrId?.roles ? memberOrId : null;
    if (!member && guild) {
      member = await guild.members.fetch({ user: userId, cache: false }).catch(() => null);
    }

    let userData = witchHunterStorage.getUser(userId);
    const oldPumpkins = userData?.pumpkins || 0;
    const oldRank = userData?.current_rank || 1;
    const newPumpkins = oldPumpkins + numAmount;
    const hasFaction = Boolean(userData?.faction);

    let isRankUp = false;
    let newRank = oldRank;
    let rankInfo = null;
    let quote = null;

    if (!userData) {
      userData = {
        user_id: userId,
        faction: null,
        current_rank: 1,
        pumpkins: newPumpkins,
      };
    } else {
      userData.pumpkins = newPumpkins;
    }

    // Nếu người dùng ĐÃ CÓ PHE => Tính toán tự động thăng cấp nếu đủ điểm
    if (hasFaction) {
      newRank = this.calculateRank(newPumpkins);
      userData.current_rank = newRank;

      if (newRank > oldRank) {
        isRankUp = true;
        rankInfo = this.getRankInfo(userData.faction, newRank);
        quote = this.getRankUpQuote(userId, userData.faction, newRank, rankInfo.name);

        // Tự động cấp role bậc mới và gỡ role bậc cũ
        if (guild) {
          await this.syncRankRole(guild, member || userId, newRank, userData.faction);
        }

        // Nếu đang mang Supporter / Vũ Khí mặc định của bậc cũ thì tự động nâng lên bậc mới
        const oldDefaultSupporter = getSupporterByRank(userData.faction, oldRank);
        const oldDefaultWeapon = getWeaponByRank(userData.faction, oldRank);
        if (userData.equipped_supporter === oldDefaultSupporter?.id) {
          userData.equipped_supporter = null;
        }
        if (userData.equipped_weapon === oldDefaultWeapon?.id) {
          userData.equipped_weapon = null;
        }
      } else {
        rankInfo = this.getRankInfo(userData.faction, oldRank);
      }
    }

    // Lưu ngay lập tức vào database
    witchHunterStorage.saveUser(userData, true);

    // Gửi tin nhắn riêng (DM) cho người nhận
    if (notifyDM) {
      try {
        const userObj = member?.user || (guild?.client ? await guild.client.users.fetch(userId, { cache: false }).catch(() => null) : null);
        if (userObj) {
          const dmEmbed = this.buildAwardPumpkinsDM(userObj, numAmount, newPumpkins, isRankUp, rankInfo, quote, reason, executor);
          await userObj.send({ embeds: [dmEmbed] }).catch(() => null);
        }
      } catch {}
    }

    // Nếu có thăng cấp (Rank Up), tự động gửi DM mở khóa Supporter mới thức tỉnh
    if (isRankUp && userData.faction && guild?.client) {
      await this.notifySupporterUnlock(guild.client, userId, userData.faction, newRank, false);

      // Gửi thông báo chúc mừng thăng cấp vào Kênh Chỉ Định (announcementChannelId: 1563457814138064916)
      try {
        const announcementChannelId = WITCH_HUNTER_CONFIG.channels.announcementChannelId;
        const channel = guild.channels?.cache?.get(announcementChannelId) ||
          await guild.channels?.fetch?.(announcementChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const announceEmbed = this.buildRankUpAnnouncementEmbed(
            userId,
            userData.faction,
            oldRank,
            newRank,
            rankInfo,
            quote,
            newPumpkins
          );
          await channel.send({ content: `<@${userId}>`, embeds: [announceEmbed] }).catch(() => null);
        }
      } catch (annErr) {
        logger.error('❌ [WitchHunter] Lỗi khi gửi thông báo thăng cấp vào kênh chỉ định:', annErr);
      }
    }

    // Gửi thông báo nội bộ cho Admin vào kênh 1563382678378643487
    if (notifyAdminLog && guild) {
      try {
        const logEmbed = this.buildAwardPumpkinsAdminLogEmbed(
          member || { id: userId, user: { tag: userId } },
          numAmount,
          oldPumpkins,
          newPumpkins,
          isRankUp,
          newRank,
          rankInfo,
          reason,
          executor,
          source,
          userData.faction
        );
        await this.sendAdminLog(guild, logEmbed);
      } catch {}
    }

    return {
      success: true,
      userId,
      amount: numAmount,
      oldPumpkins,
      newPumpkins,
      oldRank,
      newRank,
      isRankUp,
      rankInfo,
      quote,
      faction: userData.faction,
      userData,
    };
  }

  /**
   * Tạo Embed tin nhắn riêng (DM) khi bị thu hồi Bí Ngô dẫn đến Giáng Cấp
   */
  static buildDemoteDM(user, actualDeducted, newPumpkins, oldRank, newRank, oldRankInfo, newRankInfo, oldSupporter, newSupporter, reason, executor, faction = null) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const decor30Emoji = emojis.decor30 || '<a:trangtrig30:1546905942476464178>';
    const decor1Emoji = emojis.decor1 || '<a:trangtrig1:1546040442548654140>';
    const effectiveFaction = faction || oldRankInfo?.faction || newRankInfo?.faction;
    const isWitch = effectiveFaction === 'witch';
    const factionName = isWitch ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const factionBadge = isWitch ? emojis.witchBadge : emojis.hunterBadge;

    const newSupporterCat = newSupporter ? WITCH_HUNTER_CONFIG.supporters.categories[newSupporter.categoryKey] : null;
    const newCatEmoji = newSupporterCat?.emoji || emojis.sparkles;

    const sourceText = executor
      ? `từ <@${executor.id}>`
      : reason?.includes('Hiến tế') || reason?.includes('Tế Đàn')
      ? `thông qua nghi lễ hiến tế tại Tế Đàn Triệu Hồi`
      : 'từ Ban Quản Trị';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **THU HỒI BÍ NGÔ & GIÁNG CẤP MA THUẬT** ${emojis.titleRight}`)
      .setDescription(
        `Chào **Kẻ Mang Khế Ước** thân mến! Em phù thủy nóng bỏng Usagi múp rụp gửi thông báo tới lữ khách nè!\n\n` +
        `Số Bí Ngô của lữ khách vừa sụt giảm **-${actualDeducted.toLocaleString('vi-VN')} Bí Ngô** ${emojis.pumpkin} ${sourceText}!\n` +
        (reason ? `> ${decor30Emoji} **Lý do:** ${reason}\n\n` : '\n') +
        `${decor1Emoji} **Tổng Bí Ngô tích lũy hiện tại:** **${newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n\n` +
        `<a:bang2:1546891483250954290> **CẢNH BÁO GIÁNG CẤP DANH VỊ:**\n` +
        `Do số lượng Bí Ngô sụt giảm không còn đủ duy trì ma lực, danh vị của lữ khách đã bị giáng từ **${oldRankInfo?.name || `Bậc ${oldRank}`}** xuống:\n` +
        `> ${factionBadge} **${factionName}** • ${emojis.decor15 || '<a:trangtrig15:1546047955696488489>'} **${newRankInfo?.name || `Bậc ${newRank}`}**\n\n` +
        `Role **${oldRankInfo?.name || `Bậc ${oldRank}`}** đã bị thu hồi, thay thế bằng role **${newRankInfo?.name || `Bậc ${newRank}`}** trên máy chủ.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:trangtrig4:1546041273813827645> **KHẾ ƯỚC SUPPORTER BỊ PHONG ẤN & THU HỒI:**\n` +
        `Do ma lực không còn đạt ngưỡng yêu cầu, khế ước của Supporter **${oldSupporter ? oldSupporter.name : `Bậc ${oldRank}`}** đã bị giải trừ và phong ấn trở lại!\n` +
        `Supporter đồng hành hiện tại của lữ khách được giáng về bậc tương ứng:\n` +
        `> ${newCatEmoji} **SUPPORTER: ${newSupporter ? newSupporter.fullName : `Bậc ${newRank}`}** *(Bậc ${newRank})*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '💕'} Hãy nỗ lực tích lũy thêm Bí Ngô để khôi phục lại cảnh giới ma lực và thức tỉnh lại Supporter tối cao nha lữ khách!`
      )
      .setFooter({ text: 'Witch Hunter System' })
      .setTimestamp();
  }

  /**
   * Tạo Embed tin nhắn riêng (DM) khi bị thu hồi Bí Ngô nhưng không bị giáng cấp
   */
  static buildRevokePumpkinsDM(user, actualDeducted, newPumpkins, reason, executor) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const decor30Emoji = emojis.decor30 || '<a:trangtrig30:1546905942476464178>';
    const decor1Emoji = emojis.decor1 || '<a:trangtrig1:1546040442548654140>';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **THU HỒI BÍ NGÔ MA THUẬT** ${emojis.titleRight}`)
      .setDescription(
        `Chào **Kẻ Mang Khế Ước** thân mến! Em phù thủy nóng bỏng Usagi múp rụp gửi thông báo tới lữ khách nè!\n\n` +
        `Hội Đồng Ma Thuật vừa thực hiện thu hồi **-${actualDeducted.toLocaleString('vi-VN')} Bí Ngô** ${emojis.pumpkin} từ ${executor ? `<@${executor.id}>` : 'Ban Quản Trị'}!\n` +
        (reason ? `> ${decor30Emoji} **Lý do / Vi phạm:** ${reason}\n\n` : '\n') +
        `${decor1Emoji} **Tổng Bí Ngô tích lũy hiện tại:** **${newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n\n` +
        `Số Bí Ngô tích lũy hiện tại vẫn đủ duy trì cấp bậc danh vị ma lực của lữ khách. Hãy cẩn thận và tiếp tục phấn đấu tích lũy thêm Bí Ngô nha!`
      )
      .setFooter({ text: 'Witch Hunter System' })
      .setTimestamp();
  }

  /**
   * Tạo Embed thông báo nội bộ cho Admin khi có lượt thu hồi Bí Ngô
   */
  static buildRevokePumpkinsAdminLogEmbed(member, amount, oldPumpkins, newPumpkins, isDemoted, oldRank, newRank, rankInfo, reason, executor, faction) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitch = faction === 'witch';
    const isHunter = faction === 'hunter';
    let factionDisplay = '*Chưa ký khế ước*';
    if (isWitch) factionDisplay = `${emojis.witchBadge} Hội Phù Thủy (Witches)`;
    if (isHunter) factionDisplay = `${emojis.hunterBadge} Hiệp Hội Thợ Săn (W.H. Association)`;

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **THÔNG BÁO NỘI BỘ: THU HỒI BÍ NGÔ** ${emojis.titleRight}`)
      .setDescription(`Hệ thống ghi nhận lượt thu hồi Bí Ngô từ thành viên!`)
      .addFields(
        {
          name: '👤 Người Bị Thu Hồi:',
          value: `<@${member.id}> (\`${member.user?.tag || member.id}\` | ID: \`${member.id}\`)`,
          inline: true,
        },
        {
          name: '👑 Người Thu Hồi (Admin):',
          value: executor ? `<@${executor.id}> (\`${executor.tag || executor.id}\`)` : 'Ban Quản Trị',
          inline: true,
        },
        {
          name: `${emojis.pumpkin} Số Lượng Thu Hồi:`,
          value: `**-${amount.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
          inline: true,
        },
        {
          name: '📊 Biến Động Số Dư:',
          value: `${oldPumpkins.toLocaleString('vi-VN')} ➡️ **${newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
          inline: true,
        },
        {
          name: '⚔️ Phe Phái & Cấp Bậc:',
          value: `${factionDisplay}\n${faction ? `**${rankInfo?.name || `Bậc ${newRank}`}** *(Bậc ${newRank})*` : '*Chưa phân định*'}`,
          inline: true,
        },
        {
          name: '📜 Lý Do / Vi Phạm:',
          value: `**${reason || 'Thu hồi trực tiếp'}**`,
          inline: true,
        }
      )
      .setFooter({ text: 'Witch Hunter Admin System' })
      .setTimestamp();

    if (isDemoted && rankInfo) {
      embed.addFields({
        name: '⚠️ Giáng Cấp Danh Vị:',
        value: `Thành viên không còn đủ điểm Bí Ngô và đã bị giáng từ **Bậc ${oldRank}** xuống **${rankInfo.name}** (Role: <@&${rankInfo.roleId}>)! Supporter bậc cao hơn đã bị phong ấn và giáng về bậc mới.`,
        inline: false,
      });
    }

    return embed;
  }

  /**
   * Thu hồi Bí Ngô từ thành viên (Chỉ Admin)
   * Tự động trừ điểm, kiểm tra nếu bị giáng cấp thì đổi role, giáng supporter, gửi DM riêng (không báo kênh lớn).
   */
  static async revokePumpkins(guild, memberOrId, amount, options = {}) {
    const {
      reason = 'Thu hồi trực tiếp từ Admin',
      executor = null,
      notifyDM = true,
      notifyAdminLog = true,
    } = options;

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      return {
        success: false,
        reason: 'INVALID_AMOUNT',
        message: 'Số lượng Bí Ngô thu hồi phải là một số nguyên dương lớn hơn 0!',
      };
    }

    const userId = typeof memberOrId === 'string' ? memberOrId : memberOrId.id;
    let member = typeof memberOrId === 'object' && memberOrId?.roles ? memberOrId : null;
    if (!member && guild) {
      member = await guild.members.fetch({ user: userId, cache: false }).catch(() => null);
    }

    let userData = witchHunterStorage.getUser(userId);
    const oldPumpkins = userData?.pumpkins || 0;
    if (oldPumpkins <= 0) {
      return {
        success: false,
        reason: 'NO_PUMPKINS',
        message: `Thành viên <@${userId}> hiện tại không có Bí Ngô nào trong kho để thu hồi!`,
      };
    }

    const actualDeducted = Math.min(oldPumpkins, numAmount);
    const newPumpkins = oldPumpkins - actualDeducted;
    const oldRank = userData?.current_rank || 1;
    const hasFaction = Boolean(userData?.faction);

    let isDemoted = false;
    let newRank = oldRank;
    let oldRankInfo = null;
    let newRankInfo = null;
    let oldSupporter = null;
    let newSupporter = null;

    if (!userData) {
      userData = {
        user_id: userId,
        faction: null,
        current_rank: 1,
        pumpkins: newPumpkins,
        unlocked_supporters: [],
      };
    } else {
      userData.pumpkins = newPumpkins;
    }

    // Nếu người dùng ĐÃ CÓ PHE => Tính toán xem có bị giáng cấp không
    if (hasFaction) {
      newRank = this.calculateRank(newPumpkins);
      oldRankInfo = this.getRankInfo(userData.faction, oldRank);
      newRankInfo = this.getRankInfo(userData.faction, newRank);

      if (newRank < oldRank) {
        isDemoted = true;
        userData.current_rank = newRank;

        // Lấy thông tin supporter cũ và supporter mới sau khi giáng
        oldSupporter = getSupporterByRank(userData.faction, oldRank);
        newSupporter = getSupporterByRank(userData.faction, newRank);

        // Giáng supporter: Xóa các bậc cao hơn khỏi danh sách đã mở khóa
        const currentUnlocked = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];
        userData.unlocked_supporters = currentUnlocked.filter((key) => {
          const parts = key.split(':');
          const r = Number(parts[1]);
          return isNaN(r) || r <= newRank;
        });

        // Tự động thu hồi role bậc cũ và cấp lại role bậc mới tương ứng
        if (guild) {
          await this.syncRankRole(guild, member || userId, newRank, userData.faction);
        }

        // Tự động kiểm tra và hạ cấp Supporter & Vũ Khí đang kích hoạt nếu vượt quá rank mới
        const maxAllowedTier = Math.min(5, newRank + 1);
        if (userData.equipped_supporter) {
          const equippedSupp = getSupporterById(userData.equipped_supporter);
          if (
            !equippedSupp ||
            (!equippedSupp.isSummon && Number(equippedSupp.rank) > newRank) ||
            (equippedSupp.isSummon && this.rankToTier(equippedSupp.rank) > maxAllowedTier)
          ) {
            userData.equipped_supporter = null;
          }
        }
        if (userData.equipped_weapon) {
          const equippedWep = getWeaponById(userData.equipped_weapon);
          if (
            !equippedWep ||
            (!equippedWep.isSummon && Number(equippedWep.rank) > newRank) ||
            (equippedWep.isSummon && this.rankToTier(equippedWep.rank) > maxAllowedTier)
          ) {
            userData.equipped_weapon = null;
          }
        }
      }
    }

    // Lưu ngay lập tức vào database
    witchHunterStorage.saveUser(userData, true);

    // Gửi tin nhắn riêng (DM) cho thành viên (Chỉ gửi DM riêng, TUYỆT ĐỐI KHÔNG thông báo kênh lớn)
    if (notifyDM) {
      try {
        const userObj = member?.user || (guild?.client ? await guild.client.users.fetch(userId, { cache: false }).catch(() => null) : null);
        if (userObj) {
          let dmEmbed;
          if (isDemoted) {
            dmEmbed = this.buildDemoteDM(
              userObj,
              actualDeducted,
              newPumpkins,
              oldRank,
              newRank,
              oldRankInfo,
              newRankInfo,
              oldSupporter,
              newSupporter,
              reason,
              executor,
              userData.faction
            );
          } else {
            dmEmbed = this.buildRevokePumpkinsDM(userObj, actualDeducted, newPumpkins, reason, executor);
          }
          await userObj.send({ embeds: [dmEmbed] }).catch(() => null);
        }
      } catch {}
    }

    // Gửi thông báo nội bộ cho Admin vào kênh 1563382678378643487 (KHÔNG thông báo kênh lớn)
    if (notifyAdminLog && guild) {
      try {
        const logEmbed = this.buildRevokePumpkinsAdminLogEmbed(
          member || { id: userId, user: { tag: userId } },
          actualDeducted,
          oldPumpkins,
          newPumpkins,
          isDemoted,
          oldRank,
          newRank,
          newRankInfo || oldRankInfo,
          reason,
          executor,
          userData.faction
        );
        await this.sendAdminLog(guild, logEmbed);
      } catch {}
    }

    return {
      success: true,
      userId,
      amount: actualDeducted,
      oldPumpkins,
      newPumpkins,
      oldRank,
      newRank,
      isDemoted,
      oldRankInfo,
      newRankInfo,
      oldSupporter,
      newSupporter,
      faction: userData.faction,
      userData,
    };
  }


  /**
   * Đồng bộ Role: Gỡ bỏ tất cả Role bậc cũ và cấp Role bậc mới tương ứng theo phe.
   * Tối ưu RAM: Fetch không lưu cache, xử lý ngoại lệ an toàn nếu member thoát hoặc bot thiếu quyền.
   * Đã tích hợp recordBotAction để tránh trigger nhầm khi Admin cấp/xóa role thủ công.
   */
  static async syncRankRole(guild, memberOrId, targetRank, targetFaction) {
    try {
      if (!guild) return { success: false, reason: 'NO_GUILD' };

      let member = memberOrId;
      if (typeof memberOrId === 'string') {
        member = await guild.members.fetch({ user: memberOrId, cache: false }).catch(() => null);
      }

      if (!member) {
        return { success: false, reason: 'MEMBER_NOT_FOUND' };
      }

      // Thu thập tất cả 10 role IDs của cả 2 phe để dọn dẹp sạch sẽ
      const allWitchHunterRoleIds = new Set();
      Object.values(WITCH_HUNTER_CONFIG.roles.hunter).forEach((id) => allWitchHunterRoleIds.add(id));
      Object.values(WITCH_HUNTER_CONFIG.roles.witch).forEach((id) => allWitchHunterRoleIds.add(id));

      const targetRoleId = WITCH_HUNTER_CONFIG.roles[targetFaction]?.[targetRank];

      // Tìm những role cần tháo bỏ
      const rolesToRemove = [];
      for (const roleId of allWitchHunterRoleIds) {
        if (roleId && roleId !== targetRoleId && member.roles.cache.has(roleId)) {
          rolesToRemove.push(roleId);
        }
      }

      // Đánh dấu hành động của Bot trước khi tháo/cấp role
      for (const roleId of rolesToRemove) {
        recordBotAction(member.id, roleId, 'remove');
      }

      if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
        recordBotAction(member.id, targetRoleId, 'add');
      }

      // Tháo role cũ
      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove, 'Witch Hunter: Tự động tháo role bậc cũ khi thăng hạng / đổi phe').catch((err) => {
          logger.warn(`⚠️ [WitchHunter] Không thể tháo role [${rolesToRemove.join(', ')}] cho ${member.id}:`, err.message);
        });
      }

      // Cấp role mới
      if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
        await member.roles.add(targetRoleId, `Witch Hunter: Tự động cấp role Bậc ${targetRank} (${targetFaction})`).catch((err) => {
          logger.warn(`⚠️ [WitchHunter] Không thể cấp role [${targetRoleId}] cho ${member.id}:`, err.message);
        });
      }

      return {
        success: true,
        targetRoleId,
        removedRoles: rolesToRemove,
      };
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi ngoại lệ khi syncRankRole:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Tách danh sách User ID / Mention từ chuỗi nhập vào
   */
  static parseUserIds(inputString) {
    if (!inputString || typeof inputString !== 'string') return [];
    const matches = inputString.match(/\d{17,20}/g) || [];
    return [...new Set(matches)];
  }

  /**
   * Tạo giao diện tin nhắn DM gửi cho thành viên chưa chọn phe (Màu tím pastel nhạt nhạt)
   */
  static buildFactionReminderDM(user, pointsAwarded, totalPumpkins, thang) {
    const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Cố định màu tím pastel nhạt nhạt
      .setTitle(`${emojis.titleLeft} **KHẾ ƯỚC MA THUẬT** ${emojis.titleRight}`)
      .setDescription(
        `Chào bạn **${user.username}** thân mến! Em phù thủy nóng bỏng Usagi múp rụp mang tin vui tới cho bạn nè! ${emojis.heart || '<a:heartg1:1545307544808071258>'}\n\n` +
        `${emojis.pumpkin} Trong kỳ tổng kết Bảng Xếp Hạng **${thang}**, bạn đã đạt thành tích hoạt động xuất sắc và được ban thưởng:\n` +
        `> ${emojis.pumpkin} **+${pointsAwarded} Bí Ngô** (Hiện tổng tích lũy: **${totalPumpkins}** ${emojis.pumpkin})\n\n` +
        `${emojis.pumpkin} **LƯU Ý QUAN TRỌNG TỪ HỘI ĐỒNG MA THUẬT**\n` +
        `Linh hồn của bạn hiện vẫn chưa ký khế ước gia nhập phe phái trong thế giới Witch Hunter!\n\n` +
        `${emojis.hunterButton} Hiệp Hội Thợ Săn (W.H. Association)\n` +
        `${emojis.witchButton} Hội Phù Thủy (Witches)\n\n` +
        `Hãy mau chóng ghé qua kênh <#${channels.selectionChannelId}> và bấm nút ký khế ước để nhận ngay Role danh hiệu và khai mở toàn bộ đặc quyền cấp bậc của bạn nhé!`
      )
      .setFooter({
        text: 'Witch Hunter System',
      })
      .setTimestamp();
  }

  /**
   * Xử lý cộng điểm chốt BXH tháng
   */
  static async processMonthlyLeaderboard(guild, client, { top1_3Raw, top4_10Raw, top11_20Raw, thang }) {
    const top1_3Ids = this.parseUserIds(top1_3Raw);
    const top4_10Ids = this.parseUserIds(top4_10Raw);
    const top11_20Ids = this.parseUserIds(top11_20Raw);

    const results = {
      top1_3: [],
      top4_10: [],
      top11_20: [],
      rankUps: [],
      dmReminded: [],
      errors: [],
    };

    const processGroup = async (userIds, points, groupName) => {
      for (const userId of userIds) {
        try {
          let userData = witchHunterStorage.getUser(userId);
          const oldPumpkins = userData?.pumpkins || 0;
          const oldRank = userData?.current_rank || 1;
          const newPumpkins = oldPumpkins + points;

          if (!userData) {
            userData = {
              user_id: userId,
              faction: null,
              current_rank: 1,
              pumpkins: newPumpkins,
            };
          } else {
            userData.pumpkins = newPumpkins;
          }

          // Kiểm tra xem thành viên đã có phe chưa
          if (!userData.faction) {
            // Lưu điểm vào DB trước
            witchHunterStorage.saveUser(userData);

            // Gửi DM nhắc chọn phe (Tối ưu RAM: fetch user với cache: false)
            try {
              const discordUser = await client.users.fetch(userId, { cache: false }).catch(() => null);
              if (discordUser) {
                const dmEmbed = this.buildFactionReminderDM(discordUser, points, newPumpkins, thang);
                await discordUser.send({ embeds: [dmEmbed] }).catch(() => {
                  logger.info(`ℹ️ [WitchHunter] Không thể gửi DM cho ${userId} (DM bị chặn/đóng).`);
                });
                results.dmReminded.push(userId);
              }
            } catch (dmErr) {
              // Bỏ qua lỗi DM
            }
          } else {
            // Đã có phe: Tính toán kiểm tra xem có thăng cấp không
            const newRank = this.calculateRank(newPumpkins);
            userData.current_rank = newRank;
            witchHunterStorage.saveUser(userData);

            if (newRank > oldRank) {
              // Có thăng cấp!
              const rankInfo = this.getRankInfo(userData.faction, newRank);
              await this.syncRankRole(guild, userId, newRank, userData.faction);

              const quote = this.getRankUpQuote(userId, userData.faction, newRank, rankInfo.name);

              // Tự động gửi DM thức tỉnh Supporter bậc mới
              await this.notifySupporterUnlock(client, userId, userData.faction, newRank, false);

              results.rankUps.push({
                userId,
                faction: userData.faction,
                oldRank,
                newRank,
                rankName: rankInfo.name,
                title: rankInfo.title,
                pumpkins: newPumpkins,
                quote,
              });
            }
          }

          results[groupName].push({
            userId,
            pumpkins: newPumpkins,
            added: points,
            faction: userData.faction,
          });
        } catch (err) {
          logger.error(`❌ [WitchHunter] Lỗi khi xử lý thành viên ${userId}:`, err);
          results.errors.push({ userId, error: err.message });
        }
      }
    };

    await processGroup(top1_3Ids, WITCH_HUNTER_CONFIG.pointsReward.top1_3, 'top1_3');
    await processGroup(top4_10Ids, WITCH_HUNTER_CONFIG.pointsReward.top4_10, 'top4_10');
    await processGroup(top11_20Ids, WITCH_HUNTER_CONFIG.pointsReward.top11_20, 'top11_20');

    // Sau khi duyệt xong toàn bộ batch, lưu ngay vào đĩa
    witchHunterStorage.flushJson();

    return results;
  }

  /**
   * Xử lý sự kiện GuildMemberUpdate khi Admin cấp role hoặc xóa role thủ công qua Discord
   */
  static async handleGuildMemberRoleUpdate(oldMember, newMember) {
    try {
      if (!newMember?.guild || newMember.user?.bot) return;

      const guild = newMember.guild;
      const allWHRoleIds = getAllWitchHunterRoleIds();

      // Xác định các role Witch Hunter được Thêm hoặc Bị Gỡ
      const addedRoleIds = [];
      const removedRoleIds = [];

      // Kiểm tra thành viên có trong cache hay partial
      if (!oldMember?.partial) {
        for (const [roleId] of newMember.roles.cache) {
          if (allWHRoleIds.has(roleId) && !oldMember.roles.cache.has(roleId)) {
            addedRoleIds.push(roleId);
          }
        }
        for (const [roleId] of oldMember.roles.cache) {
          if (allWHRoleIds.has(roleId) && !newMember.roles.cache.has(roleId)) {
            removedRoleIds.push(roleId);
          }
        }
      } else {
        // Trường hợp oldMember là partial: đối chiếu role hiện tại với dữ liệu trong DB
        const userData = witchHunterStorage.getUser(newMember.id);
        const currentDbFaction = userData?.faction;

        for (const [roleId] of newMember.roles.cache) {
          if (allWHRoleIds.has(roleId)) {
            const roleInfo = getWitchHunterRoleInfo(roleId);
            if (roleInfo && roleInfo.faction !== currentDbFaction) {
              addedRoleIds.push(roleId);
            }
          }
        }
      }

      if (addedRoleIds.length === 0 && removedRoleIds.length === 0) {
        return;
      }

      // Tra cứu Audit Log để xác định Admin/Mod thực hiện thao tác thủ công (nếu có quyền)
      let executor = null;
      try {
        if (guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
          // Delay nhỏ để Discord kịp ghi nhận Audit Entry
          await new Promise((resolve) => setTimeout(resolve, 400));
          const auditLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberRoleUpdate,
            limit: 5,
          }).catch(() => null);

          if (auditLogs) {
            const now = Date.now();
            for (const entry of auditLogs.entries.values()) {
              const targetId = entry.targetId ?? entry.target?.id;
              if (targetId === newMember.id && now - entry.createdTimestamp < 15000) {
                const execId = entry.executorId ?? entry.executor?.id;
                // Nếu người thực hiện là chính Bot => Bỏ qua
                if (execId === newMember.client?.user?.id) {
                  return;
                }
                executor = entry.executor;
                break;
              }
            }
          }
        }
      } catch (auditErr) {
        logger.warn('⚠️ [WitchHunter] Không thể fetch Audit Log:', auditErr.message);
      }

      // 1. XỬ LÝ ROLE BỊ XÓA (ADMIN GỠ THỦ CÔNG)
      for (const roleId of removedRoleIds) {
        // Kiểm tra xem có phải do chính Bot vừa gỡ không
        if (isRecentBotAction(newMember.id, roleId, 'remove')) {
          continue;
        }

        const roleInfo = getWitchHunterRoleInfo(roleId);
        if (!roleInfo) continue;

        // Kiểm tra xem sau khi gỡ role này, thành viên còn role Witch Hunter nào cùng phe không
        const remainingSameFactionRole = [...newMember.roles.cache.keys()].some((rId) => {
          const info = getWitchHunterRoleInfo(rId);
          return info?.faction === roleInfo.faction;
        });

        if (!remainingSameFactionRole) {
          // Đã xóa hết role của phe => Ghi nhận thành viên tạm không có phe (faction = null)
          let userData = witchHunterStorage.getUser(newMember.id);
          if (userData) {
            userData.faction = null;
            witchHunterStorage.saveUser(userData, true);
          }

          // Gửi thông báo nội bộ cho Admin vào kênh 1563382678378643487
          const adminEmbed = this.buildManualRoleRemoveAdminLogEmbed(newMember, roleInfo, executor);
          await this.sendAdminLog(guild, adminEmbed);

          // Gửi thông báo riêng (DM) cho thành viên
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor(WITCH_HUNTER_CONFIG.colors.pastelPurple)
              .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} **KHẾ ƯỚC MA THUẬT: GIẢI TRỪ PHE** ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
              .setDescription(
                `Chào **${newMember.user.username}** thân mến! Em bot Usagi múp rụp gửi thông báo tới bạn nè:\n\n` +
                `Ban Quản Trị vừa thu hồi role phe **${roleInfo.name}** của bạn.\n` +
                `> ⚠️ **Trạng thái hiện tại:** Dữ liệu phe phái của bạn trong thế giới Witch Hunter đã được đưa về trạng thái **Chưa có phe (Vô môn vô phái)**.\n` +
                `> 💡 Khi nào Ban Quản Trị cấp lại hoặc bạn tự ghé kênh <#${WITCH_HUNTER_CONFIG.channels.selectionChannelId}> để ký khế ước chọn phe lại thì hệ thống mới ghi nhận thông tin nha!`
              )
              .setFooter({ text: 'Witch Hunter System' })
              .setTimestamp();

            await newMember.send({ embeds: [dmEmbed] }).catch(() => null);
          } catch {}
        }
      }

      // 2. XỬ LÝ ROLE ĐƯỢC THÊM (ADMIN CẤP THỦ CÔNG)
      for (const roleId of addedRoleIds) {
        // Kiểm tra xem có phải do chính Bot vừa cấp không
        if (isRecentBotAction(newMember.id, roleId, 'add')) {
          continue;
        }

        const roleInfo = getWitchHunterRoleInfo(roleId);
        if (!roleInfo) continue;

        // Cập nhật Database: Ghi nhận phe và cấp bậc của role được cấp
        let userData = witchHunterStorage.getUser(newMember.id);
        const currentPumpkins = userData?.pumpkins || 0;

        if (!userData) {
          userData = {
            user_id: newMember.id,
            faction: roleInfo.faction,
            current_rank: roleInfo.rank,
            pumpkins: currentPumpkins,
          };
        } else {
          userData.faction = roleInfo.faction;
          userData.current_rank = roleInfo.rank;
        }

        witchHunterStorage.saveUser(userData, true);

        // Tự động gỡ các role của phe đối lập (nếu có) để tránh thành viên giữ cùng lúc 2 phe
        const oppositeFaction = roleInfo.faction === 'hunter' ? 'witch' : 'hunter';
        const oppositeRoleIds = Object.values(WITCH_HUNTER_CONFIG.roles[oppositeFaction]);
        const rolesToClean = [];
        for (const oppId of oppositeRoleIds) {
          if (newMember.roles.cache.has(oppId)) {
            rolesToClean.push(oppId);
            recordBotAction(newMember.id, oppId, 'remove');
          }
        }
        if (rolesToClean.length > 0) {
          await newMember.roles.remove(rolesToClean, 'Witch Hunter: Tự động dọn role phe đối lập khi admin cấp role thủ công').catch(() => null);
        }

        // Gửi thông báo riêng (DM) cho thành viên được cấp role
        try {
          const welcomeMessage = roleInfo.faction === 'witch'
            ? WITCH_HUNTER_CONFIG.messages.welcomeWitch(newMember.id)
            : WITCH_HUNTER_CONFIG.messages.welcomeHunter(newMember.id);

          const dmEmbed = new EmbedBuilder()
            .setColor(WITCH_HUNTER_CONFIG.colors.pastelPurple)
            .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} **KHẾ ƯỚC MA THUẬT: GIA NHẬP PHE** ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
            .setDescription(
              `Chào **${newMember.user.username}** thân mến! Em bot Usagi múp rụp chúc mừng bạn:\n\n` +
              `Ban Quản Trị vừa cấp role và phê chuẩn bạn chính thức gia nhập **${roleInfo.factionName}** với danh hiệu **${roleInfo.name}**!\n\n` +
              `${welcomeMessage}`
            )
            .setFooter({ text: 'Witch Hunter System' })
            .setTimestamp();

          await newMember.send({ embeds: [dmEmbed] }).catch(() => null);
        } catch {}

        // Tự động gửi DM trao/thức tỉnh Supporter tương ứng bậc vừa được cấp
        await this.notifySupporterUnlock(guild.client, newMember.id, roleInfo.faction, roleInfo.rank, roleInfo.rank === 1, true);

        // Gửi thông báo nội bộ cho Admin vào kênh 1563382678378643487
        const adminEmbed = this.buildManualRoleAddAdminLogEmbed(newMember, roleInfo, executor);
        await this.sendAdminLog(guild, adminEmbed);
      }
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi xử lý handleGuildMemberRoleUpdate:', error);
    }
  }

  /**
   * Tạo Embed trang tổng quan danh sách Supporter thế giới Witch Hunter
   */
  static buildSupporterOverviewEmbed() {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu Tím Pastel #D8B4F8
      .setTitle(`${emojis.titleLeft} **WITCH HUNTER: DANH SÁCH SUPPORTER KHẾ ƯỚC** ${emojis.titleRight}`)
      .setDescription(
        `Trong thế giới Witch Hunter, mỗi Thợ Săn hay Phù Thủy khi đạt đến từng cảnh giới ma lực nhất định sẽ có thể ký khế ước để kết giao hoặc điều khiển một Supporter (Trợ thủ phò tá) riêng biệt.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${emojis.decor41 || '<a:trangtrig41:1547238037832863744>'} **3 ĐẠI HỆ BẢN CHẤT SUPPORTER:**\n` +
        `• ${emojis.nguyenthe || '<a:nguyentheg:1563399515732443177>'} **Hệ Nguyền Thể (Cursed Entity):** Thực thể sinh ra từ oán niệm, xác thịt bị nguyền rủa hoặc linh hồn bị phong ấn vào vật thể.\n` +
        `• ${emojis.camkhi || '<a:camkhig:1563399321125134346>'} **Hệ Cấm Khí (Forbidden Relic):** Ma cụ, cơ quan cổ đại hoặc thiết bị không gian do con người rèn tạo để cưỡng chế ma lực.\n` +
        `• ${emojis.linhtoc || '<a:linhtocg:1563399670351536310>'} **Hệ Linh Tộc (Primordial Beast):** Sinh vật thượng cổ có tri giác độc lập, chỉ liên kết qua khế ước danh dự hoặc máu tương thích.\n\n` +
        `<a:whg2:1564145798537683034> **BỂ TRIỆU HỒI HUYẾT NGUYỆT (SUMMON BANNER):**\n` +
        `• Gồm các Supporter Cổ Đại & Đỉnh Phong phẩm cấp **A-Rank**, **S-Rank**, **SS-Rank**.\n` +
        `• Hãy sử dụng Tế Đàn Triệu Hồi Huyết Nguyệt để dâng hiến Bí Ngô và triệu gọi khế ước!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '<a:heartg1:1545307544808071258>'} Hãy chọn một Supporter trong danh sách bên dưới để tra cứu chi tiết hình dạng và khế ước chiến đấu nha lữ khách!`
      )
      .setFooter({ text: 'Witch Hunter Archive' });
  }

  /**
   * Tạo Embed chi tiết từng Supporter khi chọn từ menu
   */
  static buildSupporterDetailEmbed(supporter) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const cat = WITCH_HUNTER_CONFIG.supporters.categories[supporter.categoryKey];
    const catEmoji = cat?.emoji || emojis.sparkles;
    const isWitch = supporter.faction === 'witch';
    const factionBadge = isWitch ? emojis.witchBadge : emojis.hunterBadge;

    const summonNotice = supporter.isBlackMarket
      ? `\n\n<a:trangtrig46:1547240249761996812> **VẬT PHẨM ĐỘC QUYỀN CHỢ ĐEN:**\n> *Đây là Supporter độc quyền từ Chợ Đen Hư Không, dùng Mảnh Vỡ Ký Ức để trao đổi!*`
      : supporter.isSummon
      ? `\n\n<a:trangtrig41:1547240249761996812> **THÔNG BÁO TRIỆU HỒI KHẾ ƯỚC:**\n> *Đây là Supporter từ bể triệu gọi khế ước, hãy summon ngay để sở hữu!*`
      : '';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **KHẾ ƯỚC SUPPORTER: ${supporter.name.toUpperCase()}** ${emojis.titleRight}`)
      .setDescription(
        `${factionBadge} **${supporter.factionName}** • ${emojis.decor15 || '<a:trangtrig15:1546047955696488489>'} **${supporter.rankName}**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${catEmoji} **SUPPORTER: ${supporter.fullName}**\n` +
        `${catEmoji} ${cat?.name || 'Đại Hệ'}\n` +
        `> ${cat?.desc || ''}\n\n` +
        `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **HÌNH DÁNG ĐẶC TRƯNG:**\n` +
        `${supporter.appearance}\n\n` +
        `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **NGUỒN GỐC & KHẾ ƯỚC CHIẾN ĐẤU:**\n` +
        `${supporter.lore}` +
        summonNotice +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '<a:heartg1:1545307544808071258>'} Hãy chọn Supporter khác từ menu bên dưới để tiếp tục tra cứu khế ước nha lữ khách!`
      )
      .setFooter({ text: 'Witch Hunter Supporter' });
  }

  /**
   * Tạo Embed gửi tin nhắn riêng (DM) mở khóa Supporter
   * - Bậc 1: Dành cho tân binh vừa gia nhập
   * - Bậc 2 trở lên: Dành cho Kẻ Mang Khế Ước khi thăng cấp
   */
  static buildSupporterUnlockDM(supporter, isInitialRank1 = false) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const cat = WITCH_HUNTER_CONFIG.supporters.categories[supporter.categoryKey];
    const catEmoji = cat?.emoji || emojis.sparkles;
    const isWitch = supporter.faction === 'witch';
    const factionBadge = isWitch ? emojis.witchBadge : emojis.hunterBadge;

    if (isInitialRank1) {
      // Bậc 1: Tân Binh
      return new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **KHẾ ƯỚC SUPPORTER: ${supporter.name.toUpperCase()}** ${emojis.titleRight}`)
        .setDescription(
          `Chào **Tân Binh ${supporter.factionName}** thân mến! Em phù thủy nóng bỏng Usagi múp rụp gửi trao khế ước tới lữ khách nè!\n\n` +
          `Hội Đồng Ma Thuật vừa hoàn tất nghi thức phong ấn Supporter thế giới **Witch Hunter**. Nhận thấy lữ khách đã mang trong mình danh hiệu **${supporter.rankName}**, Hội Đồng xin trân trọng trao gửi Supporter khởi đầu đồng hành cùng lữ khách:\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${catEmoji} **SUPPORTER: ${supporter.fullName}**\n` +
          `${catEmoji} ${cat?.name || 'Đại Hệ'}\n` +
          `> ${cat?.desc || ''}\n\n` +
          `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **HÌNH DÁNG ĐẶC TRƯNG:**\n` +
          `${supporter.appearance}\n\n` +
          `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **NGUỒN GỐC & KHẾ ƯỚC CHIẾN ĐẤU:**\n` +
          `${supporter.lore}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${emojis.heart || '<a:heartg1:1545307544808071258>'} Khế ước đã liên kết vào linh hồn lữ khách! Lữ khách có thể dùng lệnh \`/supporter\` bất cứ lúc nào để tra cứu danh sách toàn bộ Supporter của thế giới Witch Hunter nha!`
        )
        .setFooter({ text: 'Witch Hunter Supporter' });
    }

    // Bậc 2 trở lên: Kẻ Mang Khế Ước thức tỉnh Supporter mới
    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **KHẾ ƯỚC SUPPORTER MỚI THỨC TỈNH** ${emojis.titleRight}`)
      .setDescription(
        `Chào **Kẻ Mang Khế Ước** thân mến! Em phù thủy nóng bỏng Usagi múp rụp mang tin vui chấn động tới cho **Kẻ Mang Khế Ước** nè!\n\n` +
        `Lữ khách đã tích lũy đủ chiến công Bí Ngô và chính thức thăng cấp lên:\n` +
        `> ${factionBadge} **${supporter.factionName}** • ${emojis.decor15 || '<a:trangtrig15:1546047955696488489>'} **${supporter.rankName}**\n\n` +
        `Khế ước cổ đại vừa rung chuyển dữ dội! Nhờ đạt đến ngưỡng ma lực mới, lữ khách đã chính thức mở khóa và nhận được sự phò tá của Supporter độc quyền:\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${catEmoji} **SUPPORTER: ${supporter.fullName}**\n` +
        `${catEmoji} ${cat?.name || 'Đại Hệ'}\n` +
        `> ${cat?.desc || ''}\n\n` +
        `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **HÌNH DÁNG ĐẶC TRƯNG:**\n` +
        `${supporter.appearance}\n\n` +
        `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **NGUỒN GỐC & KHẾ ƯỚC CHIẾN ĐẤU:**\n` +
        `${supporter.lore}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '<a:heartg1:1545307544808071258>'} Hãy mang theo Supporter này bên mình và tiếp tục tích lũy Bí Ngô để chinh phục các tầng danh vị tối cao tiếp theo nha!`
      )
      .setFooter({ text: 'Witch Hunter Supporter' });
  }

  /**
   * Tự động gửi DM thông báo mở khóa Supporter cho thành viên
   */
  static async notifySupporterUnlock(client, userId, faction, rank, isInitialRank1 = false, force = false) {
    try {
      if (!client || !userId || !faction || !rank) return false;

      const supporter = getSupporterByRank(faction, rank);
      if (!supporter) return false;

      let userData = witchHunterStorage.getUser(userId);
      if (!userData) {
        userData = { user_id: userId, faction, current_rank: rank, pumpkins: 0, unlocked_supporters: [] };
      }
      userData.unlocked_supporters = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];

      // Kiểm tra xem đã gửi DM cho bậc này chưa (trừ khi force = true)
      const unlockKey = `${faction}:${rank}`;
      if (!force && userData.unlocked_supporters.includes(unlockKey)) {
        return false;
      }

      // Fetch user và gửi DM
      const discordUser = await client.users.fetch(userId, { cache: false }).catch(() => null);
      if (!discordUser) return false;

      const dmEmbed = this.buildSupporterUnlockDM(supporter, isInitialRank1);
      await discordUser.send({ embeds: [dmEmbed] }).catch(() => {
        logger.info(`ℹ️ [WitchHunter] Không thể gửi DM Supporter cho ${userId} (DM bị chặn/đóng).`);
      });

      // Đánh dấu đã nhận
      userData.unlocked_supporters.push(unlockKey);
      witchHunterStorage.saveUser(userData, true);
      logger.info(`🔮 [WitchHunter] Đã gửi DM trao Supporter [${supporter.name}] cho thành viên ${userId}.`);
      return true;
    } catch (err) {
      logger.error(`❌ [WitchHunter] Lỗi ngoại lệ trong notifySupporterUnlock cho ${userId}:`, err);
      return false;
    }
  }

  /**
   * Quét và gửi bù thông báo Supporter Bậc 1 cho tất cả thành viên đã có Role Rank 1 trước đó
   */
  static async syncInitialRank1Supporters(guild) {
    try {
      if (!guild) return { syncedCount: 0 };

      let syncedCount = 0;
      const processedUserIds = new Set();

      const hunterRank1RoleId = WITCH_HUNTER_CONFIG.roles.hunter[1];
      const witchRank1RoleId = WITCH_HUNTER_CONFIG.roles.witch[1];

      // 1. Quét trực tiếp các thành viên đang giữ Role Rank 1 Thợ Săn trên Discord
      if (hunterRank1RoleId) {
        const hunterRole = await guild.roles.fetch(hunterRank1RoleId).catch(() => null);
        if (hunterRole) {
          for (const [memberId, member] of hunterRole.members) {
            if (member.user.bot) continue;
            processedUserIds.add(memberId);
            let userData = witchHunterStorage.getUser(memberId);
            if (!userData) {
              userData = { user_id: memberId, faction: 'hunter', current_rank: 1, pumpkins: 0, unlocked_supporters: [] };
              witchHunterStorage.saveUser(userData);
            }
            const unlockedList = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];
            if (!unlockedList.includes('hunter:1')) {
              const sent = await this.notifySupporterUnlock(guild.client, memberId, 'hunter', 1, true);
              if (sent) syncedCount++;
            }
          }
        }
      }

      // 2. Quét trực tiếp các thành viên đang giữ Role Rank 1 Phù Thủy trên Discord
      if (witchRank1RoleId) {
        const witchRole = await guild.roles.fetch(witchRank1RoleId).catch(() => null);
        if (witchRole) {
          for (const [memberId, member] of witchRole.members) {
            if (member.user.bot) continue;
            processedUserIds.add(memberId);
            let userData = witchHunterStorage.getUser(memberId);
            if (!userData) {
              userData = { user_id: memberId, faction: 'witch', current_rank: 1, pumpkins: 0, unlocked_supporters: [] };
              witchHunterStorage.saveUser(userData);
            }
            const unlockedList = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];
            if (!unlockedList.includes('witch:1')) {
              const sent = await this.notifySupporterUnlock(guild.client, memberId, 'witch', 1, true);
              if (sent) syncedCount++;
            }
          }
        }
      }

      // 3. Quét kiểm tra thêm các thành viên đã lưu trong Database
      const allUsers = witchHunterStorage.getAllUsers();
      for (const u of allUsers) {
        if (!u.faction || processedUserIds.has(u.user_id)) continue;
        const unlockKey = `${u.faction}:1`;
        const unlockedList = Array.isArray(u.unlocked_supporters) ? u.unlocked_supporters : [];
        if (!unlockedList.includes(unlockKey)) {
          const sent = await this.notifySupporterUnlock(guild.client, u.user_id, u.faction, 1, true);
          if (sent) syncedCount++;
        }
      }

      logger.info(`🔮 [WitchHunter] Quét đồng bộ gửi bù Supporter Bậc 1: Hoàn tất cho ${syncedCount} thành viên.`);
      return { syncedCount };
    } catch (err) {
      logger.error('❌ [WitchHunter] Lỗi khi syncInitialRank1Supporters:', err);
      return { syncedCount: 0, error: err.message };
    }
  }

  /**
   * Tạo Embed thông báo điều chỉnh cấp bậc (Giáng cấp) gửi vào Kênh Chỉ Định
   */
  static buildRankDemoteAnnouncementEmbed(userId, faction, oldRank, newRank, oldRankInfo, newRankInfo, totalPumpkins) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitch = faction === 'witch';
    const factionName = isWitch ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const factionBadge = isWitch ? emojis.witchBadge : emojis.hunterBadge;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **ĐIỀU CHỈNH CẤP BẬC MA THUẬT TIÊU CHUẨN** ${emojis.titleRight}`)
      .setDescription(
        `Hội Đồng **Witch Hunter** vừa cập nhật lại thang đo chiến công Bí Ngô tiêu chuẩn mới!\n\n` +
        `• **Thành viên:** <@${userId}>\n` +
        `• **Phe phái:** ${factionBadge} **${factionName}**\n` +
        `• **Tổng Bí Ngô hiện có:** **${totalPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
        `• **Cấp bậc điều chỉnh:** **${oldRankInfo?.name || `Bậc ${oldRank}`}** ➔ **${newRankInfo?.name || `Bậc ${newRank}`}**\n\n` +
        `*Role cấp bậc trên máy chủ và trang bị tương ứng đã được tự động đồng bộ lại!*`
      )
      .setFooter({ text: 'Witch Hunter Ranking System • Đồng Bộ Cấp Bậc' })
      .setTimestamp();
  }

  /**
   * Tạo Embed gửi tin nhắn riêng (DM) cho người chơi khi bị điều chỉnh cấp bậc theo mốc mới
   */
  static buildRankDemoteAdjustmentDM(user, faction, oldRank, newRank, oldRankInfo, newRankInfo, totalPumpkins) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitch = faction === 'witch';
    const factionName = isWitch ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
    const factionBadge = isWitch ? emojis.witchBadge : emojis.hunterBadge;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **THÔNG BÁO: CẬP NHẬT CẤP BẬC TIÊU CHUẨN** ${emojis.titleRight}`)
      .setDescription(
        `Chào **${user.username}** thân mến! Em bot Usagi múp rụp gửi thông báo cập nhật tới bạn nè! <a:heartg1:1545307544808071258>\n\n` +
        `Hệ thống Witch Hunter vừa cập nhật lại biểu mốc Bí Ngô yêu cầu cho các cấp bậc:\n` +
        `> **Bậc C:** 0 Bí Ngô\n` +
        `> **Bậc B:** 500 Bí Ngô\n` +
        `> **Bậc A:** 3.000 Bí Ngô\n` +
        `> **Bậc S:** 10.000 Bí Ngô\n` +
        `> **Bậc SS:** 20.000 Bí Ngô\n\n` +
        `Với số lượng **${totalPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin} hiện có của bạn:\n` +
        `• Cấp bậc điều chỉnh: **${oldRankInfo?.name || `Bậc ${oldRank}`}** ➔ **${newRankInfo?.name || `Bậc ${newRank}`}** (${factionBadge} ${factionName})\n` +
        `• Role tương ứng trên máy chủ đã được tự động cập nhật lại.\n\n` +
        `*Hãy tiếp tục tham gia viễn chinh và giao tranh để sớm đột phá lên các cảnh giới cao hơn nhé!*`
      )
      .setFooter({ text: 'Witch Hunter Ranking System • Tin nhắn tự động' })
      .setTimestamp();
  }

  /**
   * Quét và điều chỉnh toàn bộ Rank & Role của người chơi cũ theo mốc điểm Bí Ngô mới:
   * C: 0, B: 500, A: 3.000, S: 10.000, SS: 20.000
   * Tự động gỡ role sai, cấp role đúng, và bắn thông báo tăng/giáng cấp.
   */
  static async reconcileAllMemberRanks(guild) {
    if (!guild) return { updatedCount: 0, demotedCount: 0, promotedCount: 0, roleFixedCount: 0 };

    logger.info(`🔄 [WitchHunter] Bắt đầu rà soát và điều chỉnh Rank/Role theo mốc Bí Ngô mới cho guild ${guild.name}...`);
    const allUsers = witchHunterStorage.getAllUsers();
    let updatedCount = 0;
    let demotedCount = 0;
    let promotedCount = 0;
    let roleFixedCount = 0;

    const announcementChannelId = WITCH_HUNTER_CONFIG.channels.announcementChannelId;
    const announceChannel = guild.channels?.cache?.get(announcementChannelId) ||
      await guild.channels?.fetch?.(announcementChannelId).catch(() => null);

    const allWitchHunterRoleIds = getAllWitchHunterRoleIds();

    for (const user of allUsers) {
      if (!user.faction) continue;

      const userId = user.user_id;
      const pumpkins = Number(user.pumpkins) || 0;
      const oldRank = Number(user.current_rank) || 1;
      const expectedRank = this.calculateRank(pumpkins);

      const oldRankInfo = this.getRankInfo(user.faction, oldRank);
      const newRankInfo = this.getRankInfo(user.faction, expectedRank);

      let member = guild.members.cache.get(userId);
      if (!member) {
        member = await guild.members.fetch(userId).catch(() => null);
      }

      if (expectedRank !== oldRank) {
        updatedCount++;
        user.current_rank = expectedRank;

        if (expectedRank < oldRank) {
          // GIÁNG CẤP
          demotedCount++;

          // Lọc lại unlocked_supporters không vượt quá bậc mới
          if (Array.isArray(user.unlocked_supporters)) {
            user.unlocked_supporters = user.unlocked_supporters.filter((key) => {
              const parts = key.split(':');
              const r = Number(parts[1]);
              return isNaN(r) || r <= expectedRank;
            });
          }

          // Giáng Supporter & Vũ Khí: nếu trang bị hiện tại vượt quá cấp bậc mới thì hạ về mặc định theo bậc mới
          const maxAllowedTier = Math.min(5, expectedRank + 1);
          if (user.equipped_supporter) {
            const equippedSupp = getSupporterById(user.equipped_supporter);
            if (
              !equippedSupp ||
              (!equippedSupp.isSummon && Number(equippedSupp.rank) > expectedRank) ||
              (equippedSupp.isSummon && this.rankToTier(equippedSupp.rank) > maxAllowedTier)
            ) {
              user.equipped_supporter = null; // Tự động hạ về supporter mặc định của rank mới
            }
          }
          if (user.equipped_weapon) {
            const equippedWep = getWeaponById(user.equipped_weapon);
            if (
              !equippedWep ||
              (!equippedWep.isSummon && Number(equippedWep.rank) > expectedRank) ||
              (equippedWep.isSummon && this.rankToTier(equippedWep.rank) > maxAllowedTier)
            ) {
              user.equipped_weapon = null; // Tự động hạ về vũ khí mặc định của rank mới
            }
          }

          // Cập nhật role Discord
          if (member) {
            await this.syncRankRole(guild, member, expectedRank, user.faction);
          }

          witchHunterStorage.saveUser(user, true);

          // Gửi thông báo kênh chung
          if (announceChannel && announceChannel.isTextBased()) {
            const demoteEmbed = this.buildRankDemoteAnnouncementEmbed(
              userId,
              user.faction,
              oldRank,
              expectedRank,
              oldRankInfo,
              newRankInfo,
              pumpkins
            );
            await announceChannel.send({ content: `<@${userId}>`, embeds: [demoteEmbed] }).catch(() => null);
          }

          // Gửi DM cho user
          try {
            const userObj = member?.user || (guild.client ? await guild.client.users.fetch(userId).catch(() => null) : null);
            if (userObj) {
              const dmEmbed = this.buildRankDemoteAdjustmentDM(
                userObj,
                user.faction,
                oldRank,
                expectedRank,
                oldRankInfo,
                newRankInfo,
                pumpkins
              );
              await userObj.send({ embeds: [dmEmbed] }).catch(() => null);
            }
          } catch {}
        } else if (expectedRank > oldRank) {
          // THĂNG CẤP
          promotedCount++;
          if (member) {
            await this.syncRankRole(guild, member, expectedRank, user.faction);
          }

          // Thăng Supporter & Vũ Khí: nếu đang mang Supporter / Vũ Khí mặc định của bậc cũ thì tự động nâng lên bậc mới
          const oldDefaultSupporter = getSupporterByRank(user.faction, oldRank);
          const oldDefaultWeapon = getWeaponByRank(user.faction, oldRank);
          if (user.equipped_supporter === oldDefaultSupporter?.id) {
            user.equipped_supporter = null; // Tự động nhận supporter mặc định của rank mới
          }
          if (user.equipped_weapon === oldDefaultWeapon?.id) {
            user.equipped_weapon = null; // Tự động nhận vũ khí mặc định của rank mới
          }

          witchHunterStorage.saveUser(user, true);

          // Thông báo thăng cấp vào Kênh Chỉ Định
          const quote = this.getRankUpQuote(userId, user.faction, expectedRank, newRankInfo.name);
          if (announceChannel && announceChannel.isTextBased()) {
            const rankUpEmbed = this.buildRankUpAnnouncementEmbed(
              userId,
              user.faction,
              oldRank,
              expectedRank,
              newRankInfo,
              quote,
              pumpkins
            );
            await announceChannel.send({ content: `<@${userId}>`, embeds: [rankUpEmbed] }).catch(() => null);
          }

          if (guild.client) {
            await this.notifySupporterUnlock(guild.client, userId, user.faction, expectedRank, false);
          }
        }
      } else {
        // Cấp bậc trong DB đã đúng, nhưng rà soát lại Supporter / Vũ Khí xem có bị lưu lệch bậc tiến trình không
        let needsSave = false;
        const maxAllowedTier = Math.min(5, expectedRank + 1);
        if (user.equipped_supporter) {
          const equippedSupp = getSupporterById(user.equipped_supporter);
          if (
            !equippedSupp ||
            (!equippedSupp.isSummon && Number(equippedSupp.rank) > expectedRank) ||
            (equippedSupp.isSummon && this.rankToTier(equippedSupp.rank) > maxAllowedTier)
          ) {
            user.equipped_supporter = null;
            needsSave = true;
          }
        }
        if (user.equipped_weapon) {
          const equippedWep = getWeaponById(user.equipped_weapon);
          if (
            !equippedWep ||
            (!equippedWep.isSummon && Number(equippedWep.rank) > expectedRank) ||
            (equippedWep.isSummon && this.rankToTier(equippedWep.rank) > maxAllowedTier)
          ) {
            user.equipped_weapon = null;
            needsSave = true;
          }
        }
        if (needsSave) {
          witchHunterStorage.saveUser(user, true);
        }

        // Rà soát lại role Discord xem có đang lệch không
        if (member) {
          const targetRoleId = WITCH_HUNTER_CONFIG.roles[user.faction]?.[expectedRank];
          const hasTargetRole = targetRoleId && member.roles.cache.has(targetRoleId);
          const hasOtherRole = [...allWitchHunterRoleIds].some(
            (rId) => rId !== targetRoleId && member.roles.cache.has(rId)
          );

          if (!hasTargetRole || hasOtherRole) {
            await this.syncRankRole(guild, member, expectedRank, user.faction);
            roleFixedCount++;
          }
        }
      }
    }

    logger.info(
      `✅ [WitchHunter] Hoàn tất điều chỉnh cấp bậc: ${updatedCount} đổi rank (${demotedCount} giáng, ${promotedCount} thăng), ${roleFixedCount} sửa role lệch.`
    );

    return { updatedCount, demotedCount, promotedCount, roleFixedCount };
  }

  /**
   * Tạo ActionRow chứa StringSelectMenu tra cứu danh sách Supporter (chia theo Phe để tránh chạm giới hạn 25 options)
   * @param {string} authorId ID của người dùng gõ lệnh
   * @param {string|null} currentSelectedId ID của supporter đang được chọn (để set default)
   * @param {'hunter' | 'witch'} currentFaction Phe đang hiển thị
   */
  static createSupporterSelectRow(authorId, currentSelectedId = null, currentFaction = 'hunter') {
    const { supporters } = WITCH_HUNTER_CONFIG;

    const parseEmoji = (emojiStr) => {
      if (!emojiStr) return undefined;
      if (typeof emojiStr === 'string' && !emojiStr.startsWith('<')) {
        return { name: emojiStr };
      }
      const match = String(emojiStr).match(/<(?<animated>a)?:(?<name>[a-zA-Z0-9_]+):(?<id>\d+)>/);
      if (match && match.groups) {
        return {
          id: match.groups.id,
          name: match.groups.name,
          animated: Boolean(match.groups.animated),
        };
      }
      return undefined;
    };

    const factionSupporters = supporters.list.filter((s) => s.faction === currentFaction);
    const otherFaction = currentFaction === 'hunter' ? 'witch' : 'hunter';
    const otherFactionName = currentFaction === 'hunter' ? 'Hội Phù Thủy' : 'Hiệp Hội Thợ Săn';
    const otherFactionEmoji = currentFaction === 'hunter'
      ? WITCH_HUNTER_CONFIG.emojis.witchButton
      : WITCH_HUNTER_CONFIG.emojis.hunterButton;

    const options = [
      {
        label: '[Tổng Quan] 3 Đại Hệ Supporter',
        description: 'Bản chất 3 Đại Hệ: Nguyền Thể, Cấm Khí, Linh Tộc',
        value: 'overview',
        default: currentSelectedId === 'overview',
        emoji: parseEmoji(WITCH_HUNTER_CONFIG.emojis.decor18 || '<a:trangtrig18:1546068102817775626>'),
      },
      ...factionSupporters.map((s) => {
        const cat = supporters.categories[s.categoryKey];
        const prefix = s.isBlackMarket ? `[${s.rank}-Rank Chợ Đen]` : s.isSummon ? `[${s.rank}-Rank Banner]` : `[Bậc ${s.rank}]`;
        return {
          label: `${prefix} ${s.name}`.slice(0, 100),
          description: `${s.rankName} • ${cat?.shortName || ''}`.slice(0, 100),
          value: s.id,
          default: currentSelectedId === s.id,
          emoji: parseEmoji(cat?.emoji),
        };
      }),
      {
        label: `[Xem Phe] ${otherFactionName}`.slice(0, 100),
        description: `Chuyển sang xem danh sách Supporter của ${otherFactionName}`.slice(0, 100),
        value: `switch_faction_${otherFaction}`,
        emoji: parseEmoji(otherFactionEmoji),
      },
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`supporter_select:${authorId}:${currentFaction}`)
      .setPlaceholder(`🔮 Chọn Supporter (${currentFaction === 'hunter' ? 'Thợ Săn' : 'Phù Thủy'}) để tra cứu...`)
      .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
  }

  /**
   * Tạo Embed trang tổng quan danh sách Thần Binh Vũ Khí thế giới Witch Hunter
   */
  static buildWeaponOverviewEmbed() {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu Tím Pastel #D8B4F8
      .setTitle(`${emojis.titleLeft} **WITCH HUNTER: KHO VŨ KHÍ MA THUẬT** ${emojis.titleRight}`)
      .setDescription(
        `Trong thế giới **Witch Hunter**, mỗi Thợ Săn hay Phù Thủy khi đột phá từng cảnh giới ma lực sẽ được trang bị một Thần Binh Vũ Khí độc quyền, liên kết cộng hưởng trực tiếp cùng Supporter khế ước để giải phóng sức mạnh tối thượng.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${emojis.hunterBadge || '<a:trangtrig36:1563065680922808340>'} **VŨ KHÍ THỢ SĂN (TIẾN TRÌNH & BANNER):**\n` +
        `• **Vũ khí tiến trình Bậc 1-5:** Silver Fang Dagger ➔ Clockwork Saw-Blade ➔ Aegis Heavy Tower ➔ Dimension Breaker ➔ Chrono-Crossbow\n` +
        `• **Vũ khí Triệu Hồi (A/S/SS):** Frostbite Fangs, Chain of Penance, Spike Cage Shield, Thunder Pearl Rapier, Executioner’s Guise, Singularity Staff, Judgement Cannon, Absolute Singularity Lance\n\n` +
        `${emojis.witchBadge || '<a:trangtrig32:1546906170994856026>'} **VŨ KHÍ PHÙ THỦY (TIẾN TRÌNH & BANNER):**\n` +
        `• **Vũ khí tiến trình Bậc 1-5:** Soul-Stitch Needle ➔ Raven Glass Blade ➔ Kitsune Fox-Lantern ➔ Cinder Cane ➔ Soul-Harvest Scythe\n` +
        `• **Vũ khí Triệu Hồi (A/S/SS):** Gale Plume Whip, Slumber Mist Censer, Blight Pestle, Petrification Gaze Flute, Screaming Veil, Infinity Mirror, Genesis Blood Chalice, Calamity Dragon Horn\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '<a:heartg1:1545307544808071258>'} Hãy chọn một Vũ Khí trong danh sách bên dưới để tra cứu chi tiết thuộc tính năng lượng và cụ thể sức mạnh nha lữ khách!`
      )
      .setFooter({ text: 'Witch Hunter System' });
  }

  /**
   * Tạo Embed chi tiết từng Thần Binh Vũ Khí khi chọn từ menu
   */
  static buildWeaponDetailEmbed(weapon) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitch = weapon.faction === 'witch';
    const factionBadge = isWitch ? emojis.witchBadge : emojis.hunterBadge;

    const milestoneText = weapon.isSummon
      ? (weapon.activationMilestone || 'Bể Triệu Hồi Huyết Nguyệt')
      : weapon.rank === 1
      ? `0 ${emojis.pumpkin} (Khởi đầu)`
      : weapon.rank === 5
      ? `10.000 ${emojis.pumpkin} (Tối thượng)`
      : `${weapon.minPumpkins?.toLocaleString('vi-VN') || 0} ${emojis.pumpkin}`;

    const summonNotice = weapon.isBlackMarket
      ? `\n\n<a:trangtrig46:1547240249761996812> **VẬT PHẨM ĐỘC QUYỀN CHỢ ĐEN:**\n> *Đây là Khí Tài Cấm Thuật độc quyền từ Chợ Đen Hư Không, dùng Mảnh Vỡ Ký Ức để trao đổi!*`
      : weapon.isSummon
      ? `\n\n<a:trangtrig41:1547238037832863744> **THÔNG BÁO TRIỆU HỒI KHẾ ƯỚC:**\n> *Đây là Vũ Khí từ bể triệu gọi khế ước, hãy summon ngay để sở hữu!*`
      : '';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu Tím Pastel #D8B4F8
      .setTitle(`${emojis.titleLeft} **VŨ KHÍ MA THUẬT: ${weapon.name.toUpperCase()}** ${emojis.titleRight}`)
      .setDescription(
        `${factionBadge} **${weapon.factionName}** • ${emojis.decor15 || '<a:trangtrig15:1546047955696488489>'} **${weapon.rankName}**\n` +
        `${emojis.pumpkin} **Mốc kích hoạt:** **${milestoneText}**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:trangtrig18:1546068102817775626> **TÊN VŨ KHÍ:** **${weapon.name}**\n\n` +
        `<a:trangtrig38:1547237720332439574> **LIÊN KẾT SUPPORTER:**\n` +
        `${weapon.supporterLink}\n\n` +
        `${weapon.energyEmoji} **THUỘC TÍNH NĂNG LƯỢNG:**\n` +
        `${weapon.energyAttribute}\n\n` +
        `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **CỤ THỂ SỨC MẠNH:**\n` +
        `${weapon.powerDetail}` +
        summonNotice +
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '<a:heartg1:1545307544808071258>'} Hãy chọn Vũ Khí khác từ menu bên dưới để tiếp tục tra cứu sức mạnh nha lữ khách!`
      )
      .setFooter({ text: 'Witch Hunter System' });
  }

  /**
   * Tạo ActionRow Select Menu cho giao diện Vũ Khí (chia theo Phe để tránh chạm giới hạn 25 options)
   * @param {string} authorId ID của người dùng gõ lệnh
   * @param {string|null} currentSelectedId ID của vũ khí đang được chọn (để set default)
   * @param {'hunter' | 'witch'} currentFaction Phe đang hiển thị
   */
  static createWeaponSelectRow(authorId, currentSelectedId = null, currentFaction = 'hunter') {
    const { weapons } = WITCH_HUNTER_CONFIG;

    const parseEmoji = (emojiStr) => {
      if (!emojiStr) return undefined;
      if (typeof emojiStr === 'string' && !emojiStr.startsWith('<')) {
        return { name: emojiStr };
      }
      const match = String(emojiStr).match(/<(?<animated>a)?:(?<name>[a-zA-Z0-9_]+):(?<id>\d+)>/);
      if (match && match.groups) {
        return {
          id: match.groups.id,
          name: match.groups.name,
          animated: Boolean(match.groups.animated),
        };
      }
      return undefined;
    };

    const factionWeapons = weapons.list.filter((w) => w.faction === currentFaction);
    const otherFaction = currentFaction === 'hunter' ? 'witch' : 'hunter';
    const otherFactionName = currentFaction === 'hunter' ? 'Hội Phù Thủy' : 'Hiệp Hội Thợ Săn';
    const otherFactionEmoji = currentFaction === 'hunter'
      ? WITCH_HUNTER_CONFIG.emojis.witchButton
      : WITCH_HUNTER_CONFIG.emojis.hunterButton;

    const options = [
      {
        label: '[Tổng Quan] Kho Thần Binh Vũ Khí',
        description: 'Kho vũ khí tối thượng của Hiệp Hội Thợ Săn & Hội Phù Thủy',
        value: 'overview',
        default: currentSelectedId === 'overview',
        emoji: parseEmoji(WITCH_HUNTER_CONFIG.emojis.decor18 || '<a:trangtrig18:1546068102817775626>'),
      },
      ...factionWeapons.map((w) => {
        const prefix = w.isBlackMarket ? `[${w.rank}-Rank Chợ Đen]` : w.isSummon ? `[${w.rank}-Rank Banner]` : `[Bậc ${w.rank}]`;
        return {
          label: `${prefix} ${w.shortName}`.slice(0, 100),
          description: `${w.rankName} • ${w.activationMilestone || ''}`.slice(0, 100),
          value: w.id,
          default: currentSelectedId === w.id,
          emoji: parseEmoji(w.energyEmoji),
        };
      }),
      {
        label: `[Xem Phe] ${otherFactionName}`.slice(0, 100),
        description: `Chuyển sang xem kho Vũ Khí của ${otherFactionName}`.slice(0, 100),
        value: `switch_faction_${otherFaction}`,
        emoji: parseEmoji(otherFactionEmoji),
      },
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`weapon_select:${authorId}:${currentFaction}`)
      .setPlaceholder(`⚔️ Chọn Vũ Khí (${currentFaction === 'hunter' ? 'Thợ Săn' : 'Phù Thủy'}) để tra cứu...`)
      .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
  }

  /**
   * Tính toán định danh phiên đợt mở cuối tuần (Thứ 7 & Chủ Nhật)
   * Cả 2 ngày Thứ 7 và Chủ Nhật cùng quy về 1 key duy nhất dựa vào ngày Thứ Bảy
   * @param {Date} date
   * @returns {string|null} Trả về weekend_YYYY_MM_DD hoặc null nếu không phải cuối tuần
   */
  static getWeekendSessionKey(date = new Date()) {
    const vnDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // 'YYYY-MM-DD'
    const [year, month, day] = vnDateStr.split('-').map(Number);
    const vnDate = new Date(year, month - 1, day);
    const dayOfWeek = vnDate.getDay(); // 0: Chủ Nhật, 6: Thứ Bảy

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      return null;
    }

    const saturday = new Date(vnDate);
    if (dayOfWeek === 0) {
      saturday.setDate(saturday.getDate() - 1);
    }

    const y = saturday.getFullYear();
    const m = String(saturday.getMonth() + 1).padStart(2, '0');
    const d = String(saturday.getDate()).padStart(2, '0');
    return `weekend_${y}_${m}_${d}`;
  }

  /**
   * Kiểm tra xem hôm nay có đang trong thời gian mở Giải Mã Cổ Ngữ không (Thứ 7 & CN)
   */
  static isWeekendPuzzleOpen(date = new Date()) {
    return this.getWeekendSessionKey(date) !== null;
  }

  /**
   * Kiểm tra người dùng đã hoàn thành lượt giải mã trong tuần/đợt hiện tại chưa
   * @param {string} userId
   * @param {string} weekendKey
   */
  static async hasUserCompletedPuzzle(userId, weekendKey) {
    if (!weekendKey) return false;
    const user = witchHunterStorage.getUser(userId);
    if (user?.last_puzzle_session === weekendKey) {
      return true;
    }
    try {
      const { getFromDb } = await import('../utils/database.js');
      const pgRecord = await getFromDb(`temp:witch_hunter:puzzle_completed:${weekendKey}:${userId}`);
      if (pgRecord) return true;
    } catch {}
    return false;
  }

  /**
   * Ghi nhận người dùng đã tham gia/hoàn thành Giải Mã Cổ Ngữ trong đợt tuần
   */
  static async markUserPuzzleCompleted(userId, weekendKey) {
    if (!userId || !weekendKey) return;
    let user = witchHunterStorage.getUser(userId);
    if (!user) {
      user = { user_id: userId, faction: null, current_rank: 1, pumpkins: 0, unlocked_supporters: [] };
    }
    user.last_puzzle_session = weekendKey;
    user.updated_at = Date.now();
    witchHunterStorage.saveUser(user, true);

    try {
      const { setInDb } = await import('../utils/database.js');
      await setInDb(`temp:witch_hunter:puzzle_completed:${weekendKey}:${userId}`, {
        userId,
        weekendKey,
        completedAt: Date.now(),
      });
    } catch {}
  }

  /**
   * Tạo Embed giới thiệu bảng Giải Mã Cổ Ngữ
   */
  static buildQuickPuzzleIntroEmbed() {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **GIẢI MÃ CỔ NGỮ — QUICK PUZZLE** ${emojis.titleRight}`)
      .setDescription(
        `Nghi thức khảo nghiệm trí tuệ ma thuật cổ xưa dành cho toàn thể **Thợ Săn** và **Phù Thủy**!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📜 **QUY TẮC THAM GIA:**\n` +
        `• ⏰ **Thời gian mở:** Chỉ diễn ra vào **Thứ 7 & Chủ Nhật** hàng tuần.\n` +
        `• 🔒 **Giới hạn tham gia:** Mỗi thành viên **CHỈ ĐƯỢC THAM GIA DUY NHẤT 1 LẦN** trong suốt cả 2 ngày cuối tuần.\n` +
        `• 🧩 **Nội dung:** Khảo nghiệm các câu hỏi cổ ngữ xoay quanh cốt truyện, vũ khí thần binh, supporter và sự kiện server.\n` +
        `• ${emojis.pumpkin || '🎃'} **Phần thưởng:** Nhận điểm Bí Ngô tích lũy để thăng cấp danh vị ma thuật tối cao!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '💕'} Nhấn nút **Bắt Đầu Giải Mã** bên dưới để bước vào nghi thức!`
      )
      .setFooter({ text: 'Witch Hunter System • Giải Mã Cổ Ngữ' })
      .setTimestamp();
  }

  /**
   * Tạo ActionRow nút bấm bắt đầu Giải Mã Cổ Ngữ
   */
  static createQuickPuzzleStartRow() {
    const startButton = new ButtonBuilder()
      .setCustomId('witch_hunter_puzzle_start')
      .setLabel('Bắt Đầu Giải Mã')
      .setStyle(ButtonStyle.Primary)
    return new ActionRowBuilder().addComponents(startButton);
  }

  /**
   * Chuyển đổi Rank (1-5 hoặc C, B, A, S, SS) sang Tier số (1-5)
   */
  static rankToTier(rank) {
    if (typeof rank === 'number') return rank;
    const r = String(rank || '').trim().toUpperCase();
    if (r === 'C' || r === '1') return 1;
    if (r === 'B' || r === '2') return 2;
    if (r === 'A' || r === '3') return 3;
    if (r === 'S' || r === '4') return 4;
    if (r === 'SS' || r === '5') return 5;
    return 1;
  }

  /**
   * Chuyển đổi Tier số (1-5) sang ký tự Rank (C, B, A, S, SS)
   */
  static tierToLetter(tier) {
    switch (Number(tier)) {
      case 1: return 'C';
      case 2: return 'B';
      case 3: return 'A';
      case 4: return 'S';
      case 5: return 'SS';
      default: return 'C';
    }
  }

  /**
   * Định dạng Rank hiển thị chuẩn hóa thành ký tự chữ (C, B, A, S, SS)
   */
  static formatRankLetter(rank) {
    const tier = this.rankToTier(rank);
    return this.tierToLetter(tier);
  }

  /**
   * Kiểm tra xem Supporter và Thần Binh Vũ Khí đang kích hoạt có Cộng Hưởng Đồng Bộ Khế Ước không.
   * Cung cấp lời khuyên chi tiết từ Em Phù Thủy Usagi khi chưa đồng bộ.
   */
  static checkResonance(userId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) {
      return {
        hasFaction: false,
        isResonance: false,
        message: 'Lữ khách chưa ký khế ước gia nhập phe!',
      };
    }

    const equippedSupp = this.getEquippedSupporter(userId);
    const equippedWep = this.getEquippedWeapon(userId);

    if (!equippedSupp || !equippedWep) {
      return {
        hasFaction: true,
        isResonance: false,
        equippedSupporter: equippedSupp,
        equippedWeapon: equippedWep,
        suggestion: 'Lữ khách hãy trang bị đầy đủ cả Supporter và Thần Binh Vũ Khí để kích hoạt sức mạnh cộng hưởng nha!',
      };
    }

    const matchedWepId = WITCH_HUNTER_RESONANCE_MAP[equippedSupp.id];
    const matchedSuppId = WITCH_HUNTER_WEAPON_TO_SUPPORTER_MAP[equippedWep.id];
    const isResonance = Boolean(matchedWepId && matchedWepId === equippedWep.id);

    // Đồng bộ thuộc tính vào userData
    if (userData.is_resonance !== (isResonance ? 1 : 0)) {
      userData.is_resonance = isResonance ? 1 : 0;
      witchHunterStorage.saveUser(userData, true);
    }

    if (isResonance) {
      return {
        hasFaction: true,
        isResonance: true,
        equippedSupporter: equippedSupp,
        equippedWeapon: equippedWep,
        matchedWeapon: equippedWep,
        matchedSupporter: equippedSupp,
        bonusDesc: 'Tăng **x1.5 Bạo Kích Sát Thương** & kích hoạt 100% Thuộc Tính Thần Binh khi giao tranh!',
      };
    }

    // Nếu không đồng bộ -> Tìm vật phẩm gợi ý từ kho đồ hoặc hệ thống
    const matchedWep = matchedWepId ? getWeaponById(matchedWepId) : null;
    const matchedSupp = matchedSuppId ? getSupporterById(matchedSuppId) : null;

    const ownedSupporters = this.getOwnedSupporters(userId);
    const ownedWeapons = this.getOwnedWeapons(userId);

    const hasMatchedWep = Boolean(matchedWep && ownedWeapons.some((w) => w.id === matchedWep.id));
    const hasMatchedSupp = Boolean(matchedSupp && ownedSupporters.some((s) => s.id === matchedSupp.id));

    let suggestion = '';
    const suppRankLetter = this.formatRankLetter(equippedSupp.rank);
    const wepRankLetter = this.formatRankLetter(equippedWep.rank);

    if (hasMatchedWep && matchedWep) {
      suggestion = `Lữ khách đã sở hữu Thần Binh **${matchedWep.shortName || matchedWep.name}** [${this.formatRankLetter(matchedWep.rank)}-Rank] trong kho! Hãy đổi sang vũ khí này để đồng bộ với Supporter **${equippedSupp.name}** [${suppRankLetter}-Rank], kích hoạt tăng **x1.5 Bạo Kích Sát Thương** nha! <a:heartg4:1546068063500369940>`;
    } else if (hasMatchedSupp && matchedSupp) {
      suggestion = `Lữ khách đã sở hữu Supporter **${matchedSupp.name}** [${this.formatRankLetter(matchedSupp.rank)}-Rank] trong kho! Hãy đổi sang Supporter này để đồng bộ với Thần Binh **${equippedWep.shortName || equippedWep.name}** [${wepRankLetter}-Rank], kích hoạt tăng **x1.5 Bạo Kích Sát Thương** nha! <a:heartg4:1546068063500369940>`;
    } else if (matchedWep && matchedSupp) {
      suggestion = `Nên đổi sang Thần Binh **${matchedWep.shortName || matchedWep.name}** [${this.formatRankLetter(matchedWep.rank)}-Rank] (phù hợp với Supporter **${equippedSupp.name}**) hoặc đổi sang Supporter **${matchedSupp.name}** [${this.formatRankLetter(matchedSupp.rank)}-Rank] (phù hợp với Thần Binh **${equippedWep.shortName || equippedWep.name}**) để kích hoạt tăng **x1.5 Bạo Kích Sát Thương** nha! <a:heartg4:1546068063500369940>`;
    } else if (matchedWep) {
      suggestion = `Nên trang bị Thần Binh **${matchedWep.shortName || matchedWep.name}** [${this.formatRankLetter(matchedWep.rank)}-Rank] để đồng bộ khế ước cùng Supporter **${equippedSupp.name}**, tăng **x1.5 Bạo Kích Sát Thương** nha! <a:heartg4:1546068063500369940>`;
    } else {
      suggestion = `Hãy chọn cặp Supporter và Thần Binh Vũ Khí cùng hệ đồng bộ bậc [${suppRankLetter}-Rank] để kích hoạt **x1.5 Bạo Kích Sát Thương** nha! <a:heartg4:1546068063500369940>`;
    }

    return {
      hasFaction: true,
      isResonance: false,
      equippedSupporter: equippedSupp,
      equippedWeapon: equippedWep,
      matchedWeapon: matchedWep,
      matchedSupporter: matchedSupp,
      suggestion,
    };
  }

  /**
   * Lấy danh sách Supporter đã sở hữu của một thành viên
   */
  static getOwnedSupporters(userId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) return [];

    const faction = userData.faction;
    const currentRank = userData.current_rank || 1;
    const unlockedKeys = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];

    // 1. Tiến trình: Bậc 1 đến currentRank hoặc có trong unlocked_supporters
    const progressionSupporters = WITCH_HUNTER_CONFIG.supporters.list.filter((s) => {
      if (s.isSummon || s.isBlackMarket || s.faction !== faction) return false;
      const r = Number(s.rank);
      return r <= currentRank || unlockedKeys.includes(`${faction}:${r}`) || unlockedKeys.includes(s.id);
    });

    // 2. Summoned / Black Market supporters từ kho đồ hoặc unlocked_supporters
    let invIds = new Set();
    try {
      const invItems = witchHunterSummonStorage.getUserInventory(userId).filter((i) => i.item_type === 'supporter');
      invIds = new Set(invItems.map((i) => i.item_id));
    } catch {}

    const specialSupporters = WITCH_HUNTER_CONFIG.supporters.list.filter((s) => {
      if ((!s.isSummon && !s.isBlackMarket) || s.faction !== faction) return false;
      return invIds.has(s.id) || unlockedKeys.includes(s.id);
    });

    const map = new Map();
    [...progressionSupporters, ...specialSupporters].forEach((s) => {
      if (!map.has(s.id)) map.set(s.id, s);
    });

    return Array.from(map.values());
  }

  /**
   * Lấy danh sách Thần Binh Vũ Khí đã sở hữu của một thành viên
   */
  static getOwnedWeapons(userId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) return [];

    const faction = userData.faction;
    const currentRank = userData.current_rank || 1;
    const unlockedWeapons = Array.isArray(userData.unlocked_weapons) ? userData.unlocked_weapons : [];

    // 1. Tiến trình: Bậc 1 đến currentRank
    const progressionWeapons = WITCH_HUNTER_CONFIG.weapons.list.filter((w) => {
      if (w.isSummon || w.isBlackMarket || w.faction !== faction) return false;
      return Number(w.rank) <= currentRank;
    });

    // 2. Summoned / Black Market weapons từ kho đồ hoặc unlocked_weapons
    let invIds = new Set();
    try {
      const invItems = witchHunterSummonStorage.getUserInventory(userId).filter((i) => i.item_type === 'weapon');
      invIds = new Set(invItems.map((i) => i.item_id));
    } catch {}

    const specialWeapons = WITCH_HUNTER_CONFIG.weapons.list.filter((w) => {
      if ((!w.isSummon && !w.isBlackMarket) || w.faction !== faction) return false;
      return invIds.has(w.id) || unlockedWeapons.includes(w.id);
    });

    const map = new Map();
    [...progressionWeapons, ...specialWeapons].forEach((w) => {
      if (!map.has(w.id)) map.set(w.id, w);
    });

    return Array.from(map.values());
  }

  /**
   * Lấy Supporter đang kích hoạt của thành viên (có kiểm tra giới hạn cấp bậc)
   */
  static getEquippedSupporter(userId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) return null;

    const currentRank = userData.current_rank || 1;
    const maxAllowedTier = Math.min(5, currentRank + 1);

    if (userData.equipped_supporter) {
      const s = getSupporterById(userData.equipped_supporter);
      if (s && s.faction === userData.faction) {
        const tier = this.rankToTier(s.rank);
        if (s.isBlackMarket || tier <= maxAllowedTier) {
          return s;
        }
      }
    }

    return getSupporterByRank(userData.faction, currentRank) || null;
  }

  /**
   * Lấy Thần Binh Vũ Khí đang kích hoạt của thành viên (có kiểm tra giới hạn cấp bậc)
   */
  static getEquippedWeapon(userId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) return null;

    const currentRank = userData.current_rank || 1;
    const maxAllowedTier = Math.min(5, currentRank + 1);

    if (userData.equipped_weapon) {
      const w = getWeaponById(userData.equipped_weapon);
      if (w && w.faction === userData.faction) {
        const tier = this.rankToTier(w.rank);
        if (w.isBlackMarket || tier <= maxAllowedTier) {
          return w;
        }
      }
    }

    return getWeaponByRank(userData.faction, currentRank) || null;
  }

  /**
   * Tính toán hồi phục sinh lực tự nhiên cho tất cả Supporter của user (+10% HP / 1 giờ)
   */
  static updateNaturalRegen(userData) {
    if (!userData) return;
    if (!userData.supporter_hp || typeof userData.supporter_hp !== 'object') {
      userData.supporter_hp = {};
    }
    const now = Date.now();
    if (!userData.last_hp_update) {
      userData.last_hp_update = now;
      return;
    }
    const elapsedMs = now - userData.last_hp_update;
    const hoursPassed = Math.floor(elapsedMs / (60 * 60 * 1000));
    if (hoursPassed > 0) {
      const hpGain = hoursPassed * 10;
      let hasChanges = false;
      for (const [sId, hp] of Object.entries(userData.supporter_hp)) {
        if (hp < 100) {
          userData.supporter_hp[sId] = Math.min(100, (Number(hp) || 0) + hpGain);
          hasChanges = true;
        }
      }
      userData.last_hp_update = userData.last_hp_update + (hoursPassed * 3600000);
      if (hasChanges) {
        witchHunterStorage.saveUser(userData);
      }
    }
  }

  /**
   * Lấy lượng máu hiện tại của Supporter (0 - 100%, mặc định 100% nếu chưa từng bị trừ)
   */
  static getSupporterHp(userId, supporterId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData) return 100;
    this.updateNaturalRegen(userData);
    if (userData.supporter_hp && userData.supporter_hp[supporterId] !== undefined) {
      return Math.min(100, Math.max(0, Number(userData.supporter_hp[supporterId])));
    }
    return 100;
  }

  /**
   * Cập nhật lượng máu của Supporter
   */
  static setSupporterHp(userId, supporterId, hp) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData) return;
    this.updateNaturalRegen(userData);
    if (!userData.supporter_hp || typeof userData.supporter_hp !== 'object') {
      userData.supporter_hp = {};
    }
    userData.supporter_hp[supporterId] = Math.min(100, Math.max(0, Math.round(hp)));
    witchHunterStorage.saveUser(userData, true);
  }

  /**
   * Trừ lượng máu của Supporter (không giảm xuống dưới 0%)
   */
  static deductSupporterHp(userId, supporterId, amount) {
    const currentHp = this.getSupporterHp(userId, supporterId);
    const newHp = Math.max(0, currentHp - amount);
    this.setSupporterHp(userId, supporterId, newHp);
    return newHp;
  }

  /**
   * Đổi Supporter trang bị cho thành viên
   */
  static equipSupporter(userId, supporterId) {
    let userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) {
      return { success: false, message: 'Lữ khách chưa ký khế ước gia nhập phe!' };
    }

    const currentRank = userData.current_rank || 1;
    const userTier = this.rankToTier(currentRank);
    const maxAllowedTier = Math.min(5, userTier + 1);
    const rankInfo = this.getRankInfo(userData.faction, currentRank);

    if (supporterId === 'default') {
      userData.equipped_supporter = null;
      witchHunterStorage.saveUser(userData, true);
      const defaultSupp = getSupporterByRank(userData.faction, currentRank);
      const resonance = this.checkResonance(userId);
      return { success: true, supporter: defaultSupp, isDefault: true, resonance };
    }

    const owned = this.getOwnedSupporters(userId);
    const targetSupporter = owned.find((s) => s.id === supporterId);
    if (!targetSupporter) {
      return { success: false, message: '❌ Lữ khách chưa sở hữu Supporter này trong kho lưu trữ!' };
    }

    const itemTier = this.rankToTier(targetSupporter.rank);
    if (!targetSupporter.isBlackMarket && itemTier > maxAllowedTier) {
      const maxLetter = this.tierToLetter(maxAllowedTier);
      const userLetter = this.tierToLetter(userTier);
      const requiredRankTier = itemTier - 1;
      const requiredRankObj = WITCH_HUNTER_CONFIG.ranks[userData.faction].find((r) => r.rank === requiredRankTier);
      return {
        success: false,
        locked: true,
        message: `🔒 **CẤP BẬC KHÔNG ĐỦ ĐIỀU KIỆN!**\n> Cấp bậc hiện tại của lữ khách là **${rankInfo?.name || `Bậc ${currentRank}`}** (${userLetter}-Rank).\n> Quy tắc ma thuật giới hạn lữ khách chỉ có thể trang bị Supporter tối đa từ bậc **${maxLetter}-Rank trở xuống** *(Bậc hiện tại + 1)*!\n> Để sử dụng Supporter **${targetSupporter.name}** [${this.formatRankLetter(targetSupporter.rank)}-Rank], lữ khách cần đạt tối thiểu cấp bậc **${requiredRankObj?.name || `Bậc ${requiredRankTier}`}** (${this.tierToLetter(requiredRankTier)}-Rank) nha! 💕`,
      };
    }

    userData.equipped_supporter = targetSupporter.id;
    witchHunterStorage.saveUser(userData, true);
    const resonance = this.checkResonance(userId);
    return { success: true, supporter: targetSupporter, resonance };
  }

  /**
   * Đổi Thần Binh Vũ Khí trang bị cho thành viên
   */
  static equipWeapon(userId, weaponId) {
    let userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) {
      return { success: false, message: 'Lữ khách chưa ký khế ước gia nhập phe!' };
    }

    const currentRank = userData.current_rank || 1;
    const userTier = this.rankToTier(currentRank);
    const maxAllowedTier = Math.min(5, userTier + 1);
    const rankInfo = this.getRankInfo(userData.faction, currentRank);

    if (weaponId === 'default') {
      userData.equipped_weapon = null;
      witchHunterStorage.saveUser(userData, true);
      const defaultWep = getWeaponByRank(userData.faction, currentRank);
      const resonance = this.checkResonance(userId);
      return { success: true, weapon: defaultWep, isDefault: true, resonance };
    }

    const owned = this.getOwnedWeapons(userId);
    const targetWeapon = owned.find((w) => w.id === weaponId);
    if (!targetWeapon) {
      return { success: false, message: '❌ Lữ khách chưa sở hữu Vũ Khí này trong kho lưu trữ!' };
    }

    const itemTier = this.rankToTier(targetWeapon.rank);
    if (!targetWeapon.isBlackMarket && itemTier > maxAllowedTier) {
      const maxLetter = this.tierToLetter(maxAllowedTier);
      const userLetter = this.tierToLetter(userTier);
      const requiredRankTier = itemTier - 1;
      const requiredRankObj = WITCH_HUNTER_CONFIG.ranks[userData.faction].find((r) => r.rank === requiredRankTier);
      return {
        success: false,
        locked: true,
        message: `🔒 **CẤP BẬC KHÔNG ĐỦ ĐIỀU KIỆN!**\n> Cấp bậc hiện tại của lữ khách là **${rankInfo?.name || `Bậc ${currentRank}`}** (${userLetter}-Rank).\n> Quy tắc ma thuật giới hạn lữ khách chỉ có thể trang bị Thần Binh Vũ Khí tối đa từ bậc **${maxLetter}-Rank trở xuống** *(Bậc hiện tại + 1)*!\n> Để sử dụng Vũ Khí **${targetWeapon.name}** [${this.formatRankLetter(targetWeapon.rank)}-Rank], lữ khách cần đạt tối thiểu cấp bậc **${requiredRankObj?.name || `Bậc ${requiredRankTier}`}** (${this.tierToLetter(requiredRankTier)}-Rank) nha! 💕`,
      };
    }

    userData.equipped_weapon = targetWeapon.id;
    witchHunterStorage.saveUser(userData, true);
    const resonance = this.checkResonance(userId);
    return { success: true, weapon: targetWeapon, resonance };
  }

  /**
   * Dựng Embed hiển thị hồ sơ cá nhân /profile
   */
  static buildProfileEmbed(targetUser, callerUser = null) {
    const userId = targetUser.id;
    const userData = witchHunterStorage.getUser(userId);
    const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

    const decor45Emoji = emojis.decor45 || '<a:trangtrig45:1547239010190237819>';
    const decor30Emoji = emojis.decor30 || '<a:trangtrig30:1546905942476464178>';
    const decor34Emoji = emojis.decor34 || '<a:trangtrig34:1547237010572582982>';
    const decor21Emoji = emojis.decor21 || '<a:trangtrig21:1546093099770716213>';
    const defaultLinhTocEmoji = emojis.linhtoc || '<a:linhtocg:1563399670351536310>';
    const heartEmoji = emojis.heart || '<a:heartg1:1545307544808071258>';

    const faction = userData?.faction || null;
    const pumpkins = userData?.pumpkins || 0;
    const currentRank = userData?.current_rank || 1;

    // Chưa chọn phe
    if (!faction) {
      return new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **HỒ SƠ CÁ NHÂN: ${targetUser.username.toUpperCase()}** ${emojis.titleRight}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(
          `Chào **${targetUser.username}**! Hiện tại lữ khách **chưa ký khế ước gia nhập phe phái** nào trong thế giới **Witch Hunter**.\n\n` +
          `${emojis.pumpkin} **Bí Ngô tích lũy:** **${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
          `${decor34Emoji} **Phe phái:** *Chưa phân định...*\n` +
          `${decor45Emoji} **Cấp bậc:** *Chưa phân định*\n` +
          `${defaultLinhTocEmoji} **Supporter Khế Ước:** *Chưa ký kết khế ước*\n\n` +
          `${decor30Emoji} **Lời nhắn từ Phù Thủy Usagi:**\n` +
          `> Hãy ghé qua kênh <#${channels.selectionChannelId}> nhận role danh hiệu ngay nha Lữ Khách ơi! ${heartEmoji}`
        )
        .setFooter({ text: 'Witch Hunter Profile' })
        .setTimestamp();
    }

    const isHunter = faction === 'hunter';
    const factionDisplay = isHunter
      ? `${emojis.hunterButton} **Phe phái:** **Hiệp Hội Thợ Săn**`
      : `${emojis.witchButton} **Phe phái:** **Phe Phù Thủy**`;

    const progress = this.getProgressDetails(faction, pumpkins, currentRank);
    const rankInfo = this.getRankInfo(faction, currentRank);

    const userTier = this.rankToTier(currentRank);
    const userLetter = this.tierToLetter(userTier);
    const maxAllowedTier = Math.min(5, userTier + 1);
    const maxAllowedLetter = this.tierToLetter(maxAllowedTier);

    const equippedSupporter = this.getEquippedSupporter(userId);
    const equippedWeapon = this.getEquippedWeapon(userId);
    const ownedSupporters = this.getOwnedSupporters(userId);
    const ownedWeapons = this.getOwnedWeapons(userId);

    // Supporter đang kích hoạt
    let equippedSupporterLine = `*Chưa trang bị*`;
    if (equippedSupporter) {
      const cat = WITCH_HUNTER_CONFIG.supporters.categories[equippedSupporter.categoryKey];
      const catEmoji = cat?.emoji || defaultLinhTocEmoji;
      const rankBadge = `**[${this.formatRankLetter(equippedSupporter.rank)}-Rank]**`;
      equippedSupporterLine = `${catEmoji} ${rankBadge} **${equippedSupporter.name}** *(${cat?.shortName || ''})*`;
    }

    // Vũ khí đang kích hoạt
    let equippedWeaponLine = `*Chưa trang bị*`;
    if (equippedWeapon) {
      const rankBadge = `**[${this.formatRankLetter(equippedWeapon.rank)}-Rank]**`;
      const energyEmoji = equippedWeapon.energyEmoji || '⚔️';
      equippedWeaponLine = `${energyEmoji} ${rankBadge} **${equippedWeapon.name}** *(${equippedWeapon.energyAttribute || ''})*`;
    }

    // Sinh lực Supporter đang xuất trận
    let supporterHpBlock = '';
    if (equippedSupporter) {
      const suppHp = this.getSupporterHp(userId, equippedSupporter.id);
      const filledBars = Math.min(10, Math.max(0, Math.floor(suppHp / 10)));
      const emptyBars = 10 - filledBars;
      const hpBarString = `[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}]`;
      supporterHpBlock =
        `<:wh4:1564143733690204190> Sinh Lực Supporter Đang Xuất Trận:\n` +
        `\`${hpBarString}\` **${suppHp}%** (${suppHp}/100 HP)\n` +
        `> <:wh4:1564143733690204190> Tốc độ hồi phục tự nhiên: **+10% HP / mỗi 1 giờ** (Tối đa 100%)\n\n`;
    }

    // Kiểm tra Cộng Hưởng Khế Ước giữa Supporter và Thần Binh Vũ Khí
    const resonance = this.checkResonance(userId);
    let resonanceLine = '';
    if (resonance.isResonance) {
      resonanceLine =
        `<a:trangtrig14:1546047912969113622> **Cộng Hưởng Đồng Bộ Khế Ước:** <a:trangtrig20:1546092997299667055> **KÍCH HOẠT THÀNH CÔNG!**\n` +
        `> <a:knifeg1:1546058092016312381> **Hiệu quả:** Tăng **x1.5 Bạo Kích Sát Thương** & kích hoạt 100% Thuộc Tính Thần Binh khi giao tranh!\n\n`;
    } else {
      resonanceLine =
        `<a:bang2:1546891483250954290> **Lữ khách xin lưu ý:** Supporter và Vũ Khí của lữ khách chưa có đồng bộ cộng hưởng.\n` +
        `> <a:bang2:1546891483250954290> **Em Phù Thủy Usagi khuyên dùng:** ${resonance.suggestion}\n\n`;
    }

    // Danh sách Supporter sở hữu (đổi 1 2 3 4 sang C B A S SS, bỏ chấm ngang thay bằng 1.  2.  cách nhau)
    let ownedSupportersLines = '';
    if (ownedSupporters.length > 0) {
      ownedSupportersLines = ownedSupporters.map((s, idx) => {
        const isEquipped = equippedSupporter && s.id === equippedSupporter.id;
        const cat = WITCH_HUNTER_CONFIG.supporters.categories[s.categoryKey];
        const catEmoji = cat?.emoji || '🔮';
        const rankLetter = this.formatRankLetter(s.rank);
        const tag = isEquipped ? ' <a:trangtrig36:1563065680922808340> *(Đang dùng)*' : '';
        return `> ${idx + 1}.  ${catEmoji} **[${rankLetter}-Rank]** ${s.name}${tag}`;
      }).join('\n');
    } else {
      ownedSupportersLines = `> *(Chưa có Supporter nào)*`;
    }

    // Danh sách Vũ Khí sở hữu (đổi 1 2 3 4 sang C B A S SS, bỏ chấm ngang thay bằng 1.  2.  cách nhau)
    let ownedWeaponsLines = '';
    if (ownedWeapons.length > 0) {
      ownedWeaponsLines = ownedWeapons.map((w, idx) => {
        const isEquipped = equippedWeapon && w.id === equippedWeapon.id;
        const energyEmoji = w.energyEmoji || '⚔️';
        const rankLetter = this.formatRankLetter(w.rank);
        const tag = isEquipped ? ' <a:trangtrig36:1563065680922808340> *(Đang dùng)*' : '';
        return `> ${idx + 1}.  ${energyEmoji} **[${rankLetter}-Rank]** ${w.shortName || w.name}${tag}`;
      }).join('\n');
    } else {
      ownedWeaponsLines = `> *(Chưa có Vũ Khí nào)*`;
    }

    const progressText = progress.isMax
      ? `${progress.formattedStatus}`
      : `> ${progress.formattedStatus}`;

    let darkTitleSection = '';
    if (userData?.dark_title && WITCH_HUNTER_CONFIG.darkTitles?.list?.[userData.dark_title]) {
      const dt = WITCH_HUNTER_CONFIG.darkTitles.list[userData.dark_title];
      darkTitleSection = `<a:animeg2:1546040159886114846> Danh Hiệu Hắc Ám: ｢ ${dt.nameVi} ｣ - ${dt.nameEn}\n*"${dt.slogan}"*\n\n`;
    }

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **HỒ SƠ MA THUẬT: ${targetUser.username.toUpperCase()}** ${emojis.titleRight}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `Chiến binh huyền thoại của thế giới ma thuật **Witch Hunter**:\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        darkTitleSection +
        `${emojis.pumpkin} **Bí Ngô sở hữu:** **${pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
        (userData?.memory_shards > 0 ? `<a:trangtrig46:1547240249761996812> **Mảnh Vỡ Ký Ức:** **${(userData.memory_shards || 0).toLocaleString('vi-VN')}**\n` : '') +
        (userData?.free_summons > 0 ? `<a:linhtocg:1563399670351536310> **Vé Tế Đàn Free:** **${userData.free_summons}** lượt khả dụng\n` : '') +
        `${factionDisplay}\n` +
        `${decor45Emoji} **Cấp bậc:** **${rankInfo.name}** *(${rankInfo.title})*\n` +
        `<a:trangtrig18:1546068102817775626> **Quy tắc trang bị:** Tối đa bậc **${maxAllowedLetter}-Rank** trở xuống *(Bậc hiện tại + 1)*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:whg2:1564145798537683034> **TRANG BỊ ĐANG KÍCH HOẠT:**\n` +
        `• **Supporter:** ${equippedSupporterLine}\n` +
        `• **Thần Binh Vũ Khí:** ${equippedWeaponLine}\n\n` +
        supporterHpBlock +
        `${resonanceLine}` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:giftg1:1543150714732412948> **KHO BÁU VẬT ĐÃ SỞ HỮU:**\n` +
        `<a:linhtocg:1563399670351536310> **Supporter Đã Ký Khế Ước (${ownedSupporters.length}):**\n` +
        `${ownedSupportersLines}\n\n` +
        `<a:trangtrig36:1563065680922808340> **Thần Binh Vũ Khí Sở Hữu (${ownedWeapons.length}):**\n` +
        `${ownedWeaponsLines}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${decor21Emoji} **Tiến trình đột phá bậc kế tiếp:**\n` +
        `${progress.progressBar}\n` +
        `${progressText}`
      )
      .setFooter({ text: 'Witch Hunter Profile' })
      .setTimestamp();
  }

  /**
   * Tạo ActionRow Select Menus đổi Supporter và Vũ Khí cho lệnh /profile
   */
  static createProfileEquipComponents(userId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) return [];

    const parseEmoji = (emojiStr) => {
      if (!emojiStr) return undefined;
      if (typeof emojiStr === 'string' && !emojiStr.startsWith('<')) {
        return { name: emojiStr };
      }
      const match = String(emojiStr).match(/<(?<animated>a)?:(?<name>[a-zA-Z0-9_]+):(?<id>\d+)>/);
      if (match && match.groups) {
        return {
          id: match.groups.id,
          name: match.groups.name,
          animated: Boolean(match.groups.animated),
        };
      }
      return undefined;
    };

    const currentRank = userData.current_rank || 1;
    const userTier = this.rankToTier(currentRank);
    const maxAllowedTier = Math.min(5, userTier + 1);

    const equippedSupporter = this.getEquippedSupporter(userId);
    const equippedWeapon = this.getEquippedWeapon(userId);
    const ownedSupporters = this.getOwnedSupporters(userId);
    const ownedWeapons = this.getOwnedWeapons(userId);

    // 1. Menu đổi Supporter
    const supporterOptions = [
      {
        label: '↺ Mặc Định Theo Cấp Bậc',
        description: `Tự động trang bị Supporter theo bậc danh vị hiện tại`,
        value: 'default',
        default: !userData.equipped_supporter,
        emoji: parseEmoji(WITCH_HUNTER_CONFIG.emojis.decor18 || '<a:trangtrig18:1546068102817775626>'),
      },
      ...ownedSupporters.slice(0, 24).map((s) => {
        const itemTier = this.rankToTier(s.rank);
        const rankLetter = this.formatRankLetter(s.rank);
        const isLocked = !s.isBlackMarket && itemTier > maxAllowedTier;
        const isEquipped = equippedSupporter && s.id === equippedSupporter.id;
        const cat = WITCH_HUNTER_CONFIG.supporters.categories[s.categoryKey];
        const prefix = isLocked ? `🔒 [Khóa Bậc ${rankLetter}] ` : isEquipped ? `⚔️ [Đang Dùng] ` : `[${rankLetter}-Rank] `;
        return {
          label: `${prefix}${s.name}`.slice(0, 100),
          description: isLocked
            ? `Cần Bậc ${this.tierToLetter(itemTier - 1)}-Rank để mở khóa`.slice(0, 100)
            : `${s.rankName} • ${cat?.shortName || ''}`.slice(0, 100),
          value: s.id,
          default: !isLocked && Boolean(isEquipped && userData.equipped_supporter === s.id),
          emoji: isLocked ? undefined : parseEmoji(cat?.emoji),
        };
      }),
    ];

    // 2. Menu đổi Vũ Khí
    const weaponOptions = [
      {
        label: '↺ Mặc Định Theo Cấp Bậc',
        description: `Tự động trang bị Vũ Khí theo bậc danh vị hiện tại`,
        value: 'default',
        default: !userData.equipped_weapon,
        emoji: parseEmoji(WITCH_HUNTER_CONFIG.emojis.decor18 || '<a:trangtrig18:1546068102817775626>'),
      },
      ...ownedWeapons.slice(0, 24).map((w) => {
        const itemTier = this.rankToTier(w.rank);
        const rankLetter = this.formatRankLetter(w.rank);
        const isLocked = !w.isBlackMarket && itemTier > maxAllowedTier;
        const isEquipped = equippedWeapon && w.id === equippedWeapon.id;
        const prefix = isLocked ? `🔒 [Khóa Bậc ${rankLetter}] ` : isEquipped ? `⚔️ [Đang Dùng] ` : `[${rankLetter}-Rank] `;
        return {
          label: `${prefix}${w.shortName || w.name}`.slice(0, 100),
          description: isLocked
            ? `Cần Bậc ${this.tierToLetter(itemTier - 1)}-Rank để mở khóa`.slice(0, 100)
            : `${w.rankName}`.slice(0, 100),
          value: w.id,
          default: !isLocked && Boolean(isEquipped && userData.equipped_weapon === w.id),
          emoji: isLocked ? undefined : parseEmoji(w.energyEmoji),
        };
      }),
    ];

    const supporterSelect = new StringSelectMenuBuilder()
      .setCustomId(`profile_equip_supporter:${userId}`)
      .setPlaceholder(`🔮 Chọn Supporter xuất trận (Tối đa Bậc ${this.tierToLetter(maxAllowedTier)})...`)
      .addOptions(supporterOptions);

    const weaponSelect = new StringSelectMenuBuilder()
      .setCustomId(`profile_equip_weapon:${userId}`)
      .setPlaceholder(`⚔️ Chọn Vũ Khí xuất trận (Tối đa Bậc ${this.tierToLetter(maxAllowedTier)})...`)
      .addOptions(weaponOptions);

    const rows = [
      new ActionRowBuilder().addComponents(supporterSelect),
      new ActionRowBuilder().addComponents(weaponSelect),
    ];

    // 3. Menu chọn Danh Hiệu Hắc Ám (nếu có sở hữu)
    const unlockedTitles = Array.isArray(userData.unlocked_titles) ? userData.unlocked_titles : [];
    if (unlockedTitles.length > 0) {
      const titlesList = WITCH_HUNTER_CONFIG.darkTitles?.list || {};
      const titleOptions = [
        {
          label: '↺ Không Sử Dụng Danh Hiệu',
          description: 'Gỡ danh hiệu hắc ám khỏi hồ sơ cá nhân',
          value: 'none',
          default: !userData.dark_title,
          emoji: parseEmoji(WITCH_HUNTER_CONFIG.emojis.decor18 || '<a:trangtrig18:1546068102817775626>'),
        },
        ...unlockedTitles.map((tKey) => {
          const tInfo = titlesList[tKey];
          if (!tInfo) return null;
          const isEquipped = userData.dark_title === tKey;
          return {
            label: `${isEquipped ? '👑 [Đang Dùng] ' : ''}｢ ${tInfo.nameVi} ｣`.slice(0, 100),
            description: `${tInfo.nameEn} • ${tInfo.slogan}`.slice(0, 100),
            value: tKey,
            default: Boolean(isEquipped),
            emoji: parseEmoji('<a:trangtrig14:1546047912969113622>'),
          };
        }).filter(Boolean),
      ];

      const titleSelect = new StringSelectMenuBuilder()
        .setCustomId(`profile_equip_dark_title:${userId}`)
        .setPlaceholder('👑 Chọn Danh Hiệu Hắc Ám muốn hiển thị...')
        .addOptions(titleOptions);

      rows.push(new ActionRowBuilder().addComponents(titleSelect));
    }

    return rows;
  }

  /**
   * Thay đổi hoặc gỡ Danh Hiệu Hắc Ám cho thành viên
   * @param {string} userId
   * @param {string} titleKey 'none' hoặc ID danh hiệu
   * @param {Guild} guild
   */
  static async equipDarkTitle(userId, titleKey, guild = null) {
    let userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) {
      return { success: false, message: 'Lữ khách chưa ký khế ước gia nhập phe!' };
    }

    const unlockedTitles = Array.isArray(userData.unlocked_titles) ? userData.unlocked_titles : [];
    const titlesList = WITCH_HUNTER_CONFIG.darkTitles?.list || {};

    if (titleKey === 'none') {
      userData.dark_title = null;
      witchHunterStorage.saveUser(userData, true);

      // Gỡ toàn bộ role danh hiệu trên Discord
      if (guild) {
        try {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            const roleIdsToRemove = Object.values(titlesList).map((t) => t.roleId).filter(Boolean);
            for (const rId of roleIdsToRemove) {
              if (member.roles.cache.has(rId)) {
                await member.roles.remove(rId).catch(() => null);
              }
            }
          }
        } catch {}
      }

      return { success: true, isNone: true };
    }

    if (!unlockedTitles.includes(titleKey)) {
      return { success: false, message: '❌ Lữ khách chưa sở hữu Danh Hiệu Hắc Ám này!' };
    }

    const titleInfo = titlesList[titleKey];
    if (!titleInfo) {
      return { success: false, message: '❌ Danh hiệu không tồn tại trong hệ thống!' };
    }

    userData.dark_title = titleKey;
    witchHunterStorage.saveUser(userData, true);

    // Đồng bộ role Discord
    if (guild) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const allTitleRoleIds = Object.values(titlesList).map((t) => t.roleId).filter(Boolean);
          for (const rId of allTitleRoleIds) {
            if (rId !== titleInfo.roleId && member.roles.cache.has(rId)) {
              await member.roles.remove(rId).catch(() => null);
            }
          }
          if (titleInfo.roleId && !member.roles.cache.has(titleInfo.roleId)) {
            await member.roles.add(titleInfo.roleId).catch(() => null);
          }
        }
      } catch {}
    }

    return { success: true, title: titleInfo };
  }
}


