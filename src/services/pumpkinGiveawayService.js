import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
import { WitchHunterService } from './witchHunterService.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const PUMPKIN_GIVEAWAYS_JSON_PATH = path.join(DATA_DIR, 'pumpkin_giveaways.json');

/**
 * Kiểm tra quyền hạn Ban Quản Trị Witch Hunter & Giveaway
 */
export function isWitchHunterAdmin(interaction) {
  const member = interaction.member;
  if (!member) return false;

  const ownerId = interaction.guild?.ownerId;
  if (ownerId && (interaction.user?.id === ownerId || member.id === ownerId)) {
    return true;
  }

  const configuredOwnerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (configuredOwnerIds.includes(interaction.user?.id) || configuredOwnerIds.includes(member.id)) {
    return true;
  }

  const adminRoles = [
    WITCH_HUNTER_CONFIG.adminRoleId,
    '1545295139390619768',
    '1541303749916754001',
  ];

  for (const roleId of adminRoles) {
    if (member.roles?.cache?.has?.(roleId)) return true;
    if (Array.isArray(member._roles) && member._roles.includes(roleId)) return true;
    if (Array.isArray(member.roles) && member.roles.includes(roleId)) return true;
  }

  if (
    member.permissions?.has?.(PermissionFlagsBits.Administrator) ||
    member.permissions?.has?.(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  return false;
}

/**
 * Phân tích chuỗi thời gian thành mili-giây
 */
export function parseDuration(input) {
  if (!input) return 30 * 60 * 1000;
  const str = String(input).trim().toLowerCase();

  const match = str.match(/^(\d+)\s*(s|sec|m|min|h|hour|d|day)?$/);
  if (!match) return null;

  const val = parseInt(match[1], 10);
  if (isNaN(val) || val <= 0) return null;

  const unit = match[2] || 'm';

  switch (unit) {
    case 's':
    case 'sec':
      return val * 1000;
    case 'm':
    case 'min':
      return val * 60 * 1000;
    case 'h':
    case 'hour':
      return val * 60 * 60 * 1000;
    case 'd':
    case 'day':
      return val * 24 * 60 * 60 * 1000;
    default:
      return val * 60 * 1000;
  }
}

class PumpkinGiveawayService {
  constructor() {
    this.sessions = new Map();
    this.activeGiveaways = new Map();
    this.init();
  }

  async init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      let data = await getFromDb('temp:pumpkin_giveaways_active').catch(() => null);
      if (!data && fs.existsSync(PUMPKIN_GIVEAWAYS_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(PUMPKIN_GIVEAWAYS_JSON_PATH, 'utf-8');
          data = JSON.parse(raw);
        } catch {}
      }

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.id) {
            this.activeGiveaways.set(item.id, item);
          }
        }
        logger.info(`🎃 [PumpkinGiveaway] Đã nạp lại ${this.activeGiveaways.size} sự kiện ban thưởng bí ngô.`);
      }
    } catch (err) {
      logger.error('❌ [PumpkinGiveaway] Lỗi nạp dữ liệu ban thưởng:', err);
    }
  }

  async saveState() {
    try {
      const serializable = Array.from(this.activeGiveaways.values()).map((g) => {
        const { timer, ...rest } = g;
        return rest;
      });
      fs.writeFileSync(PUMPKIN_GIVEAWAYS_JSON_PATH, JSON.stringify(serializable, null, 2), 'utf-8');
      await setInDb('temp:pumpkin_giveaways_active', serializable).catch(() => null);
    } catch (err) {
      logger.error('❌ [PumpkinGiveaway] Lỗi lưu trạng thái ban thưởng:', err);
    }
  }

  /**
   * Khôi phục timer khi bot sẵn sàng (ready event)
   */
  async resumeActiveGiveaways(client) {
    const now = Date.now();
    for (const [id, giveaway] of this.activeGiveaways.entries()) {
      if (giveaway.status === 'active') {
        if (giveaway.endTime <= now) {
          logger.info(`🎃 [PumpkinGiveaway] Sự kiện ${id} đã đến hạn trong lúc offline -> Tiến hành phân phát thưởng!`);
          await this.endGiveaway(client, id);
        } else {
          const remainMs = giveaway.endTime - now;
          giveaway.timer = setTimeout(() => {
            this.endGiveaway(client, id);
          }, remainMs);
          logger.info(`🎃 [PumpkinGiveaway] Đã khôi phục bộ đếm sự kiện ${id} (còn ${(remainMs / 1000).toFixed(0)}s).`);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // ADMIN DASHBOARD SESSION MANAGEMENT
  // ────────────────────────────────────────────────────────────

  getSession(userId, guildId) {
    const key = `${guildId}:${userId}`;
    if (!this.sessions.has(key)) {
      this.sessions.set(key, {
        userId,
        guildId,
        totalPumpkins: 10000,
        duration: '30m',
        channelId: null,
      });
    }
    return this.sessions.get(key);
  }

  resetSession(userId, guildId) {
    const key = `${guildId}:${userId}`;
    const fresh = {
      userId,
      guildId,
      totalPumpkins: 10000,
      duration: '30m',
      channelId: null,
    };
    this.sessions.set(key, fresh);
    return fresh;
  }

  /**
   * Tạo Embed Bảng Điều Khiển Cấu Hình của Admin (Sử dụng Custom Emojis máy chủ)
   */
  buildDashboardEmbed(session) {
    const { colors, emojis } = WITCH_HUNTER_CONFIG;
    const channelDisplay = session.channelId ? `<#${session.channelId}>` : '*(Kênh hiện tại)*';

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu tím pastel chuẩn #D8B4F8
      .setTitle(`${emojis.titleLeft} **BẢNG THIẾT LẬP: ĐẠI LỄ BAN THƯỞNG BÍ NGÔ** ${emojis.titleRight}`)
      .setDescription(
        `Cấu hình thông số sự kiện chia đều Bí Ngô cho toàn thể cư dân trong máy chủ.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:giftg1:1543150714732412948> **Tổng quỹ Bí Ngô:** **${session.totalPumpkins.toLocaleString('vi-VN')} Bí Ngô** <a:bingo:1563061901800243253>\n` +
        `<a:trangtrig13:1546047657963819048> **Thời gian mở cổng:** **${session.duration}**\n` +
        `<a:trangtrig18:1546068102817775626> **Kênh phát thưởng:** ${channelDisplay}\n` +
        `<a:trangtrig41:1547238037832863744> **Cơ chế phân phối:** **Chia Đều Cho Tất Cả Người Bấm**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:bang2:1546891483250954290> *Chọn tùy chọn bên dưới để chỉnh sửa hoặc bấm [ Phát Động ] để bắt đầu.*`
      )
      .setFooter({ text: 'Witch Hunter Admin Control Panel • Cấu hình Ban Thưởng Bí Ngô' })
      .setTimestamp();

    return embed;
  }

  /**
   * Tạo Components Bảng Điều Khiển Admin (Select Menu & Buttons với Custom Emojis)
   */
  buildDashboardComponents(session) {
    const selectMenuRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('pgd_select')
        .setPlaceholder('⚙️ Tùy chọn cài đặt sự kiện ban thưởng...')
        .addOptions(
          {
            label: 'Đặt Tổng Quỹ Bí Ngô',
            description: `Hiện tại: ${session.totalPumpkins.toLocaleString('vi-VN')} Bí Ngô`,
            value: 'pumpkins',
            emoji: '<a:bingo:1563061901800243253>',
          },
          {
            label: 'Cài Đặt Thời Gian',
            description: `Hiện tại: ${session.duration}`,
            value: 'duration',
            emoji: '<a:trangtrig13:1546047657963819048>',
          }
        )
    );

    const channelSelectRow = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('pgd_channel_select')
        .setPlaceholder('📍 Chọn kênh phát thưởng (Mặc định: Kênh này)...')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pgd_launch')
        .setLabel('Phát Động Ban Thưởng')
        .setEmoji('<a:giftg1:1543150714732412948>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('pgd_reset')
        .setLabel('Làm Mới Cấu Hình')
        .setEmoji('<a:trangtrig41:1547238037832863744>')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('pgd_cancel')
        .setLabel('Đóng Bảng')
        .setEmoji('<a:bang2:1546891483250954290>')
        .setStyle(ButtonStyle.Secondary)
    );

    return [selectMenuRow, channelSelectRow, buttonRow];
  }

  // ────────────────────────────────────────────────────────────
  // PUBLIC CLIENT-FACING GIVEAWAY INTERFACE
  // ────────────────────────────────────────────────────────────

  /**
   * Tạo Embed Đại Lễ Ban Thưởng hiển thị công khai ở kênh
   */
  buildGiveawayEmbed(giveaway) {
    const { colors, emojis } = WITCH_HUNTER_CONFIG;
    const participantCount = giveaway.participants.length;
    const currentShare = participantCount > 0
      ? Math.max(1, Math.floor(giveaway.totalPumpkins / participantCount))
      : giveaway.totalPumpkins;
    const endSec = Math.floor(giveaway.endTime / 1000);

    const embed = new EmbedBuilder()
      .setColor(colors.pastelPurple) // Màu tím pastel #D8B4F8
      .setTitle(`${emojis.pumpkin} **ĐẠI LỄ BAN THƯỞNG BÍ NGÔ HUYẾT NGUYỆT** ${emojis.pumpkin}`)
      .setDescription(
        `Huyết Nguyệt chiếu rọi thánh địa! Cổng Kho Báu Hoàng Gia đã chính thức mở cửa để chia sẻ phước lành Bí Ngô cho toàn bộ chiến binh Thợ Săn và Phù Thủy!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:giftg1:1543150714732412948> Tổng quỹ ban thưởng: **${giveaway.totalPumpkins.toLocaleString('vi-VN')} Bí Ngô** <a:bingo:1563061901800243253>\n` +
        `<a:trangtrig41:1547238037832863744> Số lữ khách đã ghi danh: **${participantCount} người**\n` +
        `<a:trangtrig41:1547238037832863744> Tạm tính hiện tại: **~${currentShare.toLocaleString('vi-VN')} Bí Ngô / người**\n` +
        `<a:trangtrig13:1546047657963819048> Thời gian còn lại: <t:${endSec}:R> (Đóng cổng lúc: <t:${endSec}:t>)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<a:bang2:1546891483250954290> **CÁCH THỨC THAM GIA:**\n` +
        `Chỉ cần bấm nút **[ <a:bingo:1563061901800243253> BẤM ĐIỂM DANH NHẬN BÍ NGÔ ]** bên dưới!\n` +
        `Sau khi hết thời gian, toàn bộ quỹ Bí Ngô sẽ được chia đều và cộng thẳng vào kho đồ của tất cả ai đã ghi danh!`
      )
      .setFooter({ text: 'Witch Hunter Pumpkin Shared Pool • Ban Quản Trị Server' })
      .setTimestamp();

    return embed;
  }

  /**
   * Tạo 2 nút bấm tương tác ngoài kênh chat
   */
  buildGiveawayComponents(giveaway, disabled = false) {
    const participantCount = giveaway.participants.length;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pg_join:${giveaway.id}`)
        .setLabel(disabled ? `ĐÃ KẾT THÚC (${participantCount})` : `BẤM ĐIỂM DANH NHẬN BÍ NGÔ (${participantCount})`)
        .setEmoji('<a:bingo:1563061901800243253>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`pg_list:${giveaway.id}`)
        .setLabel('Danh Sách Ghi Danh')
        .setEmoji('<a:trangtrig18:1546068102817775626>')
        .setStyle(ButtonStyle.Secondary)
    );

    return [row];
  }

  // ────────────────────────────────────────────────────────────
  // INTERACTION ROUTER & HANDLERS
  // ────────────────────────────────────────────────────────────

  async handleInteraction(interaction) {
    const customId = interaction.customId || '';

    // 1. Phục vụ nút Tham Gia [ BẤM ĐIỂM DANH NHẬN BÍ NGÔ ]
    if (interaction.isButton() && customId.startsWith('pg_join:')) {
      const giveawayId = customId.split(':')[1];
      return await this.handleJoin(interaction, giveawayId);
    }

    // 2. Phục vụ nút [ Danh Sách Ghi Danh ] (Chỉ Admin mới xem được)
    if (interaction.isButton() && customId.startsWith('pg_list:')) {
      const giveawayId = customId.split(':')[1];
      return await this.handleList(interaction, giveawayId);
    }

    // 3. Admin Dashboard: Select Menu chọn thuộc tính
    if (interaction.isStringSelectMenu() && customId === 'pgd_select') {
      const selected = interaction.values[0];
      const session = this.getSession(interaction.user.id, interaction.guildId);

      if (selected === 'pumpkins') {
        const modal = new ModalBuilder()
          .setCustomId('pgm_pumpkins')
          .setTitle('🎃 Đặt Tổng Quỹ Bí Ngô')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('input_pumpkins')
                .setLabel('Số lượng Bí Ngô ban thưởng (tối thiểu 10)')
                .setStyle(TextInputStyle.Short)
                .setValue(String(session.totalPumpkins))
                .setRequired(true)
                .setMaxLength(10)
            )
          );
        return await interaction.showModal(modal);
      }

      if (selected === 'duration') {
        const modal = new ModalBuilder()
          .setCustomId('pgm_duration')
          .setTitle('⏱️ Cài Đặt Thời Gian Ban Thưởng')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('input_duration')
                .setLabel('Thời gian (VD: 10m, 30m, 1h, 2h, 24h)')
                .setStyle(TextInputStyle.Short)
                .setValue(String(session.duration))
                .setRequired(true)
                .setMaxLength(15)
            )
          );
        return await interaction.showModal(modal);
      }
    }

    // 4. Admin Dashboard: Modal Submit Bí Ngô
    if (interaction.isModalSubmit() && customId === 'pgm_pumpkins') {
      const input = interaction.fields.getTextInputValue('input_pumpkins')?.trim();
      const num = parseInt(input, 10);
      const session = this.getSession(interaction.user.id, interaction.guildId);

      if (isNaN(num) || num < 10) {
        return interaction.reply({
          content: '<a:bang2:1546891483250954290> Số lượng Bí Ngô không hợp lệ! Vui lòng nhập số nguyên dương tối thiểu từ 10 Bí Ngô trở lên.',
          flags: MessageFlags.Ephemeral,
        });
      }

      session.totalPumpkins = num;
      const embed = this.buildDashboardEmbed(session);
      const components = this.buildDashboardComponents(session);

      return await interaction.update({
        embeds: [embed],
        components,
      });
    }

    // 5. Admin Dashboard: Modal Submit Thời Gian
    if (interaction.isModalSubmit() && customId === 'pgm_duration') {
      const input = interaction.fields.getTextInputValue('input_duration')?.trim();
      const parsedMs = parseDuration(input);
      const session = this.getSession(interaction.user.id, interaction.guildId);

      if (!parsedMs || parsedMs < 30000) {
        return interaction.reply({
          content: '<a:bang2:1546891483250954290> Thời gian không hợp lệ! Vui lòng nhập định dạng hợp lệ (VD: 10m, 30m, 1h, 24h), tối thiểu 30 giây.',
          flags: MessageFlags.Ephemeral,
        });
      }

      session.duration = input;
      const embed = this.buildDashboardEmbed(session);
      const components = this.buildDashboardComponents(session);

      return await interaction.update({
        embeds: [embed],
        components,
      });
    }

    // 6. Admin Dashboard: Channel Select Menu
    if (interaction.isChannelSelectMenu() && customId === 'pgd_channel_select') {
      const channelId = interaction.values[0];
      const session = this.getSession(interaction.user.id, interaction.guildId);
      session.channelId = channelId;

      const embed = this.buildDashboardEmbed(session);
      const components = this.buildDashboardComponents(session);

      return await interaction.update({
        embeds: [embed],
        components,
      });
    }

    // 7. Admin Dashboard: Nút [ Phát Động Ban Thưởng ]
    if (interaction.isButton() && customId === 'pgd_launch') {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: '<a:bang2:1546891483250954290> Bạn không có quyền phát động sự kiện ban thưởng Bí Ngô!',
          flags: MessageFlags.Ephemeral,
        });
      }

      return await this.handleLaunch(interaction);
    }

    // 8. Admin Dashboard: Nút [ Làm Mới Cấu Hình ]
    if (interaction.isButton() && customId === 'pgd_reset') {
      const fresh = this.resetSession(interaction.user.id, interaction.guildId);
      const embed = this.buildDashboardEmbed(fresh);
      const components = this.buildDashboardComponents(fresh);

      return await interaction.update({
        embeds: [embed],
        components,
      });
    }

    // 9. Admin Dashboard: Nút [ Đóng Bảng ]
    if (interaction.isButton() && customId === 'pgd_cancel') {
      return await interaction.update({
        content: '🌸 Đã đóng Bảng Điều Khiển Ban Thưởng Bí Ngô.',
        embeds: [],
        components: [],
      });
    }

    return false;
  }

  /**
   * Phát động Đại Lễ Ban Thưởng Bí Ngô ra kênh chat
   */
  async handleLaunch(interaction) {
    const session = this.getSession(interaction.user.id, interaction.guildId);
    const durationMs = parseDuration(session.duration) || 30 * 60 * 1000;
    const guild = interaction.guild;

    const targetChannel = session.channelId
      ? guild.channels.cache.get(session.channelId) || (await guild.channels.fetch(session.channelId).catch(() => null))
      : interaction.channel;

    if (!targetChannel || !targetChannel.isTextBased()) {
      return interaction.reply({
        content: '<a:bang2:1546891483250954290> Không tìm thấy kênh chỉ định hoặc kênh không hỗ trợ gửi tin nhắn văn bản!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const now = Date.now();
    const endTime = now + durationMs;
    const giveawayId = `pg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const giveawayData = {
      id: giveawayId,
      guildId: guild.id,
      channelId: targetChannel.id,
      messageId: null,
      totalPumpkins: session.totalPumpkins,
      durationMs,
      startTime: now,
      endTime,
      participants: [],
      createdBy: interaction.user.id,
      status: 'active',
    };

    const embed = this.buildGiveawayEmbed(giveawayData);
    const components = this.buildGiveawayComponents(giveawayData, false);

    const sentMsg = await targetChannel.send({
      content: '<@&1563426234787041331>',
      embeds: [embed],
      components,
    });

    giveawayData.messageId = sentMsg.id;

    // Hẹn giờ tự động kết thúc và phân phát thưởng
    giveawayData.timer = setTimeout(() => {
      this.endGiveaway(interaction.client, giveawayId);
    }, durationMs);

    this.activeGiveaways.set(giveawayId, giveawayData);
    await this.saveState();

    logger.info(`🎃 [PumpkinGiveaway] Đã phát động thành công sự kiện ${giveawayId} (${session.totalPumpkins} Bí Ngô, ${session.duration}) tại #${targetChannel.name}.`);

    return await interaction.update({
      content: `<a:giftg1:1543150714732412948> **ĐẠI LỄ BAN THƯỞNG BÍ NGÔ ĐÃ ĐƯỢC PHÁT ĐỘNG THÀNH CÔNG!**\n> • Kênh gửi: <#${targetChannel.id}>\n> • Tổng quỹ: **${session.totalPumpkins.toLocaleString('vi-VN')} Bí Ngô** <a:bingo:1563061901800243253>\n> • Thời hạn: **${session.duration}**`,
      embeds: [],
      components: [],
    });
  }

  /**
   * Xử lý khi thành viên bấm [ BẤM ĐIỂM DANH NHẬN BÍ NGÔ ]
   */
  async handleJoin(interaction, giveawayId) {
    const giveaway = this.activeGiveaways.get(giveawayId);

    if (!giveaway || giveaway.status !== 'active' || Date.now() >= giveaway.endTime) {
      return interaction.reply({
        content: '<a:bang2:1546891483250954290> Sự kiện Đại Lễ Ban Thưởng Bí Ngô này đã kết thúc rồi lữ khách ơi!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;

    // Kiểm tra đã ghi danh chưa
    if (giveaway.participants.includes(userId)) {
      const idx = giveaway.participants.indexOf(userId) + 1;
      return interaction.reply({
        content: `<a:bang2:1546891483250954290> **LỮ KHÁCH ĐÃ GHI DANH RỒI!**\nLữ Khách đã có tên trong danh sách nhận Bí Ngô ở vị trí **#${idx}**.\nHãy yên tâm kiên nhẫn đợi đến khi cổng đếm ngược kết thúc để nhận phần thưởng nhé! 💕`,
        flags: MessageFlags.Ephemeral,
      });
    }

    giveaway.participants.push(userId);
    await this.saveState();

    const count = giveaway.participants.length;

    // Cập nhật số lượng người ghi danh trên nút bấm ngoài chat
    try {
      const embed = this.buildGiveawayEmbed(giveaway);
      const components = this.buildGiveawayComponents(giveaway, false);

      await interaction.message.edit({
        embeds: [embed],
        components,
      }).catch(() => null);
    } catch {}

    return interaction.reply({
      content:
        `<a:trangtrig20:1546092997299667055> **ĐÃ ĐIỂM DANH THÀNH CÔNG!**\n` +
        `Lữ khách đã ghi danh nhận chia Bí Ngô thành công (Số thứ tự: **#${count}**).\n` +
        `Khi cổng thời gian đếm ngược kết thúc, Lữ Khách sẽ được tự động cộng phần chia Bí Ngô vào tài khoản! ✨`,
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Xử lý khi bấm nút [ Danh Sách Ghi Danh ] (CHỈ ADMIN MỚI XEM ĐƯỢC)
   */
  async handleList(interaction, giveawayId) {
    // RÀNG BUỘC PHÂN QUYỀN: CHỈ ADMIN MỚI ĐƯỢC XEM
    if (!isWitchHunterAdmin(interaction)) {
      return interaction.reply({
        content: `<a:bang2:1546891483250954290> Chỉ Hội Đồng Tối Cao mới có quyền xem danh sách ghi danh ban thưởng Bí Ngô nhé Lữ Khách ơi! <a:heartg1:1545307544808071258>`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const giveaway = this.activeGiveaways.get(giveawayId);
    if (!giveaway) {
      return interaction.reply({
        content: 'Không tìm thấy dữ liệu của sự kiện này trong hệ thống!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const count = giveaway.participants.length;
    if (count === 0) {
      return interaction.reply({
        content: `<a:trangtrig18:1546068102817775626> Hiện tại chưa có lữ khách nào bấm điểm danh ghi danh nhận Bí Ngô.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const listText = giveaway.participants
      .slice(0, 50)
      .map((id, idx) => `**#${idx + 1}.** <@${id}> (\`${id}\`)`)
      .join('\n');

    const extra = count > 50 ? `\n... và còn thêm **${count - 50} lữ khách** khác nữa.` : '';

    return interaction.reply({
      content:
        `<a:trangtrig18:1546068102817775626> **DANH SÁCH LỮ KHÁCH ĐÃ GHI DANH (${count} NGƯỜI):**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${listText}${extra}\n\n` +
        `*Ghi chú: Toàn bộ danh sách này sẽ được chia đều quỹ **${giveaway.totalPumpkins.toLocaleString('vi-VN')} Bí Ngô** khi hết giờ.*`,
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Kết thúc sự kiện và tự động chia đều Bí Ngô cho tất cả người tham gia
   */
  async endGiveaway(client, giveawayId) {
    const giveaway = this.activeGiveaways.get(giveawayId);
    if (!giveaway || giveaway.status !== 'active') return;

    giveaway.status = 'ended';
    if (giveaway.timer) clearTimeout(giveaway.timer);

    const guild = client.guilds.cache.get(giveaway.guildId) || (await client.guilds.fetch(giveaway.guildId).catch(() => null));
    if (!guild) return;

    const channel = guild.channels.cache.get(giveaway.channelId) || (await guild.channels.fetch(giveaway.channelId).catch(() => null));
    let msg = null;
    if (channel) {
      msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    }

    const { colors, emojis } = WITCH_HUNTER_CONFIG;
    const count = giveaway.participants.length;

    // 1. Trường hợp không có ai tham gia
    if (count === 0) {
      if (msg) {
        const endedEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(`${emojis.pumpkin} **ĐẠI LỄ BAN THƯỞNG BÍ NGÔ ĐÃ KẾT THÚC** ${emojis.pumpkin}`)
          .setDescription(
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `<a:bang2:1546891483250954290> Thời gian mở cổng kho báu đã kết thúc nhưng không có lữ khách nào ghi danh nhận thưởng.\n` +
            `Quỹ **${giveaway.totalPumpkins.toLocaleString('vi-VN')} Bí Ngô** đã được niêm phong hoàn trả về Ngân Khố Hoàng Gia!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          )
          .setFooter({ text: 'Witch Hunter Pumpkin Shared Pool' })
          .setTimestamp();

        const components = this.buildGiveawayComponents(giveaway, true);
        await msg.edit({ embeds: [endedEmbed], components }).catch(() => null);
      }
      await this.saveState();
      return;
    }

    // 2. Tính toán chia đều Bí Ngô cho tất cả người đã bấm
    const eachShare = Math.max(1, Math.floor(giveaway.totalPumpkins / count));
    let awardedCount = 0;

    for (const userId of giveaway.participants) {
      try {
        await WitchHunterService.awardPumpkins(guild, userId, eachShare, {
          reason: `Nhận chia phước lành từ Đại Lễ Ban Thưởng Bí Ngô (${giveaway.totalPumpkins} chia ${count} người)`,
          executor: null,
          source: 'Đại Lễ Ban Thưởng Bí Ngô',
          notifyDM: false,
          notifyAdminLog: false,
        });
        awardedCount += 1;
      } catch (err) {
        logger.error(`❌ [PumpkinGiveaway] Lỗi phát Bí Ngô cho user ${userId}:`, err);
      }
    }

    logger.info(`🎃 [PumpkinGiveaway] Sự kiện ${giveawayId} hoàn tất: Đã chia đều ${eachShare} Bí Ngô cho ${awardedCount}/${count} người!`);

    // 3. Cập nhật Embed công bố kết quả hoàn tất ra kênh
    if (msg) {
      const victoryEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.pumpkin} **ĐẠI LỄ BAN THƯỞNG BÍ NGÔ HOÀN TẤT!** ${emojis.pumpkin}`)
        .setDescription(
          `Huyết Nguyệt chứng giám! Cổng Kho Báu Hoàng Gia đã đóng lại trong tiếng hò reo vang dội!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:giftg1:1543150714732412948> **TỔNG KẾT PHÂN PHÁT PHƯỚC LÀNH BÍ NGÔ:**\n` +
          `• Tổng quỹ đã chia: **${giveaway.totalPumpkins.toLocaleString('vi-VN')} Bí Ngô** <a:bingo:1563061901800243253>\n` +
          `• Tổng số lữ khách nhận thưởng: **${count} người**\n` +
          `• Mỗi lữ khách nhận: **+${eachShare.toLocaleString('vi-VN')} Bí Ngô** <a:bingo:1563061901800243253>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig20:1546092997299667055> **Toàn bộ Bí Ngô đã được cộng thẳng vào kho đồ của tất cả ai đã ghi danh!**\n` +
          `*Chúc các chiến binh Thợ Săn & Cổ Thuật Sĩ luôn dồi dào ma lực trên chiến trường Witch Hunter!*`
        )
        .setFooter({ text: 'Witch Hunter Pumpkin Shared Pool • Hoàn Tất Phát Thưởng' })
        .setTimestamp();

      const components = this.buildGiveawayComponents(giveaway, true);
      await msg.edit({ embeds: [victoryEmbed], components }).catch(() => null);
    }

    await this.saveState();
  }
}

export const pumpkinGiveawayService = new PumpkinGiveawayService();
