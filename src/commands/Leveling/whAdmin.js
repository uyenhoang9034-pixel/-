import { ChannelType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterSummonService } from '../../services/witchHunterSummonService.js';
import { logger } from '../../utils/logger.js';

function isWitchHunterAdmin(interaction) {
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

  const adminRole = WITCH_HUNTER_CONFIG.adminRoleId;
  if (member.roles?.cache?.has?.(adminRole)) return true;
  if (Array.isArray(member._roles) && member._roles.includes(adminRole)) return true;
  if (Array.isArray(member.roles) && member.roles.includes(adminRole)) return true;

  return false;
}

export default {
  data: new SlashCommandBuilder()
    .setName('wh-admin')
    .setDescription('Lệnh quản trị hệ thống Witch Hunter (Chỉ Admin)')
    .addSubcommand((sub) =>
      sub
        .setName('setup-summon')
        .setDescription('Tạo bảng cố định Tế Đàn Triệu Gọi Huyết Nguyệt: Supporter & Thần Khí')
        .addChannelOption((opt) =>
          opt
            .setName('kenh')
            .setDescription('Kênh gửi bảng triệu hồi cố định (mặc định kênh hiện tại hoặc #trieu-hoi)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('setup-monolith')
        .setDescription('Khởi tạo bảng Embed Trụ Tổng Pháo Đài cố định tại kênh #✦・🏰・thành-trì-huyết-thệ')
        .addChannelOption((opt) =>
          opt
            .setName('kenh')
            .setDescription('Kênh gửi bảng Trụ Tổng (mặc định kênh #✦・🏰・thành-trì-huyết-thệ)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset-monolith')
        .setDescription('Phục hồi 100% HP cho cả 2 Trụ Tổng Thợ Săn & Phù Thủy (Đầu mùa giải mới)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel-duel')
        .setDescription('Hủy trận đấu đang diễn ra và hoàn trả 100% Bí Ngô cho sòng cược')
    )
    .addSubcommand((sub) =>
      sub
        .setName('bao-cao-daily')
        .setDescription('Gửi báo cáo hoạt động hằng ngày vào kênh Admin (gửi ngay hoặc gửi bù)')
        .addStringOption((opt) =>
          opt
            .setName('ngay')
            .setDescription('Ngày cần báo cáo (định dạng DD/MM/YYYY, ví dụ: 26/10/2026, để trống = hôm qua)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('siege-start')
        .setDescription('Khởi tạo và mở cổng Chiến Trường Cổ Tháp Phong Ấn (PVP Phe)')
        .addIntegerOption((opt) =>
          opt
            .setName('thoi_gian_phut')
            .setDescription('Thời gian mở chiến trường tính theo phút (Mặc định 30 phút)')
            .setMinValue(5)
            .setMaxValue(180)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName('kenh')
            .setDescription('Kênh gửi bảng chiến trường (mặc định kênh hiện tại)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('siege-end')
        .setDescription('Kết thúc sớm Chiến Trường Cổ Tháp và chốt trao thưởng Bùa Lợi Lãnh Địa')
        .addBooleanOption((opt) =>
          opt
            .setName('huy_bo')
            .setDescription('Hủy bỏ chiến trường mà không trao thưởng? (Mặc định: False)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tang-ve-summon')
        .setDescription('Tặng Vé Triệu Gọi Tế Đàn Free cho lữ khách')
        .addUserOption((opt) =>
          opt
            .setName('thanh_vien')
            .setDescription('Thành viên nhận vé triệu gọi')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('so_luong')
            .setDescription('Số lượng vé muốn tặng')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('boss-start')
        .setDescription('Khai mở sự kiện World Boss: BÁCH QUỶ DẠ HÀNH - HUYẾT NGUYỆT GIÁNG LÂM')
        .addStringOption((opt) =>
          opt
            .setName('boss_type')
            .setDescription('Loại thực thể giáng trần')
            .addChoices(
              { name: 'Ma Nữ Tha Hóa Cổ Đại - Avalonia (Thợ Săn khắc hệ 2%)', value: 'avalonia' },
              { name: 'Cấm Khí Hư Không - Void Monarch (Phù Thủy khắc hệ 2%)', value: 'void' }
            )
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('thoi_gian_phut')
            .setDescription('Thời gian mở chiến dịch tính theo phút (Mặc định: 60 phút)')
            .setMinValue(5)
            .setMaxValue(300)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName('kenh')
            .setDescription('Kênh gửi bảng World Boss (mặc định kênh #ma-nữ-tha-hóa 1564565572098990131)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('boss-end')
        .setDescription('Kết thúc sớm sự kiện World Boss và phát thưởng')
        .addStringOption((opt) =>
          opt
            .setName('ly_do')
            .setDescription('Kết quả kết thúc sự kiện')
            .addChoices(
              { name: 'Chiến thắng: Boss bị tiêu diệt (Kháng Cự về 0%)', value: 'defeated' },
              { name: 'Hết giờ: Boss rút lui vào hư không', value: 'timeout' }
            )
            .setRequired(false)
        )
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép quản trị Witch Hunter 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const subcommand = interaction.options.getSubcommand();
      const { WitchHunterDuelService } = await import('../../services/witchHunterDuelService.js');

      if (subcommand === 'setup-summon') {
        const chosenChannel = interaction.options.getChannel('kenh');
        let targetChannel = chosenChannel;

        if (!targetChannel) {
          targetChannel =
            interaction.guild.channels.cache.find(
              (c) => c.name === 'trieu-hoi' || c.name === 'summon' || c.name === 'te-dan'
            ) || interaction.channel;
        }

        const embed = WitchHunterSummonService.buildSummonDashboardEmbed();
        const components = WitchHunterSummonService.createSummonDashboardComponents();

        await targetChannel.send({
          embeds: [embed],
          components,
        });

        return interaction.reply({
          content: `✅ Đã thiết lập bảng **Tế Đàn Triệu Gọi Huyết Nguyệt** tại kênh <#${targetChannel.id}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // SETUP MONOLITH
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'setup-monolith') {
        const chosenChannel = interaction.options.getChannel('kenh');
        let targetChannel = chosenChannel;

        if (!targetChannel) {
          const defaultChannelId = WITCH_HUNTER_CONFIG.channels.monolithChannelId;
          targetChannel =
            interaction.guild.channels.cache.get(defaultChannelId) ||
            interaction.guild.channels.cache.find((c) => c.name.includes('thành-trì') || c.name.includes('tru-tong')) ||
            interaction.channel;
        }

        await WitchHunterDuelService.setupMonolithDashboard(targetChannel);

        return interaction.reply({
          content: `✅ Đã khởi tạo bảng cố định **Trụ Tổng Pháo Đài** tại kênh <#${targetChannel.id}> thành công! Máu trụ và nhật ký sẽ tự động cập nhật sau mỗi trận chiến.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // RESET MONOLITH
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'reset-monolith') {
        await WitchHunterDuelService.resetMonolith(interaction.guild);

        return interaction.reply({
          content: `🔄 **ĐÃ PHỤC HỒI 100% HP CHO CẢ 2 TRỤ TỔNG!**\n> Toàn bộ cư dân 2 phe đã được giải trừ phong ấn ma lực và sẵn sàng cho mùa giải mới.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // CANCEL DUEL
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'cancel-duel') {
        const duel = WitchHunterDuelService.activeDuels.get(interaction.guildId);
        if (!duel) {
          return interaction.reply({
            content: 'Hiện không có trận đấu nào đang diễn ra để hủy!',
            flags: MessageFlags.Ephemeral,
          });
        }

        clearTimeout(duel.roundTimer);
        clearTimeout(duel.betTimer);
        clearTimeout(duel.timeoutTimer);

        // Hoàn 100% cược cho người chơi
        const { WitchHunterService } = await import('../../services/witchHunterService.js');
        for (const bet of duel.bets) {
          if (bet.userId === 'fan1' || bet.userId === 'fan2') continue;
          await WitchHunterService.awardPumpkins(interaction.guild, bet.userId, bet.amount, {
            reason: 'Hoàn trả 100% Bí Ngô do Admin hủy trận đấu Huyết Thệ',
            executor: interaction.user,
            notifyDM: true,
            notifyAdminLog: false,
          }).catch(() => null);
        }

        WitchHunterDuelService.activeDuels.delete(interaction.guildId);

        if (duel.mainMessage) {
          const cancelEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`${WITCH_HUNTER_CONFIG.emojis.titleLeft} **TRẬN ĐẤU ĐÃ BỊ HỦY BỎ BỞI ADMIN** ${WITCH_HUNTER_CONFIG.emojis.titleRight}`)
            .setDescription(`Admin <@${interaction.user.id}> đã hủy bỏ trận chiến Huyết Thệ này. Toàn bộ Bí Ngô cược đã được hoàn trả 100% cho các đấu thủ và cư dân!`)
            .setTimestamp();

          await duel.mainMessage.edit({ embeds: [cancelEmbed], components: [] }).catch(() => null);
        }

        return interaction.reply({
          content: `✅ Đã hủy trận đấu thành công và hoàn trả 100% Bí Ngô cho tất cả người cược!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // BAO CAO DAILY (GỬI BÙ HOẶC GỬI NGAY)
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'bao-cao-daily') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { pumpkinGrowthTracker } = await import('../../services/pumpkinGrowthTracker.js');

        const inputDate = interaction.options.getString('ngay');
        let targetDate = inputDate ? inputDate.trim() : null;

        if (!targetDate) {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          targetDate = yesterday.toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
        }

        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(targetDate)) {
          return interaction.editReply({
            content: `❌ Định dạng ngày không hợp lệ! Vui lòng nhập đúng định dạng DD/MM/YYYY (ví dụ: \`26/10/2026\`).`,
          });
        }

        const reportChannelId = WITCH_HUNTER_CONFIG.channels.dailyReportChannelId;
        await pumpkinGrowthTracker.flushDailyReport(interaction.client, targetDate, null, true);

        return interaction.editReply({
          content: `✅ Đã gửi báo cáo hoạt động ngày **${targetDate}** vào kênh <#${reportChannelId}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
        });
      }

      // ────────────────────────────────────────────────────────────
      // SIEGE START
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'siege-start') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { witchHunterSiegeService } = await import('../../services/witchHunterSiegeService.js');

        const durationMinutes = interaction.options.getInteger('thoi_gian_phut') || 30;
        const targetChannel = interaction.options.getChannel('kenh') || interaction.channel;

        const result = await witchHunterSiegeService.startSiege({
          interaction,
          durationMinutes,
          channel: targetChannel,
        });

        if (!result.success) {
          return interaction.editReply({ content: result.message });
        }

        return interaction.editReply({
          content: `✅ Đã mở cổng **Chiến Trường Cổ Tháp Phong Ấn** (${durationMinutes} phút) tại kênh <#${targetChannel.id}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
        });
      }

      // ────────────────────────────────────────────────────────────
      // SIEGE END
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'siege-end') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { witchHunterSiegeService } = await import('../../services/witchHunterSiegeService.js');

        if (!witchHunterSiegeService.isSiegeActive()) {
          return interaction.editReply({
            content: '❌ Hiện không có chiến trường Cổ Tháp nào đang diễn ra để kết thúc!',
          });
        }

        const isCancel = interaction.options.getBoolean('huy_bo') || false;
        await witchHunterSiegeService.endSiege(interaction.client, isCancel);

        return interaction.editReply({
          content: isCancel
            ? '🛑 Đã hủy bỏ chiến trường Cổ Tháp Phong Ấn thành công!'
            : '✅ Đã kết thúc chiến trường Cổ Tháp và tự động trao Bùa Lợi Lãnh Địa cho phe thắng cuộc rồi nè vợ của Kim Nong ơi! 💕',
        });
      }

      // ────────────────────────────────────────────────────────────
      // TANG VE SUMMON
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'tang-ve-summon') {
        const targetUser = interaction.options.getUser('thanh_vien');
        const count = interaction.options.getInteger('so_luong');
        const { witchHunterStorage } = await import('../../services/witchHunterService.js');

        const uData = witchHunterStorage.getUser(targetUser.id);
        if (!uData || !uData.faction) {
          return interaction.reply({
            content: `❌ Thành viên <@${targetUser.id}> chưa chọn phe phái trong Witch Hunter!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        uData.free_summons = (Number(uData.free_summons) || 0) + count;
        uData.updated_at = Date.now();
        witchHunterStorage.saveUser(uData, true);

        return interaction.reply({
          content: `🎉 Đã tặng **+${count} Vé Triệu Gọi Tế Đàn Free** cho <@${targetUser.id}> thành công! Hiện có tổng cộng **${uData.free_summons} vé** 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // WORLD BOSS START
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'boss-start') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { witchHunterWorldBossService } = await import('../../services/witchHunterWorldBossService.js');

        const bossType = interaction.options.getString('boss_type') || 'avalonia';
        const durationMinutes = interaction.options.getInteger('thoi_gian_phut') || 60;
        const targetChannel = interaction.options.getChannel('kenh');

        const result = await witchHunterWorldBossService.startWorldBoss({
          interaction,
          bossType,
          durationMinutes,
          channel: targetChannel,
        });

        if (!result.success) {
          return interaction.editReply({ content: result.message });
        }

        return interaction.editReply({
          content: `✅ Đã khai mở sự kiện **BÁCH QUỶ DẠ HÀNH - HUYẾT NGUYỆT GIÁNG LÂM** (${result.bossName}, ${durationMinutes} phút) tại kênh <#${result.channelId}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
        });
      }

      // ────────────────────────────────────────────────────────────
      // WORLD BOSS END
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'boss-end') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { witchHunterWorldBossService } = await import('../../services/witchHunterWorldBossService.js');

        if (!witchHunterWorldBossService.isBossActive()) {
          return interaction.editReply({
            content: '❌ Hiện không có chiến dịch Bách Quỷ Dạ Hành nào đang diễn ra để kết thúc!',
          });
        }

        const reason = interaction.options.getString('ly_do') || 'timeout';
        await witchHunterWorldBossService.endWorldBoss(interaction.client, { reason });

        return interaction.editReply({
          content: `✅ Đã kết thúc chiến dịch World Boss (${reason === 'defeated' ? 'Boss bị tiêu diệt' : 'Hết giờ'}) và chốt trao thưởng thành công rồi nè vợ của Kim Nong ơi! 💕`,
        });
      }
    } catch (error) {
      logger.error('❌ [WitchHunterAdmin] Lỗi thực thi lệnh /wh-admin:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
