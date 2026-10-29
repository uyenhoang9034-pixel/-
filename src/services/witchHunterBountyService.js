import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import {
  WITCH_HUNTER_CONFIG,
  getSupporterByRank,
  getWeaponByRank,
  getWeaponById,
  getSupporterById,
} from '../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from './witchHunterService.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const BOUNTY_FILE_PATH = path.join(DATA_DIR, 'witch_hunter_bounty.json');

const RANK_LETTERS = { 1: 'C', 2: 'B', 3: 'A', 4: 'S', 5: 'SS' };

function getVietnamDate() {
  return new Date()
    .toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .reverse()
    .join('-'); // 'YYYY-MM-DD'
}

function getBaseBounty(rank) {
  const r = Math.max(1, Math.min(5, Number(rank) || 1));
  return 30 + (r - 1) * 20;
}

class WitchHunterBountyService {
  constructor() {
    this.data = {
      last_reset_date: null,
      hunted_users: {},
      targets: {
        hunter_board: null, // Bảng ghim ở Doanh Trại Thợ Săn (Treo Cổ Thuật Sĩ Phù Thủy)
        witch_board: null,  // Bảng ghim ở Nghi Thức Trăng Máu (Treo Thần Khí Sĩ Thợ Săn)
      },
      history: [],
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(BOUNTY_FILE_PATH)) {
        const raw = fs.readFileSync(BOUNTY_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = { ...this.data, ...parsed };
        }
      } else {
        this.saveData();
      }
    } catch (err) {
      logger.error('❌ [WitchHunterBounty] Lỗi đọc dữ liệu witch_hunter_bounty.json:', err);
    }
  }

  saveData() {
    try {
      fs.writeFileSync(BOUNTY_FILE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      logger.error('❌ [WitchHunterBounty] Lỗi lưu file witch_hunter_bounty.json:', err);
    }
  }

  /**
   * Khởi tạo cùng Client lúc bot khởi động
   * Phá lệ: Ra thông báo ghim tin nhắn ngay lập tức nếu chưa có bảng hôm nay
   */
  async initClient(client) {
    try {
      const today = getVietnamDate();
      logger.info(`🎯 [WitchHunterBounty] Khởi tạo hệ thống Bảng Truy Nã ngày ${today}...`);

      const guildId = WITCH_HUNTER_CONFIG.guildId || process.env.GUILD_ID;
      let guild = null;
      if (guildId) {
        guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      }
      if (!guild) {
        guild = client.guilds.cache.first();
      }

      if (!guild) {
        logger.warn('⚠️ [WitchHunterBounty] Không tìm thấy Guild để khởi tạo Bảng Truy Nã!');
        return;
      }

      // Kiểm tra nếu chưa có bảng hôm nay hoặc chưa từng khởi tạo -> Khởi tạo & ghim ngay
      const needsHunterBoard = !this.data.targets?.hunter_board?.message_id || this.data.targets?.hunter_board?.is_defeated;
      const needsWitchBoard = !this.data.targets?.witch_board?.message_id || this.data.targets?.witch_board?.is_defeated;

      if (needsHunterBoard || needsWitchBoard || this.data.last_reset_date !== today) {
        await this.ensureBountyBoards(guild, false);
      }
    } catch (error) {
      logger.error('❌ [WitchHunterBounty] Lỗi initClient:', error);
    }
  }

  /**
   * Quét reset hằng ngày vào 00:00
   */
  async processDailyReset(client) {
    try {
      const today = getVietnamDate();
      logger.info(`🔄 [WitchHunterBounty] Bắt đầu quét 00:00 hằng ngày cho Bảng Truy Nã (${today})...`);

      const guildId = WITCH_HUNTER_CONFIG.guildId || process.env.GUILD_ID;
      let guild = null;
      if (guildId) {
        guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      }
      if (!guild) {
        guild = client.guilds.cache.first();
      }

      if (!guild) {
        logger.warn('⚠️ [WitchHunterBounty] Không tìm thấy Guild khi thực hiện Daily Reset!');
        return;
      }

      await this.ensureBountyBoards(guild, true);
    } catch (error) {
      logger.error('❌ [WitchHunterBounty] Lỗi processDailyReset:', error);
    }
  }

  /**
   * Đảm bảo và cập nhật bảng truy nã 2 phe
   * @param {Guild} guild
   * @param {boolean} isMidnightReset - True nếu là quét 00:00, False nếu là khởi tạo lúc bot bật
   */
  async ensureBountyBoards(guild, isMidnightReset = false) {
    const today = getVietnamDate();
    this.data.last_reset_date = today;

    // 1. Xử lý Bảng Phe Thợ Săn (Kênh: 1563385216800657479 - Doanh Trại Hiệp Hội, Treo Phù Thủy)
    await this.setupSingleBoard({
      guild,
      boardKey: 'hunter_board',
      targetFaction: 'witch',
      channelId: WITCH_HUNTER_CONFIG.channels.hunterChannelId,
      isMidnightReset,
      today,
    });

    // 2. Xử lý Bảng Phe Phù Thủy (Kênh: 1563385150660808846 - Nghi Thức Trăng Máu, Treo Thợ Săn)
    await this.setupSingleBoard({
      guild,
      boardKey: 'witch_board',
      targetFaction: 'hunter',
      channelId: WITCH_HUNTER_CONFIG.channels.witchChannelId,
      isMidnightReset,
      today,
    });

    this.saveData();
  }

  /**
   * Thiết lập 1 bảng truy nã riêng cho 1 phe
   */
  async setupSingleBoard({ guild, boardKey, targetFaction, channelId, isMidnightReset, today }) {
    try {
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased()) {
        logger.warn(`⚠️ [WitchHunterBounty] Không tìm thấy kênh ${channelId} cho ${boardKey}!`);
        return;
      }

      let board = this.data.targets[boardKey];

      // LOGIC CHỌN MỤC TIÊU:
      // Nếu là 00:00:
      //  - Nếu mục tiêu cũ CHƯA BỊ HẠ GỤC: Giữ nguyên mục tiêu, cộng dồn +5 🎃
      //  - Nếu mục tiêu cũ ĐÃ BỊ HẠ GỤC (hoặc chưa từng có): Chọn ngẫu nhiên mục tiêu mới
      if (isMidnightReset && board && !board.is_defeated && board.target_user_id) {
        board.bonus_bounty = (Number(board.bonus_bounty) || 0) + 5;
        board.total_bounty = (Number(board.base_bounty) || 30) + board.bonus_bounty;
        logger.info(`🎯 [WitchHunterBounty] Mục tiêu ${board.target_user_id} sống sót qua ngày! Cộng dồn +5 Bí Ngô (Tổng: ${board.total_bounty} 🎃)`);
      } else if (!board || board.is_defeated || !board.target_user_id) {
        // Chọn ngẫu nhiên thành viên phe đối địch
        const targetUserRecord = await this.pickRandomTarget(guild, targetFaction);
        if (!targetUserRecord) {
          logger.warn(`⚠️ [WitchHunterBounty] Không tìm thấy thành viên phù hợp thuộc phe ${targetFaction} để treo thưởng!`);
          return;
        }

        const rank = targetUserRecord.current_rank || 1;
        const baseBounty = getBaseBounty(rank);

        board = {
          target_user_id: targetUserRecord.user_id,
          target_faction: targetFaction,
          target_rank: rank,
          base_bounty: baseBounty,
          bonus_bounty: 0,
          total_bounty: baseBounty,
          is_defeated: false,
          defeated_by: null,
          message_id: null,
          channel_id: channelId,
          date_assigned: today,
        };
        this.data.targets[boardKey] = board;
      }

      // Gỡ ghim và xóa tin nhắn cũ của ngày hôm trước
      if (board.message_id) {
        try {
          const oldMsg = await channel.messages.fetch(board.message_id).catch(() => null);
          if (oldMsg) {
            await oldMsg.unpin().catch(() => null);
            await oldMsg.delete().catch(() => null);
          }
        } catch (e) {
          logger.debug(`[WitchHunterBounty] Không thể xóa tin nhắn cũ ${board.message_id}:`, e.message);
        }
      }

      // Tạo Embed và Nút bấm theo đúng mẫu giao diện duyệt
      const targetMember = await guild.members.fetch(board.target_user_id).catch(() => null);
      const targetUser = targetMember?.user || (await guild.client.users.fetch(board.target_user_id).catch(() => null));

      const embed = this.buildBountyEmbed({
        boardKey,
        targetUser,
        targetFaction,
        board,
      });

      const buttonRow = this.createBountyButtonRow();

      // Gửi tin nhắn mới và ghim lên kênh
      const newMsg = await channel.send({
        embeds: [embed],
        components: [buttonRow],
      });

      await newMsg.pin().catch(() => null);
      board.message_id = newMsg.id;

      // Xóa tin nhắn hệ thống ghim tự động để kênh luôn gọn gàng
      try {
        const pinNotifs = await channel.messages.fetch({ limit: 5 }).catch(() => null);
        if (pinNotifs) {
          const sysPin = pinNotifs.find((m) => m.system && m.type === 6); // ChannelPinnedMessage
          if (sysPin) await sysPin.delete().catch(() => null);
        }
      } catch {}

      logger.info(`✅ [WitchHunterBounty] Đã ghim thành công Bảng Truy Nã mới (${boardKey}) tại <#${channelId}>!`);
    } catch (err) {
      logger.error(`❌ [WitchHunterBounty] Lỗi setupSingleBoard (${boardKey}):`, err);
    }
  }

  /**
   * Chọn ngẫu nhiên 1 thành viên theo role phe phái
   */
  async pickRandomTarget(guild, faction) {
    try {
      const allUsers = witchHunterStorage.getAllUsers();
      const factionUsers = allUsers.filter((u) => u.faction === faction);

      // Ưu tiên thành viên trong database còn đang ở trong máy chủ
      const validCandidates = [];
      for (const u of factionUsers) {
        const member = guild.members.cache.get(u.user_id) || (await guild.members.fetch(u.user_id).catch(() => null));
        if (member && !member.user.bot) {
          validCandidates.push(u);
        }
      }

      if (validCandidates.length > 0) {
        const randomIndex = Math.floor(Math.random() * validCandidates.length);
        return validCandidates[randomIndex];
      }

      // Dự phòng: Quét qua Role Discord nếu database chưa có người
      const roleMap = faction === 'hunter' ? WITCH_HUNTER_CONFIG.roles.hunter : WITCH_HUNTER_CONFIG.roles.witch;
      const roleCandidates = [];

      for (const [rStr, rId] of Object.entries(roleMap)) {
        const role = guild.roles.cache.get(rId) || (await guild.roles.fetch(rId).catch(() => null));
        if (role) {
          for (const [, m] of role.members) {
            if (!m.user.bot) {
              roleCandidates.push({
                user_id: m.id,
                faction,
                current_rank: Number(rStr) || 1,
                pumpkins: 0,
              });
            }
          }
        }
      }

      if (roleCandidates.length > 0) {
        const randomIndex = Math.floor(Math.random() * roleCandidates.length);
        return roleCandidates[randomIndex];
      }

      return null;
    } catch (err) {
      logger.error('❌ [WitchHunterBounty] Lỗi pickRandomTarget:', err);
      return null;
    }
  }

  /**
   * Dựng Embed Bảng Truy Nã chuẩn xác 100% theo giao diện người dùng yêu cầu
   */
  buildBountyEmbed({ boardKey, targetUser, targetFaction, board }) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    const rankNum = board.target_rank || 1;
    const rankLetter = RANK_LETTERS[rankNum] || 'C';
    const rankInfo = WitchHunterService.getRankInfo(targetFaction, rankNum);

    const isTargetWitch = targetFaction === 'witch';

    // Trang bị hiện tại
    const supp = WitchHunterService.getEquippedSupporter(board.target_user_id) || getSupporterByRank(targetFaction, rankNum);
    const suppTier = supp?.rank ? RANK_LETTERS[supp.rank] : rankLetter;
    const suppName = supp?.name || 'Chưa liên kết';

    const wep = WitchHunterService.getEquippedWeapon(board.target_user_id) || getWeaponByRank(targetFaction, rankNum);
    const wepTier = wep?.rank ? RANK_LETTERS[wep.rank] : rankLetter;
    const wepName = wep?.name || 'Vũ khí cơ bản';
    const wepEmoji = wep?.energyEmoji || (isTargetWitch ? '<a:whg3:1564146083372990484>' : '<:wh3:1563432304179945563>');

    // Kiểm tra Cộng Hưởng Đồng Bộ Khế Ước
    const resonance = WitchHunterService.checkResonance(board.target_user_id);
    const resonanceLine = resonance.isResonance
      ? `\n> <a:trangtrig6:1546043036390260756> Kích hoạt: Cộng Hưởng Đồng Bộ Khế Ước (x1.5 Bạo Kích)`
      : '';

    // Dữ liệu Bí Ngô
    const totalBounty = board.total_bounty || board.base_bounty || 30;
    const baseBounty = board.base_bounty || 30;
    const bonusBounty = board.bonus_bounty || 0;

    let title = '';
    let intro = '';
    let conditionLine = '';
    let factionEmoji = '';

    if (boardKey === 'hunter_board') {
      // Treo ở kênh Hiệp Hội Thợ Săn: Truy nã Cổ Thuật Sĩ (Phù Thủy)
      title = `${emojis.titleLeft} **LỆNH TRUY NÃ CỔ THUẬT SĨ: PHÙ THỦY THA HÓA** ${emojis.titleRight}`;
      intro =
        `Hiệp Hội Thợ Săn phát lệnh truy nã đặc biệt! Mục tiêu mang theo tà thuật hắc ám đang lẩn khuất tại ranh giới chiến trường. Hãy nhanh chóng tiêu diệt để đoạt lấy chiến công Bí Ngô!`;
      conditionLine = `> • Điều kiện: Chỉ **Thần Khí Sĩ (Thợ Săn)** mới được nhận lệnh săn mục tiêu này.`;
      factionEmoji = emojis.witchButton; // Icon phù thủy cho mục tiêu
    } else {
      // Treo ở kênh Nghi Thức Trăng Máu: Truy nã Thần Khí Sĩ (Thợ Săn)
      title = `${emojis.titleLeft} **LỆNH TRUY NÃ THẦN KHÍ SĨ: THỢ SĂN LƯU VONG** ${emojis.titleRight}`;
      intro =
        `Hội Phù Thủy ban chiếu treo thưởng Huyết Nguyệt! Một Thần Khí Sĩ nguy hiểm của Hiệp Hội đang thâm nhập lãnh địa cấm kỵ. Hãy dùng ma chú phong ấn kẻ này để đoạt lấy tinh hoa Bí Ngô!`;
      conditionLine = `> • Điều kiện: Chỉ **Cổ Thuật Sĩ (Phù Thủy)** mới được nhận lệnh săn mục tiêu này.`;
      factionEmoji = emojis.hunterButton; // Icon thợ săn cho mục tiêu
    }

    const description =
      `${intro}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `<a:trangtrig4:1546041273813827645> MỤC TIÊU BỊ TRUY NÃ:\n` +
      `> <@${board.target_user_id}> (\`${targetUser?.username || 'Unknown'}\` | ID: \`${board.target_user_id}\`)\n\n` +
      `<a:trangtrig4:1546041273813827645> DANH VỊ & CẤP BẬC:\n` +
      `> ${factionEmoji} ${rankInfo?.name || `Bậc ${rankNum}`} • **Bậc ${rankLetter}**\n\n` +
      `<a:trangtrig4:1546041273813827645> TRANG BỊ HIỆN TẠI:\n` +
      `> <a:linhtocg:1563399670351536310> Supporter: ${suppName} *Cấp ${suppTier}*\n` +
      `> ${wepEmoji} Vũ Khí: ${wepName} *Cấp ${wepTier}*${resonanceLine}\n\n` +
      `${emojis.pumpkin} TIỀN THƯỞNG BÍ NGÔ HIỆN TẠI:\n` +
      `> ${emojis.pumpkin} **${totalBounty} Bí Ngô** (Gốc ${baseBounty} ${emojis.pumpkin} + ${bonusBounty} ${emojis.pumpkin} tích lũy sống sót)\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<a:knifeg1:1546058092016312381> QUY TẮC CHIẾN ĐẤU:\n` +
      `${conditionLine}\n` +
      `> • Giới hạn: Mỗi chiến binh chỉ được tham gia chiến đấu **1 lần / ngày**.\n` +
      `> • Quy luật: Hạ gục nhận trọn vẹn **${totalBounty}** ${emojis.pumpkin}. Thất bại nhận an ủi **+2** ${emojis.pumpkin}.`;

    const avatarUrl =
      targetUser?.displayAvatarURL?.({ dynamic: true, size: 256 }) ||
      targetUser?.avatarURL?.({ dynamic: true, size: 256 }) ||
      'https://cdn.discordapp.com/embed/avatars/0.png';

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu pastel giữ nguyên
      .setTitle(title)
      .setDescription(description)
      .setThumbnail(avatarUrl)
      .setFooter({
        text: 'Bảng Truy Nã Chiến Trường • Cập nhật tự động • Hôm nay lúc 00:00',
      })
      .setTimestamp();

    return embed;
  }

  /**
   * ActionRow chứa Nút Duy Nhất màu xám theo yêu cầu
   */
  createBountyButtonRow() {
    const button = new ButtonBuilder()
      .setCustomId('witch_hunter_bounty_hunt')
      .setLabel('Nhận Lệnh Truy Nã')
      .setEmoji('<a:whg2:1564145798537683034>')
      .setStyle(ButtonStyle.Secondary); // Nút màu xám theo đúng yêu cầu

    return new ActionRowBuilder().addComponents(button);
  }

  /**
   * Kiểm tra người dùng đã tham gia săn hôm nay chưa
   */
  hasHuntedToday(userId, dateStr) {
    const list = this.data.hunted_users[dateStr] || [];
    return list.includes(userId);
  }

  /**
   * Đánh dấu người dùng đã săn trong ngày
   */
  markUserHunted(userId, dateStr) {
    if (!this.data.hunted_users[dateStr]) {
      this.data.hunted_users[dateStr] = [];
    }
    if (!this.data.hunted_users[dateStr].includes(userId)) {
      this.data.hunted_users[dateStr].push(userId);
      this.saveData();
    }
  }

  /**
   * Xử lý tương tác khi người chơi nhấn nút [ Nhận Lệnh Truy Nã ]
   */
  async handleHuntInteraction(interaction, client) {
    try {
      const { channelId, user, guild } = interaction;
      const today = getVietnamDate();
      const { emojis, colors } = WITCH_HUNTER_CONFIG;

      // 1. Kiểm tra giới hạn 1 lần / ngày
      if (this.hasHuntedToday(user.id, today)) {
        return interaction.reply({
          content: `<a:bang2:1546891483250954290> Hôm nay lữ khách đã tham gia săn thưởng rồi ạ! Mỗi ngày mỗi chiến binh chỉ được nhận **1** lệnh truy nã duy nhất thôi nè. Hãy quay lại sau 00:00 nha! <a:heartg1:1545307544808071258>`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // 2. Xác định bảng truy nã tương ứng theo kênh
      let boardKey = null;
      let hunterFaction = null;
      let targetFaction = null;

      if (channelId === WITCH_HUNTER_CONFIG.channels.hunterChannelId) {
        boardKey = 'hunter_board';
        hunterFaction = 'hunter';
        targetFaction = 'witch';
      } else if (channelId === WITCH_HUNTER_CONFIG.channels.witchChannelId) {
        boardKey = 'witch_board';
        hunterFaction = 'witch';
        targetFaction = 'hunter';
      } else {
        // Nếu dùng ở kênh khác
        return interaction.reply({
          content: '❌ Lệnh truy nã này không hợp lệ tại kênh hiện tại!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const board = this.data.targets[boardKey];
      if (!board || !board.target_user_id) {
        return interaction.reply({
          content: '❌ Hiện tại chưa có mục tiêu truy nã nào trên chiến trường!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (board.is_defeated) {
        return interaction.reply({
          content: '❌ Mục tiêu này đã bị chiến binh khác hạ gục rồi! Hãy chờ đến 00:00 để nhận lệnh mới nhé 💕',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Đánh dấu đã săn hôm nay ngay lập tức (chống double click / race condition)
      this.markUserHunted(user.id, today);

      // 3. Phân định tỷ lệ chiến đấu
      const hunterProfile = WitchHunterService.getUserProfile(user.id);
      const hunterRank = hunterProfile?.current_rank || 1;
      const targetRank = board.target_rank || 1;

      const hunterLetter = RANK_LETTERS[hunterRank] || 'C';
      const targetLetter = RANK_LETTERS[targetRank] || 'C';

      // Kiểm tra Cộng Hưởng của kẻ đi săn
      const hunterResonance = WitchHunterService.checkResonance(user.id);
      const hasResonance = hunterResonance.isResonance;

      let isWin = false;
      let situationalText = '';

      if (hunterRank < targetRank) {
        // Bậc thấp đánh Bậc cao: 90% Thua — 10% Thắng
        isWin = Math.random() < 0.10;
        situationalText = `Bậc ${hunterLetter} đánh Bậc ${targetLetter} (90% Thất Bại — Chênh lệch cảnh giới)`;
      } else if (hunterRank === targetRank) {
        // Bậc ngang nhau: 50% Thắng / 50% Thua (Có cộng hưởng: 53% Thắng / 47% Thua)
        const winChance = hasResonance ? 0.53 : 0.50;
        isWin = Math.random() < winChance;
        situationalText = hasResonance
          ? `Cấp Bậc Ngang Nhau (53% Thắng nhờ Cộng Hưởng Đồng Bộ Khế Ước)`
          : `Cấp Bậc Ngang Nhau (50% Thắng — 50% Thua)`;
      } else {
        // Bậc cao đánh Bậc thấp: Thắng áp đảo
        isWin = Math.random() < 0.90;
        situationalText = `Bậc ${hunterLetter} áp đảo Bậc ${targetLetter} (Thắng Áp Đảo Cảnh Giới)`;
      }

      const totalBounty = board.total_bounty || board.base_bounty || 30;

      // Danh xưng và emoji đại diện phe
      const isHunterFaction = hunterFaction === 'hunter';
      const hunterFactionEmoji = isHunterFaction ? emojis.hunterButton : emojis.witchButton;
      const hunterTitle = isHunterFaction ? 'Thần Khí Sĩ (Thợ Săn)' : 'Cổ Thuật Sĩ (Phù Thủy)';
      const targetTitle = isHunterFaction ? 'Cổ Thuật Sĩ' : 'Thần Khí Sĩ';

      // ────────────────────────────────────────────────────────────
      // TRƯỜNG HỢP 1: THẮNG TRẬN
      // ────────────────────────────────────────────────────────────
      if (isWin) {
        board.is_defeated = true;
        board.defeated_by = user.id;
        this.saveData();

        // Trao trọn vẹn số Bí Ngô tiền thưởng cho kẻ săn
        await WitchHunterService.awardPumpkins(guild, user.id, totalBounty, {
          reason: `Hoàn thành Lệnh Truy Nã Chiến Trường (Hạ gục <@${board.target_user_id}>)`,
          source: 'Bảng Truy Nã',
          notifyDM: true,
          notifyAdminLog: true,
        }).catch((err) => logger.error('❌ [WitchHunterBounty] Lỗi trao thưởng Bí Ngô:', err));

        // Phản hồi interaction để tránh lỗi Discord
        await interaction.reply({
          content: `🎉 Chúc mừng lữ khách <@${user.id}> đã hoàn thành xuất sắc Lệnh Truy Nã! Đoạt lấy **+${totalBounty} Bí Ngô** ${emojis.pumpkin}!`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);

        // Gỡ ghim và xóa luôn tin nhắn Bảng Truy Nã khỏi kênh theo đúng yêu cầu
        if (board.message_id) {
          try {
            const oldMessage = await interaction.channel.messages.fetch(board.message_id).catch(() => null);
            if (oldMessage) {
              await oldMessage.unpin().catch(() => null);
              await oldMessage.delete().catch(() => null);
            }
          } catch (delErr) {
            logger.warn('⚠️ [WitchHunterBounty] Không thể xóa tin nhắn truy nã cũ:', delErr.message);
          }
        }

        // Gửi thông báo vinh danh công khai tại kênh
        const winEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(`${emojis.titleLeft} **TRUY NÃ THÀNH CÔNG: MỤC TIÊU ĐÃ BỊ HẠ GỤC!** ${emojis.titleRight}`)
          .setDescription(
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${hunterFactionEmoji} ${isHunterFaction ? 'Thợ săn' : 'Phù thủy'} <@${user.id}> đã xuất kiếm áp đảo, đánh bại hoàn toàn ${targetTitle} <@${board.target_user_id}> trong trận chiến sinh tử!\n\n` +
            `> <a:trangtrig1:1546040442548654140> Tình thế giao tranh: ${situationalText}\n` +
            `> <a:giftg1:1543150714732412948> Phần Thưởng Đoạt Được: +${totalBounty} Bí Ngô ${emojis.pumpkin} *(Đã cộng trực tiếp vào túi đồ)*\n` +
            `> <a:knifeg1:1546058092016312381> Trạng Thái Lệnh: Mục tiêu đã bị tiêu diệt! Bảng truy nã đã hoàn thành sứ mệnh.\n\n` +
            `<a:trangtrig41:1547238037832863744> Hệ thống đã gỡ ghim và xóa bảng truy nã khỏi kênh. Ngày mai (00:00) sẽ chọn mục tiêu mới!`
          )
          .setTimestamp();

        await interaction.channel.send({ embeds: [winEmbed] }).catch(() => null);
        return;
      }

      // ────────────────────────────────────────────────────────────
      // TRƯỜNG HỢP 2: THUA TRẬN (MỤC TIÊU PHÒNG THỦ THÀNH CÔNG)
      // ────────────────────────────────────────────────────────────
      // Trao an ủi +2 Bí Ngô vì đã tham gia chiến đấu
      await WitchHunterService.awardPumpkins(guild, user.id, 2, {
        reason: 'Phần thưởng an ủi tham gia Lệnh Truy Nã Chiến Trường',
        source: 'Bảng Truy Nã',
        notifyDM: false,
        notifyAdminLog: false,
      }).catch((err) => logger.error('❌ [WitchHunterBounty] Lỗi trao Bí Ngô an ủi:', err));

      const lossEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **TRUY NÃ THẤT BẠI: MỤC TIÊU ĐÃ TẨU THOÁT!** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:shockg1:1541433028193165312> ${targetTitle} <@${board.target_user_id}> đã dựng kết giới hắc ma thuật cực mạnh, đánh bật đòn tấn công của <@${user.id}>!\n\n` +
          `> <a:trangtrig1:1546040442548654140> Tình thế giao tranh: ${situationalText}\n` +
          `> <a:giftg1:1543150714732412948> Phần Thưởng An Ủi: +2 Bí Ngô ${emojis.pumpkin} *(Cống hiến tham gia chiến đấu)*\n` +
          `> <a:knifeg1:1546058092016312381> Trạng Thái Lệnh: Mục tiêu vẫn sống sót! Bảng truy nã được giữ nguyên trên kênh để chiến binh khác tiếp tục săn.\n\n` +
          `Lữ khách đã sử dụng hết **1** lượt săn của ngày hôm nay. Hãy quay lại vào 00:00 ngày mai nhé! <a:heartg1:1545307544808071258>`
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [lossEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterBounty] Lỗi handleHuntInteraction:', error);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `Đã xảy ra lỗi khi tham gia săn thưởng: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  }
}

export const witchHunterBountyService = new WitchHunterBountyService();
export { WitchHunterBountyService };
