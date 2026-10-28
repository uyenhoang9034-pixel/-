import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  WITCH_HUNTER_CONFIG,
  WITCH_HUNTER_RESONANCE_MAP,
  getSupporterById,
  getWeaponById,
} from '../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from './witchHunterService.js';
import { logger } from '../utils/logger.js';

/**
 * Cấu hình 3 Khu Vực Viễn Chinh Ranh Giới Hắc Ám
 */
export const EXPEDITION_ZONES = {
  zone_1: {
    id: 'zone_1',
    name: 'Vụ Giới Phế Tích (Mistveil Ruins)',
    shortName: 'Vụ Giới Phế Tích',
    emoji: '🌫️',
    minHp: 50, // PHẢI TRÊN 50%
    minRankLetter: 'C',
    minRankTier: 1,
    counterCategory: 'linhToc',
    counterCategoryName: 'Hệ Linh Tộc',
    counterEmoji: '<a:linhtocg:1563399670351536310>',
    counterFlavor: 'Khứu giác & linh lực xua tan sương mù ➔ Giảm 10% giờ',
    dangerLevel: 'Sơ cấp (100% THÀNH CÔNG)',
    rates: {
      default: 1.0,
    },
    rewards: {
      success: {
        minPumpkins: 2,
        maxPumpkins: 2,
        minShards: 20,
        maxShards: 20,
        minTickets: 0,
        maxTickets: 0,
        hpLoss: 0,
      },
      failure: {
        minPumpkins: 0,
        maxPumpkins: 0,
        hpLoss: 0,
      },
    },
  },
  zone_2: {
    id: 'zone_2',
    name: 'Vực Cổ Khắc Tro Tàn (Cinder Ash Chasm)',
    shortName: 'Vực Cổ Khắc Tro Tàn',
    emoji: '🌋',
    minHp: 50, // PHẢI TRÊN 50%
    minRankLetter: 'C',
    minRankTier: 1,
    counterCategory: 'camKhi',
    counterCategoryName: 'Hệ Cấm Khí',
    counterEmoji: '<a:camkhig:1563399321125134346>',
    counterFlavor: 'Cơ quan cổ kháng hỏa ngục ➔ Giảm 10% giờ',
    dangerLevel: 'Trung cấp (Thất bại trừ 30% HP)',
    rates: {
      C: 0.20,
      B: 0.20,
      A: 0.80,
      S: 0.80,
      SS: 0.80,
    },
    rewards: {
      success: {
        minPumpkins: 5,
        maxPumpkins: 5,
        minShards: 30,
        maxShards: 30,
        minTickets: 0,
        maxTickets: 0,
        hpLoss: 0,
      },
      failure: {
        minPumpkins: 2,
        maxPumpkins: 2,
        minShards: 0,
        maxShards: 0,
        minTickets: 0,
        maxTickets: 0,
        hpLoss: 30,
      },
    },
  },
  zone_3: {
    id: 'zone_3',
    name: 'Vực Thẳm Hư Vô Tận (Abyssal Oblivion)',
    shortName: 'Vực Thẳm Hư Vô Tận',
    emoji: '🌌',
    minHp: 90, // PHẢI TRÊN 90%
    minRankLetter: 'C',
    minRankTier: 1,
    counterCategory: 'nguyenThe',
    counterCategoryName: 'Hệ Nguyền Thể',
    counterEmoji: '<a:nguyentheg:1563399515732443177>',
    counterFlavor: 'Oán niệm tương thích Hư Không ➔ Giảm 10% giờ',
    dangerLevel: 'Tuyệt Diệt (Thất bại trừ 90% HP)',
    rates: {
      C: 0.01,
      B: 0.01,
      A: 0.01,
      S: 0.10,
      SS: 0.50,
    },
    rewards: {
      success: {
        minPumpkins: 10,
        maxPumpkins: 10,
        minShards: 100,
        maxShards: 100,
        minTickets: 2,
        maxTickets: 2,
        hpLoss: 0,
      },
      failure: {
        minPumpkins: 5,
        maxPumpkins: 5,
        minShards: 0,
        maxShards: 0,
        minTickets: 0,
        maxTickets: 0,
        hpLoss: 90,
      },
    },
  },
};

// Lưu tạm thời bản nháp lựa chọn của người chơi khi mở menu điều phối
const userExpeditionDrafts = new Map();

export class WitchHunterExpeditionService {
  /**
   * Helper lấy draft lựa chọn hiện tại của người dùng
   */
  static getUserDraft(userId) {
    if (!userExpeditionDrafts.has(userId)) {
      userExpeditionDrafts.set(userId, {
        zoneId: 'zone_1',
        supporterId: null,
      });
    }
    return userExpeditionDrafts.get(userId);
  }

  /**
   * Helper cập nhật draft
   */
  static setUserDraft(userId, draftUpdate) {
    const current = this.getUserDraft(userId);
    const updated = { ...current, ...draftUpdate };
    userExpeditionDrafts.set(userId, updated);
    return updated;
  }

  /**
   * Xóa draft
   */
  static clearUserDraft(userId) {
    userExpeditionDrafts.delete(userId);
  }

  /**
   * Helper parse Discord Emoji string sang định dạng component
   */
  static parseEmoji(emojiStr) {
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
  }

  /**
   * 1. BẢNG ĐIỀU KHIỂN CỐ ĐỊNH (Dashboard Embed)
   */
  static buildExpeditionDashboardEmbed() {
    const { colors, emojis } = WITCH_HUNTER_CONFIG;
    const pumpkinEmoji = emojis?.pumpkin || '<a:bingo:1563061901800243253>';
    const shardEmoji = emojis?.memoryShard || emojis?.decor46 || '<a:trangtrig46:1547240249761996812>';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(
        '<a:trangtrig2:1546040703375904801> **VIỄN CHINH: RANH GIỚI HẮC ÁM (IDLE EXPEDITION)** <a:trangtrig3:1546040818261954610>'
      )
      .setDescription(
        `Nơi giao thoa giữa cõi thực và vết nứt Hư Không sâu thẳm. Hãy phái các **Supporter** đồng hành cùng Thần Binh tiến vào các vùng phế tích cổ xưa để thu thập Bí Ngô, Mảnh Ký Ức và Vé Tế Đàn!\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig18:1546068102817775626> **QUY CHUẨN THÁM HIỂM:**\n` +
          `• Thời gian cố định: **3 TIẾNG** cho mỗi lượt thám hiểm.\n` +
          `• Đặc ân Viễn Chinh: Trong lúc đi viễn chinh, Supporter VẪN THAM GIA DUEL BÌNH THƯỜNG!\n` +
          `• Hồi phục Sinh Lực: Supporter tự động hồi phục **+10% HP sau mỗi 1 giờ** (tối đa 100%).\n` +
          `• Cơ chế Khắc Hệ Môi Trường: Mang đúng Hệ Tộc khắc chế khu vực sẽ **rút ngắn 10% thời gian** (còn **2 giờ 42 phút**)! \n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig18:1546068102817775626> **DANH SÁCH 3 VÙNG ĐẤT NGUY HIỂM:**\n\n` +
          `<a:whg1:1563430946835931187> 1. VỤ GIỚI PHẾ TÍCH (Mistveil Ruins)\n` +
          `<a:bang2:1546891483250954290> Yêu cầu: Supporter **Bậc C trở lên** + Sinh lực **> 50% HP**\n` +
          `<a:trangtrig29:1546385117478527016> Khắc hệ: <a:linhtocg:1563399670351536310> Hệ Linh Tộc\n` +
          `> Khứu giác & linh lực xua tan sương mù ➔ Giảm 10% giờ\n` +
          `<a:giftg1:1543150714732412948> Thành công: 2 Bí Ngô ${pumpkinEmoji} + 20 Mảnh Ký Ức ${shardEmoji}\n\n` +
          `<a:whg1:1563430946835931187> 2. VỰC CỔ KHẮC TRO TÀN (Cinder Ash Chasm)\n` +
          `<a:bang2:1546891483250954290> Yêu cầu: Supporter **Bậc C trở lên** + Sinh lực **> 50% HP**\n` +
          `<a:bang2:1546891483250954290> Tỉ lệ thành công:\n` +
          `> Supporter Bậc A trở lên: 80% Thành công — 20% Thất bại\n` +
          `> Supporter Bậc B - C: 20% Thành công — 80% Thất bại\n` +
          `> ${shardEmoji} Kích hoạt Cộng Hưởng Thần Binh: **+2% Tỉ lệ Thành công**\n` +
          `<a:trangtrig29:1546385117478527016> Khắc hệ: <a:camkhig:1563399321125134346> Hệ Cấm Khí\n` +
          `> Cơ quan cổ kháng hỏa ngục ➔ Giảm 10% giờ\n` +
          `<a:giftg1:1543150714732412948> Thu hoạch:\n` +
          `> <a:giftg1:1543150714732412948> Thành công: 5 Bí Ngô ${pumpkinEmoji} + 30 Mảnh Ký Ức ${shardEmoji}\n` +
          `> <:wh4:1564143733690204190> Thất bại: Nhận an ủi 2 Bí Ngô ${pumpkinEmoji} & **Trừ 30% Máu Supporter**\n\n` +
          `<a:whg1:1563430946835931187> 3. VỰC THẲM HƯ VÔ TẬN (Abyssal Oblivion)\n` +
          `<a:bang2:1546891483250954290> Yêu cầu: Supporter **Bậc C trở lên** + Sinh lực **> 90% HP**\n` +
          `<a:bang2:1546891483250954290> Tỉ lệ thành công:\n` +
          `> Supporter Bậc SS: 50% Thành công — 50% Thất bại\n` +
          `> Supporter Bậc S trở lên: 10% Thành công — 90% Thất bại\n` +
          `> Supporter Bậc A - B - C: 1% Thành công — 99% Thất bại\n` +
          `> ${shardEmoji} Kích hoạt Cộng Hưởng Thần Binh: **+2% Tỉ lệ Thành công**\n` +
          `<a:trangtrig29:1546385117478527016> Khắc hệ: <a:nguyentheg:1563399515732443177> Hệ Nguyền Thể\n` +
          `> Oán niệm tương thích Hư Không ➔ Giảm 10% giờ\n` +
          `<a:giftg1:1543150714732412948> Thu hoạch:\n` +
          `> <a:giftg1:1543150714732412948> Thành công: 10 Bí Ngô ${pumpkinEmoji} + 100 Mảnh Ký Ức ${shardEmoji} + 2 Vé Tế Đàn\n` +
          `> <:wh4:1564143733690204190> Thất bại: Nhận an ủi 5 Bí Ngô ${pumpkinEmoji} & **Trừ 90% Máu Supporter**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig13:1546047657963819048> Bấm các nút bên dưới để điều phối đội ngũ thám hiểm của bạn!`
      )
      .setFooter({
        text: 'Witch Hunter Idle Expedition System • Cổng Ranh Giới Hắc Ám',
      })
      .setTimestamp();
  }

  /**
   * ActionRow nút bấm trên Dashboard cố định (Toàn bộ Style Secondary xám sang trọng)
   */
  static createExpeditionDashboardComponents() {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_expedition_choose')
        .setLabel('Chọn Khu Vực Viễn Chinh')
        .setEmoji(this.parseEmoji('<a:whg1:1563430946835931187>'))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_expedition_status')
        .setLabel('Theo Dõi Tiến Trình')
        .setEmoji(this.parseEmoji('<a:whg1:1563430946835931187>'))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_expedition_claim')
        .setLabel('Nhận Thưởng Thu Hoạch')
        .setEmoji(this.parseEmoji('<a:giftg1:1543150714732412948>'))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_expedition_cancel')
        .setLabel('Hủy Viễn Chinh')
        .setEmoji(this.parseEmoji('<a:whg1:1563430946835931187>'))
        .setStyle(ButtonStyle.Secondary)
    );

    return [row];
  }

  /**
   * 2. BẢNG ĐIỀU PHỐI HỘI QUÂN (Dispatch Ephemeral Embed)
   */
  static buildDispatchEmbed(userId, draft = null) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const currentDraft = draft || this.getUserDraft(userId);
    const selectedZone = EXPEDITION_ZONES[currentDraft.zoneId] || EXPEDITION_ZONES.zone_1;
    const selectedSupporter = currentDraft.supporterId
      ? getSupporterById(currentDraft.supporterId)
      : WitchHunterService.getEquippedSupporter(userId);

    let supporterInfo = '*Chưa chọn Supporter*';
    if (selectedSupporter) {
      const suppHp = WitchHunterService.getSupporterHp(userId, selectedSupporter.id);
      const rankLetter = WitchHunterService.formatRankLetter(selectedSupporter.rank);
      supporterInfo = `**[${rankLetter}-Rank] ${selectedSupporter.name}** (HP: **${suppHp}%**)`;
    }

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(
        '<a:trangtrig2:1546040703375904801> **ĐIỀU PHỐI HỘI QUÂN VIỄN CHINH** <a:trangtrig3:1546040818261954610>'
      )
      .setDescription(
        `Lữ Khách hãy chọn khu vực thám hiểm và lựa chọn Supporter xuất kích bên dưới:\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `• **Khu vực đã chọn:** ${selectedZone.emoji} **${selectedZone.name}**\n` +
          `• **Supporter xuất trận:** ${supporterInfo}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:bang2:1546891483250954290> **LƯU Ý QUAN TRỌNG:**\n` +
          `• Mỗi Supporter chỉ có thể đi 1 khu vực tại một thời điểm.\n` +
          `• Kiểm tra kĩ lượng máu hiện tại của Supporter trước khi chọn vùng đất có hiểm họa cao!\n` +
          `• Khắc Hệ khu vực sẽ giảm **10% thời gian** (còn **2 giờ 42 phút**).`
      )
      .setFooter({
        text: 'Witch Hunter Idle Expedition System • Điều Phối Hội Quân',
      });
  }

  /**
   * Components bảng chọn điều phối (Select Menu Khu Vực, Select Menu Supporter & Nút Xuất Quân)
   */
  static createDispatchComponents(userId, draft = null) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) return [];

    const currentDraft = draft || this.getUserDraft(userId);
    const ownedSupporters = WitchHunterService.getOwnedSupporters(userId);
    const equippedSupporter = WitchHunterService.getEquippedSupporter(userId);
    const equippedWeapon = WitchHunterService.getEquippedWeapon(userId);

    // Đảm bảo có ít nhất 1 supporter (mặc định theo rank nếu kho rỗng)
    const availableSupporters =
      ownedSupporters.length > 0
        ? ownedSupporters
        : equippedSupporter
        ? [equippedSupporter]
        : [];

    const activeSuppId = currentDraft.supporterId || equippedSupporter?.id || availableSupporters[0]?.id;

    // 1. Menu chọn Khu Vực
    const zoneOptions = Object.values(EXPEDITION_ZONES).map((z) => ({
      label: `${z.emoji} ${z.shortName}`,
      value: z.id,
      description: `Yêu cầu: Máu > ${z.minHp}% | ${z.dangerLevel.substring(0, 50)}`,
      default: z.id === currentDraft.zoneId,
    }));

    const zoneSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_expedition_zone:${userId}`)
      .setPlaceholder('Chọn 1 trong 3 Vùng Đất Viễn Chinh...')
      .addOptions(zoneOptions);

    // 2. Menu chọn Supporter
    const supporterOptions = availableSupporters.map((s) => {
      const cat = WITCH_HUNTER_CONFIG.supporters.categories[s.categoryKey];
      const suppHp = WitchHunterService.getSupporterHp(userId, s.id);
      const rankLetter = WitchHunterService.formatRankLetter(s.rank);
      const isResonant = Boolean(
        equippedWeapon && WITCH_HUNTER_RESONANCE_MAP[s.id] === equippedWeapon.id
      );

      const resonanceTag = isResonant ? ' | ✨ Đồng bộ vũ khí (+2%)' : '';
      return {
        label: `[${rankLetter}-Rank] ${s.name}`.substring(0, 100),
        value: s.id,
        description: `Hệ: ${cat?.shortName || ''} | HP: ${suppHp}%${resonanceTag}`.substring(0, 100),
        emoji: this.parseEmoji(cat?.emoji || '<a:linhtocg:1563399670351536310>'),
        default: s.id === activeSuppId,
      };
    });

    const supporterSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_expedition_supporter:${userId}`)
      .setPlaceholder('Chọn Supporter cử đi thám hiểm...')
      .addOptions(supporterOptions.slice(0, 25)); // Discord giới hạn 25 options

    // 3. Nút Xác Nhận Xuất Quân
    const launchButton = new ButtonBuilder()
      .setCustomId(`btn_expedition_launch:${currentDraft.zoneId}:${activeSuppId}`)
      .setLabel('XÁC NHẬN XUẤT QUÂN KHỞI HÀNH')
      .setEmoji(this.parseEmoji('<a:trangtrig36:1563065680922808340>'))
      .setStyle(ButtonStyle.Secondary);

    return [
      new ActionRowBuilder().addComponents(zoneSelect),
      new ActionRowBuilder().addComponents(supporterSelect),
      new ActionRowBuilder().addComponents(launchButton),
    ];
  }

  /**
   * 3. BẢNG TIẾN ĐỘ THÁM HIỂM (Progress Ephemeral Embed)
   */
  static buildProgressEmbed(userId) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const userData = witchHunterStorage.getUser(userId);

    if (!userData || !userData.active_expedition) {
      return new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setDescription(
          `<a:bang2:1546891483250954290> Hiện tại Lữ Khách chưa cử đội ngũ Supporter nào tham gia viễn chinh!\n` +
            `Hãy bấm nút **[ Chọn Khu Vực Viễn Chinh ]** để bắt đầu gửi Supporter đi thám hiểm nhé.<a:heartg1:1545307544808071258>`
        );
    }

    const exp = userData.active_expedition;
    const zone = EXPEDITION_ZONES[exp.zoneId] || EXPEDITION_ZONES.zone_1;
    const supporter = getSupporterById(exp.supporterId);
    const weapon = exp.weaponId ? getWeaponById(exp.weaponId) : null;

    const suppHp = supporter
      ? WitchHunterService.getSupporterHp(userId, supporter.id)
      : 100;
    const suppRankLetter = supporter
      ? WitchHunterService.formatRankLetter(supporter.rank)
      : 'C';
    const wepRankLetter = weapon
      ? WitchHunterService.formatRankLetter(weapon.rank)
      : 'C';
    const wepName = weapon ? weapon.name : 'Không có';

    const cat = supporter
      ? WITCH_HUNTER_CONFIG.supporters.categories[supporter.categoryKey]
      : null;
    const catEmoji = cat?.emoji || '<a:linhtocg:1563399670351536310>';

    // Tính toán thời gian
    const now = Date.now();
    const elapsed = Math.max(0, now - exp.startTime);
    const duration = exp.durationMs || (180 * 60 * 1000);
    const percent = Math.min(100, Math.floor((elapsed / duration) * 100));

    const totalBars = 10;
    const filledBars = Math.min(
      totalBars,
      Math.max(0, Math.floor((percent / 100) * totalBars))
    );
    const emptyBars = totalBars - filledBars;
    const barString = `${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}`;

    const endSec = Math.floor(exp.endTime / 1000);
    const isFinished = now >= exp.endTime;

    let timeText = `> Thời gian còn lại: <t:${endSec}:R> (Dự kiến về lúc: <t:${endSec}:t>)`;
    let statusFlavor = 'Đang bắt đầu tiến vào ranh giới bí ẩn, tinh thần dâng cao.';
    if (percent >= 30 && percent < 70) {
      statusFlavor = 'Đang băng qua khe nứt địa nhiệt, chưa ghi nhận thương tích.';
    } else if (percent >= 70 && percent < 100) {
      statusFlavor = 'Đang thu gom tàn tích và chuẩn bị mở cổng không gian quay về.';
    } else if (isFinished) {
      timeText = `> Thời gian còn lại: **Đã hoàn thành!** (Hãy bấm nút **Nhận Thưởng Thu Hoạch**)`;
      statusFlavor = 'Đã hoàn tất chuyến thám hiểm an toàn! Sẵn sàng mở rương chiến lợi phẩm.';
    }

    let counterSection = '';
    if (exp.isCountered) {
      counterSection =
        `<a:trangtrig29:1546385117478527016> Hiệu ứng Khắc Hệ Môi Trường:\n` +
        `> ${zone.counterCategoryName} khắc chế ${zone.shortName}! Thời gian thám hiểm được giảm **10% chỉ còn 2 giờ 42 phút**!\n`;
    } else {
      counterSection =
        `<a:trangtrig29:1546385117478527016> Hiệu ứng Khắc Hệ Môi Trường:\n` +
        `> Không kích hoạt (Thời gian thám hiểm tiêu chuẩn: **3 giờ**).\n`;
    }

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(
        '<a:trangtrig2:1546040703375904801> **TIẾN ĐỘ THÁM HIỂM RANH GIỚI HẮC ÁM** <a:trangtrig3:1546040818261954610>'
      )
      .setDescription(
        `Đội hình thám hiểm của Lữ Khách đang tiến sâu vào vùng cấm địa:\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `<a:whg1:1563430946835931187> Khu vực đang thám hiểm: ${zone.emoji} **${zone.name}**\n` +
          `<a:linhtocg:1563399670351536310> Supporter phái đi: ${catEmoji} **[${suppRankLetter}-Rank] ${supporter?.name || 'Vô danh'}** *(HP: ${suppHp}%)*\n` +
          `<a:trangtrig36:1563065680922808340> Vũ khí đi kèm: **[${wepRankLetter}-Rank] ${wepName}**\n` +
          `<a:trangtrig36:1563065680922808340> Đồng bộ Thần Binh: ${
            exp.isResonant
              ? 'Kích hoạt **+2% Tỉ lệ Thành công**'
              : 'Không có cộng hưởng'
          }\n\n` +
          `${counterSection}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig6:1546043036390260756> TIẾN ĐỘ THỜI GIAN:\n` +
          `\`[${barString}]\` **${percent}%**\n` +
          `${timeText}\n` +
          `> Tình trạng đoàn đội: ${statusFlavor}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Khi đếm ngược hoàn tất, hãy quay lại bấm nút \`[ Nhận Thưởng Thu Hoạch ]\` để mở rương nhé!`
      );
  }

  /**
   * 4. BẢNG XÁC NHẬN HỦY VIỄN CHINH (Cancel Confirmation)
   */
  static buildCancelConfirmationEmbed(userId) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const userData = witchHunterStorage.getUser(userId);

    if (!userData || !userData.active_expedition) {
      return new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setDescription(
          `<a:bang2:1546891483250954290> Hiện tại Lữ Khách chưa cử đội ngũ Supporter nào tham gia viễn chinh!`
        );
    }

    const exp = userData.active_expedition;
    const zone = EXPEDITION_ZONES[exp.zoneId] || EXPEDITION_ZONES.zone_1;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(
        '<a:trangtrig2:1546040703375904801> **XÁC NHẬN RÚT LUI ĐOÀN THÁM HIỂM?** <a:trangtrig3:1546040818261954610>'
      )
      .setDescription(
        `Lữ Khách có chắc chắn muốn ra lệnh triệu hồi khẩn cấp đoàn thám hiểm đang ở **${zone.name}** không?\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:bang2:1546891483250954290> **HẬU QUẢ KHI RÚT LUI KHẨN CẤP:**\n` +
          `> Supporter sẽ bị tổn thương nguyên khí: Khấu trừ thẳng **-20% Máu Supporter**!\n` +
          `> Toàn bộ tài nguyên đang thu thập tại khu vực sẽ bị thất lạc (không nhận được Bí Ngô).\n` +
          `<a:bang2:1546891483250954290> Tuy nhiên không bị phạt Cooldown: Lữ Khách có thể lập tức phát động chuyến viễn chinh mới ngay sau khi hủy nếu Supporter đủ điều kiện máu.`
      );
  }

  /**
   * Nút bấm xác nhận hủy (full xám Secondary)
   */
  static createCancelConfirmationComponents(userId) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_expedition_confirm_cancel:${userId}`)
        .setLabel('XÁC NHẬN RÚT LUI (-20% HP)')
        .setEmoji(this.parseEmoji('<a:bang2:1546891483250954290>'))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`btn_expedition_dismiss_cancel:${userId}`)
        .setLabel('KHÔNG, TIẾP TỤC ĐI')
        .setEmoji(this.parseEmoji('<a:bang2:1546891483250954290>'))
        .setStyle(ButtonStyle.Secondary)
    );

    return [row];
  }

  /**
   * 5. LOGIC KHỞI HÀNH VIỄN CHINH (Launch Expedition)
   */
  static async launchExpedition(userId, zoneId, supporterId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) {
      return {
        success: false,
        message:
          '❌ Lữ Khách chưa ký kết khế ước gia nhập phe phái! Vui lòng chọn phe trước khi tham gia viễn chinh 💕',
      };
    }

    if (userData.active_expedition) {
      return {
        success: false,
        message:
          '⚠️ Lữ Khách đã có một đoàn thám hiểm đang hoạt động! Vui lòng hoàn thành hoặc hủy chuyến đi hiện tại trước khi khởi hành chuyến mới.',
      };
    }

    const zone = EXPEDITION_ZONES[zoneId];
    if (!zone) {
      return { success: false, message: '❌ Khu vực viễn chinh không hợp lệ!' };
    }

    const supporter = getSupporterById(supporterId);
    if (!supporter) {
      return { success: false, message: '❌ Supporter không tồn tại!' };
    }

    // Kiểm tra lượng máu hiện tại
    const currentHp = WitchHunterService.getSupporterHp(userId, supporter.id);
    if (currentHp <= zone.minHp) {
      return {
        success: false,
        message:
          `<a:bang2:1546891483250954290> **SINH LỰC SUPPORTER KHÔNG ĐỦ ĐIỀU KIỆN!**\n` +
          `> Khu vực **${zone.name}** yêu cầu Supporter phải có Sinh lực **trên ${zone.minHp}% HP**!\n` +
          `> Hiện tại **${supporter.name}** chỉ còn **${currentHp}% HP**.\n` +
          `> Vui lòng đợi hồi phục tự nhiên (+10% HP/giờ) hoặc chọn Supporter khác nha Lữ Khách ơi! <a:heartg1:1545307544808071258>`,
      };
    }

    // Kiểm tra Khắc Hệ môi trường
    const isCountered = supporter.categoryKey === zone.counterCategory;
    // Thời gian chuẩn 3 tiếng (180 phút), nếu khắc hệ giảm 10% còn 162 phút (2h42m)
    const durationMs = isCountered ? 162 * 60 * 1000 : 180 * 60 * 1000;
    const startTime = Date.now();
    const endTime = startTime + durationMs;

    // Kiểm tra Vũ Khí và Cộng Hưởng
    const equippedWeapon = WitchHunterService.getEquippedWeapon(userId);
    const isResonant = Boolean(
      equippedWeapon && WITCH_HUNTER_RESONANCE_MAP[supporter.id] === equippedWeapon.id
    );

    userData.active_expedition = {
      zoneId: zone.id,
      supporterId: supporter.id,
      weaponId: equippedWeapon ? equippedWeapon.id : null,
      startTime,
      endTime,
      durationMs,
      isCountered,
      isResonant,
    };

    witchHunterStorage.saveUser(userData, true);
    this.clearUserDraft(userId);

    logger.info(
      `🗺️ [Expedition] User ${userId} đã phát động viễn chinh tại ${zone.name} bằng ${supporter.name} (Khắc hệ: ${isCountered}, Cộng hưởng: ${isResonant})`
    );

    return {
      success: true,
      zone,
      supporter,
      durationMs,
      endTime,
      isCountered,
      isResonant,
    };
  }

  /**
   * 6. LOGIC HỦY VIỄN CHINH (Confirm Cancel)
   */
  static async cancelExpedition(userId) {
    const userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.active_expedition) {
      return {
        success: false,
        message: '⚠️ Hiện tại Lữ Khách không có đoàn thám hiểm nào đang hoạt động!',
      };
    }

    const exp = userData.active_expedition;
    const supporter = getSupporterById(exp.supporterId);
    const supporterName = supporter ? supporter.name : 'Supporter';

    // Trừ 20% Máu Supporter
    const newHp = WitchHunterService.deductSupporterHp(userId, exp.supporterId, 20);

    // Làm mới trạng thái viễn chinh
    userData.active_expedition = null;
    witchHunterStorage.saveUser(userData, true);

    logger.info(
      `🗺️ [Expedition] User ${userId} đã hủy viễn chinh, ${supporterName} bị trừ 20% HP (còn ${newHp}% HP)`
    );

    return {
      success: true,
      supporterName,
      newHp,
    };
  }

  /**
   * 7. LOGIC THU HOẠCH PHẦN THƯỞNG (Claim Rewards)
   */
  static async claimExpedition(userId) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const userData = witchHunterStorage.getUser(userId);

    if (!userData || !userData.active_expedition) {
      return {
        status: 'no_expedition',
        embed: new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setDescription(
            `<a:bang2:1546891483250954290> Hiện tại Lữ Khách chưa cử đội ngũ Supporter nào tham gia viễn chinh!\n` +
              `Hãy bấm nút **[ Chọn Khu Vực Viễn Chinh ]** để bắt đầu gửi Supporter đi thám hiểm nhé.<a:heartg1:1545307544808071258>`
          ),
      };
    }

    const exp = userData.active_expedition;
    const now = Date.now();

    // Chưa hoàn tất thời gian
    if (now < exp.endTime) {
      const endSec = Math.floor(exp.endTime / 1000);
      return {
        status: 'not_finished',
        embed: new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setDescription(
            `<a:bang2:1546891483250954290> **ĐỘI NGŨ CHƯA HOÀN TẤT THÁM HIỂM!**\n` +
              `Đoàn thám hiểm của Lữ Khách hiện vẫn đang lục soát tàn tích cổ xưa.\n` +
              `> Thời gian dự kiến hoàn thành: <t:${endSec}:R> (lúc <t:${endSec}:t>).\n` +
              `Vui lòng kiên nhẫn đợi đến khi cổng đếm ngược kết thúc nhé Lữ Khách ơi! <a:heartg1:1545307544808071258>`
          ),
      };
    }

    // Đã hoàn tất! Tính toán tỉ lệ thành công / thất bại
    const zone = EXPEDITION_ZONES[exp.zoneId] || EXPEDITION_ZONES.zone_1;
    const supporter = getSupporterById(exp.supporterId);
    const supporterName = supporter ? supporter.name : 'Supporter';
    const rankLetter = supporter
      ? WitchHunterService.formatRankLetter(supporter.rank)
      : 'C';

    let successRate = 1.0;
    if (zone.id === 'zone_1') {
      successRate = 1.0;
    } else if (zone.id === 'zone_2') {
      // Sup A trở lên: 80%, B-C: 20%. Cộng hưởng: +2%
      const baseRate = ['A', 'S', 'SS'].includes(rankLetter) ? 0.80 : 0.20;
      successRate = baseRate + (exp.isResonant ? 0.02 : 0.0);
    } else if (zone.id === 'zone_3') {
      // SS: 50%, Sup S: 10%, A-B-C: 1%. Cộng hưởng: +2%
      let baseRate = 0.01;
      if (rankLetter === 'SS') baseRate = 0.50;
      else if (rankLetter === 'S') baseRate = 0.10;
      else baseRate = 0.01;

      successRate = baseRate + (exp.isResonant ? 0.02 : 0.0);
    }

    const roll = Math.random();
    const isSuccess = roll < successRate;

    const pumpkinEmoji = WITCH_HUNTER_CONFIG.emojis?.pumpkin || '<a:bingo:1563061901800243253>';
    const shardEmoji = WITCH_HUNTER_CONFIG.emojis?.memoryShard || WITCH_HUNTER_CONFIG.emojis?.decor46 || '<a:trangtrig46:1547240249761996812>';

    const randomRange = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    let resultEmbed = null;

    if (isSuccess) {
      // THÀNH CÔNG
      const configRewards = zone.rewards.success;
      const pumpkinsWon = randomRange(
        configRewards.minPumpkins,
        configRewards.maxPumpkins
      );
      const shardsWon = configRewards.maxShards > 0
        ? randomRange(configRewards.minShards, configRewards.maxShards)
        : 0;
      const ticketsWon = configRewards.maxTickets > 0
        ? randomRange(configRewards.minTickets, configRewards.maxTickets)
        : 0;

      // Cộng tài nguyên vào túi đồ
      userData.pumpkins = (userData.pumpkins || 0) + pumpkinsWon;
      if (shardsWon > 0) {
        userData.memory_shards = (userData.memory_shards || 0) + shardsWon;
      }
      if (ticketsWon > 0) {
        userData.free_summons = (userData.free_summons || 0) + ticketsWon;
      }

      const currentHp = WitchHunterService.getSupporterHp(
        userId,
        exp.supporterId
      );

      if (zone.id === 'zone_1') {
        resultEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(
            '<a:trangtrig2:1546040703375904801> **THÁM HIỂM TOÀN THẮNG: VỤ GIỚI PHẾ TÍCH** <a:trangtrig3:1546040818261954610>'
          )
          .setDescription(
            `Supporter **[${rankLetter}-Rank] ${supporterName}** đã an toàn trở về từ màn sương mờ mịt của Vụ Giới Phế Tích!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `<a:giftg1:1543150714732412948> **TỔNG KẾT TÀI NGUYÊN THU HOẠCH:**\n` +
              `${pumpkinEmoji} Bí Ngô mang về: **+${pumpkinsWon} Điểm Bí Ngô**\n` +
              `${shardEmoji} Mảnh Vỡ Ký Ức: **+${shardsWon} Mảnh Ký Ức**\n` +
              `<a:linhtocg:1563399670351536310> Tình trạng Supporter: Bảo toàn nguyên vẹn ${currentHp}% Sinh Lực.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*Tất cả tài nguyên đã được tự động cộng thẳng vào túi đồ của Lữ Khách!*`
          );
      } else if (zone.id === 'zone_2') {
        resultEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(
            '<a:trangtrig2:1546040703375904801> **THÁM HIỂM ĐẠI THẮNG: VỰC CỔ KHẮC TRO TÀN** <a:trangtrig3:1546040818261954610>'
          )
          .setDescription(
            `Bằng bản lĩnh kiên cường, Supporter **[${rankLetter}-Rank] ${supporterName}** đã xuyên qua dung nham và thu thập được những cổ vật quý giá!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `<a:giftg1:1543150714732412948> **TỔNG KẾT TÀI NGUYÊN THU HOẠCH:**\n` +
              `${pumpkinEmoji} Bí Ngô mang về: **+${pumpkinsWon} Điểm Bí Ngô**\n` +
              `${shardEmoji} Mảnh Vỡ Ký Ức: **+${shardsWon} Mảnh Ký Ức**\n` +
              `<a:linhtocg:1563399670351536310> Tình trạng Supporter: An toàn trở về, bảo toàn ${currentHp}% Sinh Lực.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*Tất cả tài nguyên đã được tự động cộng thẳng vào túi đồ của Lữ Khách!*`
          );
      } else {
        resultEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(
            '<a:trangtrig2:1546040703375904801> **KỲ TÍCH HƯ VÔ: VƯỢT QUA VỰC THẲM TUYỆT DIỆT!** <a:trangtrig3:1546040818261954610>'
          )
          .setDescription(
            `Không tưởng! Supporter **[${rankLetter}-Rank] ${supporterName}** đã trấn áp ma khí Hư Vô và mang về kho báu huyền thoại của cõi vĩnh hằng!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `<a:giftg1:1543150714732412948> **TỔNG KẾT TÀI NGUYÊN THU HOẠCH:**\n` +
              `${pumpkinEmoji} Bí Ngô mang về: **+${pumpkinsWon.toLocaleString('vi-VN')} Điểm Bí Ngô**\n` +
              `${shardEmoji} Mảnh Vỡ Ký Ức: **+${shardsWon} Mảnh Ký Ức**\n` +
              `<a:linhtocg:1563399670351536310> Vé Triệu Hồi Tế Đàn: **+${ticketsWon} Vé Quay Tế Đàn Free**\n` +
              `<a:linhtocg:1563399670351536310> Tình trạng Supporter: Vẹn nguyên uy lực tối thượng ${currentHp}% Sinh Lực.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*Tất cả bảo vật đã được chuyển thẳng vào hồ sơ ma thuật của Lữ Khách!*`
          );
      }
    } else {
      // THẤT BẠI
      const configRewards = zone.rewards.failure;
      const pumpkinsWon = configRewards.minPumpkins;
      const hpDeduction = configRewards.hpLoss || 0;

      // Cộng bí ngô an ủi
      userData.pumpkins = (userData.pumpkins || 0) + pumpkinsWon;

      // Trừ máu Supporter
      const newHp = WitchHunterService.deductSupporterHp(
        userId,
        exp.supporterId,
        hpDeduction
      );

      if (zone.id === 'zone_2') {
        resultEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(
            '<a:trangtrig2:1546040703375904801> **THÁM HIỂM THẤT BẠI: DUNG NHAM CÀN QUÉT!** <a:trangtrig3:1546040818261954610>'
          )
          .setDescription(
            `Nhiệt lượng cực đại và bẫy cổ đã khiến Supporter **[${rankLetter}-Rank] ${supporterName}** gặp nạn trong lòng Vực Tro Tàn!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `<:wh4:1564143733690204190> **TỔN THẤT SINH LỰC:**\n` +
              `> Thương tích: **-30% Máu Supporter** *(Còn ${newHp}% HP)*!\n` +
              `> Supporter cần nghỉ ngơi hồi phục tự nhiên 10% mỗi giờ trước khi đủ điều kiện đi tiếp.\n\n` +
              `<a:giftg1:1543150714732412948> **CHIẾN LỢI PHẨM AN ỦI:**\n` +
              `${pumpkinEmoji} Bí Ngô thu gom sót lại: **+${pumpkinsWon} Điểm Bí Ngô**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*Hãy chú ý dưỡng thương cho Supporter trước khi tiếp tục các chuyến đi hiểm trở tiếp theo!*`
          );
      } else {
        resultEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(
            '<a:trangtrig2:1546040703375904801> **THÁM HIỂM THẤT BẠI: HƯ KHÔNG NUỐT CHỬNG!** <a:trangtrig3:1546040818261954610>'
          )
          .setDescription(
            `Kết giới Hư Vô quá hung hãn! Supporter **[${rankLetter}-Rank] ${supporterName}** đã bị trọng thương nặng nề và phải rút chạy trong gang tấc!\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `<:wh4:1564143733690204190> **TỔN THẤT SINH LỰC:**\n` +
              `> Thương tích chí mạng: **-90% Máu Supporter** *(Còn ${newHp}% HP)*!\n` +
              `> Supporter rơi vào trạng thái suy kiệt, cần hồi phục ít nhất 9 tiếng để đầy máu lại.\n\n` +
              `<a:giftg1:1543150714732412948> **CHIẾN LỢI PHẨM AN ỦI:**\n` +
              `${pumpkinEmoji} Bí Ngô thu gom sót lại: **+${pumpkinsWon} Điểm Bí Ngô**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `*Hãy để Supporter tịnh dưỡng hồi máu tự nhiên hoặc chỉ cử đi Khu 1 sau khi hồi phục trên 50% HP!*`
          );
      }
    }

    // Xóa active_expedition
    userData.active_expedition = null;
    witchHunterStorage.saveUser(userData, true);

    logger.info(
      `🗺️ [Expedition] User ${userId} hoàn tất viễn chinh tại ${zone.name}. Kết quả: ${
        isSuccess ? 'Thành Công' : 'Thất Bại'
      }`
    );

    return {
      status: 'claimed',
      isSuccess,
      embed: resultEmbed,
    };
  }
}
