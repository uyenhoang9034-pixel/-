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
  getSupporterById,
  getWeaponById,
} from '../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from './witchHunterService.js';
import { WitchHunterDuelService } from './witchHunterDuelService.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const WORLD_BOSS_JSON_PATH = path.join(DATA_DIR, 'witch_hunter_world_boss.json');

// Danh sách Boss & Đặc tính khắc hệ
export const WORLD_BOSS_CONFIGS = {
  avalonia: {
    id: 'avalonia',
    name: 'MA NỮ THA HÓA CỔ ĐẠI - AVALONIA',
    title: 'Ma Nữ Tha Hóa Cổ Đại - Avalonia',
    trait: 'Ma Thuật Hắc Ám Cổ Cực',
    weakness: 'Bị đạn bạc & cấm khí khắc chế mạnh (x2 Sát Thương)!',
    hunterEffect: 'Khắc chế điểm yếu (x2) -> 2% ~ 10% (x1.5 Cộng Hưởng: 3% ~ 15%) / đòn theo Bậc.',
    witchEffect: 'Đòn đánh tiêu chuẩn (x1) -> 1% ~ 5% (x1.5 Cộng Hưởng: 1.5% ~ 7.5%) / đòn theo Bậc.',
    weaknessFaction: 'hunter',
    weaknessFlavor: 'Đòn đánh xuyên qua ma khí hắc ám của Boss (Khắc Chế Điểm Yếu x2 Sát Thương)!',
    normalFlavor: 'Đòn đánh ma thuật tiêu chuẩn!',
  },
  void: {
    id: 'void',
    name: 'CẤM KHÍ HƯ KHÔNG - VOID MONARCH',
    title: 'Cấm Khí Hư Không',
    trait: 'Hư Không Thao Túng & Huyết Ma Giới',
    weakness: 'Bị cổ thuật & nguyên thể phong ấn mạnh (x2 Sát Thương)!',
    hunterEffect: 'Đòn đánh tiêu chuẩn (x1) -> 1% ~ 5% (x1.5 Cộng Hưởng: 1.5% ~ 7.5%) / đòn theo Bậc.',
    witchEffect: 'Khắc chế điểm yếu (x2) -> 2% ~ 10% (x1.5 Cộng Hưởng: 3% ~ 15%) / đòn theo Bậc.',
    weaknessFaction: 'witch',
    weaknessFlavor: 'Cổ thuật phá vỡ kết giới Hư Không của Boss (Khắc Chế Điểm Yếu x2 Sát Thương)!',
    normalFlavor: 'Đòn đánh vật lý ma thuật tiêu chuẩn!',
  },
};

function createProgressBar(percent, length = 20) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

class WitchHunterWorldBossService {
  constructor() {
    this.activeBoss = null;
    this.batchTimer = null;
    this.endTimer = null;
    this.init();
  }

  async init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      let data = await getFromDb('temp:witch_hunter:world_boss_active').catch(() => null);
      if (!data && fs.existsSync(WORLD_BOSS_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(WORLD_BOSS_JSON_PATH, 'utf-8');
          data = JSON.parse(raw);
        } catch {}
      }

      if (data && data.status === 'active' && data.endTime > Date.now()) {
        const participantsMap = new Map();
        if (Array.isArray(data.participants)) {
          for (const p of data.participants) {
            participantsMap.set(p.userId, p);
          }
        }
        this.activeBoss = {
          ...data,
          participants: participantsMap,
        };
        logger.info(`👹 [WorldBoss] Đã nạp lại sự kiện World Boss đang mở: ${this.activeBoss.bossConfig?.title}`);
      }
    } catch (err) {
      logger.error('❌ [WorldBoss] Lỗi nạp dữ liệu World Boss:', err);
    }
  }

  async saveState() {
    try {
      if (!this.activeBoss) return;
      const serializable = {
        ...this.activeBoss,
        participants: Array.from(this.activeBoss.participants.values()),
      };
      fs.writeFileSync(WORLD_BOSS_JSON_PATH, JSON.stringify(serializable, null, 2), 'utf-8');
      await setInDb('temp:witch_hunter:world_boss_active', serializable).catch(() => null);
    } catch (err) {
      logger.error('❌ [WorldBoss] Lỗi lưu trạng thái World Boss:', err);
    }
  }

  isBossActive() {
    return Boolean(this.activeBoss && this.activeBoss.status === 'active');
  }

  /**
   * Khởi tạo World Boss
   */
  async startWorldBoss({ interaction, bossType = 'avalonia', durationMinutes = 60, channel = null }) {
    if (this.isBossActive()) {
      return {
        success: false,
        message: '<a:bang2:1546891483250954290> Hiện đang có chiến dịch Bách Quỷ Dạ Hành đang diễn ra rồi!',
      };
    }

    const bossConfig = WORLD_BOSS_CONFIGS[bossType] || WORLD_BOSS_CONFIGS.avalonia;
    const defaultChannelId = WITCH_HUNTER_CONFIG.channels.worldBossChannelId || '1564565572098990131';
    const targetChannel =
      channel ||
      interaction.guild.channels.cache.get(defaultChannelId) ||
      (await interaction.guild.channels.fetch(defaultChannelId).catch(() => null)) ||
      interaction.channel;

    const durationMs = durationMinutes * 60 * 1000;
    const now = Date.now();
    const endTime = now + durationMs;

    this.activeBoss = {
      guildId: interaction.guildId,
      channelId: targetChannel.id,
      messageId: null,
      bossType,
      bossConfig,
      resistance: 100,
      startTime: now,
      endTime,
      durationMinutes,
      status: 'active',
      participants: new Map(),
      factionDamage: {
        hunter: 0,
        witch: 0,
      },
      isDirty: false,
    };

    const embed = this.buildDashboardEmbed();
    const components = this.buildDashboardComponents(false);

    const msg = await targetChannel.send({
      content: '<@&1563426234787041331>',
      embeds: [embed],
      components,
    });
    this.activeBoss.messageId = msg.id;

    await this.saveState();

    // Batch update mỗi 2 phút (120,000ms) để tối ưu RAM và tránh Rate Limit
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.batchTimer = setInterval(() => {
      this.flushBatchUpdate(interaction.client);
    }, 120000);

    // Timer kết thúc tự động khi hết giờ
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => {
      this.endWorldBoss(interaction.client, { reason: 'timeout' });
    }, durationMs);

    logger.info(`👹 [WorldBoss] Đã khai mở sự kiện Bách Quỷ Dạ Hành (${durationMinutes}p) tại #${targetChannel.name}.`);

    return {
      success: true,
      channelId: targetChannel.id,
      bossName: bossConfig.title,
      durationMinutes,
    };
  }

  formatTimeRemaining(ms) {
    if (ms <= 0) return '0 phút 0 giây';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m} phút ${s} giây`;
  }

  formatEndTimeString(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Tạo Embed Bảng Điều Khiển Tổng Bách Quỷ Dạ Hành
   */
  buildDashboardEmbed() {
    const { colors, emojis } = WITCH_HUNTER_CONFIG;
    const state = this.activeBoss;
    if (!state) return new EmbedBuilder();

    const now = Date.now();
    const remainMs = Math.max(0, state.endTime - now);
    const remainingTimeStr = this.formatTimeRemaining(remainMs);
    const endTimeStr = this.formatEndTimeString(state.endTime);

    const resBar = createProgressBar(state.resistance, 20);
    const erodedResistance = 100 - state.resistance;

    const hunterDmg = state.factionDamage.hunter || 0;
    const witchDmg = state.factionDamage.witch || 0;
    const totalFactionDmg = hunterDmg + witchDmg;

    let hunterPct = 50;
    let witchPct = 50;
    if (totalFactionDmg > 0) {
      hunterPct = Math.round((hunterDmg / totalFactionDmg) * 100);
      witchPct = 100 - hunterPct;
    }
    const hunterBar = createProgressBar(hunterPct, 20);
    const witchBar = createProgressBar(witchPct, 20);

    let leadingFactionText = 'Cân bằng thế trận';
    if (hunterDmg > witchDmg) {
      leadingFactionText = 'Hiệp Hội Thợ Săn';
    } else if (witchDmg > hunterDmg) {
      leadingFactionText = 'Hội Phù Thủy';
    }

    // Lấy Top 5 dẫn đầu
    const sorted = Array.from(state.participants.values()).sort(
      (a, b) => b.damage - a.damage || a.hits - b.hits
    );
    const top5 = sorted.slice(0, 5);

    let top5Text = '';
    if (top5.length === 0) {
      top5Text = '> *Chưa có chiến binh nào ra đòn công phá kết giới.*';
    } else {
      top5Text = top5
        .map((p, idx) => {
          const rankNum = idx + 1;
          const factionEmoji =
            p.faction === 'hunter'
              ? '<a:trangtrig36:1563065680922808340>'
              : '<a:trangtrig32:1546906170994856026>';
          const factionTitle = p.faction === 'hunter' ? 'Thần Khí Sĩ' : 'Cổ Thuật Sĩ';
          const top1Badge = rankNum === 1 ? ' <a:trangtrig14:1546047912969113622>' : '';
          return `${rankNum}. ${factionEmoji} [${factionTitle}] **${p.displayName || p.username}** ──── ${p.damage}% Kháng Cự (${p.hits} lượt)${top1Badge}`;
        })
        .join('\n');
    }

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple) // BẮT BUỘC MÀU TÍM PASTEL
      .setTitle(`${emojis.titleLeft} BÁCH QUỶ DẠ HÀNH: HUYẾT NGUYỆT GIÁNG LÂM ${emojis.titleRight}`)
      .setDescription(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:whg2:1564145798537683034> Thời gian kết thúc: **${endTimeStr}**\n` +
        `> Còn lại: \`${remainingTimeStr}\`\n` +
        `<a:whg2:1564145798537683034> Trạng thái: **ĐANG NỔ RA CHIẾN DỊCH DIỆT THẾ!**\n\n` +
        `**THỰC THỂ GIÁNG TRẦN:**\n` +
        `<a:nguyentheg:1563399515732443177> **${state.bossConfig.name}**\n` +
        `<a:whg1:1563430946835931187> Đặc tính: ${state.bossConfig.trait}\n` +
        `<a:whg1:1563430946835931187> Điểm yếu khắc chế: ${state.bossConfig.weakness}\n` +
        `<a:trangtrig36:1563065680922808340> Thần Khí Sĩ (Thợ Săn): ${state.bossConfig.hunterEffect}\n` +
        `<a:trangtrig32:1546906170994856026> Cổ Thuật Sĩ (Phù Thủy): ${state.bossConfig.witchEffect}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:whg1:1563430946835931187> **THANH KHÁNG CỰ CỦA THỰC THỂ:**\n` +
        `\`[${resBar}]\` **${state.resistance}% / 100%**\n` +
        `> Đã bào mòn: **${erodedResistance}% Kháng Cự**\n\n` +
        `<a:whg1:1563430946835931187> **TỶ LỆ CỐNG HIẾN PHE PHÁI:**\n` +
        `<a:trangtrig36:1563065680922808340> Hiệp Hội Thợ Săn:  ${hunterPct}% \`[${hunterBar}]\` (${hunterDmg}% Kháng Cự đã trừ)\n` +
        `<a:trangtrig32:1546906170994856026> Hội Phù Thủy:      ${witchPct}% \`[${witchBar}]\` (${witchDmg}% Kháng Cự đã trừ)\n` +
        `<a:trangtrig14:1546047912969113622> **Tạm dẫn điểm: ${leadingFactionText}**\n` +
        `> *Có thể sẽ giữ quyền nhận Ban Phước +5% Trụ Tổng nếu chiến thắng*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:animeg2:1546040159886114846> **TOP 5 THỢ SĂN & CỔ THUẬT SĨ DẪN ĐẦU (TIẾN TRÌNH VÉ TẾ ĐÀN):**\n` +
        `${top5Text}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:giftg1:1543150714732412948> **CƠ CẤU PHẦN THƯỞNG (DÙ BOSS CHẾT HAY KHÔNG):**\n` +
        `> • **Thưởng BXH:** Top 1: +20, Top 2: +15, Top 3: +12, Top 4-5: +10, Top 6-7: +8, Top 8-9: +6, Top 10-12: +4 <a:bingo:1563061901800243253>\n` +
        `> • **Top 1 – 5 DPS:** Nhận thêm **1 Vé Quay Tế Đàn Miễn Phí** (Supporter/Thần Khí A-SS)\n` +
        `> • **Nếu diệt Boss:** Tất cả người tham chiến nhận thêm **+1 <a:bingo:1563061901800243253>**\n\n` +
        `<a:bang2:1546891483250954290> **Bấm nút bên dưới để dồn toàn lực xuất chiêu công phá kết giới Boss!**`
      )
      .setFooter({ text: 'Hệ thống tự động gom batch đồng bộ mỗi 2 phút • Witch Hunter World Boss' })
      .setTimestamp();

    return embed;
  }

  /**
   * Tạo Nút Bấm Tương Tác (Toàn bộ Secondary - Full Xám)
   */
  buildDashboardComponents(disabled = false) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wb_attack')
        .setLabel(disabled ? 'CHIẾN DỊCH ĐÃ KẾT THÚC' : 'TUNG ĐÒN TIẾN CÔNG')
        .setEmoji('<a:whg2:1564145798537683034>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('wb_top12')
        .setLabel('Bảng Xếp Hạng Top 12')
        .setEmoji('<a:whg2:1564145798537683034>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wb_my_stats')
        .setLabel('Chiến Tích Của Tôi')
        .setEmoji('<a:whg2:1564145798537683034>')
        .setStyle(ButtonStyle.Secondary)
    );

    return [row];
  }

  /**
   * Cập nhật batch tin nhắn Embed tổng (Mỗi 2 phút)
   */
  async flushBatchUpdate(client) {
    if (!this.isBossActive()) return;

    try {
      const state = this.activeBoss;
      const channel =
        client.channels.cache.get(state.channelId) ||
        (await client.channels.fetch(state.channelId).catch(() => null));
      if (!channel) return;

      const msg = await channel.messages.fetch(state.messageId).catch(() => null);
      if (!msg) return;

      const embed = this.buildDashboardEmbed();
      const components = this.buildDashboardComponents(false);

      await msg.edit({
        embeds: [embed],
        components,
      }).catch(() => null);

      state.isDirty = false;
      await this.saveState();
      logger.info(`👹 [WorldBoss] Đã flush batch cập nhật Embed World Boss (${state.resistance}% kháng cự).`);
    } catch (err) {
      logger.error('❌ [WorldBoss] Lỗi flushBatchUpdate:', err);
    }
  }

  /**
   * Xử lý khi thành viên bấm nút [ TUNG ĐÒN TIẾN CÔNG ]
   */
  async handleAttack(interaction) {
    if (!this.isBossActive()) {
      return interaction.reply({
        content: '<a:bang2:1546891483250954290> Hiện không có chiến dịch Bách Quỷ Dạ Hành nào đang diễn ra!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;
    const userData = WitchHunterService.getUserProfile(userId);

    // 1. Kiểm tra đã chọn phe chưa
    if (!userData || !userData.faction) {
      return interaction.reply({
        content:
          `<a:bang2:1546891483250954290> Lữ khách chưa gia nhập phe phái ma thuật!\n` +
          `Hãy dùng lệnh chọn phe để bước vào hàng ngũ **Thợ Săn** hoặc **Phù Thủy** trước khi tham chiến nhé!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const state = this.activeBoss;
    let participant = state.participants.get(userId);
    if (!participant) {
      participant = {
        userId,
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        faction: userData.faction,
        hits: 0,
        damage: 0,
        lastAttackTime: 0,
      };
      state.participants.set(userId, participant);
    }

    // 2. Giới hạn tối đa 5 lượt đánh trong suốt sự kiện
    if (participant.hits >= 5) {
      return interaction.reply({
        content:
          `<a:bang2:1546891483250954290> **ĐÃ ĐẠT GIỚI HẠN TẤN CÔNG!**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Lữ khách đã tung đủ **5/5 đòn đánh** ma thuật tối đa trong sự kiện Bách Quỷ Dạ Hành lần này.\n` +
          `Hãy nghỉ ngơi và theo dõi đồng đội tiếp tục công phá kết giới Boss nhé!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // 3. Cooldown 30 giây giữa mỗi lần bấm
    const now = Date.now();
    const cooldownMs = 30000;
    if (participant.lastAttackTime && now - participant.lastAttackTime < cooldownMs) {
      const waitSec = Math.ceil((participant.lastAttackTime + cooldownMs - now) / 1000);
      return interaction.reply({
        content:
          `<a:bang2:1546891483250954290> **MA NĂNG CHƯA ĐẦY!**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Vũ khí và Supporter của lữ khách đang trong trạng thái hồi phục năng lượng sau đòn quét vừa rồi.\n` +
          `*Vui lòng chờ thêm: **${waitSec} giây** để xuất chiêu kế tiếp!*`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // 4. Tính toán sát thương theo cấp bậc người chơi (1-5), điểm yếu Boss và cộng hưởng Thần Binh
    const isHunter = participant.faction === 'hunter';
    const isWeakness = state.bossConfig.weaknessFaction === participant.faction;

    const userRank = Math.max(1, Math.min(5, Number(userData.current_rank) || 1));
    const resonanceInfo = WitchHunterService.checkResonance(userId);
    const hasResonance = Boolean(resonanceInfo && resonanceInfo.isResonance);

    // Bậc C: 1%, B: 2%, A: 3%, S: 4%, SS: 5% theo cấp bậc (1-5)
    // Khắc hệ Boss: x2 sát thương nếu phe khắc chế điểm yếu của Boss
    // Đồng bộ Thần Binh & Supporter: x1.5 sát thương
    const baseDamage = userRank;
    const weaknessMultiplier = isWeakness ? 2 : 1;
    const resonanceMultiplier = hasResonance ? 1.5 : 1.0;
    let calculatedDamage = baseDamage * weaknessMultiplier * resonanceMultiplier;
    // Làm tròn 1 chữ số thập phân (ví dụ 1.5%, 7.5%, 12%)
    calculatedDamage = Math.round(calculatedDamage * 10) / 10;
    if (calculatedDamage <= 0) calculatedDamage = 1;

    // Giảm kháng cự của Boss
    const actualDamage = Math.min(state.resistance, calculatedDamage);
    const roundedActualDamage = Math.round(actualDamage * 10) / 10;

    state.resistance = Math.max(0, Math.round((state.resistance - roundedActualDamage) * 10) / 10);
    state.factionDamage[participant.faction] = Math.round(((state.factionDamage[participant.faction] || 0) + roundedActualDamage) * 10) / 10;

    participant.hits += 1;
    participant.damage = Math.round(((participant.damage || 0) + roundedActualDamage) * 10) / 10;
    participant.lastAttackTime = now;
    state.isDirty = true;

    // Lấy thông tin trang bị
    const weapon = userData.equipped_weapon ? getWeaponById(userData.equipped_weapon) : null;
    const supporter = userData.equipped_supporter ? getSupporterById(userData.equipped_supporter) : null;
    let gearText = '';
    if (weapon && supporter) {
      gearText = `${weapon.name} (${weapon.rank}) & ${supporter.name} (${supporter.rank})`;
    } else if (weapon) {
      gearText = `${weapon.name} (${weapon.rank})`;
    } else if (supporter) {
      gearText = `Supporter: ${supporter.name} (${supporter.rank})`;
    } else {
      gearText = isHunter ? 'Silver Fang Dagger (Đạn Bạc Sơ Cấp)' : 'Trượng Phù Thủy Sơ Cấp (Hắc Ma Thuật)';
    }

    // Xác định thứ hạng hiện tại của người chơi
    const sorted = Array.from(state.participants.values()).sort(
      (a, b) => b.damage - a.damage || a.hits - b.hits
    );
    const userRankNumber = sorted.findIndex((p) => p.userId === userId) + 1;
    const isTop1 = userRankNumber === 1;

    const userFactionEmoji = isHunter
      ? '<a:trangtrig36:1563065680922808340>'
      : '<a:trangtrig32:1546906170994856026>';
    const userFactionTitle = isHunter ? 'Thần Khí Sĩ' : 'Cổ Thuật Sĩ';
    const userFactionName = isHunter ? 'Hiệp Hội Thợ Săn' : 'Hội Phù Thủy';
    const factionShortName = isHunter ? 'Hiệp Hội' : 'Coven';
    const rankInfo = WitchHunterService.getRankInfo(participant.faction, userRank);
    const rankName = rankInfo?.name || `Bậc ${userRank}`;
    const resonanceNotice = hasResonance
      ? '<a:trangtrig20:1546092997299667055> **KÍCH HOẠT ĐỒNG BỘ THẦN BINH (x1.5 Sát Thương)!**'
      : '*Chưa kích hoạt đồng bộ Thần Binh & Supporter*';

    const flavorText = isWeakness
      ? `${state.bossConfig.weaknessFlavor}\n<a:linhtocg:1563399670351536310> Bào mòn trực tiếp: **-${roundedActualDamage}% Kháng Cự** của Boss!`
      : `${state.bossConfig.normalFlavor}\n<a:linhtocg:1563399670351536310> Bào mòn trực tiếp: **-${roundedActualDamage}% Kháng Cự** của Boss!`;

    // Phản hồi Ephemeral tức thì (Không chờ batch)
    await interaction.reply({
      content:
        `<:wh4:1564143733690204190> **LỮ KHÁCH ĐÃ XUẤT TRẬN TẤN CÔNG BOSS!**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `**Mục tiêu:** ${state.bossConfig.title}\n` +
        `**Thân phận:** ${userFactionEmoji} [${userFactionTitle}] **${participant.displayName}** (${userFactionName})\n` +
        `**Cấp bậc:** **${rankName}** (Bậc ${userRank}/5) | ${resonanceNotice}\n` +
        `**Khí tài mang theo:** \`${gearText}\`\n\n` +
        `<a:linhtocg:1563399670351536310> **HIỆU ỨNG KHẮC HỆ & SÁT THƯƠNG:**\n` +
        `${flavorText}\n\n` +
        `**CỐNG HIẾN CÁ NHÂN:**\n` +
        `- Tổng Kháng Cự đã trừ: **${participant.damage}%** (${participant.hits}/5 lượt)\n` +
        `- Thứ hạng hiện tại: **Top ${userRankNumber}** ${isTop1 ? '<a:trangtrig14:1546047912969113622>' : ''}\n` +
        `- Điểm đóng góp cho phe ${factionShortName}: **+${roundedActualDamage}%**\n\n` +
        `<:wh2:1563431832546967624> Hồi phục ma năng (Cooldown): **30 giây** trước đòn đánh tiếp theo!`,
      flags: MessageFlags.Ephemeral,
    });

    // Nếu Boss bị hạ gục (Kháng Cự về 0%), lập tức kết thúc chiến dịch toàn thắng
    if (state.resistance <= 0) {
      await this.endWorldBoss(interaction.client, { reason: 'defeated' });
    }
  }

  /**
   * Popup xem Bảng Xếp Hạng Top 12 (Ephemeral)
   */
  async handleTop12(interaction) {
    const state = this.activeBoss;
    const { colors, emojis } = WITCH_HUNTER_CONFIG;

    if (!state) {
      return interaction.reply({
        content: '<a:bang2:1546891483250954290> Chưa có dữ liệu bảng xếp hạng Bách Quỷ Dạ Hành!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sorted = Array.from(state.participants.values()).sort(
      (a, b) => b.damage - a.damage || a.hits - b.hits
    );

    const rankDigits = emojis.rankDigits || {};
    const getDigitEmoji = (n) => rankDigits[String(n)] || `#${n}`;

    // TOP 1 - 5
    let top5Section = '';
    const top5 = sorted.slice(0, 5);
    if (top5.length === 0) {
      top5Section = '> *Chưa có ai ghi danh trong Top 5.*';
    } else {
      top5Section = top5
        .map((p, idx) => {
          const rank = idx + 1;
          const numEmoji = getDigitEmoji(rank);
          const fEmoji =
            p.faction === 'hunter'
              ? '<a:trangtrig36:1563065680922808340>'
              : '<a:trangtrig32:1546906170994856026>';
          const fTitle = p.faction === 'hunter' ? 'Thần Khí Sĩ' : 'Cổ Thuật Sĩ';
          const pumpkinReward = rank === 1 ? 20 : rank === 2 ? 15 : rank === 3 ? 12 : 10;

          return (
            `${numEmoji} **Top ${rank}:** ${fEmoji} [${fTitle}] <@${p.userId}> ── **${p.damage}% Kháng Cự**\n` +
            `> +${pumpkinReward} <a:bingo:1563061901800243253> | <a:linhtocg:1563399670351536310> **Vé Tế Đàn x1**`
          );
        })
        .join('\n\n');
    }

    // TOP 6 - 12
    let top6to12Section = '';
    const top6to12 = sorted.slice(5, 12);
    if (top6to12.length === 0) {
      top6to12Section = '> *Chưa có người chơi lọt vào Top 6 - 12.*';
    } else {
      top6to12Section = top6to12
        .map((p, idx) => {
          const rank = idx + 6;
          const fEmoji =
            p.faction === 'hunter'
              ? '<a:trangtrig36:1563065680922808340>'
              : '<a:trangtrig32:1546906170994856026>';
          const fTitle = p.faction === 'hunter' ? 'Thần Khí Sĩ' : 'Cổ Thuật Sĩ';
          const pumpkinReward = rank <= 7 ? 8 : rank <= 9 ? 6 : 4;

          return (
            `**#${rank}.** ${fEmoji} [${fTitle}] <@${p.userId}> ──────── **${p.damage}% Kháng Cự** (+${pumpkinReward} <a:bingo:1563061901800243253>)`
          );
        })
        .join('\n');
    }

    // Vị trí của người đang bấm nút
    const userIndex = sorted.findIndex((p) => p.userId === interaction.user.id);
    let myPositionStr = '';
    if (userIndex >= 0) {
      const userRank = userIndex + 1;
      const userDmg = sorted[userIndex].damage;
      if (userRank <= 12) {
        myPositionStr = `**Vị trí của Lữ Khách:** Hạng **#${userRank}** (Đã trừ: **${userDmg}% Kháng Cự**)`;
      } else {
        const top12MinDmg = sorted[11] ? sorted[11].damage : 1;
        const diffDmg = Math.max(1, top12MinDmg - userDmg + 1);
        myPositionStr = `**Vị trí của Lữ Khách:** Hạng **#${userRank}** (Đã trừ: **${userDmg}% Kháng Cự**) - Cần thêm **+${diffDmg}%** để lọt vào Top 12!`;
      }
    } else {
      myPositionStr = `**Vị trí của Lữ Khách:** Chưa tham chiến - Hãy tung đòn để ghi danh trên bảng vàng!`;
    }

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple) // MÀU TÍM PASTEL BẮT BUỘC
      .setTitle(`${emojis.titleLeft} BẢNG THỐNG KÊ CHIẾN TÍCH TOP 12 ${emojis.titleRight}`)
      .setDescription(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:giftg1:1543150714732412948> **CƠ CẤU PHẦN THƯỞNG BÍ NGÔ (DÙ BOSS CHẾT HAY KHÔNG):**\n` +
        `> • **Top 1:** +20 <a:bingo:1563061901800243253> | **Top 2:** +15 <a:bingo:1563061901800243253> | **Top 3:** +12 <a:bingo:1563061901800243253>\n` +
        `> • **Top 4-5:** +10 <a:bingo:1563061901800243253> | **Top 6-7:** +8 <a:bingo:1563061901800243253>\n` +
        `> • **Top 8-9:** +6 <a:bingo:1563061901800243253> | **Top 10-12:** +4 <a:bingo:1563061901800243253>\n` +
        `> • **Top 1 – 5 DPS:** Nhận thêm **1 Vé Quay Tế Đàn Miễn Phí**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:trangtrig20:1546092997299667055> **VINH DANH TOP 5 (TIẾN TRÌNH VÉ TẾ ĐÀN & BÍ NGÔ CAO CẤP):**\n` +
        `${top5Section}\n\n` +
        `<a:trangtrig20:1546092997299667055> **VINH DANH TOP 6 - 12:**\n` +
        `${top6to12Section}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${myPositionStr}`
      )
      .setFooter({ text: 'Bảng xếp hạng cập nhật theo thời gian thực • Witch Hunter' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Popup xem Chiến Tích Của Tôi (Ephemeral)
   */
  async handleMyStats(interaction) {
    const state = this.activeBoss;
    const { colors, emojis } = WITCH_HUNTER_CONFIG;

    if (!state) {
      return interaction.reply({
        content: '<a:bang2:1546891483250954290> Chưa có dữ liệu sự kiện Bách Quỷ Dạ Hành!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;
    const userData = WitchHunterService.getUserProfile(userId);
    const participant = state.participants.get(userId);

    if (!participant || participant.hits === 0) {
      return interaction.reply({
        content:
          `<a:bang2:1546891483250954290> **Lữ khách chưa tham gia tấn công Boss lần nào!**\n` +
          `Hãy bấm nút **[ TUNG ĐÒN TIẾN CÔNG ]** để ghi nhận sát thương và nhận vé triệu gọi miễn phí nhé!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const sorted = Array.from(state.participants.values()).sort(
      (a, b) => b.damage - a.damage || a.hits - b.hits
    );
    const userRank = sorted.findIndex((p) => p.userId === userId) + 1;
    const isHunter = participant.faction === 'hunter';
    const factionEmoji = isHunter
      ? '<a:trangtrig36:1563065680922808340>'
      : '<a:trangtrig32:1546906170994856026>';
    const factionTitle = isHunter ? 'Thần Khí Sĩ' : 'Cổ Thuật Sĩ';
    const factionName = isHunter ? 'Hiệp Hội Thợ Săn' : 'Hội Phù Thủy';

    const weapon = userData?.equipped_weapon ? getWeaponById(userData.equipped_weapon) : null;
    const supporter = userData?.equipped_supporter ? getSupporterById(userData.equipped_supporter) : null;

    let expectedReward = '';
    if (userRank <= 5) {
      expectedReward = `1 Vé Quay Tế Đàn Miễn Phí + ${userRank === 1 ? 20 : userRank === 2 ? 15 : userRank === 3 ? 12 : 10} Bí Ngô`;
    } else if (userRank <= 12) {
      expectedReward = `${userRank <= 7 ? 8 : userRank <= 9 ? 6 : 4} Bí Ngô`;
    } else {
      expectedReward = `+1 Bí Ngô (nếu Boss bị tiêu diệt)`;
    }

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple) // MÀU TÍM PASTEL BẮT BUỘC
      .setTitle(`${emojis.titleLeft} CHIẾN TÍCH BÁCH QUỶ DẠ HÀNH CỦA BẠN ${emojis.titleRight}`)
      .setDescription(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `**Chiến Binh:** <@${userId}>\n` +
        `**Thân Phận:** ${factionEmoji} [${factionTitle}] (${factionName})\n` +
        `**Vũ Khí:** \`${weapon ? `${weapon.name} (${weapon.rank})` : 'Mặc Định'}\`\n` +
        `**Supporter:** \`${supporter ? `${supporter.name} (${supporter.rank})` : 'Chưa Đồng Hành'}\`\n\n` +
        `<a:linhtocg:1563399670351536310> **SỐ LIỆU CỐNG HIẾN CHIẾN DỊCH:**\n` +
        `> • Số lượt xuất kích: **${participant.hits} / 5 lượt**\n` +
        `> • Tổng Kháng Cự đã bào mòn: **${participant.damage}%**\n` +
        `> • Thứ hạng cá nhân hiện tại: **Hạng #${userRank}**\n` +
        `> • Phần thưởng dự kiến: **${expectedReward}**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Gợi ý: Cố gắng lọt vào Top 5 DPS để chắc chắn nhận 1 Vé Triệu Gọi Tế Đàn Free!*`
      )
      .setFooter({ text: 'Witch Hunter World Boss Participant Tracker' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Kết thúc sự kiện World Boss (Boss chết hoặc Hết giờ)
   */
  async endWorldBoss(client, { reason = 'timeout' } = {}) {
    if (!this.activeBoss) return;

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }

    const state = this.activeBoss;
    state.status = reason;

    try {
      const channel =
        client.channels.cache.get(state.channelId) ||
        (await client.channels.fetch(state.channelId).catch(() => null));
      const guild = channel?.guild || client.guilds.cache.get(state.guildId);

      const hunterDmg = state.factionDamage.hunter || 0;
      const witchDmg = state.factionDamage.witch || 0;
      const totalFactionDmg = hunterDmg + witchDmg || 1;

      let winFaction = null;
      let winFactionName = 'Hiệp Hội Thợ Săn';
      let loseFactionName = 'Hội Phù Thủy';
      let winFactionEmoji = '<a:trangtrig36:1563065680922808340>';
      let loseFactionEmoji = '<a:trangtrig32:1546906170994856026>';
      let winFactionPct = 50;
      let loseFactionPct = 50;

      if (hunterDmg > witchDmg) {
        winFaction = 'hunter';
        winFactionName = 'Hiệp Hội Thợ Săn';
        loseFactionName = 'Hội Phù Thủy';
        winFactionEmoji = '<a:trangtrig36:1563065680922808340>';
        loseFactionEmoji = '<a:trangtrig32:1546906170994856026>';
        winFactionPct = Math.round((hunterDmg / totalFactionDmg) * 100);
        loseFactionPct = 100 - winFactionPct;
      } else if (witchDmg > hunterDmg) {
        winFaction = 'witch';
        winFactionName = 'Hội Phù Thủy';
        loseFactionName = 'Hiệp Hội Thợ Săn';
        winFactionEmoji = '<a:trangtrig32:1546906170994856026>';
        loseFactionEmoji = '<a:trangtrig36:1563065680922808340>';
        winFactionPct = Math.round((witchDmg / totalFactionDmg) * 100);
        loseFactionPct = 100 - winFactionPct;
      }

      // 1. BAN PHƯỚC TỐI CAO: Hồi phục +5% HP Trụ Tổng cho phe thắng sát thương
      if (winFaction && guild) {
        const winFactionName = winFaction === 'hunter' ? 'Phe Thợ Săn' : 'Phe Phù Thủy';
        await WitchHunterDuelService.healTowerHp(
          guild,
          winFaction,
          5,
          `Ban Phước Tối Cao từ Đại Chiến Bách Quỷ Dạ Hành (+5% HP Trụ Tổng ${winFactionName})`
        );
      }

      // 2. PHÂN PHÁT PHẦN THƯỞNG CÁ NHÂN
      const sorted = Array.from(state.participants.values()).sort(
        (a, b) => b.damage - a.damage || a.hits - b.hits
      );

      // Thưởng Vé Tế Đàn: Top 1 - 5 DPS luôn nhận 1 Vé Triệu Gọi Tế Đàn Miễn Phí
      for (let i = 0; i < Math.min(5, sorted.length); i++) {
        const p = sorted[i];
        try {
          const uData = witchHunterStorage.getUser(p.userId);
          if (uData) {
            uData.free_summons = (Number(uData.free_summons) || 0) + 1;
            uData.updated_at = Date.now();
            witchHunterStorage.saveUser(uData, true);
          }
        } catch (ticketErr) {
          logger.error(`❌ [WorldBoss] Lỗi trao vé tế đàn cho user ${p.userId}:`, ticketErr);
        }
      }

      // Thưởng Bí Ngô:
      // TH1: Nếu Boss bị tiêu diệt -> +1 Bí Ngô cho TẤT CẢ ai tham gia ít nhất 1 đòn
      if (reason === 'defeated' && guild) {
        for (const p of sorted) {
          if (p.hits >= 1) {
            await WitchHunterService.awardPumpkins(guild, p.userId, 1, {
              reason: 'Phần thưởng tham chiến diệt Boss Bách Quỷ Dạ Hành',
              notifyDM: false,
              notifyAdminLog: false,
            }).catch(() => null);
          }
        }
      }

      // TH2 & TH1: Dù Boss chết hay không chết, Top 1 - 12 ĐỀU nhận thưởng Bí Ngô chuẩn theo BXH:
      // Top 1: +20, Top 2: +15, Top 3: +12, Top 4-5: +10, Top 6-7: +8, Top 8-9: +6, Top 10-12: +4 Bí Ngô
      if (guild) {
        for (let i = 0; i < Math.min(12, sorted.length); i++) {
          const p = sorted[i];
          const rank = i + 1;
          let addPumpkins = 0;
          if (rank === 1) addPumpkins = 20;
          else if (rank === 2) addPumpkins = 15;
          else if (rank === 3) addPumpkins = 12;
          else if (rank <= 5) addPumpkins = 10;
          else if (rank <= 7) addPumpkins = 8;
          else if (rank <= 9) addPumpkins = 6;
          else if (rank <= 12) addPumpkins = 4;

          if (addPumpkins > 0) {
            await WitchHunterService.awardPumpkins(guild, p.userId, addPumpkins, {
              reason: `Top ${rank} DPS Bách Quỷ Dạ Hành (${reason === 'defeated' ? 'Tiêu diệt Boss' : 'Boss rút lui'})`,
              notifyDM: false,
              notifyAdminLog: false,
            }).catch(() => null);
          }
        }
      }

      // 3. XÂY DỰNG EMBED TỔNG KẾT (BẮT BUỘC MÀU TÍM PASTEL)
      const { colors, emojis } = WITCH_HUNTER_CONFIG;
      const endEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple); // TUYỆT ĐỐI GIỮ NGUYÊN MÀU TÍM PASTEL, KHÔNG ĐỔI MÀU KHÁC

      if (reason === 'defeated') {
        endEmbed
          .setTitle(`${emojis.titleLeft} CHIẾN DỊCH HUYẾT NGUYỆT TOÀN THẮNG: THỰC THỂ BỊ TIÊU DIỆT! ${emojis.titleRight}`)
          .setDescription(
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**${state.bossConfig.title}** đã bị phong ấn hoàn toàn trước thời hạn!\n\n` +
            `<a:trangtrig15:1546047955696488489> **TỔNG KẾT TRANH ĐOẠT PHE PHÁI:**\n` +
            `${winFactionEmoji} **${winFactionName}:** ${winFactionPct}% Tổng Kháng Cự\n` +
            `<a:trangtrig20:1546092997299667055> **CHIẾN THẮNG ÁP ĐẢO!**\n` +
            `${loseFactionEmoji} **${loseFactionName}:** ${loseFactionPct}% Tổng Kháng Cự\n\n` +
            `<a:trangtrig41:1547238037832863744> **BAN PHƯỚC TỐI CAO:**\n` +
            `> Trụ Tổng Phe **${winFactionName}** được hồi phục ngay lập tức **+5% HP**!\n` +
            `> Trụ Tổng Phe **${loseFactionName}** bảo toàn nguyên vẹn, không bị khấu trừ.\n\n` +
            `<a:giftg1:1543150714732412948> **PHẦN THƯỞNG CHIẾN DỊCH (BOSS BỊ TIÊU DIỆT):**\n` +
            `- **Tất cả Thần Khí Sĩ và Cổ Thuật Sĩ** tham gia đánh ít nhất 1 đòn: Nhận ngay **+1 <a:bingo:1563061901800243253>**.\n` +
            `- **Thưởng BXH Top 1 – 12 DPS:**\n` +
            `  > • **Top 1:** +20 <a:bingo:1563061901800243253> | **Top 2:** +15 <a:bingo:1563061901800243253> | **Top 3:** +12 <a:bingo:1563061901800243253>\n` +
            `  > • **Top 4 – 5:** +10 <a:bingo:1563061901800243253> | **Top 6 – 7:** +8 <a:bingo:1563061901800243253>\n` +
            `  > • **Top 8 – 9:** +6 <a:bingo:1563061901800243253> | **Top 10 – 12:** +4 <a:bingo:1563061901800243253>\n` +
            `- **Top 1 – 5 DPS:** Nhận thêm **1 Vé Quay Tế Đàn Miễn Phí** (Triệu Hồi Supporter/Thần Khí A-SS).`
          );
      } else {
        endEmbed
          .setTitle(`${emojis.titleLeft} THỜI GIAN ĐÃ HẾT: BOSS ĐÃ RÚT LUI VÀO HƯ KHÔNG! ${emojis.titleRight}`)
          .setDescription(
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Hết thời gian chiến dịch! Thực thể **${state.bossConfig.title}** đã ẩn thân vào bóng tối.\n` +
            `> *Kết giới chưa bị phá hủy hoàn toàn (còn ${state.resistance}% Kháng Cự), không kích hoạt +1 Bí Ngô toàn server.*\n\n` +
            `<a:trangtrig15:1546047955696488489> **KẾT QUẢ TÍCH LŨY SÁT THƯƠNG PHE PHÁI:**\n` +
            `${winFactionEmoji} **${winFactionName}:** ${winFactionPct}% Tổng Kháng Cự\n` +
            `<a:trangtrig20:1546092997299667055> **CHIẾN THẮNG ÁP ĐẢO!**\n` +
            `${loseFactionEmoji} **${loseFactionName}:** ${loseFactionPct}% Tổng Kháng Cự\n\n` +
            `<a:trangtrig41:1547238037832863744> **BAN PHƯỚC TỐI CAO:**\n` +
            `> Trụ Tổng Phe **${winFactionName}** được hồi phục ngay lập tức **+5% HP**!\n\n` +
            `<a:giftg1:1543150714732412948> **PHẦN THƯỞNG XẾP HẠNG CÁ NHÂN (DÙ BOSS KHÔNG CHẾT):**\n` +
            `> • **Top 1:** +20 <a:bingo:1563061901800243253> + 1 Vé Tế Đàn\n` +
            `> • **Top 2:** +15 <a:bingo:1563061901800243253> + 1 Vé Tế Đàn\n` +
            `> • **Top 3:** +12 <a:bingo:1563061901800243253> + 1 Vé Tế Đàn\n` +
            `> • **Top 4 – 5:** +10 <a:bingo:1563061901800243253> + 1 Vé Tế Đàn\n` +
            `> • **Top 6 – 7:** +8 <a:bingo:1563061901800243253>\n` +
            `> • **Top 8 – 9:** +6 <a:bingo:1563061901800243253>\n` +
            `> • **Top 10 – 12:** +4 <a:bingo:1563061901800243253>`
          );
      }

      endEmbed
        .setFooter({ text: 'Sự kiện Bách Quỷ Dạ Hành đã khép lại • Witch Hunter World Boss' })
        .setTimestamp();

      if (channel && state.messageId) {
        const msg = await channel.messages.fetch(state.messageId).catch(() => null);
        if (msg) {
          const disabledComponents = this.buildDashboardComponents(true);
          await msg.edit({
            embeds: [endEmbed],
            components: disabledComponents,
          }).catch(() => null);
        }
      }

      await this.saveState();
      logger.info(`👹 [WorldBoss] Sự kiện World Boss đã kết thúc (${reason}).`);
    } catch (err) {
      logger.error('❌ [WorldBoss] Lỗi endWorldBoss:', err);
    }
  }
}

export const witchHunterWorldBossService = new WitchHunterWorldBossService();
