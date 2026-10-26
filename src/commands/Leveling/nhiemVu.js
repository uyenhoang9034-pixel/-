import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WitchHunterQuestService } from '../../services/witchHunterQuestService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('nhiem-vu')
    .setDescription('Xem Bảng Khế Ước Nhiệm Vụ Tuần Witch Hunter của bạn'),

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

      const embed = await WitchHunterQuestService.buildWeeklyQuestsEmbed(user, guild);

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterQuest] Lỗi lệnh nhiem-vu:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
