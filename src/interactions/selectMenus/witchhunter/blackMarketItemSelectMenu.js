import { MessageFlags } from 'discord.js';
import { WitchHunterBlackMarketService } from '../../../services/witchHunterBlackMarketService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'black_market_item_select',

  async execute(interaction, client, args = []) {
    try {
      const [type] = args;
      const selectedValue = interaction.values?.[0];
      if (!selectedValue || !type) return;

      const view = WitchHunterBlackMarketService.buildConfirmationView(
        interaction.user.id,
        type,
        selectedValue
      );

      if (!view) {
        return interaction.reply({
          content: '❌ Không tìm thấy thông tin vật phẩm được chọn!',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.update({
        embeds: [view.embed],
        components: view.components,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterBlackMarket] Lỗi khi xử lý black_market_item_select menu:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi xem chi tiết vật phẩm, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
