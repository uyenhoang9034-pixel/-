import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
import { SUMMON_CONFIG } from '../config/summonConfig.js';
import { witchHunterStorage } from './witchHunterService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const SQLITE_FILE_PATH = path.join(DATA_DIR, 'witch_hunter.sqlite');
const INVENTORY_JSON_PATH = path.join(DATA_DIR, 'witch_hunter_inventory.json');
const PITY_JSON_PATH = path.join(DATA_DIR, 'witch_hunter_summon_pity.json');

class WitchHunterSummonStorage {
  constructor() {
    this.sqliteDb = null;
    this.isSqlite = false;
    this.memoryData = {
      inventory: [], // [{ id, user_id, item_type, item_id, rank, obtained_at }]
      pity: {},      // { [user_id]: { user_id, supporter_pity_a, ... } }
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Khởi tạo SQLite nếu có
      try {
        if (typeof process !== 'undefined' && process.versions && parseInt(process.versions.node) >= 22) {
          import('node:sqlite').then((mod) => {
            const { DatabaseSync } = mod;
            if (DatabaseSync) {
              this.sqliteDb = new DatabaseSync(SQLITE_FILE_PATH);
              this.sqliteDb.exec(`
                CREATE TABLE IF NOT EXISTS user_inventory (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id TEXT NOT NULL,
                  item_type TEXT NOT NULL,
                  item_id TEXT NOT NULL,
                  rank TEXT NOT NULL,
                  obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS summon_pity_tracker (
                  user_id TEXT PRIMARY KEY,
                  supporter_pity_a INTEGER DEFAULT 0,
                  supporter_pity_s INTEGER DEFAULT 0,
                  supporter_pity_ss INTEGER DEFAULT 0,
                  supporter_spent_cycle INTEGER DEFAULT 0,
                  weapon_pity_a INTEGER DEFAULT 0,
                  weapon_pity_s INTEGER DEFAULT 0,
                  weapon_pity_ss INTEGER DEFAULT 0,
                  weapon_spent_cycle INTEGER DEFAULT 0,
                  memory_shards INTEGER DEFAULT 0
                );
              `);
              this.isSqlite = true;
              logger.info('🔮 [WitchHunterSummon] Storage Engine: SQLite đã sẵn sàng.');
            }
          }).catch(() => null);
        }
      } catch (err) {}

      // Nạp JSON backup nếu có
      if (fs.existsSync(INVENTORY_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(INVENTORY_JSON_PATH, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.memoryData.inventory = parsed;
          }
        } catch (e) {}
      }

      if (fs.existsSync(PITY_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(PITY_JSON_PATH, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.memoryData.pity = parsed;
          }
        } catch (e) {}
      }

      this.syncWithPersistentDb().catch(() => null);
    } catch (error) {
      logger.error('❌ [WitchHunterSummon] Lỗi khởi tạo Storage:', error);
    }
  }

  flushJson() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(INVENTORY_JSON_PATH, JSON.stringify(this.memoryData.inventory, null, 2), 'utf-8');
      fs.writeFileSync(PITY_JSON_PATH, JSON.stringify(this.memoryData.pity, null, 2), 'utf-8');
    } catch (err) {
      logger.error('❌ [WitchHunterSummon] Lỗi ghi file backup JSON:', err);
    }
  }

  async syncWithPersistentDb() {
    try {
      const { getFromDb, setInDb } = await import('../utils/database.js');
      const pgInv = await getFromDb('temp:witch_hunter:inventory');
      if (Array.isArray(pgInv) && pgInv.length > 0) {
        this.memoryData.inventory = pgInv;
      } else if (this.memoryData.inventory.length > 0) {
        await setInDb('temp:witch_hunter:inventory', this.memoryData.inventory);
      }

      const pgPity = await getFromDb('temp:witch_hunter:summon_pity');
      if (pgPity && typeof pgPity === 'object') {
        this.memoryData.pity = { ...pgPity, ...this.memoryData.pity };
      } else if (Object.keys(this.memoryData.pity).length > 0) {
        await setInDb('temp:witch_hunter:summon_pity', this.memoryData.pity);
      }
    } catch (err) {}
  }

  schedulePgSave() {
    if (this.pgSaveTimeout) return;
    this.pgSaveTimeout = setTimeout(async () => {
      this.pgSaveTimeout = null;
      try {
        const { setInDb } = await import('../utils/database.js');
        await setInDb('temp:witch_hunter:inventory', this.memoryData.inventory);
        await setInDb('temp:witch_hunter:summon_pity', this.memoryData.pity);
      } catch (err) {}
    }, 500);
  }

  getPityTracker(userId) {
    if (!userId) return null;
    let tracker = this.memoryData.pity[userId];

    if (!tracker && this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare('SELECT * FROM summon_pity_tracker WHERE user_id = ?');
        const row = stmt.get(userId);
        if (row) {
          tracker = {
            user_id: row.user_id,
            supporter_pity_a: Number(row.supporter_pity_a) || 0,
            supporter_pity_s: Number(row.supporter_pity_s) || 0,
            supporter_pity_ss: Number(row.supporter_pity_ss) || 0,
            supporter_spent_cycle: Number(row.supporter_spent_cycle) || 0,
            weapon_pity_a: Number(row.weapon_pity_a) || 0,
            weapon_pity_s: Number(row.weapon_pity_s) || 0,
            weapon_pity_ss: Number(row.weapon_pity_ss) || 0,
            weapon_spent_cycle: Number(row.weapon_spent_cycle) || 0,
            memory_shards: Number(row.memory_shards) || 0,
          };
          this.memoryData.pity[userId] = tracker;
        }
      } catch (e) {}
    }

    if (!tracker) {
      tracker = {
        user_id: userId,
        supporter_pity_a: 0,
        supporter_pity_s: 0,
        supporter_pity_ss: 0,
        supporter_spent_cycle: 0,
        weapon_pity_a: 0,
        weapon_pity_s: 0,
        weapon_pity_ss: 0,
        weapon_spent_cycle: 0,
        memory_shards: 0,
      };
      this.memoryData.pity[userId] = tracker;
    }

    return tracker;
  }

  savePityTracker(tracker) {
    if (!tracker || !tracker.user_id) return;
    this.memoryData.pity[tracker.user_id] = { ...tracker };
    this.flushJson();
    this.schedulePgSave();

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO summon_pity_tracker (
            user_id,
            supporter_pity_a, supporter_pity_s, supporter_pity_ss, supporter_spent_cycle,
            weapon_pity_a, weapon_pity_s, weapon_pity_ss, weapon_spent_cycle,
            memory_shards
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            supporter_pity_a = excluded.supporter_pity_a,
            supporter_pity_s = excluded.supporter_pity_s,
            supporter_pity_ss = excluded.supporter_pity_ss,
            supporter_spent_cycle = excluded.supporter_spent_cycle,
            weapon_pity_a = excluded.weapon_pity_a,
            weapon_pity_s = excluded.weapon_pity_s,
            weapon_pity_ss = excluded.weapon_pity_ss,
            weapon_spent_cycle = excluded.weapon_spent_cycle,
            memory_shards = excluded.memory_shards
        `);
        stmt.run(
          tracker.user_id,
          tracker.supporter_pity_a || 0,
          tracker.supporter_pity_s || 0,
          tracker.supporter_pity_ss || 0,
          tracker.supporter_spent_cycle || 0,
          tracker.weapon_pity_a || 0,
          tracker.weapon_pity_s || 0,
          tracker.weapon_pity_ss || 0,
          tracker.weapon_spent_cycle || 0,
          tracker.memory_shards || 0
        );
      } catch (e) {
        logger.error('❌ [WitchHunterSummon] SQLite savePityTracker error:', e);
      }
    }
  }

  getUserInventory(userId) {
    if (!userId) return [];
    return this.memoryData.inventory.filter((item) => item.user_id === userId);
  }

  hasItem(userId, itemType, itemId) {
    if (!userId || !itemId) return false;
    return this.memoryData.inventory.some(
      (item) => item.user_id === userId && item.item_type === itemType && item.item_id === itemId
    );
  }

  addItemToInventory(userId, itemType, itemId, rank) {
    if (!userId || !itemId) return;
    const entry = {
      id: this.memoryData.inventory.length + 1,
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      rank: rank || 'A',
      obtained_at: new Date().toISOString(),
    };
    this.memoryData.inventory.push(entry);
    this.flushJson();
    this.schedulePgSave();

    if (this.isSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO user_inventory (user_id, item_type, item_id, rank)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(userId, itemType, itemId, rank);
      } catch (e) {
        logger.error('❌ [WitchHunterSummon] SQLite addItemToInventory error:', e);
      }
    }
  }
}

export const witchHunterSummonStorage = new WitchHunterSummonStorage();

export class WitchHunterSummonService {
  // Map lưu trạng thái chọn tế đàn của từng người dùng: Map<userId, 'supporter' | 'weapon'>
  static userSelectedSummonType = new Map();
  // Mutex lock chống double-click click spam
  static activeSummonUsers = new Set();

  static getUserSelectedType(userId) {
    return this.userSelectedSummonType.get(userId) || 'supporter';
  }

  static setUserSelectedType(userId, type) {
    this.userSelectedSummonType.set(userId, type);
  }

  /**
   * Tạo Embed cố định cho Tế Đàn Triệu Gọi Huyết Nguyệt
   */
  static buildSummonDashboardEmbed() {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const sEmojis = SUMMON_CONFIG.emojis;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${sEmojis.titleLeft} ─── ✦ ⟨ **TẾ ĐÀN TRIỆU GỌI HUYẾT NGUYỆT** ⟩ ✦ ─── ${sEmojis.titleRight}`)
      .setDescription(
        `Dưới ánh trăng đỏ rực của Huyết Nguyệt vĩnh hằng, không gian và thời gian bị xé rách! Hãy dâng hiến **Bí Ngô** ${sEmojis.pumpkin} để đánh thức các **Khế Ước Đồng Hành (Supporter)** và **Thần Khí Liên Kết Độc Bản** thượng cổ!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📜 **QUY TẮC CHI PHÍ & TẾ ĐÀN:**\n` +
        `> ${sEmojis.pumpkin} **Quay Lẻ:** \`20 Bí Ngô\` / lượt\n` +
        `> ${sEmojis.pumpkin} **Quay x10:** \`180 Bí Ngô\` / 10 lượt *(Tiết kiệm ngay 10%)*\n` +
        `> 🔒 **Khóa Theo Phe (Faction Lock):** Người chơi thuộc phe nào (*Thợ Săn* hoặc *Phù Thủy*) thì 100% kết quả chỉ quay ra vật phẩm độc quyền của phe đó!\n` +
        `> 🔄 **2 Bể Độc Lập:** Bộ đếm lượt quay và bảo hiểm Pity của **Bể Supporter** và **Bể Vũ Khí** hoàn toàn độc lập với nhau.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎲 **TỈ LỆ TRIỆU HỒI CƠ BẢN:**\n` +
        `> ${sEmojis.rankSS} **Bậc SS-Rank:** \`2.5%\`\n` +
        `> ${sEmojis.rankS} **Bậc S-Rank:** \`12.5%\`\n` +
        `> ${sEmojis.rankA} **Bậc A-Rank:** \`25.0%\`\n` +
        `> ${sEmojis.miss} **Trượt (Không ra vật phẩm):** \`60.0%\` ➔ Nhận ngay **1 Mảnh vỡ ký ức** ${sEmojis.memoryShard} + **Hoàn trả trực tiếp 5 Bí Ngô** ${sEmojis.pumpkin} mỗi lượt!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛡️ **CƠ CHẾ BẢO HIỂM (PITY SYSTEM):**\n` +
        `> 🔹 **Tối đa 20 lượt:** Chắc chắn nổ tối thiểu **1 A-Rank** trở lên.\n` +
        `> 🔸 **Tối đa 30 lượt:** Chắc chắn nổ tối thiểu **1 S-Rank** trở lên.\n` +
        `> 👑 **Tối đa 60 lượt:** Chắc chắn nổ **SS-Rank Tối Cao**! Khi nổ SS, reset bộ đếm phẩm cấp và chu kỳ chi phí về 0.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `♻️ **CƠ CHẾ HOÀN TRẢ BÍ NGÔ KHI TRÙNG:**\n` +
        `> 🎯 **Chạm Trần Pity (Mốc 20/30/60):** Hoàn lại **đúng 80%** tổng số Bí Ngô thực tế người chơi đã bỏ ra trong chu kỳ đó!\n` +
        `> ✨ **Nổ Sớm (Early Drop):** Hoàn lại **đúng 60%** tổng số Bí Ngô thực tế đã bỏ ra từ đầu chu kỳ tính đến lượt vừa nổ!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Chọn tế đàn ở Menu bên dưới và nhấn nút để bắt đầu triệu hồi!*`
      )
      .setFooter({ text: 'Witch Hunter System • Tế Đàn Triệu Gọi Huyết Nguyệt' })
      .setTimestamp();
  }

  /**
   * Tạo các ActionRows gắn kèm Embed Tế Đàn
   */
  static createSummonDashboardComponents(selectedType = 'supporter') {
    const sEmojis = SUMMON_CONFIG.emojis;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_summon_type')
      .setPlaceholder('Chọn tế đàn bạn muốn dâng hiến Bí Ngô...')
      .addOptions([
        {
          label: 'Triệu Hồi Supporter',
          value: 'supporter',
          description: 'Tìm kiếm Khế Ước Đồng Hành (A - S - SS)',
          emoji: '<a:linhtocg:1563399670351536310>',
          default: selectedType === 'supporter',
        },
        {
          label: 'Triệu Hồi Thần Khí',
          value: 'weapon',
          description: 'Rút Thần Khí Liên Kết Độc Bản (A - S - SS)',
          emoji: '<a:trangtrig36:1563065680922808340>',
          default: selectedType === 'weapon',
        },
      ]);

    const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

    const buttonSingle = new ButtonBuilder()
      .setCustomId('btn_summon_single')
      .setLabel('Quay 1 Lần (20 🎃)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('<a:linhtocg:1563399670351536310>');

    const buttonMulti = new ButtonBuilder()
      .setCustomId('btn_summon_multi')
      .setLabel('Quay 10 Lần (180 🎃)')
      .setStyle(ButtonStyle.Success)
      .setEmoji('<a:linhtocg:1563399670351536310>');

    const buttonPity = new ButtonBuilder()
      .setCustomId('btn_view_pity')
      .setLabel('Kiểm Tra Pity')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('<a:trangtrig18:1546068102817775626>');

    const rowButtons = new ActionRowBuilder().addComponents(buttonSingle, buttonMulti, buttonPity);

    return [rowMenu, rowButtons];
  }

  /**
   * Tạo nút quay tiếp gắn kèm tin nhắn kết quả
   */
  static createSummonResultComponents(userId, currentType) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_summon_again_single:${userId}:${currentType}`)
        .setLabel('Quay Tiếp 1 Lần (20 🎃)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('<a:linhtocg:1563399670351536310>'),
      new ButtonBuilder()
        .setCustomId(`btn_summon_again_multi:${userId}:${currentType}`)
        .setLabel('Quay Tiếp 10 Lần (180 🎃)')
        .setStyle(ButtonStyle.Success)
        .setEmoji('<a:linhtocg:1563399670351536310>'),
      new ButtonBuilder()
        .setCustomId(`btn_summon_switch_type:${userId}:${currentType}`)
        .setLabel(currentType === 'supporter' ? 'Đổi Sang Thần Khí' : 'Đổi Sang Supporter')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('<a:trangtrig36:1563065680922808340>')
    );
    return [row];
  }

  /**
   * Xem tiến trình Pity của người dùng
   */
  static buildPityStatusEmbed(userId) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const sEmojis = SUMMON_CONFIG.emojis;
    const tracker = witchHunterSummonStorage.getPityTracker(userId);
    const userData = witchHunterStorage.getUser(userId);

    const factionName = userData?.faction === 'witch'
      ? 'Hội Phù Thủy (Witches)'
      : userData?.faction === 'hunter'
      ? 'Hiệp Hội Thợ Săn (W.H. Association)'
      : 'Chưa Gia Nhập Phe';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${sEmojis.titleLeft} 𝓣𝓲𝓮̂́𝓷 𝓣𝓻𝓲̀𝓷𝓱 𝓑𝓪̉𝓸 𝓗𝓲𝓮̂̉𝓶 𝓟𝓲𝓽𝔂 𝓗𝓾𝔂𝓮̂́𝓽 𝓝𝓰𝓾𝔂𝓮̣̂𝓽 ${sEmojis.titleRight}`)
      .setDescription(
        `👤 **Lữ Khách:** <@${userId}>\n` +
        `⚔️ **Phe Phái:** **${factionName}**\n` +
        `🎃 **Số Dư Bí Ngô:** **${(userData?.pumpkins || 0).toLocaleString('vi-VN')}** ${sEmojis.pumpkin}\n` +
        `💎 **Mảnh Vỡ Ký Ức:** **${(tracker.memory_shards || 0).toLocaleString('vi-VN')}** ${sEmojis.memoryShard}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔮 **BỂ TRIỆU HỒI SUPPORTER:**\n` +
        `> 🔷 **Bảo hiểm A-Rank (Trần 20):** \`${tracker.supporter_pity_a || 0} / 20\` lượt\n` +
        `> 🔸 **Bảo hiểm S-Rank (Trần 30):** \`${tracker.supporter_pity_s || 0} / 30\` lượt\n` +
        `> 👑 **Bảo hiểm SS-Rank (Trần 60):** \`${tracker.supporter_pity_ss || 0} / 60\` lượt\n` +
        `> 💰 **Chi phí tích lũy chu kỳ hiện tại:** \`${(tracker.supporter_spent_cycle || 0).toLocaleString('vi-VN')}\` Bí Ngô\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ **BỂ TRIỆU HỒI THẦN KHÍ:**\n` +
        `> 🔷 **Bảo hiểm A-Rank (Trần 20):** \`${tracker.weapon_pity_a || 0} / 20\` lượt\n` +
        `> 🔸 **Bảo hiểm S-Rank (Trần 30):** \`${tracker.weapon_pity_s || 0} / 30\` lượt\n` +
        `> 👑 **Bảo hiểm SS-Rank (Trần 60):** \`${tracker.weapon_pity_ss || 0} / 60\` lượt\n` +
        `> 💰 **Chi phí tích lũy chu kỳ hiện tại:** \`${(tracker.weapon_spent_cycle || 0).toLocaleString('vi-VN')}\` Bí Ngô\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setFooter({ text: 'Witch Hunter Pity Tracker' })
      .setTimestamp();
  }

  /**
   * Thực hiện triệu hồi (1 lần hoặc 10 lần)
   */
  static async executeSummon({ guild, user, summonType = 'supporter', pullCount = 1 }) {
    const userId = user.id;

    // 1. Kiểm tra race condition
    if (this.activeSummonUsers.has(userId)) {
      return {
        success: false,
        message: '⚠️ Thao tác triệu hồi của bạn đang được xử lý, vui lòng không nhấn nút liên tục!',
      };
    }

    this.activeSummonUsers.add(userId);

    try {
      // 2. Kiểm tra phe phái (Faction Lock)
      const userData = witchHunterStorage.getUser(userId);
      const faction = userData?.faction;

      if (!faction || !['hunter', 'witch'].includes(faction)) {
        this.activeSummonUsers.delete(userId);
        return {
          success: false,
          message: '❌ Lữ khách chưa chọn phe phái! Hãy sử dụng lệnh chọn phe hoặc đến kênh nhận role trước khi dâng hiến Bí Ngô tại Tế Đàn nhé 💕',
        };
      }

      // 3. Kiểm tra số dư Bí Ngô
      const cost = pullCount === 10 ? SUMMON_CONFIG.costs.multi : SUMMON_CONFIG.costs.single;
      const currentPumpkins = Number(userData.pumpkins) || 0;

      if (currentPumpkins < cost) {
        this.activeSummonUsers.delete(userId);
        return {
          success: false,
          message: `❌ Lữ khách không đủ Bí Ngô! Cần **${cost}** ${SUMMON_CONFIG.emojis.pumpkin}, nhưng hiện tại lữ khách chỉ có **${currentPumpkins.toLocaleString('vi-VN')}** ${SUMMON_CONFIG.emojis.pumpkin}. Hãy tích cực tham gia hoạt động để kiếm thêm nhé 💕`,
        };
      }

      // 4. TRỪ TRỰC TIẾP SỐ DƯ BÍ NGÔ CỦA LỮ KHÁCH (Không làm giáng cấp bậc rank đã đạt)
      userData.pumpkins = currentPumpkins - cost;
      userData.updated_at = Date.now();
      witchHunterStorage.saveUser(userData, true);

      // Nạp pity tracker
      const tracker = witchHunterSummonStorage.getPityTracker(userId);
      const costPerPull = pullCount === 10 ? SUMMON_CONFIG.costs.costPerMultiPull : SUMMON_CONFIG.costs.single;

      // Danh mục item tương ứng với phe và loại tế đàn
      const poolItems = SUMMON_CONFIG.pools[faction][summonType];
      const itemsA = poolItems.filter((i) => i.rank === 'A');
      const itemsS = poolItems.filter((i) => i.rank === 'S');
      const itemsSS = poolItems.filter((i) => i.rank === 'SS');

      const results = [];
      let totalRefundPumpkins = 0;
      let totalNewMemoryShards = 0;

      // Tiền tố thuộc tính pity của bể tương ứng
      const pityPrefix = summonType === 'supporter' ? 'supporter' : 'weapon';
      const pityAKey = `${pityPrefix}_pity_a`;
      const pitySKey = `${pityPrefix}_pity_s`;
      const pitySSKey = `${pityPrefix}_pity_ss`;
      const spentCycleKey = `${pityPrefix}_spent_cycle`;

      // 5. VÒNG LẶP TRIỆU HỒI (GACHA LOOP)
      for (let i = 0; i < pullCount; i++) {
        // Tăng bộ đếm pity và chi phí chu kỳ
        tracker[pityAKey] = (tracker[pityAKey] || 0) + 1;
        tracker[pitySKey] = (tracker[pitySKey] || 0) + 1;
        tracker[pitySSKey] = (tracker[pitySSKey] || 0) + 1;
        tracker[spentCycleKey] = (tracker[spentCycleKey] || 0) + costPerPull;

        let selectedRank = null;
        let isCeiling = false;

        // Kiểm tra Pity SS (Trần 60)
        if (tracker[pitySSKey] >= SUMMON_CONFIG.pity.ssCap) {
          selectedRank = 'SS';
          isCeiling = tracker[pitySSKey] === SUMMON_CONFIG.pity.ssCap;
        }
        // Kiểm tra Pity S (Trần 30)
        else if (tracker[pitySKey] >= SUMMON_CONFIG.pity.sCap) {
          const rand = Math.random() * 100;
          if (rand < SUMMON_CONFIG.rates.ss) {
            selectedRank = 'SS';
            isCeiling = false;
          } else {
            selectedRank = 'S';
            isCeiling = tracker[pitySKey] === SUMMON_CONFIG.pity.sCap;
          }
        }
        // Kiểm tra Pity A (Trần 20)
        else if (tracker[pityAKey] >= SUMMON_CONFIG.pity.aCap) {
          const rand = Math.random() * 100;
          if (rand < SUMMON_CONFIG.rates.ss) {
            selectedRank = 'SS';
            isCeiling = false;
          } else if (rand < SUMMON_CONFIG.rates.ss + SUMMON_CONFIG.rates.s) {
            selectedRank = 'S';
            isCeiling = false;
          } else {
            selectedRank = 'A';
            isCeiling = tracker[pityAKey] === SUMMON_CONFIG.pity.aCap;
          }
        }
        // Quay ngẫu nhiên thông thường
        else {
          const rand = Math.random() * 100;
          if (rand < SUMMON_CONFIG.rates.ss) {
            selectedRank = 'SS';
          } else if (rand < SUMMON_CONFIG.rates.ss + SUMMON_CONFIG.rates.s) {
            selectedRank = 'S';
          } else if (rand < SUMMON_CONFIG.rates.ss + SUMMON_CONFIG.rates.s + SUMMON_CONFIG.rates.a) {
            selectedRank = 'A';
          } else {
            selectedRank = 'MISS';
          }
        }

        // XỬ LÝ KẾT QUẢ
        if (selectedRank === 'MISS') {
          // Trượt: Nhận 1 Mảnh vỡ ký ức + Hoàn lại 5 Bí Ngô
          tracker.memory_shards = (tracker.memory_shards || 0) + 1;
          totalNewMemoryShards += 1;
          totalRefundPumpkins += SUMMON_CONFIG.costs.missRefundPumpkins;

          results.push({
            isMiss: true,
            rank: 'MISS',
            name: 'Mảnh Vỡ Ký Ức',
            refund: SUMMON_CONFIG.costs.missRefundPumpkins,
          });
        } else {
          // Trúng item (A, S, SS)
          const targetPool = selectedRank === 'SS' ? itemsSS : selectedRank === 'S' ? itemsS : itemsA;
          const chosenItem = targetPool[Math.floor(Math.random() * targetPool.length)];

          // Kiểm tra xem người chơi đã sở hữu item này chưa
          const alreadyOwned = witchHunterSummonStorage.hasItem(userId, summonType, chosenItem.id);

          if (alreadyOwned) {
            // XỬ LÝ TRÙNG LẶP: Hoàn Bí Ngô theo quy tắc
            const refundRate = isCeiling
              ? SUMMON_CONFIG.pity.ceilingRefundRate // 80%
              : SUMMON_CONFIG.pity.earlyRefundRate;  // 60%

            const refundAmount = Math.max(1, Math.round(tracker[spentCycleKey] * refundRate));
            totalRefundPumpkins += refundAmount;

            results.push({
              isMiss: false,
              isDuplicate: true,
              rank: selectedRank,
              item: chosenItem,
              refund: refundAmount,
              isCeiling,
            });

            // Reset bộ đếm Pity và bộ đếm chi phí tích lũy của rank đó về 0 sau khi hoàn điểm
            if (selectedRank === 'SS') {
              tracker[pitySSKey] = 0;
              tracker[spentCycleKey] = 0;
            } else if (selectedRank === 'S') {
              tracker[pitySKey] = 0;
            } else if (selectedRank === 'A') {
              tracker[pityAKey] = 0;
            }
          } else {
            // TRÚNG ITEM MỚI
            witchHunterSummonStorage.addItemToInventory(userId, summonType, chosenItem.id, selectedRank);

            // Đồng bộ supporter vào unlocked_supporters nếu là summon supporter
            if (summonType === 'supporter') {
              userData.unlocked_supporters = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];
              if (!userData.unlocked_supporters.includes(chosenItem.id)) {
                userData.unlocked_supporters.push(chosenItem.id);
                witchHunterStorage.saveUser(userData, true);
              }
            }

            results.push({
              isMiss: false,
              isDuplicate: false,
              rank: selectedRank,
              item: chosenItem,
              refund: 0,
              isCeiling,
            });

            // Reset bộ đếm pity tương ứng
            if (selectedRank === 'SS') {
              tracker[pitySSKey] = 0;
              tracker[spentCycleKey] = 0;
            } else if (selectedRank === 'S') {
              tracker[pitySKey] = 0;
            } else if (selectedRank === 'A') {
              tracker[pityAKey] = 0;
            }
          }
        }
      }

      // Hoàn lại Bí Ngô (từ các lượt trượt và lượt trùng)
      if (totalRefundPumpkins > 0) {
        userData.pumpkins = (userData.pumpkins || 0) + totalRefundPumpkins;
        userData.updated_at = Date.now();
        witchHunterStorage.saveUser(userData, true);
      }

      // Lưu pity tracker
      witchHunterSummonStorage.savePityTracker(tracker);

      this.activeSummonUsers.delete(userId);

      return {
        success: true,
        pullCount,
        summonType,
        faction,
        cost,
        totalRefundPumpkins,
        totalNewMemoryShards,
        finalPumpkins: userData.pumpkins,
        results,
        tracker,
      };
    } catch (error) {
      this.activeSummonUsers.delete(userId);
      logger.error('❌ [WitchHunterSummon] Lỗi thực hiện triệu hồi:', error);
      return {
        success: false,
        message: `Đã có lỗi bất ngờ xảy ra khi kích hoạt tế đàn: ${error.message}`,
      };
    }
  }

  /**
   * Dựng Embed hiển thị kết quả triệu hồi công khai
   */
  static buildSummonResultEmbed(user, summonResult) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const sEmojis = SUMMON_CONFIG.emojis;
    const { pullCount, summonType, cost, totalRefundPumpkins, finalPumpkins, results, tracker } = summonResult;

    const summonTypeName = summonType === 'supporter' ? 'Khế Ước Đồng Hành (Supporter)' : 'Thần Khí Liên Kết';

    let resultLines = [];
    results.forEach((res, index) => {
      const lineNum = results.length > 1 ? `**#${index + 1}** ` : '';
      if (res.isMiss) {
        resultLines.push(`> ${lineNum}${sEmojis.miss} *Trượt tế đàn* ➔ Nhận 1 Mảnh vỡ ký ức & hoàn lại **+${res.refund}** ${sEmojis.pumpkin}`);
      } else {
        const rankEmoji = res.rank === 'SS' ? sEmojis.rankSS : res.rank === 'S' ? sEmojis.rankS : sEmojis.rankA;
        const rankBadge = `**[${res.rank}-Rank]**`;
        if (res.isDuplicate) {
          const reasonTag = res.isCeiling ? '*(Chạm Trần Pity - Hoàn 80%)*' : '*(Nổ Sớm - Hoàn 60%)*';
          resultLines.push(`> ${lineNum}${rankEmoji} ${rankBadge} **${res.item.name}**\n> ↳ ♻️ *Trùng lặp* ${reasonTag}: Hoàn trả ngay **+${res.refund}** ${sEmojis.pumpkin}`);
        } else {
          resultLines.push(`> ${lineNum}${rankEmoji} ${rankBadge} **${res.item.name}** ✨ **[MỚI]** ➔ *Đã nhập kho lưu trữ!*`);
        }
      }
    });

    const pityPrefix = summonType === 'supporter' ? 'supporter' : 'weapon';
    const pityStr = `🔷 A: \`${tracker[`${pityPrefix}_pity_a`] || 0}/20\` • 🔸 S: \`${tracker[`${pityPrefix}_pity_s`] || 0}/30\` • 👑 SS: \`${tracker[`${pityPrefix}_pity_ss`] || 0}/60\``;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${sEmojis.titleLeft} ─── ✦ ⟨ **KẾT QUẢ TRIỆU HỒI HUYẾT NGUYỆT** ⟩ ✦ ─── ${sEmojis.titleRight}`)
      .setDescription(
        `Lữ khách <@${user.id}> vừa hiến tế Bí Ngô tại tế đàn **${summonTypeName}** (${pullCount} lượt)!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎁 **DANH SÁCH VẬT PHẨM THU ĐƯỢC:**\n` +
        resultLines.join('\n') + '\n' +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 **TỔNG KẾT TÀI NGUYÊN:**\n` +
        `> 📉 **Chi phí:** **-${cost.toLocaleString('vi-VN')}** ${sEmojis.pumpkin}\n` +
        `> 📈 **Hoàn trả:** **+${totalRefundPumpkins.toLocaleString('vi-VN')}** ${sEmojis.pumpkin}\n` +
        `> 🎃 **Số dư hiện tại:** **${finalPumpkins.toLocaleString('vi-VN')}** ${sEmojis.pumpkin}\n` +
        `> 💎 **Mảnh vỡ ký ức:** **${(tracker.memory_shards || 0).toLocaleString('vi-VN')}** ${sEmojis.memoryShard}\n` +
        `> 🛡️ **Bảo hiểm Pity hiện tại:** ${pityStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setFooter({ text: 'Witch Hunter System • Huyết Nguyệt Summon' })
      .setTimestamp();
  }
}
