import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { witchHunterStorage } from '../../services/witchHunterService.js';
import { WitchHunterSummonService } from '../../services/witchHunterSummonService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Mở Tế Đàn Triệu Gọi Huyết Nguyệt: Supporter & Thần Khí (Dành cho tất cả lữ khách)')
    .addBooleanOption((opt) =>
      opt
        .setName('an-danh')
        .setDescription('Chỉ hiển thị riêng cho bạn (mặc định: Không, hiển thị trong kênh)')
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const user = interaction.user;
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({
          content: 'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Kiểm tra xem thành viên đã tham gia phe chưa
      const userData = witchHunterStorage.getUser(user.id);
      const faction = userData?.faction;

      if (!faction || !['hunter', 'witch'].includes(faction)) {
        return interaction.reply({
          content: `❌ Lữ khách chưa ký khế ước chọn phe nào trong thế giới Witch Hunter!\nHãy ghé qua kênh <#${WITCH_HUNTER_CONFIG.channels.selectionChannelId}> để ký khế ước chọn phe trước khi dâng hiến Bí Ngô nhé 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const isHidden = interaction.options.getBoolean('an-danh') || false;
      const selectedType = WitchHunterSummonService.getUserSelectedType(user.id);

      const embed = WitchHunterSummonService.buildSummonDashboardEmbed();
      const components = WitchHunterSummonService.createSummonDashboardComponents(selectedType);

      await interaction.reply({
        embeds: [embed],
        components,
        flags: isHidden ? MessageFlags.Ephemeral : undefined,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterSummon] Lỗi khi thực thi lệnh /summon:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi mở Tế Đàn Triệu Hồi, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
