import { MessageFlags } from 'discord.js';
import { WitchHunterBlackMarketService } from '../../../services/witchHunterBlackMarketService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'black_market_category',

  async execute(interaction) {
    try {
      const selectedCategory = interaction.values?.[0];
      if (!selectedCategory) return;

      const view = WitchHunterBlackMarketService.buildCategoryView(interaction.user.id, selectedCategory);
      if (!view) {
        return interaction.reply({
          content: '❌ Không tìm thấy danh mục được yêu cầu!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Toàn bộ tương tác tại Chợ Đen trả về dạng Ephemeral để bảo mật
      await interaction.reply({
        embeds: [view.embed],
        components: view.components,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterBlackMarket] Lỗi khi xử lý black_market_category menu:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi mở danh mục Chợ Đen, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
