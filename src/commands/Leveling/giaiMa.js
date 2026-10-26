import {
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('giai-ma')
    .setDescription('Mở bảng tham gia khảo nghiệm Giải Mã Cổ Ngữ (Chỉ mở vào Thứ 7 & Chủ Nhật)')
    .addBooleanOption((option) =>
      option
        .setName('gui-bang-cong-khai')
        .setDescription('Gửi bảng khảo nghiệm công khai vào kênh hiện tại (Dành cho Admin)')
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const isPublic = interaction.options.getBoolean('gui-bang-cong-khai') || false;
      const embed = WitchHunterService.buildQuickPuzzleIntroEmbed();
      const row = WitchHunterService.createQuickPuzzleStartRow();

      if (isPublic) {
        return interaction.reply({
          embeds: [embed],
          components: [row],
        });
      }

      return interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [QuickPuzzle] Lỗi khi thực thi lệnh /giai-ma:', error);
      return interaction.reply({
        content: `Đã xảy ra lỗi khi mở bảng Giải Mã Cổ Ngữ: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
