import {
  voteDrink,
  buildTraChieuEmbed,
  buildTraChieuActionRow,
} from '../../services/thanVanTuBanService.js';
import { logger } from '../../utils/logger.js';
import { MessageFlags } from 'discord.js';

export default {
  name: 'order_drink',

  async execute(interaction, client, args) {
    try {
      const choiceKey = args?.[0] || 'trasua';
      const messageId = interaction.message.id;

      const result = voteDrink(messageId, interaction.user.id, choiceKey);
      const embed = buildTraChieuEmbed(messageId);
      const row = buildTraChieuActionRow();

      await interaction.update({
        embeds: [embed],
        components: [row],
      });

      logger.debug(
        `[OrderDrink] ${interaction.user.tag} đã ${result.action} món ${choiceKey} trên tin nhắn ${messageId}`,
      );
    } catch (error) {
      logger.error('Error in order_drink button:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: '❌ Đã có lỗi xảy ra khi lên đơn nước. Vui lòng thử lại!',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  },
};
