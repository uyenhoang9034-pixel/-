import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuditLogEvent, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  WITCH_HUNTER_CONFIG,
  getWitchHunterRoleInfo,
  getAllWitchHunterRoleIds,
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
                  updated_at INTEGER
                );
              `);
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
      const tempPath = `${JSON_FILE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), 'utf-8');
      fs.renameSync(tempPath, JSON_FILE_PATH);
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi ghi file JSON:', error);
    }
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
          const userObj = {
            user_id: row.user_id,
            faction: row.faction,
            current_rank: Number(row.current_rank) || 1,
            pumpkins: Number(row.pumpkins) || 0,
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
    this.memoryCache.set(userObj.user_id, userObj);

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO witch_hunter_members (user_id, faction, current_rank, pumpkins, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            faction = excluded.faction,
            current_rank = excluded.current_rank,
            pumpkins = excluded.pumpkins,
            updated_at = excluded.updated_at
        `);
        stmt.run(
          userObj.user_id,
          userObj.faction || null,
          userObj.current_rank || 1,
          userObj.pumpkins || 0,
          userObj.updated_at
        );
      } catch (err) {
        logger.error('❌ [WitchHunter] SQLite saveUser error:', err);
      }
    }

    if (immediate) {
      this.flushJson();
    } else {
      this.scheduleFlush();
    }

    return userObj;
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
    return { ...info, roleId };
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
        formattedStatus: `✨ **Đã đạt cảnh giới tối cao:** ${currentRankObj.name} (${pumpkins.toLocaleString('vi-VN')} ${pumpkinEmoji})`,
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
      .setFooter({ text: 'Witch Hunter Admin System • Em bot Usagi múp rụp 💕' })
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
      .setFooter({ text: 'Witch Hunter Admin System • Em bot Usagi múp rụp 💕' })
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
      .setFooter({ text: 'Witch Hunter Admin System • Em bot Usagi múp rụp 💕' })
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
      .setFooter({ text: 'Witch Hunter Admin System • Em bot Usagi múp rụp 💕' })
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
      .setFooter({ text: 'Witch Hunter Admin System • Em bot Usagi múp rụp 💕' })
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

    return new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu tím pastel nhạt nhạt cố định
      .setTitle(`${emojis.titleLeft} 𝓑𝓪𝓷 𝓣𝓱𝓾̛𝓸̛̉𝓷𝓰 𝓑𝓲́ 𝓝𝓰𝓸̂ 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 ${emojis.titleRight}`)
      .setDescription(
        `Chào bạn **${user.username}** thân mến! Em bot Usagi múp rụp mang tin vui tới cho bạn nè! ${emojis.heart || '💕'}\n\n` +
        `Bạn vừa nhận được **+${amount.toLocaleString('vi-VN')} Bí Ngô** ${emojis.pumpkin} được ban thưởng từ ${executor ? `<@${executor.id}>` : 'Ban Quản Trị'}!\n` +
        (reason ? `> 📝 **Lý do / Nhiệm vụ:** ${reason}\n\n` : '\n') +
        `📊 **Tổng Bí Ngô tích lũy hiện tại:** **${newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
        `Số Bí Ngô này sẽ được bảo lưu vĩnh viễn và là hành trang quý giá cho các nhiệm vụ, sự kiện đua top và nâng cấp danh vị ma thuật về sau!` +
        rankUpNotice
      )
      .setFooter({ text: 'Witch Hunter System • Em bot Usagi múp rụp 💕' })
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
        text: 'Witch Hunter System • Gửi từ em bot Usagi múp rụp 💕',
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
              .setFooter({ text: 'Witch Hunter System • Em bot Usagi múp rụp 💕' })
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
            .setFooter({ text: 'Witch Hunter System • Em bot Usagi múp rụp 💕' })
            .setTimestamp();

          await newMember.send({ embeds: [dmEmbed] }).catch(() => null);
        } catch {}

        // Gửi thông báo nội bộ cho Admin vào kênh 1563382678378643487
        const adminEmbed = this.buildManualRoleAddAdminLogEmbed(newMember, roleInfo, executor);
        await this.sendAdminLog(guild, adminEmbed);
      }
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi xử lý handleGuildMemberRoleUpdate:', error);
    }
  }
}

