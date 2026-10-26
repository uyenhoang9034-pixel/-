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
} from '../config/witchHunterConfig.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const JSON_FILE_PATH = path.join(DATA_DIR, 'witch_hunter.json');
const SQLITE_FILE_PATH = path.join(DATA_DIR, 'witch_hunter.sqlite');

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
                  last_puzzle_week TEXT
                );
              `);
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN last_puzzle_session TEXT;');
              } catch {}
              try {
                this.sqliteDb.exec('ALTER TABLE witch_hunter_members ADD COLUMN last_puzzle_week TEXT;');
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
          const userObj = {
            user_id: row.user_id,
            faction: row.faction,
            current_rank: Number(row.current_rank) || 1,
            pumpkins: Number(row.pumpkins) || 0,
            unlocked_supporters: Array.isArray(unlockedSupporters) ? unlockedSupporters : [],
            last_puzzle_session: row.last_puzzle_session || null,
            last_puzzle_week: row.last_puzzle_week || row.last_puzzle_session || null,
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
        return stmt.all().map((row) => ({
          user_id: row.user_id,
          faction: row.faction,
          current_rank: Number(row.current_rank) || 1,
          pumpkins: Number(row.pumpkins) || 0,
          last_puzzle_session: row.last_puzzle_session || null,
          last_puzzle_week: row.last_puzzle_week || row.last_puzzle_session || null,
          updated_at: Number(row.updated_at) || Date.now(),
        }));
      } catch (err) {
        logger.error('❌ [WitchHunter] SQLite getAllUsers error:', err);
      }
    }

    return Array.from(this.memoryCache.values()).sort((a, b) => (b.pumpkins || 0) - (a.pumpkins || 0));
  }

  saveUser(userObj, immediate = false) {
    userObj.updated_at = Date.now();
    userObj.unlocked_supporters = Array.isArray(userObj.unlocked_supporters) ? userObj.unlocked_supporters : [];
    this.memoryCache.set(userObj.user_id, userObj);

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO witch_hunter_members (user_id, faction, current_rank, pumpkins, updated_at, last_puzzle_session, last_puzzle_week)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            faction = excluded.faction,
            current_rank = excluded.current_rank,
            pumpkins = excluded.pumpkins,
            updated_at = excluded.updated_at,
            last_puzzle_session = excluded.last_puzzle_session,
            last_puzzle_week = excluded.last_puzzle_week
        `);
        stmt.run(
          userObj.user_id,
          userObj.faction || null,
          userObj.current_rank || 1,
          userObj.pumpkins || 0,
          userObj.updated_at,
          userObj.last_puzzle_session || null,
          userObj.last_puzzle_week || userObj.last_puzzle_session || null
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
   * Mốc điểm: 0 -> 100 -> 500 -> 3.000 -> 10.000
   */
  static calculateRank(pumpkins = 0) {
    if (pumpkins >= 10000) return 5;
    if (pumpkins >= 3000) return 4;
    if (pumpkins >= 500) return 3;
    if (pumpkins >= 100) return 2;
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
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 𝓝𝓸̣̂𝓲 𝓑𝓸̣̂: 𝓚𝔂́ 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓖𝓲𝓪 𝓝𝓱𝓪̣̂𝓹 𝓟𝓱𝓮 ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 𝓝𝓸̣̂𝓲 𝓑𝓸̣̂: 𝓐𝓭𝓶𝓲𝓷 𝓒𝓱𝓾𝔂𝓮̂̉𝓷 Đ𝓸̂̉𝓲 𝓟𝓱𝓮 ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 𝓝𝓸̣̂𝓲 𝓑𝓸̣̂: 𝓐𝓭𝓶𝓲𝓷 𝓒𝓪̂́𝓹 𝓡𝓸𝓵𝓮 𝓟𝓱𝓮 𝓣𝓱𝓾̉ 𝓒𝓸̂𝓷𝓰 ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 𝓝𝓸̣̂𝓲 𝓑𝓸̣̂: 𝓐𝓭𝓶𝓲𝓷 𝓧𝓸́𝓪 𝓡𝓸𝓵𝓮 𝓟𝓱𝓮 𝓣𝓱𝓾̉ 𝓒𝓸̂𝓷𝓰 ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 𝓝𝓸̣̂𝓲 𝓑𝓸̣̂: 𝓟𝓱𝓪́𝓽 𝓑𝓲́ 𝓝𝓰𝓸̂ ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓑𝓪𝓷 𝓣𝓱𝓾̛𝓸̛̉𝓷𝓰 𝓑𝓲́ 𝓝𝓰𝓸̂ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓒𝓱𝓾́𝓬 𝓜𝓾̛̀𝓷𝓰 Đ𝓸̣̂𝓽 𝓟𝓱𝓪́ 𝓒𝓪̂́𝓹 𝓑𝓪̣̂𝓬 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`)
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
        .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: 𝓒𝓱𝓾𝔂𝓮̂̉𝓷 Đ𝓸̂̉𝓲 𝓟𝓱𝓮 𝓟𝓱𝓪́𝓲 ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
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
      .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸: 𝓐𝓭𝓶𝓲𝓷 Đ𝓸̂̉𝓲 𝓟𝓱𝓮 𝓒𝓱𝓸 𝓣𝓱𝓪̀𝓷𝓱 𝓥𝓲𝓮̂𝓷 ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
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

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓾 𝓗𝓸̂̀𝓲 𝓑𝓲́ 𝓝𝓰𝓸̂ & 𝓖𝓲𝓪́𝓷𝓰 𝓒𝓪̂́𝓹 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`)
      .setDescription(
        `Chào **Kẻ Mang Khế Ước** thân mến! Em phù thủy nóng bỏng Usagi múp rụp gửi thông báo tới lữ khách nè!\n\n` +
        `Hội Đồng Ma Thuật vừa thực hiện thu hồi **-${actualDeducted.toLocaleString('vi-VN')} Bí Ngô** ${emojis.pumpkin} từ ${executor ? `<@${executor.id}>` : 'Ban Quản Trị'}!\n` +
        (reason ? `> ${decor30Emoji} **Lý do / Vi phạm:** ${reason}\n\n` : '\n') +
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
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓾 𝓗𝓸̂̀𝓲 𝓑𝓲́ 𝓝𝓰𝓸̂ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓸̂𝓷𝓰 𝓑𝓪́𝓸 𝓝𝓸̣̂𝓲 𝓑𝓸̣̂: 𝓣𝓱𝓾 𝓗𝓸̂̀𝓲 𝓑𝓲́ 𝓝𝓰𝓸̂ ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`)
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
              .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: 𝓖𝓲𝓪̉𝓲 𝓣𝓻𝓾̛̀ 𝓟𝓱𝓮 ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
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
            .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: 𝓖𝓲𝓪 𝓝𝓱𝓪̣̂𝓹 𝓟𝓱𝓮 ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓦𝓲𝓽𝓬𝓱 𝓗𝓾𝓷𝓽𝓮𝓻: 𝓓𝓪𝓷𝓱 𝓢𝓪́𝓬𝓱 𝓢𝓾𝓹𝓹𝓸𝓻𝓽𝓮𝓻 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 ${emojis.titleRight}`)
      .setDescription(
        `Trong thế giới Witch Hunter, mỗi Thợ Săn hay Phù Thủy khi đạt đến từng cảnh giới ma lực nhất định sẽ có thể ký khế ước để kết giao hoặc điều khiển một Supporter (Trợ thủ phò tá) riêng biệt.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${emojis.decor41 || '<a:trangtrig41:1547238037832863744>'} 3 ĐẠI HỆ BẢN CHẤT SUPPORTER:\n` +
        `• ${emojis.nguyenthe || '<a:nguyentheg:1563399515732443177>'} Hệ Nguyền Thể (Cursed Entity): Thực thể sinh ra từ oán niệm, xác thịt bị nguyền rủa hoặc linh hồn bị phong ấn vào vật thể.\n` +
        `• ${emojis.camkhi || '<a:camkhig:1563399321125134346>'} Hệ Cấm Khí (Forbidden Relic): Ma cụ, cơ quan cổ đại hoặc thiết bị không gian do con người rèn tạo để cưỡng chế ma lực.\n` +
        `• ${emojis.linhtoc || '<a:linhtocg:1563399670351536310>'} Hệ Linh Tộc (Primordial Beast): Sinh vật thượng cổ có tri giác độc lập, chỉ liên kết qua khế ước danh dự hoặc máu tương thích.\n` +
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

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓢𝓾𝓹𝓹𝓸𝓻𝓽𝓮𝓻: ${supporter.titleFancy} ${emojis.titleRight}`)
      .setDescription(
        `${factionBadge} **${supporter.factionName}** • ${emojis.decor15 || '<a:trangtrig15:1546047955696488489>'} **${supporter.rankName}**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${catEmoji} **SUPPORTER: ${supporter.fullName}**\n` +
        `${catEmoji} ${cat?.name || 'Đại Hệ'}\n` +
        `> ${cat?.desc || ''}\n\n` +
        `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **HÌNH DÁNG ĐẶC TRƯNG:**\n` +
        `${supporter.appearance}\n\n` +
        `${emojis.decor17 || '<a:trangtrig17:1546048098415939655>'} **NGUỒN GỐC & KHẾ ƯỚC CHIẾN ĐẤU:**\n` +
        `${supporter.lore}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
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
        .setTitle(`${emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓢𝓾𝓹𝓹𝓸𝓻𝓽𝓮𝓻: ${supporter.titleFancy} ${emojis.titleRight}`)
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
      .setTitle(`${emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓢𝓾𝓹𝓹𝓸𝓻𝓽𝓮𝓻 𝓜𝓸̛́𝓲 𝓣𝓱𝓾̛́𝓬 𝓣𝓲̉𝓷𝓱 ${emojis.titleRight}`)
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
   * Tạo ActionRow chứa StringSelectMenu tra cứu danh sách 10 Supporter
   * @param {string} authorId ID của người dùng gõ lệnh
   * @param {string|null} currentSelectedId ID của supporter đang được chọn (để set default)
   */
  static createSupporterSelectRow(authorId, currentSelectedId = null) {
    const { supporters } = WITCH_HUNTER_CONFIG;

    const parseEmoji = (emojiStr) => {
      if (!emojiStr) return undefined;
      const match = emojiStr.match(/<(?<animated>a)?:(?<name>[a-zA-Z0-9_]+):(?<id>\d+)>/);
      if (match && match.groups) {
        return {
          id: match.groups.id,
          name: match.groups.name,
          animated: Boolean(match.groups.animated),
        };
      }
      return emojiStr;
    };

    const options = [
      {
        label: '[Tổng Quan] 3 Đại Hệ',
        description: 'Bản chất 3 Đại Hệ: Nguyền Thể, Cấm Khí, Linh Tộc',
        value: 'overview',
        default: currentSelectedId === 'overview',
        emoji: parseEmoji(WITCH_HUNTER_CONFIG.emojis.decor18 || '<a:trangtrig18:1546068102817775626>'),
      },
      ...supporters.list.map((s) => {
        const cat = supporters.categories[s.categoryKey];
        const isHunter = s.faction === 'hunter';
        const prefix = isHunter ? '[Thợ Săn]' : '[Phù Thủy]';
        return {
          label: `${prefix} ${s.name}`,
          description: `${s.rankName} • ${cat?.shortName || ''}`,
          value: s.id,
          default: currentSelectedId === s.id,
          emoji: parseEmoji(cat?.emoji),
        };
      }),
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`supporter_select:${authorId}`)
      .setPlaceholder('🔮 Chọn Supporter để tra cứu khế ước...')
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
      .setTitle(`${emojis.titleLeft} 𝓦𝓲𝓽𝓬𝓱 𝓗𝓾𝓷𝓽𝓮𝓻: 𝓚𝓱𝓸 𝓥𝓾̃ 𝓚𝓱𝓲́ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`)
      .setDescription(
        `Trong thế giới **Witch Hunter**, mỗi Thợ Săn hay Phù Thủy khi đột phá từng cảnh giới ma lực sẽ được trang bị một Thần Binh Vũ Khí độc quyền, liên kết cộng hưởng trực tiếp cùng Supporter khế ước để giải phóng sức mạnh tối thượng.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${emojis.hunterBadge || '<a:trangtrig36:1563065680922808340>'} **VŨ KHÍ HIỆP HỘI THỢ SĂN (W.H. ASSOCIATION):**\n` +
        `• <:wh3:1563432304179945563> **Bậc 1 (0 ${emojis.pumpkin}):** Silver Fang Dagger (Đoản Đao Răng Bạc)\n` +
        `• <a:camkhig:1563399321125134346> **Bậc 2 (100 ${emojis.pumpkin}):** Clockwork Saw-Blade (Lưỡi Cưa Cơ Giới)\n` +
        `• <a:trangtrig46:1547240249761996812> **Bậc 3 (500 ${emojis.pumpkin}):** Aegis Heavy Tower (Đại Khiên Thành Trì)\n` +
        `• <a:whg3:1563432043768189059> **Bậc 4 (3.000 ${emojis.pumpkin}):** Dimension Breaker (Pháo Kích Không Gian)\n` +
        `• <:wh2:1563431832546967624> **Bậc 5 (10.000 ${emojis.pumpkin}):** Chrono-Crossbow (Nỏ Máy Tiên Tri)\n\n` +
        `${emojis.witchBadge || '<a:trangtrig32:1546906170994856026>'} **VŨ KHÍ HỘI PHÙ THỦY (WITCHES):**\n` +
        `• <a:whg2:1563431096501280819> **Bậc 1 (0 ${emojis.pumpkin}):** Soul-Stitch Needle (Hắc Châm Khâu Hồn)\n` +
        `• <a:whg1:1563430946835931187> **Bậc 2 (100 ${emojis.pumpkin}):** Raven Glass Blade (Dao Găm Lông Quạ)\n` +
        `• <:wh1:1563430728564351006> **Bậc 3 (500 ${emojis.pumpkin}):** Kitsune Fox-Lantern (Đèn Lồng Ảo Ảnh)\n` +
        `• <a:trangtrig29:1546385117478527016> **Bậc 4 (3.000 ${emojis.pumpkin}):** Cinder Cane (Trượng Tàn Hỏa)\n` +
        `• <a:nguyentheg:1563399515732443177> **Bậc 5 (10.000 ${emojis.pumpkin}):** Soul-Harvest Scythe (Lưỡi Hái Đoạt Hồn)\n` +
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

    const milestoneText =
      weapon.rank === 1
        ? `0 ${emojis.pumpkin} (Khởi đầu)`
        : weapon.rank === 5
        ? `10.000 ${emojis.pumpkin} (Tối thượng)`
        : `${weapon.minPumpkins.toLocaleString('vi-VN')} ${emojis.pumpkin}`;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu Tím Pastel #D8B4F8
      .setTitle(`${emojis.titleLeft} 𝓥𝓾̃ 𝓚𝓱𝓲́ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: ${weapon.titleFancy} ${emojis.titleRight}`)
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
        `${weapon.powerDetail}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${emojis.heart || '<a:heartg1:1545307544808071258>'} Hãy chọn Vũ Khí khác từ menu bên dưới để tiếp tục tra cứu sức mạnh nha lữ khách!`
      )
      .setFooter({ text: 'Witch Hunter System' });
  }

  /**
   * Tạo ActionRow Select Menu cho giao diện Vũ Khí
   */
  static createWeaponSelectRow(authorId, currentSelectedId = null) {
    const { weapons } = WITCH_HUNTER_CONFIG;

    const parseEmoji = (emojiStr) => {
      if (!emojiStr) return undefined;
      const match = emojiStr.match(/<(?<animated>a)?:(?<name>[a-zA-Z0-9_]+):(?<id>\d+)>/);
      if (match && match.groups) {
        return {
          id: match.groups.id,
          name: match.groups.name,
          animated: Boolean(match.groups.animated),
        };
      }
      return emojiStr;
    };

    const options = [
      {
        label: '[Tổng Quan] 10 Đại Thần Binh',
        description: 'Kho vũ khí tối thượng của Hiệp Hội Thợ Săn & Hội Phù Thủy',
        value: 'overview',
        default: currentSelectedId === 'overview',
        emoji: parseEmoji(WITCH_HUNTER_CONFIG.emojis.decor18 || '<a:trangtrig18:1546068102817775626>'),
      },
      ...weapons.list.map((w) => {
        const isHunter = w.faction === 'hunter';
        const prefix = isHunter ? '[Thợ Săn]' : '[Phù Thủy]';
        return {
          label: `${prefix} ${w.shortName}`,
          description: `${w.rankName} • ${w.activationMilestone}`,
          value: w.id,
          default: currentSelectedId === w.id,
          emoji: parseEmoji(w.energyEmoji),
        };
      }),
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`weapon_select:${authorId}`)
      .setPlaceholder('⚔️ Chọn Vũ Khí để tra cứu thuộc tính sức mạnh...')
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
      .setTitle(`${emojis.titleLeft} 𝓖𝓲𝓪̉𝓲 𝓜𝓪̃ 𝓒𝓸̂̉ 𝓝𝓰𝓾̛̃ — 𝓠𝓾𝓲𝓬𝓴 𝓟𝓾𝔃𝔃𝓵𝓮 ${emojis.titleRight}`)
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
      .setEmoji(WITCH_HUNTER_CONFIG.emojis.pumpkin || '🎃');

    return new ActionRowBuilder().addComponents(startButton);
  }
}


