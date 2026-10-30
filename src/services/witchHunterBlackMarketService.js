import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  WITCH_HUNTER_CONFIG,
  getSupporterById,
  getWeaponById,
} from '../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from './witchHunterService.js';
import { witchHunterSummonStorage } from './witchHunterSummonService.js';
import { logger } from '../utils/logger.js';

function parseEmoji(emojiStr) {
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
}

export class WitchHunterBlackMarketService {
  /**
   * Tạo Embed bảng Chợ Đen công cộng cố định trong kênh
   */
  static buildMainMarketEmbed() {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **CHỢ ĐEN HƯ KHÔNG: THƯƠNG ĐÀI TRAO ĐỔI KÝ ỨC** ${emojis.titleRight}`)
      .setDescription(
        `> Nơi lẩn khuất giữa vết nứt không gian của thế giới ma thuật. \n` +
        `━━━━━━━━━━━\n` +
        `Thương hội ngầm chấp nhận đổi những Mảnh Vỡ Ký Ức <a:trangtrig46:1547240249761996812> thu thập từ Viễn Chinh Hư Không để lấy các Supporter, Vũ Khí Cấm Thuật và Danh Hiệu Hắc Ám độc quyền chưa từng xuất hiện tại Tế Đàn!\n\n` +
        `<a:trangtrig18:1546068102817775626> **QUY TẮC THƯƠNG ĐÀI:**\n` +
        `<a:trangtrig20:1546092997299667055> Đơn vị giao dịch: Mảnh Vỡ Ký Ức <a:trangtrig46:1547240249761996812>\n` +
        `<a:trangtrig20:1546092997299667055> Giới hạn giao dịch: Không giới hạn số lần trao đổi.\n` +
        `<a:trangtrig20:1546092997299667055> Bảo mật tuyệt đối: Toàn bộ phiên giao dịch được thực hiện qua kết giới ẩn.\n` +
        `<a:trangtrig20:1546092997299667055> Định mệnh phe phái: Khế ước và Vũ Khí tự động tương thích theo phe (Thợ Săn / Phù Thủy).\n\n` +
        `<a:trangtrig18:1546068102817775626> **BẢNG NIÊM YẾT VẬT PHẨM ĐỘC QUYỀN:**\n` +
        `> • Hộp Khế Ước Supporter A-Rank: **1,000** <a:trangtrig46:1547240249761996812>   \n` +
        `> • Hộp Khí Tài Vũ Khí A-Rank: **1,000** <a:trangtrig46:1547240249761996812> \n` +
        `> • Hộp Khế Ước Supporter S-Rank: **2,000** <a:trangtrig46:1547240249761996812>   \n` +
        `> • Hộp Khí Tài Vũ Khí S-Rank: **2,000** <a:trangtrig46:1547240249761996812>   \n` +
        `> • Hộp Khế Ước Supporter SS-Rank: **9,000** <a:trangtrig46:1547240249761996812> \n` +
        `> • Hộp Khí Tài Vũ Khí SS-Rank: **9,000** <a:trangtrig46:1547240249761996812> \n` +
        `> • Vé Triệu Gọi Tế Đàn Miễn Phí: **100** <a:trangtrig46:1547240249761996812> \n` +
        `> • Danh Hiệu Hắc Ám Độc Quyền Kèm Role Tương Ứng: **200** <a:trangtrig46:1547240249761996812> \n` +
        `───────────────\n` +
        `Bấm vào Menu bên dưới để bắt đầu mở phiên giao dịch bí mật!`
      )
      .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' })
      .setTimestamp();
  }

  /**
   * Tạo ActionRow Select Menu cho bảng Chợ Đen công cộng
   */
  static createMainMarketComponents() {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('black_market_category')
      .setPlaceholder('Chọn danh mục vật phẩm muốn giao dịch...')
      .addOptions([
        {
          label: 'Hộp Khế Ước Supporter (A-Rank)',
          description: '1,000 Mảnh Vỡ Ký Ức ──── Supporter A-Rank Tự Chọn',
          value: 'supporter_A',
          emoji: parseEmoji('🔮'),
        },
        {
          label: 'Hộp Khí Tài Vũ Khí (A-Rank)',
          description: '1,000 Mảnh Vỡ Ký Ức ──── Khí Tài Vũ Khí A-Rank Tự Chọn',
          value: 'weapon_A',
          emoji: parseEmoji('⚔️'),
        },
        {
          label: 'Hộp Khế Ước Supporter (S-Rank)',
          description: '2,000 Mảnh Vỡ Ký Ức ──── Supporter S-Rank Tự Chọn',
          value: 'supporter_S',
          emoji: parseEmoji('🔮'),
        },
        {
          label: 'Hộp Khí Tài Vũ Khí (S-Rank)',
          description: '2,000 Mảnh Vỡ Ký Ức ──── Khí Tài Vũ Khí S-Rank Tự Chọn',
          value: 'weapon_S',
          emoji: parseEmoji('⚔️'),
        },
        {
          label: 'Hộp Khế Ước Supporter (SS-Rank)',
          description: '9,000 Mảnh Vỡ Ký Ức ──── Supporter SS-Rank Tự Chọn',
          value: 'supporter_SS',
          emoji: parseEmoji('🔮'),
        },
        {
          label: 'Hộp Khí Tài Vũ Khí (SS-Rank)',
          description: '9,000 Mảnh Vỡ Ký Ức ──── Khí Tài Vũ Khí SS-Rank Tự Chọn',
          value: 'weapon_SS',
          emoji: parseEmoji('⚔️'),
        },
        {
          label: 'Vé Triệu Gọi Tế Đàn Miễn Phí',
          description: '100 Mảnh Vỡ Ký Ức / vé ──── Dùng quay Tế Đàn A-SS',
          value: 'ticket',
          emoji: parseEmoji('🎫'),
        },
        {
          label: 'Danh Hiệu Hắc Ám & Cấp Role',
          description: '200 Mảnh Vỡ Ký Ức ──── Mở Khóa Danh Hiệu & Role Tương Ứng',
          value: 'title',
          emoji: parseEmoji('👑'),
        },
        {
          label: 'Kiểm Tra Số Dư Mảnh Vỡ',
          description: 'Xem số lượng Mảnh Vỡ Ký Ức hiện có trong túi đồ',
          value: 'balance',
          emoji: parseEmoji('💰'),
        },
      ]);

    return [new ActionRowBuilder().addComponents(selectMenu)];
  }

  /**
   * Tạo giao diện riêng tư (Ephemeral) khi thành viên chọn một danh mục từ Chợ Đen
   */
  static buildCategoryView(userId, category) {
    const userData = witchHunterStorage.getUser(userId);
    const { colors, emojis } = WITCH_HUNTER_CONFIG;

    if (!userData || !userData.faction) {
      const errEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **CHỢ ĐEN HƯ KHÔNG: TỪ CHỐI TIẾP CẬN** ${emojis.titleRight}`)
        .setDescription(
          `❌ Lữ khách chưa ký khế ước gia nhập phe phái nào trong thế giới Witch Hunter!\n` +
          `Hãy ghé qua kênh <#${WITCH_HUNTER_CONFIG.channels.selectionChannelId}> để ký khế ước chọn phe trước nha lữ khách ơi! 💕`
        );
      return { embed: errEmbed, components: [] };
    }

    const faction = userData.faction;
    const isHunter = faction === 'hunter';
    const factionName = isHunter ? 'Hiệp Hội Thợ Săn (W.H.A)' : 'Hội Phù Thủy (Coven)';
    const factionEmoji = isHunter ? emojis.hunterButton : emojis.witchButton;
    const currentShards = userData.memory_shards || 0;

    // 1. KIỂM TRA SỐ DƯ
    if (category === 'balance') {
      const currentRank = userData.current_rank || 1;
      const rankInfo = WitchHunterService.getRankInfo(faction, currentRank);
      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **KHO TÀI NGUYÊN KÝ ỨC CÁ NHÂN** ${emojis.titleRight}`)
        .setDescription(
          `Thông tin tài nguyên của lữ khách tại **Chợ Đen Hư Không**:\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `<a:trangtrig46:1547240249761996812> **Mảnh Vỡ Ký Ức hiện có:** **${currentShards.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `${emojis.pumpkin} **Bí Ngô tích lũy:** **${(userData.pumpkins || 0).toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
          `<a:giftg1:1543150714732412948> **Vé Tế Đàn Free:** **${userData.free_summons || 0}** vé\n` +
          `${factionEmoji} **Bản mệnh:** **${factionName}**\n` +
          `<a:trangtrig45:1547239010190237819> **Cấp bậc:** **${rankInfo?.name || `Bậc ${currentRank}`}**\n\n` +
          `> <a:bang2:1546891483250954290> **Gợi ý:** Tham gia **Viễn Chinh Hư Không** hằng ngày để thu hoạch thêm nhiều Mảnh Vỡ Ký Ức nha!`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' })
        .setTimestamp();
      return { embed, components: [] };
    }

    // 2. GÓI SUPPORTER THEO BẬC
    if (category.startsWith('supporter_')) {
      const rank = category.split('_')[1]; // 'A', 'S', 'SS'
      const price = WITCH_HUNTER_CONFIG.blackMarket.prices.supporter[rank] || 1000;
      const filteredSupporters = WITCH_HUNTER_CONFIG.supporters.list.filter(
        (s) => s.isBlackMarket && s.rank === rank && s.faction === faction
      );

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **TẾ ĐÀI KÝ KẾT: KHẾ ƯỚC LINH HỒN CỔ ĐẠI (${rank}-RANK)** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━\n` +
          `Lữ khách đang nắm giữ trong tay tàn niệm nguyên bản thu được từ Hư Không.\n` +
          `Để hiện thực hóa bản thể và ràng buộc số mệnh, hãy lựa chọn một linh hồn tương thích với phe phái của lữ khách.\n\n` +
          `<a:whg2:1564145798537683034> **THÔNG TIN ĐÁNH ĐỔI:**\n` +
          `<a:trangtrig20:1546092997299667055> Vật phẩm: **Hộp Khế Ước Tự Chọn (${rank}-Rank)**\n` +
          `<a:trangtrig20:1546092997299667055> Chi phí giải trừ: **${price.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `<a:trangtrig20:1546092997299667055> Số dư hiện tại của lữ khách: **${currentShards.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `<a:trangtrig20:1546092997299667055> Bản mệnh tiếp nhận: ${factionEmoji} **${factionName}**\n` +
          `─────────────────\n` +
          `Chọn bản thể Supporter lữ khách muốn triệu hồi từ danh sách bên dưới:`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const options = filteredSupporters.map((s) => {
        const cat = WITCH_HUNTER_CONFIG.supporters.categories[s.categoryKey];
        return {
          label: `${s.name}`.slice(0, 100),
          description: `${s.passiveName} (${cat?.shortName || ''} | ${rank}-Rank)`.slice(0, 100),
          value: s.id,
          emoji: parseEmoji('🔮'),
        };
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`black_market_item_select:supporter:${rank}`)
        .setPlaceholder(`Chọn linh hồn ký kết khế ước ${rank}-Rank...`)
        .addOptions(options);

      return { embed, components: [new ActionRowBuilder().addComponents(selectMenu)] };
    }

    // 3. GÓI VŨ KHÍ THEO BẬC
    if (category.startsWith('weapon_')) {
      const rank = category.split('_')[1]; // 'A', 'S', 'SS'
      const price = WITCH_HUNTER_CONFIG.blackMarket.prices.weapon[rank] || 1000;
      const filteredWeapons = WITCH_HUNTER_CONFIG.weapons.list.filter(
        (w) => w.isBlackMarket && w.rank === rank && w.faction === faction
      );

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **HỘI TRƯỜNG CẤM KHÍ: GIẢI PHONG VŨ KHÍ CỔ ĐẠI (${rank}-RANK)** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━\n` +
          `Hộp kim loại ma thuật bao bọc bởi nguyền chú ăn mòn đang chờ được mở khóa.\n` +
          `Hãy lựa chọn vũ khí tương thích với nguồn ma năng hắc ám của lữ khách.\n\n` +
          `<a:whg2:1564145798537683034> **THÔNG TIN ĐÁNH ĐỔI:**\n` +
          `<a:trangtrig20:1546092997299667055> Vật phẩm: **Hộp Khí Tài Tự Chọn (${rank}-Rank)**\n` +
          `<a:trangtrig20:1546092997299667055> Chi phí khai mở: **${price.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `<a:trangtrig20:1546092997299667055> Số dư hiện tại của lữ khách: **${currentShards.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `<a:trangtrig20:1546092997299667055> Bản mệnh tiếp nhận: ${factionEmoji} **${factionName}**\n` +
          `────────────────────\n` +
          `Chọn Vũ Khí Cấm Thuật lữ khách muốn rèn đúc từ danh sách bên dưới:`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const options = filteredWeapons.map((w) => ({
        label: `${w.shortName || w.name}`.slice(0, 100),
        description: `${w.viName} • ${w.energyAttribute} (${rank}-Rank)`.slice(0, 100),
        value: w.id,
        emoji: parseEmoji('⚔️'),
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`black_market_item_select:weapon:${rank}`)
        .setPlaceholder(`Chọn Khí Tài Cấm Thuật ${rank}-Rank...`)
        .addOptions(options);

      return { embed, components: [new ActionRowBuilder().addComponents(selectMenu)] };
    }

    // 4. DANH HIỆU HẮC ÁM & ROLE
    if (category === 'title') {
      const price = WITCH_HUNTER_CONFIG.blackMarket.prices.title || 200;
      const titlesList = WITCH_HUNTER_CONFIG.darkTitles.list;

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **BẢNG PHONG ẤN DANH VỊ: DANH HIỆU HẮC ÁM ĐỘC QUYỀN** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━━\n` +
          `Những danh xưng bí ẩn từng khiến cả hai thế lực Thợ Săn và Phù Thủy kinh sợ trong thời kỳ Huyết Nguyệt.\n` +
          `Khi lĩnh hội, danh xưng sẽ khắc sâu vào hồ sơ ma thuật và tự động ban cấp Role vinh dự trên máy chủ!\n\n` +
          `<a:whg2:1564145798537683034> **THÔNG TIN ĐÁNH ĐỔI:**\n` +
          `<a:trangtrig20:1546092997299667055> Chi phí lĩnh hội: **${price}** <a:trangtrig46:1547240249761996812> / Danh hiệu\n` +
          `<a:trangtrig20:1546092997299667055> Đặc quyền: Tự động nhận Role Discord tương ứng & mở khóa chọn danh hiệu trong \`/profile\`\n` +
          `<a:trangtrig20:1546092997299667055> Số dư hiện tại của bạn: **${currentShards.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `────────────────────\n` +
          `Chọn Danh Hiệu Hắc Ám lữ khách muốn thức tỉnh:`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const options = Object.values(titlesList).map((t) => ({
        label: `｢ ${t.nameVi} ｣ ── ${t.nameEn}`.slice(0, 100),
        description: `Chi phí: ${price} Mảnh • ${t.slogan}`.slice(0, 100),
        value: t.id,
        emoji: parseEmoji('👑'),
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('black_market_item_select:title')
        .setPlaceholder('Bấm vào đây để chọn Danh Hiệu Hắc Ám...')
        .addOptions(options);

      return { embed, components: [new ActionRowBuilder().addComponents(selectMenu)] };
    }

    // 5. ĐỔI VÉ TRIỆU HỒI MIỄN PHÍ
    if (category === 'ticket') {
      const pricePerTicket = WITCH_HUNTER_CONFIG.blackMarket.prices.ticket || 100;
      const currentTickets = userData.free_summons || 0;

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **TẾ ĐÀN PHÙ THỦY: TRAO ĐỔI VÉ TRIỆU HỒI MIỄN PHÍ** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━\n` +
          `Đổi trực tiếp Mảnh Vỡ Ký Ức lấy Vé Triệu Gọi Tế Đàn để quay Vũ Khí & Supporter A-SS hoàn toàn miễn phí!\n\n` +
          `<a:whg2:1564145798537683034> **TỶ GIÁ TRAO ĐỔI:**\n` +
          `<a:trangtrig20:1546092997299667055> Đơn giá: **${pricePerTicket}** <a:trangtrig46:1547240249761996812> = **1 Vé Tế Đàn**\n` +
          `<a:trangtrig20:1546092997299667055> Số dư hiện tại: **${currentShards.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `<a:trangtrig20:1546092997299667055> Số vé hiện có trong túi đồ: **${currentTickets} vé**\n` +
          `───────────────\n` +
          `Chọn số lượng vé lữ khách muốn đổi:`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const options = [
        {
          label: 'Đổi x1 Vé Tế Đàn',
          description: '100 Mảnh Vỡ Ký Ức ──── Nhận 1 Vé Quay Tế Đàn Free',
          value: '1',
          emoji: parseEmoji('🎫'),
        },
        {
          label: 'Đổi x3 Vé Tế Đàn',
          description: '300 Mảnh Vỡ Ký Ức ──── Nhận 3 Vé Quay Tế Đàn Free',
          value: '3',
          emoji: parseEmoji('🎫'),
        },
        {
          label: 'Đổi x5 Vé Tế Đàn',
          description: '500 Mảnh Vỡ Ký Ức ──── Nhận 5 Vé Quay Tế Đàn Free',
          value: '5',
          emoji: parseEmoji('🎫'),
        },
        {
          label: 'Đổi x10 Vé Tế Đàn',
          description: '1,000 Mảnh Vỡ Ký Ức ──── Nhận 10 Vé Quay Tế Đàn Free',
          value: '10',
          emoji: parseEmoji('🎫'),
        },
      ];

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('black_market_item_select:ticket')
        .setPlaceholder('Chọn số lượng Vé Tế Đàn muốn đổi...')
        .addOptions(options);

      return { embed, components: [new ActionRowBuilder().addComponents(selectMenu)] };
    }

    return null;
  }

  /**
   * Tạo giao diện xác nhận trước khi giao dịch (Preview Confirmation)
   */
  static buildConfirmationView(userId, type, itemId) {
    const userData = witchHunterStorage.getUser(userId);
    const { colors, emojis } = WITCH_HUNTER_CONFIG;
    const currentShards = userData?.memory_shards || 0;

    // 1. SUPPORTER CONFIRMATION
    if (type === 'supporter') {
      const supporter = getSupporterById(itemId);
      if (!supporter) return null;

      const cat = WITCH_HUNTER_CONFIG.supporters.categories[supporter.categoryKey];
      const catEmoji = cat?.emoji || '<a:linhtocg:1563399670351536310>';
      const price = supporter.price || WITCH_HUNTER_CONFIG.blackMarket.prices.supporter[supporter.rank] || 1000;

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **KHẾ ƯỚC LINH HỒN: ${supporter.name.toUpperCase()} (${supporter.rank}-RANK)** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━\n` +
          `*"${supporter.awakeningQuote || ''}"*\n\n` +
          `<a:trangtrig18:1546068102817775626> **THÔNG TIN BẢN THỂ LIÊN KẾT:**\n` +
          `<a:heartg1:1545307544808071258> Bản Thể: **${supporter.fullName || supporter.name}**\n` +
          `<a:heartg1:1545307544808071258> Cấp Bậc: **${supporter.rankName}**\n` +
          `${catEmoji} Hệ Tộc: **${cat?.shortName || 'Hệ Bí Truyền'}**\n` +
          `<a:heartg1:1545307544808071258> Nguồn Gốc: **Độc quyền Chợ Đen Hư Không**\n\n` +
          `<a:knifeg1:1546058092016312381> **QUYỀN NĂNG THỨC TỈNH:**\n` +
          `> Nội tại \`[${supporter.passiveName}]\`: ${supporter.passiveDesc}\n\n` +
          `<a:trangtrig18:1546068102817775626> **ĐIỀU KHOẢN RÀNG BUỘC (WITCH HUNTER LAW):**\n` +
          `1. Một khi máu tươi chạm vào tế tự, **${price.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812> sẽ lập tức tan biến vào Hư Không.\n` +
          `2. Bản thể sau khi ký kết sẽ phụng sự vĩnh viễn trong kho hành trang, không thể hoàn tác.\n` +
          `3. Sinh lực khởi điểm của bản thể đạt 100%, sẵn sàng tham chiến hoặc đi Viễn Chinh Hư Không.\n` +
          `──────────────────\n` +
          `Chi phí: **${price.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức • Lữ khách đang có: **${currentShards.toLocaleString('vi-VN')}** Mảnh Vỡ`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const confirmButton = new ButtonBuilder()
        .setCustomId(`black_market_confirm:supporter:${supporter.id}`)
        .setLabel('KÝ KẾT KHẾ ƯỚC')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(parseEmoji('<a:linhtocg:1563399670351536310>'));

      const cancelButton = new ButtonBuilder()
        .setCustomId('black_market_cancel')
        .setLabel('HỦY BỎ')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(parseEmoji('<a:bang2:1546891483250954290>'));

      return {
        embed,
        components: [new ActionRowBuilder().addComponents(confirmButton, cancelButton)],
      };
    }

    // 2. WEAPON CONFIRMATION
    if (type === 'weapon') {
      const weapon = getWeaponById(itemId);
      if (!weapon) return null;

      const price = weapon.price || WITCH_HUNTER_CONFIG.blackMarket.prices.weapon[weapon.rank] || 1000;

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **KHÍ TÀI THẦN BINH: ${weapon.viName.toUpperCase()} (${weapon.rank}-RANK)** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━━━━\n` +
          `*"${weapon.awakeningQuote || ''}"*\n\n` +
          `<a:trangtrig18:1546068102817775626> **THÔNG TIN KHÍ TÀI CẤM THUẬT:**\n` +
          `<a:heartg1:1545307544808071258> Vũ Khí: **${weapon.name}**\n` +
          `<a:heartg1:1545307544808071258> Cấp Bậc: **${weapon.rankName}**\n` +
          `${weapon.energyEmoji} Thuộc Tính: **${weapon.energyAttribute}**\n` +
          `<a:heartg1:1545307544808071258> Nguồn Gốc: **Độc quyền Chợ Đen Hư Không**\n\n` +
          `<a:knifeg1:1546058092016312381> **QUYỀN NĂNG CHIẾN TRẬN:**\n` +
          `> Hiệu ứng \`[${weapon.viName}]\`: ${weapon.powerDetail}\n\n` +
          `<a:trangtrig18:1546068102817775626> **ĐIỀU KHOẢN RÀNG BUỘC (WITCH HUNTER LAW):**\n` +
          `1. Khấu trừ vĩnh viễn **${price.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `2. Vũ khí lưu trữ vĩnh viễn trong túi đồ, có thể tự do trang bị trong lệnh \`/profile\`.\n` +
          `──────────────\n` +
          `Chi phí: **${price.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức • Lữ khách đang có: **${currentShards.toLocaleString('vi-VN')}** Mảnh Vỡ`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const confirmButton = new ButtonBuilder()
        .setCustomId(`black_market_confirm:weapon:${weapon.id}`)
        .setLabel('MỞ KHÍ TÀI')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(parseEmoji('<a:knifeg1:1546058092016312381>'));

      const cancelButton = new ButtonBuilder()
        .setCustomId('black_market_cancel')
        .setLabel('HỦY BỎ')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(parseEmoji('<a:bang2:1546891483250954290>'));

      return {
        embed,
        components: [new ActionRowBuilder().addComponents(confirmButton, cancelButton)],
      };
    }

    // 3. TITLE CONFIRMATION
    if (type === 'title') {
      const title = WITCH_HUNTER_CONFIG.darkTitles.list[itemId];
      if (!title) return null;

      const price = WITCH_HUNTER_CONFIG.blackMarket.prices.title || 200;

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **LĨNH HỘI DANH VỊ: ${title.nameVi.toUpperCase()}** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━━━━━\n` +
          `*"${title.slogan}"*\n\n` +
          `<a:trangtrig18:1546068102817775626> **THÔNG TIN DANH HIỆU:**\n` +
          `<a:heartg1:1545307544808071258> Tên Tiếng Việt: ｢ **${title.nameVi}** ｣\n` +
          `<a:heartg1:1545307544808071258> Tên Tiếng Anh: **${title.nameEn}**\n` +
          `<a:heartg1:1545307544808071258> Quyền lợi: Tự động gán Role <@&${title.roleId}> trên máy chủ Discord\n` +
          `<a:heartg1:1545307544808071258> Hiển thị: Xuất hiện vinh danh ngay dòng đầu tiên trong lệnh \`/profile\`\n\n` +
          `<a:trangtrig18:1546068102817775626> **ĐIỀU KHOẢN:**\n` +
          `1. Tiêu hao **${price}** <a:trangtrig46:1547240249761996812>\n` +
          `2. Danh hiệu được lưu vĩnh viễn vào bộ sưu tập cá nhân, có thể đổi qua lại bất kỳ lúc nào trong \`/profile\`.\n` +
          `────────────────────\n` +
          `Chi phí: **${price}** Mảnh Vỡ Ký Ức • Lữ khách đang có: **${currentShards.toLocaleString('vi-VN')}** Mảnh Vỡ`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const confirmButton = new ButtonBuilder()
        .setCustomId(`black_market_confirm:title:${title.id}`)
        .setLabel('KHẮC ẤN DANH HIỆU')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(parseEmoji('<a:trangtrig14:1546047912969113622>'));

      const cancelButton = new ButtonBuilder()
        .setCustomId('black_market_cancel')
        .setLabel('HỦY BỎ')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(parseEmoji('<a:bang2:1546891483250954290>'));

      return {
        embed,
        components: [new ActionRowBuilder().addComponents(confirmButton, cancelButton)],
      };
    }

    // 4. TICKET CONFIRMATION
    if (type === 'ticket') {
      const count = parseInt(itemId, 10) || 1;
      const pricePerTicket = WITCH_HUNTER_CONFIG.blackMarket.prices.ticket || 100;
      const totalCost = count * pricePerTicket;

      const embed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} **XÁC NHẬN ĐỔI: VÉ TRIỆU HỒI TẾ ĐÀN (x${count})** ${emojis.titleRight}`)
        .setDescription(
          `━━━━━━━━━━━━━\n` +
          `Lữ khách đang chuẩn bị đổi Mảnh Vỡ Ký Ức lấy **x${count} Vé Triệu Gọi Tế Đàn Miễn Phí**!\n\n` +
          `<a:whg2:1564145798537683034> **CHI TIẾT TRAO ĐỔI:**\n` +
          `<a:heartg1:1545307544808071258> Số lượng: **${count} Vé**\n` +
          `<a:heartg1:1545307544808071258> Tổng chi phí: **${totalCost.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
          `<a:heartg1:1545307544808071258> Số dư hiện tại: **${currentShards.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n\n` +
          `<a:trangtrig18:1546068102817775626> **ĐIỀU KHOẢN:**\n` +
          `1. Vé sau khi đổi sẽ cộng trực tiếp vào túi đồ cá nhân.\n` +
          `2. Dùng để quay thưởng tại Tế Đàn Huyết Nguyệt không tốn Bí Ngô!\n` +
          `───────────────\n` +
          `Chi phí: **${totalCost.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức • Lữ khách đang có: **${currentShards.toLocaleString('vi-VN')}** Mảnh Vỡ`
        )
        .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' });

      const confirmButton = new ButtonBuilder()
        .setCustomId(`black_market_confirm:ticket:${count}`)
        .setLabel('XÁC NHẬN ĐỔI VÉ')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(parseEmoji('<a:giftg1:1543150714732412948>'));

      const cancelButton = new ButtonBuilder()
        .setCustomId('black_market_cancel')
        .setLabel('HỦY BỎ')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(parseEmoji('<a:bang2:1546891483250954290>'));

      return {
        embed,
        components: [new ActionRowBuilder().addComponents(confirmButton, cancelButton)],
      };
    }

    return null;
  }

  /**
   * Tạo Embed thông báo khi không đủ Mảnh Vỡ Ký Ức
   */
  static buildInsufficientBalanceEmbed(required, current) {
    const { colors } = WITCH_HUNTER_CONFIG;
    const missing = required - current;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setDescription(
        `<a:bang2:1546891483250954290> **KHÔNG ĐỦ MẢNH VỠ KÝ ỨC!**\n` +
        `Lữ khách không có đủ số lượng Mảnh Vỡ Ký Ức để thực hiện giao dịch này!\n\n` +
        `<a:trangtrig46:1547240249761996812> Yêu cầu: **${required.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức\n` +
        `<a:trangtrig46:1547240249761996812> Lữ khách hiện có: **${current.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức\n` +
        `<a:trangtrig46:1547240249761996812> Còn thiếu: **-${missing.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức nữa\n\n` +
        `> Mẹo từ Em Phù Thủy Usagi múp rụp: Lữ khách hãy tích cực tham gia tính năng **Viễn Chinh Hư Không** để thu thập thêm thật nhiều Mảnh Vỡ Ký Ức nha! 💕`
      );
  }

  /**
   * Thực hiện giao dịch mua hàng, trừ tiền, phát item, gán role, và bắn audit log cho Admin
   */
  static async executePurchase({ userId, type, itemId, guild, client, user }) {
    let userData = witchHunterStorage.getUser(userId);
    if (!userData || !userData.faction) {
      return {
        success: false,
        message: 'Lữ khách chưa ký khế ước gia nhập phe phái!',
      };
    }

    const currentShards = userData.memory_shards || 0;
    let requiredCost = 0;
    let transactionType = '';
    let itemLabel = '';
    let itemExtraStatus = '';
    let successNarrative = '';
    let itemSuccessTag = '';

    // A. XỬ LÝ THEO LOẠI VẬT PHẨM
    if (type === 'supporter') {
      const supporter = getSupporterById(itemId);
      if (!supporter) return { success: false, message: 'Supporter không tồn tại!' };
      requiredCost = supporter.price || WITCH_HUNTER_CONFIG.blackMarket.prices.supporter[supporter.rank] || 1000;
      const cat = WITCH_HUNTER_CONFIG.supporters.categories[supporter.categoryKey];

      if (currentShards < requiredCost) {
        return {
          success: false,
          notEnough: true,
          required: requiredCost,
          current: currentShards,
        };
      }

      transactionType = 'Ký Kết Khế Ước Supporter Độc Quyền';
      itemLabel = `${supporter.fullName || supporter.name} [${supporter.rank}-Rank | ${cat?.shortName || ''}]`;
      itemExtraStatus = 'Đã thêm vào túi đồ cá nhân (100% HP)';
      successNarrative =
        `Sợi xích linh hồn đã trói buộc thành công giữa lữ khách và ${supporter.name}.\n` +
        `Một bóng ma nguyền rủa từ nay sẽ đồng hành cùng lữ khách trên mọi chiến trường diệt ma!`;
      itemSuccessTag = `Supporter [${supporter.name}] (${supporter.rank}-Rank | 100% Sinh Lực)`;

      // Khấu trừ tài nguyên
      userData.memory_shards -= requiredCost;

      // Cấp Supporter
      userData.unlocked_supporters = Array.isArray(userData.unlocked_supporters) ? userData.unlocked_supporters : [];
      if (!userData.unlocked_supporters.includes(supporter.id)) {
        userData.unlocked_supporters.push(supporter.id);
      }
      if (!userData.supporter_hp || typeof userData.supporter_hp !== 'object') {
        userData.supporter_hp = {};
      }
      userData.supporter_hp[supporter.id] = 100;

      // Lưu kho summon
      witchHunterSummonStorage.addItemToInventory(userId, 'supporter', supporter.id, supporter.rank);
      witchHunterStorage.saveUser(userData, true);

    } else if (type === 'weapon') {
      const weapon = getWeaponById(itemId);
      if (!weapon) return { success: false, message: 'Vũ khí không tồn tại!' };
      requiredCost = weapon.price || WITCH_HUNTER_CONFIG.blackMarket.prices.weapon[weapon.rank] || 1000;

      if (currentShards < requiredCost) {
        return {
          success: false,
          notEnough: true,
          required: requiredCost,
          current: currentShards,
        };
      }

      transactionType = 'Giải Phong Khí Tài Vũ Khí Độc Quyền';
      itemLabel = `${weapon.name} [${weapon.rank}-Rank | ${weapon.energyAttribute}]`;
      itemExtraStatus = 'Đã thêm vào kho vũ khí thần binh';
      successNarrative =
        `Phong ấn cổ xưa đã được phá vỡ, vũ khí cấm thuật ${weapon.viName} đã hoàn toàn quy phục lữ khách!\n` +
        `Sức mạnh hủy diệt nay nằm trọn trong tay lữ khách, sẵn sàng nghiền nát mọi kẻ thù.`;
      itemSuccessTag = `Vũ Khí [${weapon.shortName || weapon.name}] (${weapon.rank}-Rank)`;

      // Khấu trừ tài nguyên
      userData.memory_shards -= requiredCost;

      // Cấp Vũ Khí
      userData.unlocked_weapons = Array.isArray(userData.unlocked_weapons) ? userData.unlocked_weapons : [];
      if (!userData.unlocked_weapons.includes(weapon.id)) {
        userData.unlocked_weapons.push(weapon.id);
      }

      // Lưu kho summon
      witchHunterSummonStorage.addItemToInventory(userId, 'weapon', weapon.id, weapon.rank);
      witchHunterStorage.saveUser(userData, true);

    } else if (type === 'title') {
      const title = WITCH_HUNTER_CONFIG.darkTitles.list[itemId];
      if (!title) return { success: false, message: 'Danh hiệu không tồn tại!' };
      requiredCost = WITCH_HUNTER_CONFIG.blackMarket.prices.title || 200;

      if (currentShards < requiredCost) {
        return {
          success: false,
          notEnough: true,
          required: requiredCost,
          current: currentShards,
        };
      }

      transactionType = 'Lĩnh Hội Danh Hiệu Hắc Ám & Cấp Role';
      itemLabel = `｢ ${title.nameVi} ｣ ── ${title.nameEn}`;
      itemExtraStatus = `Đã cấp Role Discord & khắc ấn vào /profile`;
      successNarrative =
        `Danh xưng huyền thoại ｢ ${title.nameVi} ｣ đã được khắc sâu vào linh hồn của lữ khách!\n` +
        `Role vinh dự trên máy chủ Discord đã được tự động trao tặng và cập nhật vào hồ sơ ma thuật.`;
      itemSuccessTag = `Danh Hiệu [${title.nameVi}] & Role Discord`;

      // Khấu trừ tài nguyên
      userData.memory_shards -= requiredCost;

      // Mở khóa danh hiệu & kích hoạt
      userData.unlocked_titles = Array.isArray(userData.unlocked_titles) ? userData.unlocked_titles : [];
      if (!userData.unlocked_titles.includes(title.id)) {
        userData.unlocked_titles.push(title.id);
      }
      userData.dark_title = title.id;
      witchHunterStorage.saveUser(userData, true);

      // Cấp Role Discord & gỡ các role danh hiệu cũ
      if (guild) {
        await WitchHunterBlackMarketService.syncDarkTitleRole(guild, userId, title.id);
      }

    } else if (type === 'ticket') {
      const count = parseInt(itemId, 10) || 1;
      const pricePerTicket = WITCH_HUNTER_CONFIG.blackMarket.prices.ticket || 100;
      requiredCost = count * pricePerTicket;

      if (currentShards < requiredCost) {
        return {
          success: false,
          notEnough: true,
          required: requiredCost,
          current: currentShards,
        };
      }

      transactionType = 'Trao Đổi Vé Triệu Gọi Tế Đàn';
      itemLabel = `x${count} Vé Triệu Gọi Tế Đàn Miễn Phí`;
      itemExtraStatus = `Đã cộng trực tiếp vào túi đồ cá nhân`;
      successNarrative =
        `Nghi thức hoán đổi hoàn tất! Lữ khách đã nhận thêm **${count} Vé Triệu Gọi Tế Đàn Miễn Phí**.\n` +
        `Hãy dùng vé này tại Tế Đàn Huyết Nguyệt để triệu hồi thần binh và supporter tối thượng!`;
      itemSuccessTag = `x${count} Vé Triệu Gọi Tế Đàn`;

      // Khấu trừ tài nguyên & cộng vé
      userData.memory_shards -= requiredCost;
      userData.free_summons = (userData.free_summons || 0) + count;
      witchHunterStorage.saveUser(userData, true);
    } else {
      return { success: false, message: 'Loại vật phẩm không hợp lệ!' };
    }

    const newBalance = userData.memory_shards || 0;
    const { colors, emojis } = WITCH_HUNTER_CONFIG;

    // B. DỰNG EMBED THÀNH CÔNG CHO USER (EPHEMERAL)
    const successEmbed = new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} **NGHI THỨC HOÀN TẤT: KHẾ ƯỚC ĐÃ THÀNH!** ${emojis.titleRight}`)
      .setDescription(
        `━━━━━━━━━━━━━━━━━\n` +
        `${successNarrative}\n\n` +
        `<a:bang2:1546891483250954290> **CHI TIẾT GIAO DỊCH:**\n` +
        `<a:trangtrig46:1547240249761996812> Khấu trừ tài nguyên: **-${requiredCost.toLocaleString('vi-VN')}** <a:trangtrig46:1547240249761996812>\n` +
        `<a:trangtrig46:1547240249761996812> Số dư còn lại: **${newBalance.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức\n` +
        `<a:trangtrig46:1547240249761996812> Đã thêm vào túi đồ: **${itemSuccessTag}**\n\n` +
        `> <a:bang2:1546891483250954290> Gợi ý từ Em Phù Thủy Usagi múp rụp: Hãy dùng lệnh \`/profile\` để kiểm tra bản thể mới và chuẩn bị khí tài cho đợt Viễn Chinh kế tiếp nha! <a:heartg1:1545307544808071258>`
      )
      .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' })
      .setTimestamp();

    // C. BẮN LOG TỰ ĐỘNG SANG KÊNH ADMIN CHỈ ĐỊNH
    const adminLogChannelId = WITCH_HUNTER_CONFIG.channels.adminLogChannelId;
    if (adminLogChannelId && client) {
      try {
        const channel = await client.channels.fetch(adminLogChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const currentRank = userData.current_rank || 1;
          const rankInfo = WitchHunterService.getRankInfo(userData.faction, currentRank);
          const rankLetter = WitchHunterService.tierToLetter(currentRank);
          const isHunter = userData.faction === 'hunter';
          const factionName = isHunter ? 'Hiệp Hội Thợ Săn' : 'Hội Phù Thủy';
          const factionEmoji = isHunter ? emojis.hunterButton : emojis.witchButton;
          const vnDateStr = new Date().toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false,
          });

          const adminEmbed = new EmbedBuilder()
            .setColor(colors.pastelPurple)
            .setTitle(`${emojis.titleLeft} **NHẬT KÝ CHỢ ĐEN: GIAO DỊCH THÀNH CÔNG** ${emojis.titleRight}`)
            .setDescription(
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Hệ thống ghi nhận một giao dịch đổi Mảnh Vỡ Ký Ức thành công tại Chợ Đen Hư Không!\n\n` +
              `<a:heartg1:1545307544808071258> **Thành Viên Giao Dịch:**\n` +
              `<a:trangtrig46:1547240249761996812> Người mua: <@${userId}> (\`${user?.username || userId}\` | ID: \`${userId}\`)\n` +
              `${factionEmoji} Phe phái: **${factionName}**\n` +
              `<a:trangtrig46:1547240249761996812> Cấp bậc hiện tại: **Bậc ${currentRank} (${rankLetter}-Rank) — ${rankInfo?.title || ''}**\n\n` +
              `<a:heartg1:1545307544808071258> **Vật Phẩm Giao Dịch:**\n` +
              `<a:trangtrig46:1547240249761996812> Loại giao dịch: **${transactionType}**\n` +
              `<a:linhtocg:1563399670351536310> Vật phẩm nhận: **${itemLabel}**\n` +
              `<a:trangtrig46:1547240249761996812> Trạng thái bổ sung: **${itemExtraStatus}**\n\n` +
              `<a:heartg1:1545307544808071258> **Biến Động Mảnh Vỡ Ký Ức:**\n` +
              `<a:trangtrig46:1547240249761996812> Số lượng khấu trừ: **-${requiredCost.toLocaleString('vi-VN')}** Mảnh Ký Ức\n` +
              `<a:trangtrig46:1547240249761996812> Số dư trước giao dịch: **${currentShards.toLocaleString('vi-VN')}** Mảnh Ký Ức\n` +
              `<a:trangtrig46:1547240249761996812> Số dư còn lại hiện tại: **${newBalance.toLocaleString('vi-VN')}** Mảnh Ký Ức\n\n` +
              `<a:heartg1:1545307544808071258> **Thời Gian Giao Dịch:**\n` +
              `> ${vnDateStr} (Giờ Việt Nam)\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `*Witch Hunter Black Market Audit Log*`
            )
            .setFooter({ text: 'Witch Hunter Admin Audit Log' })
            .setTimestamp();

          await channel.send({ embeds: [adminEmbed] }).catch(() => null);
        }
      } catch (err) {
        logger.error('❌ [WitchHunterBlackMarket] Không thể gửi log giao dịch admin:', err);
      }
    }

    return {
      success: true,
      embed: successEmbed,
    };
  }

  /**
   * Tự động đồng bộ gắn role danh hiệu được chọn và gỡ toàn bộ các role danh hiệu hắc ám khác
   * @param {import('discord.js').Guild} guild
   * @param {string} userId
   * @param {string|null} targetTitleKey
   */
  static async syncDarkTitleRole(guild, userId, targetTitleKey = null) {
    if (!guild || !userId) return;
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const titlesList = WITCH_HUNTER_CONFIG.darkTitles?.list || {};
      const allTitleRoleIds = Object.values(titlesList).map((t) => t.roleId).filter(Boolean);

      let activeKey = targetTitleKey;
      if (activeKey === null) {
        const userData = witchHunterStorage.getUser(userId);
        activeKey = userData?.dark_title || null;
      }

      const activeTitleInfo = activeKey && activeKey !== 'none' ? titlesList[activeKey] : null;
      const targetRoleId = activeTitleInfo?.roleId || null;

      // 1. Gỡ tất cả các role danh hiệu hắc ám khác đang có trên thành viên
      for (const rId of allTitleRoleIds) {
        if (rId !== targetRoleId && member.roles.cache.has(rId)) {
          await member.roles.remove(rId).catch((err) => {
            logger.warn(`⚠️ [WitchHunterTitle] Không thể gỡ role danh hiệu ${rId} của user ${userId}:`, err.message);
          });
        }
      }

      // 2. Gắn role danh hiệu mới nếu chưa có
      if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
        await member.roles.add(targetRoleId).catch((err) => {
          logger.warn(`⚠️ [WitchHunterTitle] Không thể gắn role danh hiệu ${targetRoleId} cho user ${userId}:`, err.message);
        });
      }
    } catch (err) {
      logger.warn(`⚠️ [WitchHunterTitle] Lỗi khi đồng bộ role danh hiệu cho user ${userId}:`, err.message);
    }
  }

  /**
   * Ban thưởng Mảnh Vỡ Ký Ức (memory_shards) cho thành viên (Dành cho Admin)
   */
  static async awardMemoryShards(
    guild,
    memberOrId,
    amount,
    { reason = '', executor = null, source = 'Lệnh /phat-manh-vo-ky-uc', notifyDM = true, notifyAdminLog = true } = {}
  ) {
    const numAmount = parseInt(amount, 10);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return { success: false, message: 'Số lượng Mảnh Vỡ Ký Ức phải là số nguyên dương lớn hơn 0!' };
    }

    const userId = typeof memberOrId === 'string' ? memberOrId : memberOrId.id;
    let userData = witchHunterStorage.getUser(userId);
    if (!userData) {
      userData = witchHunterStorage.createUser(userId);
    }

    const oldShards = userData.memory_shards || 0;
    const newShards = oldShards + numAmount;
    userData.memory_shards = newShards;
    witchHunterStorage.saveUser(userData, true);

    // Đồng bộ Pity Tracker trong witchHunterSummonStorage
    try {
      const tracker = witchHunterSummonStorage.getPityTracker(userId);
      if (tracker) {
        tracker.memory_shards = (tracker.memory_shards || 0) + numAmount;
        witchHunterSummonStorage.savePityTracker(tracker);
      }
    } catch {}

    const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

    // Gửi DM thông báo cho người nhận
    if (notifyDM && guild?.client) {
      try {
        const userObj = await guild.client.users.fetch(userId).catch(() => null);
        if (userObj) {
          const dmEmbed = new EmbedBuilder()
            .setColor(colors.pastelPurple)
            .setTitle(`${emojis.titleLeft} **BAN THƯỞNG MẢNH VỠ KÝ ỨC** ${emojis.titleRight}`)
            .setDescription(
              `Chào **Lữ Khách** thân mến! Em phù thủy nóng bỏng Usagi múp rụp mang tin vui tới cho lữ khách nè! 💕\n\n` +
              `Lữ khách vừa nhận được **+${numAmount.toLocaleString('vi-VN')} Mảnh Vỡ Ký Ức** <a:trangtrig46:1547240249761996812> từ ${executor ? `<@${executor.id}>` : 'Ban Quản Trị'}!\n` +
              (reason ? `> 📝 **Lý do:** ${reason}\n\n` : '\n') +
              `<a:trangtrig46:1547240249761996812> **Số dư Mảnh Vỡ Ký Ức hiện tại:** **${newShards.toLocaleString('vi-VN')}** Mảnh\n` +
              `> Ghé ngay qua **Chợ Đen Hư Không** để đổi Supporter độc quyền, Vũ Khí Cấm Thuật và Danh Hiệu Hắc Ám nha! 💕`
            )
            .setFooter({ text: 'Witch Hunter System • Chợ Đen Hư Không' })
            .setTimestamp();
          await userObj.send({ embeds: [dmEmbed] }).catch(() => null);
        }
      } catch {}
    }

    // Gửi Admin Log
    if (notifyAdminLog && guild) {
      try {
        const adminLogChannelId = channels.adminLogChannelId;
        const channel =
          guild.channels?.cache?.get(adminLogChannelId) ||
          (await guild.channels?.fetch?.(adminLogChannelId).catch(() => null));
        if (channel && channel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(colors.pastelPurple)
            .setTitle(`${emojis.titleLeft} **NHẬT KÝ ADMIN: PHÁT MẢNH VỠ KÝ ỨC** ${emojis.titleRight}`)
            .setDescription(
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `Ban Quản Trị vừa ban thưởng Mảnh Vỡ Ký Ức cho thành viên!\n\n` +
              `👤 **Người Nhận:** <@${userId}> (ID: \`${userId}\`)\n` +
              `👑 **Người Ban Thưởng:** ${executor ? `<@${executor.id}>` : 'Hệ Thống'}\n` +
              `<a:trangtrig46:1547240249761996812> **Số Lượng Phát:** **+${numAmount.toLocaleString('vi-VN')}** Mảnh Vỡ Ký Ức\n` +
              `📊 **Biến Động Số Dư:** ${oldShards.toLocaleString('vi-VN')} ➡️ **${newShards.toLocaleString('vi-VN')}** Mảnh\n` +
              `📝 **Lý Do:** ${reason || 'Admin ban thưởng trực tiếp'}\n` +
              `📍 **Nguồn:** ${source}`
            )
            .setFooter({ text: 'Witch Hunter System' })
            .setTimestamp();
          await channel.send({ embeds: [logEmbed] }).catch(() => null);
        }
      } catch {}
    }

    return {
      success: true,
      userId,
      amount: numAmount,
      oldShards,
      newShards,
      faction: userData.faction,
    };
  }
}
