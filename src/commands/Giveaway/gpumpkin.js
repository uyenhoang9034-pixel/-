import {
  SlashCommandBuilder,
  MessageFlags,
  ChannelType,
} from 'discord.js';
import {
  pumpkinGiveawayService,
} from '../../services/pumpkinGiveawayService.js';
import { assertGiveawayCommandAdmin } from '../../utils/giveawayPermissions.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gpumpkin')
    .setDescription('Mở Bảng Điều Khiển Đại Lễ Ban Thưởng Bí Ngô chia đều toàn server (Chỉ Admin)')
    .setDefaultMemberPermissions(0n)
    .setDMPermission(false)
    .addIntegerOption((opt) =>
      opt
        .setName('so-luong')
        .setDescription('Cài trước số lượng Bí Ngô ban thưởng (tùy chọn, ví dụ: 5000, 10000)')
        .setMinValue(10)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('thoi-gian')
        .setDescription('Cài trước thời gian đếm ngược (tùy chọn, ví dụ: 10m, 30m, 1h, 24h)')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('kenh')
        .setDescription('Kênh chỉ định gửi bảng ban thưởng (tùy chọn)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  category: 'Giveaway',

  async execute(interaction) {
    await assertGiveawayCommandAdmin(interaction, 'mở Bảng Ban Thưởng Bí Ngô');

    try {
      const guild = interaction.guild;

      const preAmount = interaction.options.getInteger('so-luong');
      const preDuration = interaction.options.getString('thoi-gian');
      const preChannel = interaction.options.getChannel('kenh');

      const session = pumpkinGiveawayService.getSession(interaction.user.id, guild.id);

      if (preAmount && preAmount >= 10) {
        session.totalPumpkins = preAmount;
      }
      if (preDuration) {
        session.duration = preDuration;
      }
      if (preChannel) {
        session.channelId = preChannel.id;
      }

      const embed = pumpkinGiveawayService.buildDashboardEmbed(session);
      const components = pumpkinGiveawayService.buildDashboardComponents(session);

      return await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [PumpkinGiveawayCommand] Lỗi mở dashboard:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
