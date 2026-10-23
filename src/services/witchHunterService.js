import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
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
}

export const witchHunterStorage = new WitchHunterStorage();

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
   * Đăng ký gia nhập phe phái
   */
  static async joinFaction(guild, member, chosenFaction) {
    const userId = member.id;
    let userData = witchHunterStorage.getUser(userId);

    // Đã chọn phe trước đó => Chặn tuyệt đối
    if (userData && userData.faction) {
      return {
        success: false,
        alreadyChosen: true,
        faction: userData.faction,
        message: WITCH_HUNTER_CONFIG.messages.alreadyChosen,
      };
    }

    // Nếu chưa có hồ sơ hoặc chưa có phe
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
   * Đồng bộ Role: Gỡ bỏ tất cả Role bậc cũ và cấp Role bậc mới tương ứng theo phe.
   * Tối ưu RAM: Fetch không lưu cache, xử lý ngoại lệ an toàn nếu member thoát hoặc bot thiếu quyền.
   */
  static async syncRankRole(guild, memberOrId, targetRank, targetFaction) {
    try {
      if (!guild) return { success: false, reason: 'NO_GUILD' };

      let member = memberOrId;
      if (typeof memberOrId === 'string') {
        // Tối ưu RAM cực hạn: cache: false giúp giải phóng RAM ngay sau khi thao tác xong
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

      // Tháo role cũ
      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove, 'Witch Hunter: Tự động tháo role bậc cũ khi thăng hạng').catch((err) => {
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
      .setTitle(`${emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽: 𝓑𝓲́ 𝓝𝓰𝓸̂ Đ𝓪̃ Đ𝓮̂́𝓷! ${emojis.titleRight}`)
      .setDescription(
        `Chào bạn **${user.username}** thân mến! Em bot **Usagi múp rụp** mang tin vui tới cho bạn nè 💕\n\n` +
        `🏆 Trong kỳ tổng kết Bảng Xếp Hạng **${thang}**, bạn đã đạt thành tích hoạt động xuất sắc và được ban thưởng:\n` +
        `> ${emojis.pumpkin} **+${pointsAwarded} Bí Ngô** (Hiện tổng tích lũy: **${totalPumpkins}** ${emojis.pumpkin})\n\n` +
        `📜 **LƯU Ý QUAN TRỌNG TỪ HỘI ĐỒNG MA THUẬT:**\n` +
        `Linh hồn của bạn hiện vẫn **chưa ký khế ước gia nhập phe phái** trong thế giới **Witch Hunter**!\n\n` +
        `⚔️ **Hiệp Hội Thợ Săn (W.H. Association)**\n` +
        `🔮 **Hội Phù Thủy (Witches)**\n\n` +
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
}
