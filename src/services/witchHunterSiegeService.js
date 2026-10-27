import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from './witchHunterService.js';
import { generateTowerBattlefield } from './witchHunterSiegeCanvas.js';
import { logger } from '../utils/logger.js';

class WitchHunterSiegeService {
  constructor() {
    this.activeSiege = null;
    this.updateThrottleTimer = null;
    this.endTimer = null;
  }

  isSiegeActive() {
    return this.activeSiege !== null && Date.now() < this.activeSiege.endTime;
  }

  getActiveSiege() {
    return this.activeSiege;
  }

  /**
   * Tạo các component nút bấm điều khiển chiến trường
   */
  buildDashboardComponents(disabled = false) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_siege_tower_1')
        .setLabel('Công Tháp I')
        .setEmoji('<a:trangtrig29:1546385117478527016>')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('btn_siege_tower_2')
        .setLabel('Công Tháp II')
        .setEmoji('<a:trangtrig29:1546385117478527016>')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('btn_siege_tower_3')
        .setLabel('Công Tháp III')
        .setEmoji('<a:trangtrig29:1546385117478527016>')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('btn_siege_my_stats')
        .setLabel('Chiến Tích Cá Nhân')
        .setEmoji('<a:trangtrig45:1547239010190237819>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('btn_siege_mechanics')
        .setLabel('Cơ Chế Chiếm Tháp')
        .setEmoji('<a:trangtrig18:1546068102817775626>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
    return [row];
  }

  /**
   * Khởi tạo và mở cổng Chiến Trường Cổ Tháp Phong Ấn
   */
  async startSiege({ interaction, durationMinutes = 30, channel = null }) {
    if (this.isSiegeActive()) {
      return {
        success: false,
        message: '<a:bang2:1546891483250954290> Chiến trường Cổ Tháp Phong Ấn hiện đang diễn ra rồi!',
      };
    }

    const targetChannel = channel || interaction.channel;
    const durationMs = durationMinutes * 60 * 1000;
    const endTime = Date.now() + durationMs;

    this.activeSiege = {
      guildId: interaction.guildId,
      channelId: targetChannel.id,
      messageId: null,
      startTime: Date.now(),
      endTime,
      durationMinutes,
      towers: [
        {
          id: 'tower_1',
          name: 'THÁP I: PHẾ TÍCH ĐẠN BẠC',
          subtitle: 'Khắc tinh Cơ giới & Cấm khí',
          hunterPts: 0,
          witchPts: 0,
          hunterTroops: 0,
          witchTroops: 0,
          mvpName: 'Tranh Chấp',
          mvpTitle: 'Tranh Chấp',
          mvpUserId: null,
          mvpStreak: 0,
          mvpAvatarUrl: null,
          troopsSet: new Set(),
        },
        {
          id: 'tower_2',
          name: 'THÁP II: ĐÀI TẾ HUYẾT THỆ',
          subtitle: 'Cội nguồn Ma thuật Hắc ám',
          hunterPts: 0,
          witchPts: 0,
          hunterTroops: 0,
          witchTroops: 0,
          mvpName: 'Tranh Chấp',
          mvpTitle: 'Tranh Chấp',
          mvpUserId: null,
          mvpStreak: 0,
          mvpAvatarUrl: null,
          troopsSet: new Set(),
        },
        {
          id: 'tower_3',
          name: 'THÁP III: THƯ VIỆN CẤM THUẬT',
          subtitle: 'Khu vực phong ấn trung lập',
          hunterPts: 0,
          witchPts: 0,
          hunterTroops: 0,
          witchTroops: 0,
          mvpName: 'Tranh Chấp',
          mvpTitle: 'Tranh Chấp',
          mvpUserId: null,
          mvpStreak: 0,
          mvpAvatarUrl: null,
          troopsSet: new Set(),
        },
      ],
      participants: new Map(), // userId -> ParticipantObject
    };

    // Render Canvas ban đầu
    const timeRemainingStr = this.formatTimeRemaining(endTime - Date.now());
    const attachment = await generateTowerBattlefield({
      timeRemaining: timeRemainingStr,
      towers: this.activeSiege.towers,
    });

    const embed = this.buildDashboardEmbed(timeRemainingStr, !!attachment);
    const components = this.buildDashboardComponents(false);

    const messagePayload = {
      embeds: [embed],
      components,
    };
    if (attachment) {
      messagePayload.files = [attachment];
    }

    const siegeMsg = await targetChannel.send(messagePayload);
    this.activeSiege.messageId = siegeMsg.id;

    // Lập timer kết thúc tự động
    this.endTimer = setTimeout(() => {
      this.endSiege(interaction.client);
    }, durationMs);

    logger.info(`🏰 [WitchHunterSiege] Đã khởi tạo chiến trường Cổ Tháp (${durationMinutes} phút) tại kênh #${targetChannel.name}.`);

    return {
      success: true,
      channelId: targetChannel.id,
      durationMinutes,
    };
  }

  /**
   * Tạo Embed Bảng Điều Khiển Chiến Trường (Giao diện 1)
   */
  buildDashboardEmbed(timeRemainingStr = '30:00', hasAttachment = false) {
    const { colors } = WITCH_HUNTER_CONFIG;

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle('<a:trangtrig2:1563065680922808340> CHIẾN TRƯỜNG PHE: CỔ THÁP PHONG ẤN')
      .setDescription(
        `Phong ấn tại 3 Cổ Tháp trung lập đã chính thức khai mở! Cả hai phe phái đang tổng lực điều động binh lực để giành quyền kiểm soát lãnh địa chiến lược.\n\n` +
        `<a:trangtrig43:1547238351869059082> Thời Gian Chiếm Đóng: Còn lại \`[ ${timeRemainingStr} ]\`\n` +
        `<a:trangtrig43:1547238351869059082> Quy Mô: 3 Cổ Tháp Phong Ấn \n` +
        `> • Phế Tích Đạn Bạc \n` +
        `> • Đài Tế Huyết Thệ \n` +
        `> • Thư Viện Cấm Thuật\n` +
        `<a:giftg1:1543150714732412948> Bùa Lợi Lãnh Địa (Phe Thắng):\n` +
        `> <a:bingo:1563061901800243253> \`200 Bí Ngô\` (Chia đều cho cư dân thánh địa phe thắng tham chiến)\n` +
        `> <a:linhtocg:1563399670351536310> \`20 Vé Triệu Gọi Tế Đàn Free\` (Chia đều cho cư dân thánh địa phe thắng tham chiến)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:trangtrig21:1546093099770716213> **HƯỚNG DẪN THAM CHIẾN:**\n` +
        `> Chọn 1 trong 3 Tháp bên dưới để xuất trận chi viện.\n` +
        `> Mỗi trận thắng sẽ tăng điểm chiếm đóng cho phe mình và tích lũy chuỗi thắng (Win-Streak).\n` +
        `> Đánh bại **Chiến Tướng Tại Trụ** của phe địch để bẻ gãy chuỗi thắng và đoạt quyền kiểm soát tháp!`
      )
      .setFooter({ text: 'Hệ thống tự động đồng bộ mỗi 25 giây • Witch Hunter Siege' })
      .setTimestamp();

    if (hasAttachment) {
      embed.setImage('attachment://tower_battlefield_live.png');
    }

    return embed;
  }

  formatTimeRemaining(ms) {
    if (ms <= 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  getOrCreateParticipant(user, faction) {
    let p = this.activeSiege.participants.get(user.id);
    if (!p) {
      p = {
        userId: user.id,
        username: user.displayName || user.username,
        faction,
        battles: 0,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalScore: 0,
        towerContributions: { 0: 0, 1: 0, 2: 0 },
        lastAttackTime: 0,
      };
      this.activeSiege.participants.set(user.id, p);
    }
    return p;
  }

  /**
   * Lên lịch cập nhật hình ảnh Live Canvas (Throttle tối thiểu 25 giây)
   */
  scheduleLiveUpdate(client) {
    if (this.updateThrottleTimer || !this.activeSiege) return;

    this.updateThrottleTimer = setTimeout(async () => {
      this.updateThrottleTimer = null;
      if (!this.activeSiege) return;

      try {
        const channel = client.channels.cache.get(this.activeSiege.channelId) ||
          (await client.channels.fetch(this.activeSiege.channelId).catch(() => null));
        if (!channel) return;

        const msg = await channel.messages.fetch(this.activeSiege.messageId).catch(() => null);
        if (!msg) return;

        const timeRemainingStr = this.formatTimeRemaining(this.activeSiege.endTime - Date.now());
        const attachment = await generateTowerBattlefield({
          timeRemaining: timeRemainingStr,
          towers: this.activeSiege.towers,
        });

        const embed = this.buildDashboardEmbed(timeRemainingStr, !!attachment);
        const components = this.buildDashboardComponents(false);

        const editPayload = {
          embeds: [embed],
          components,
        };
        if (attachment) {
          editPayload.files = [attachment];
        }

        await msg.edit(editPayload).catch(() => null);
      } catch (err) {
        logger.error('❌ [WitchHunterSiege] Lỗi LiveUpdate:', err);
      }
    }, 25000);
  }

  /**
   * Xử lý khi người chơi bấm nút "Công Tháp I / II / III"
   */
  async handleTowerAttack(interaction, towerIndex) {
    if (!this.isSiegeActive()) {
      return interaction.reply({
        content: '❌ Chiến trường Cổ Tháp Phong Ấn đã kết thúc hoặc chưa được mở!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;
    const userData = witchHunterStorage.getUser(userId);
    const faction = userData?.faction;

    if (!faction || !['hunter', 'witch'].includes(faction)) {
      return interaction.reply({
        content: '❌ Lữ khách chưa gia nhập phe phái! Hãy chọn phe Thợ Săn hoặc Phù Thủy trước khi xuất trận nhé 💕',
        flags: MessageFlags.Ephemeral,
      });
    }

    const p = this.getOrCreateParticipant(interaction.user, faction);
    const now = Date.now();

    // Kiểm tra hồi sức (Cooldown 30 giây)
    const cooldownMs = 30000;
    if (p.lastAttackTime && now - p.lastAttackTime < cooldownMs) {
      const waitSec = Math.ceil((p.lastAttackTime + cooldownMs - now) / 1000);
      return interaction.reply({
        content: `<a:kuromig4:1546058744281174077> Lữ khách vừa xuất trận, cần dưỡng sức thêm **${waitSec} giây** nữa trước khi tiếp tục chi viện Cổ Tháp!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    p.lastAttackTime = now;
    p.battles += 1;

    const tower = this.activeSiege.towers[towerIndex];
    const isHunter = faction === 'hunter';
    const enemyFaction = isHunter ? 'witch' : 'hunter';
    const myRoleTitle = isHunter ? 'Thần Khí Sĩ' : 'Cổ Thuật Sĩ';
    const enemyRoleTitle = isHunter ? 'Cổ Thuật Sĩ' : 'Thần Khí Sĩ';

    // Xác định đối thủ chạm trán
    let enemyName = 'Vệ Binh Phong Ấn';
    let isEnemyMVP = false;

    if (tower.mvpUserId && tower.mvpUserId !== userId) {
      const mvpParticipant = this.activeSiege.participants.get(tower.mvpUserId);
      if (mvpParticipant && mvpParticipant.faction === enemyFaction) {
        enemyName = tower.mvpName;
        isEnemyMVP = true;
      }
    }

    if (!isEnemyMVP) {
      const enemyParticipants = Array.from(this.activeSiege.participants.values()).filter(
        (part) => part.faction === enemyFaction && part.userId !== userId
      );
      if (enemyParticipants.length > 0) {
        const randOpp = enemyParticipants[Math.floor(Math.random() * enemyParticipants.length)];
        enemyName = randOpp.username;
      }
    }

    // Tính toán sát thương và giao tranh dựa trên hồ sơ thực tế
    const profile = WitchHunterService.getUserProfile(userId);
    const atk = profile?.stats?.atk || 100;
    const mySupporter = profile?.supporter?.name || 'Chiến Binh Đồng Hành';
    const myWeapon = profile?.weapon?.name || (isHunter ? 'Súng Bạc S-Rank' : 'Cổ Trượng Huyền Bí');

    // Sát thương ngẫu nhiên có trọng số sức mạnh
    const myDamage = Math.floor(atk * (1.2 + Math.random() * 0.6));
    const enemyDamage = Math.floor(atk * (0.8 + Math.random() * 0.7));

    // Tỉ lệ thắng: cơ bản 55%, tăng nếu chuỗi thắng cao
    const winRate = Math.min(0.85, 0.55 + p.currentStreak * 0.03);
    const isVictory = Math.random() < winRate;

    const { colors } = WITCH_HUNTER_CONFIG;

    if (isVictory) {
      p.wins += 1;
      p.currentStreak += 1;
      p.bestStreak = Math.max(p.bestStreak, p.currentStreak);

      const scoreGain = 50;
      p.totalScore += scoreGain;
      p.towerContributions[towerIndex] = (p.towerContributions[towerIndex] || 0) + scoreGain;

      // Cộng điểm cho phe tại tháp
      if (isHunter) {
        tower.hunterPts += scoreGain;
      } else {
        tower.witchPts += scoreGain;
      }

      // Ghi nhận quân số đồn trú
      if (!tower.troopsSet.has(userId)) {
        tower.troopsSet.add(userId);
        if (isHunter) tower.hunterTroops += 1;
        else tower.witchTroops += 1;
      }

      // Kiểm tra đoạt danh hiệu MVP Chiến Tướng Tại Trụ
      let becameMvp = false;
      if (p.currentStreak > tower.mvpStreak || (isEnemyMVP && tower.mvpUserId)) {
        tower.mvpName = interaction.user.displayName || interaction.user.username;
        tower.mvpTitle = myRoleTitle;
        tower.mvpStreak = p.currentStreak;
        tower.mvpUserId = userId;
        tower.mvpAvatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
        becameMvp = true;
      }

      const towerTitleName = towerIndex === 0 ? 'THÁP I: PHẾ TÍCH ĐẠN BẠC' : towerIndex === 1 ? 'THÁP II: ĐÀI TẾ HUYẾT THỆ' : 'THÁP III: THƯ VIỆN CẤM THUẬT';
      const factionName = isHunter ? 'Hiệp Hội Thợ Săn' : 'Hội Phù Thủy';

      const victoryEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`<a:trangtrig2:1563065680922808340> CHIẾN THẮNG TẠI ${towerTitleName}`)
        .setDescription(
          `<a:heartg4:1546068063500369940> **Chiến Binh:** <@${userId}> [${myRoleTitle}]\n` +
          `<a:trangtrig36:1563065680922808340> **Chạm Trán:** ${isEnemyMVP ? 'Chiến Tướng' : 'Trấn Thủ'} **${enemyName}** [${enemyRoleTitle}]\n\n` +
          `<a:trangtrig45:1547239010190237819> Nước Đi Đối Kháng:\n` +
          `<a:trangtrig17:1546048098415939655> <@${userId}> kích hoạt [${myWeapon}] gây ${myDamage} sát thương!\n` +
          `<a:trangtrig17:1546048098415939655> **${enemyName}** phản kích gây ${enemyDamage} sát thương!\n` +
          `<a:trangtrig41:1547238037832863744> Kết quả: <@${userId}> đã đánh lui đối thủ thành công!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig1:1546040442548654140> **CHIẾN CÔNG GHI NHẬN**:\n` +
          `> <a:trangtrig10:1546047240265797682> Chuỗi Thắng Hiện Tại: ${p.currentStreak} Trận Liên Tiếp\n` +
          `> <a:trangtrig10:1546047240265797682> Điểm Phong Ấn Đóng Góp: +${scoreGain} Điểm cho ${factionName}\n` +
          (becameMvp ? `> <a:trangtrig14:1546047912969113622> **MVP**: Lữ khách đã trở thành **Chiến Tướng Tại Trụ** của ${towerTitleName.split(':')[0]}!` : '')
        );

      this.scheduleLiveUpdate(interaction.client);

      return interaction.reply({
        embeds: [victoryEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // Thất bại
      p.losses += 1;
      p.currentStreak = 0;

      const towerTitleName = towerIndex === 0 ? 'THÁP I: PHẾ TÍCH ĐẠN BẠC' : towerIndex === 1 ? 'THÁP II: ĐÀI TẾ HUYẾT THỆ' : 'THÁP III: THƯ VIỆN CẤM THUẬT';

      const defeatEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`<a:trangtrig2:1563065680922808340> THẤT BẠI TẠI ${towerTitleName}`)
        .setDescription(
          `<a:heartg4:1546068063500369940> **Chiến Binh:** <@${userId}> [${myRoleTitle}]\n` +
          `<a:trangtrig36:1563065680922808340> **Chạm Trán:** ${isEnemyMVP ? 'Chiến Tướng' : 'Trấn Thủ'} **${enemyName}** [${enemyRoleTitle}]\n\n` +
          `<a:trangtrig45:1547239010190237819> Nước Đi Đối Kháng:\n` +
          `<a:trangtrig17:1546048098415939655> <@${userId}> thi triển kĩ năng gây ${myDamage} sát thương!\n` +
          `<a:trangtrig17:1546048098415939655> **${enemyName}** phản đòn chí mạng gây ${enemyDamage} sát thương!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:bang2:1546891483250954290> **KẾT QUẢ:**\n` +
          `> Lữ Khách đã bị Chiến Tướng phe địch chặn đứng cuộc tiến công!\n` +
          `> Chuỗi thắng đã bị đặt lại về **0**.\n` +
          `> Hãy hồi sức trong **30 giây** trước khi tiếp tục chi viện Cổ Tháp nhé!`
        );

      this.scheduleLiveUpdate(interaction.client);

      return interaction.reply({
        embeds: [defeatEmbed],
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  /**
   * Xử lý khi người chơi bấm nút "Chiến Tích Cá Nhân" (Giao diện 3)
   */
  async handleMyStats(interaction) {
    if (!this.isSiegeActive()) {
      return interaction.reply({
        content: '❌ Hiện không có chiến trường Cổ Tháp nào đang diễn ra!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;
    const userData = witchHunterStorage.getUser(userId);
    const faction = userData?.faction;

    if (!faction || !['hunter', 'witch'].includes(faction)) {
      return interaction.reply({
        content: '❌ Lữ khách chưa gia nhập phe phái!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const p = this.getOrCreateParticipant(interaction.user, faction);
    const isHunter = faction === 'hunter';
    const factionEmoji = isHunter ? '<a:trangtrig36:1563065680922808340>' : '<a:trangtrig32:1546906170994856026>';
    const factionTitle = isHunter ? 'Hiệp Hội Thợ Săn - Thần Khí Sĩ' : 'Hội Phù Thủy - Cổ Thuật Sĩ';

    const winRate = p.battles > 0 ? Math.round((p.wins / p.battles) * 100) : 0;

    // Tìm tháp cống hiến nhiều nhất
    let topTowerIdx = 0;
    let maxContr = p.towerContributions[0] || 0;
    if ((p.towerContributions[1] || 0) > maxContr) {
      topTowerIdx = 1;
      maxContr = p.towerContributions[1];
    }
    if ((p.towerContributions[2] || 0) > maxContr) {
      topTowerIdx = 2;
      maxContr = p.towerContributions[2];
    }
    const topTowerName = topTowerIdx === 0 ? 'Tháp I: Phế Tích Đạn Bạc' : topTowerIdx === 1 ? 'Tháp II: Đài Tế Huyết Thệ' : 'Tháp III: Thư Viện Cấm Thuật';

    // Kiểm tra có đang là MVP tháp nào không
    const mvpTowers = this.activeSiege.towers.filter((t) => t.mvpUserId === userId);
    let mvpStatusLine = '> <a:trangtrig20:1546092997299667055> Trạng thái: Cư dân chi viện phong ấn';
    if (mvpTowers.length > 0) {
      const towerNames = mvpTowers.map((t) => t.name.split(':')[0]).join(', ');
      mvpStatusLine = `> <a:trangtrig14:1546047912969113622> Trạng thái Chiến Tướng: Đang trấn thủ **${towerNames}** (Chiến Tướng Tại Trụ)`;
    }

    const { colors } = WITCH_HUNTER_CONFIG;

    const statsEmbed = new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle('<a:trangtrig2:1563065680922808340> CHIẾN TÍCH PHONG ẤN CÁ NHÂN')
      .setDescription(
        `<a:heartg4:1546068063500369940> **Lữ Khách:** <@${userId}>\n` +
        `${factionEmoji} **Phe Phái:** ${factionTitle}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:trangtrig29:1546385117478527016> **THỐNG KÊ CHIẾN TRƯỜNG HIỆN TẠI:**\n` +
        `> <a:trangtrig20:1546092997299667055> Tổng số trận tham chiến: **${p.battles} trận** (${p.wins} Thắng / ${p.losses} Thua - Tỉ lệ: ${winRate}%)\n` +
        `> <a:trangtrig20:1546092997299667055> Chuỗi thắng cao nhất phiên: **${p.bestStreak} trận liên tiếp**\n` +
        `> <a:trangtrig20:1546092997299667055> Tổng điểm cống hiến cho phe: **+${p.totalScore} Điểm**\n` +
        `> <a:trangtrig20:1546092997299667055> Tháp cống hiến nhiều nhất: **${topTowerName}** (${maxContr} Điểm)\n` +
        `${mvpStatusLine}\n\n` +
        `<a:giftg1:1543150714732412948> **DỰ KIẾN PHẦN THƯỞNG (Nếu phe thắng):**\n` +
        `> <a:bingo:1563061901800243253> Nhận Bí Ngô chia đều: Đủ điều kiện nhận thưởng\n` +
        `> <a:linhtocg:1563399670351536310> Nhận Vé Triệu Gọi chia đều: Đủ điều kiện nhận thưởng`
      );

    return interaction.reply({
      embeds: [statsEmbed],
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Xử lý khi người chơi bấm nút "Cơ Chế Chiếm Tháp"
   */
  async handleMechanics(interaction) {
    const { colors } = WITCH_HUNTER_CONFIG;

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle('<a:trangtrig2:1563065680922808340> CƠ CHẾ CHIẾN TRANH CỔ THÁP PHONG ẤN')
      .setDescription(
        `**1. Bối Cảnh Chiến Trường:**\n` +
        `> 3 Cổ Tháp trung lập khai mở kết giới giữa ranh giới Doanh Trại và Rừng Coven. Hai phe Thợ Săn & Phù Thủy cùng tiến công để tích lũy điểm kiểm soát.\n\n` +
        `**2. Cách Thức Giao Tranh:**\n` +
        `> • Nhấn **Công Tháp I / II / III** để tiến công tháp tương ứng.\n` +
        `> • Chiến thắng mang lại **+50 điểm phong ấn** cho phe và cộng dồn **Chuỗi Thắng (Win-Streak)**.\n` +
        `> • Thất bại sẽ đặt chuỗi thắng về 0 và cần nghỉ ngơi hồi sức **30 giây**.\n\n` +
        `**3. Chiến Tướng Tại Trụ (MVP Tháp):**\n` +
        `> Cư dân có chuỗi thắng cao nhất tại tháp sẽ được vinh danh là **Chiến Tướng Tại Trụ** trên màn hình Live Canvas. Phe đối địch có thể công tháp để bẻ gãy chuỗi thắng này!\n\n` +
        `**4. Bùa Lợi Lãnh Địa (Phe Thắng):**\n` +
        `> Phe chiếm giữ từ **2/3 tháp** trở lên khi kết thúc phiên sẽ chiến thắng áp đảo:\n` +
        `> • Nhận ngay **200 Bí Ngô** chia đều cho toàn bộ cư dân phe thắng tham chiến.\n` +
        `> • Nhận ngay **20 Vé Triệu Gọi Tế Đàn Free** chia đều cho toàn bộ cư dân phe thắng tham chiến.`
      );

    return interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Kết thúc Chiến Trường, tổng kết và trao Bùa Lợi Lãnh Địa (Giao diện 4)
   */
  async endSiege(client, forceCancel = false) {
    if (!this.activeSiege) return;

    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    if (this.updateThrottleTimer) {
      clearTimeout(this.updateThrottleTimer);
      this.updateThrottleTimer = null;
    }

    const siege = this.activeSiege;
    this.activeSiege = null;

    try {
      const channel = client.channels.cache.get(siege.channelId) ||
        (await client.channels.fetch(siege.channelId).catch(() => null));
      if (!channel) return;

      // Vô hiệu hóa các nút bấm trên tin nhắn chính
      try {
        const mainMsg = await channel.messages.fetch(siege.messageId).catch(() => null);
        if (mainMsg) {
          const disabledRows = this.buildDashboardComponents(true);
          await mainMsg.edit({ components: disabledRows }).catch(() => null);
        }
      } catch {}

      if (forceCancel) {
        const cancelEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle('<a:trangtrig2:1563065680922808340> CHIẾN TRƯỜNG ĐÃ ĐƯỢC ĐÓNG BỞI ADMIN')
          .setDescription('Ban Quản Trị đã đóng kết giới Cổ Tháp Phong Ấn khẩn cấp. Phiên tranh đoạt đã kết thúc.');
        return channel.send({ embeds: [cancelEmbed] });
      }

      // Tính toán kết quả 3 tháp
      let hunterTowersWon = 0;
      let witchTowersWon = 0;

      const towerResults = siege.towers.map((t, idx) => {
        const total = t.hunterPts + t.witchPts;
        const hunterPct = total === 0 ? 50 : Math.round((t.hunterPts / total) * 100);
        const witchPct = 100 - hunterPct;

        let statusText = '';
        if (hunterPct > 50) {
          hunterTowersWon++;
          statusText = `<a:trangtrig36:1563065680922808340> THỢ SĂN CHIẾM GIỮ (${hunterPct}% vs ${witchPct}%)`;
        } else if (witchPct > 50) {
          witchTowersWon++;
          statusText = `<a:trangtrig32:1546906170994856026> PHÙ THỦY CHIẾM GIỮ (${witchPct}% vs ${hunterPct}%)`;
        } else {
          statusText = `<a:whg2:1564145798537683034> TRANH CHẤP BẤT PHÂN THẮNG BẠI (${hunterPct}% vs ${witchPct}%)`;
        }

        const namePrefix = idx === 0 ? 'Tháp I (Phế Tích Đạn Bạc)' : idx === 1 ? 'Tháp II (Đài Tế Huyết Thệ)' : 'Tháp III (Thư Viện Cấm Thuật)';
        return `> ${idx + 1}. ${namePrefix}: ${statusText}`;
      });

      // Xác định phe thắng cuộc
      let winningFaction = null;
      let winningFactionName = 'Bất Phân Thắng Bại';
      if (hunterTowersWon > witchTowersWon) {
        winningFaction = 'hunter';
        winningFactionName = 'HIỆP HỘI THỢ SĂN (W.H.A)';
      } else if (witchTowersWon > hunterTowersWon) {
        winningFaction = 'witch';
        winningFactionName = 'HỘI PHÙ THỦY (COVEN)';
      }

      // Lấy danh sách cư dân phe thắng tham chiến
      const winnerParticipants = Array.from(siege.participants.values()).filter(
        (p) => p.faction === winningFaction && p.battles > 0
      );

      const winnerCount = winnerParticipants.length;
      let pumpkinPerUser = 0;
      let ticketsPerUser = 0;

      if (winningFaction && winnerCount > 0) {
        pumpkinPerUser = Math.max(1, Math.floor(200 / winnerCount));
        ticketsPerUser = Math.max(1, Math.floor(20 / winnerCount));

        // TRAO THƯỞNG: CỘNG BÍ NGÔ VÀ VÉ TRIỆU GỌI CHO TỪNG CHIẾN BINH PHE THẮNG
        for (const winner of winnerParticipants) {
          try {
            // 1. Cộng Bí Ngô
            await WitchHunterService.awardPumpkins(channel.guild, winner.userId, pumpkinPerUser, {
              reason: 'Bùa Lợi Lãnh Địa: Chiến Thắng Cổ Tháp Phong Ấn',
              notifyDM: false,
              notifyAdminLog: false,
            }).catch(() => null);

            // 2. Cộng Vé Triệu Gọi Tế Đàn Free vào hồ sơ
            const uData = witchHunterStorage.getUser(winner.userId);
            if (uData) {
              uData.free_summons = (Number(uData.free_summons) || 0) + ticketsPerUser;
              uData.updated_at = Date.now();
              witchHunterStorage.saveUser(uData, true);
            }
          } catch (rewardErr) {
            logger.error(`❌ [WitchHunterSiege] Lỗi trao thưởng cho user ${winner.userId}:`, rewardErr);
          }
        }
      }

      // Top MVP 3 Tháp
      const mvpLines = siege.towers.map((t, idx) => {
        const towerShortName = idx === 0 ? 'Tháp I' : idx === 1 ? 'Tháp II' : 'Tháp III';
        const userTag = t.mvpUserId ? `<@${t.mvpUserId}>` : `**${t.mvpName}**`;
        return `> <a:trangtrig14:1546047912969113622> ${towerShortName}: ${userTag} (Chuỗi thắng: ${t.mvpStreak} <a:trangtrig29:1546385117478527016>)`;
      });

      const { colors } = WITCH_HUNTER_CONFIG;

      const endEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle('<a:trangtrig2:1563065680922808340> KẾT THÚC CHIẾN TRANH PHE: CỔ THÁP PHONG ẤN')
        .setDescription(
          `Thời gian mở phong ấn đã kết thúc! Bụi ma thuật dần lắng xuống trên chiến trường ranh giới giữa Doanh Trại và Rừng Coven.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:heartg3:1546047728314884226> **KẾT QUẢ CHIẾM ĐÓNG 3 CỔ THÁP:**\n` +
          `${towerResults.join('\n')}\n\n` +
          `<a:trangtrig15:1546047955696488489> TỶ SỐ CHUNG CUỘC: <a:trangtrig36:1563065680922808340> THỢ SĂN \`${hunterTowersWon} - ${witchTowersWon}\` PHÙ THỦY <a:trangtrig32:1546906170994856026>\n` +
          `<a:trangtrig15:1546047955696488489> **PHE CHIẾN THẮNG ÁP ĐẢO: ${winningFactionName}**\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:giftg1:1543150714732412948> **TRAO BÙA LỢI LÃNH ĐỊA CHO PHE THẮNG:**\n` +
          `> Tổng số cư dân ${winningFaction === 'hunter' ? 'Thợ Săn' : 'Phù Thủy'} tham chiến: **${winnerCount} người**\n` +
          `> <a:bingo:1563061901800243253> Bí Ngô Thưởng (200 Bí Ngô chia đều): Mỗi người nhận **+${pumpkinPerUser} Bí Ngô**!\n` +
          `> <a:linhtocg:1563399670351536310> Vé Triệu Gọi Tế Đàn Free (20 vé chia đều): Mỗi người nhận **+${ticketsPerUser} Vé Quay Free**!\n` +
          `*(Toàn bộ Bí Ngô và Vé Quay Free đã được chuyển thẳng vào hồ sơ cá nhân của từng chiến binh)*\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:kuromig4:1546058744281174077> **VINH DANH CHIẾN TƯỚNG TIÊN PHONG (TOP MVP):**\n` +
          `${mvpLines.join('\n')}`
        )
        .setFooter({ text: 'Witch Hunter Outpost Siege • Mùa Giải Huyết Nguyệt' })
        .setTimestamp();

      await channel.send({ embeds: [endEmbed] });
      logger.info(`🏆 [WitchHunterSiege] Đã tổng kết và trao thưởng cho phe ${winningFactionName} (${winnerCount} người).`);
    } catch (e) {
      logger.error('❌ [WitchHunterSiege] Lỗi khi tổng kết kết thúc chiến trường:', e);
    }
  }
}

export const witchHunterSiegeService = new WitchHunterSiegeService();
export default witchHunterSiegeService;
