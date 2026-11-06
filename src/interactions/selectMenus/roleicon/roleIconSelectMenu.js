import { buildDetailEphemeral } from '../../../services/roleIconShopService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'roleicon_select',
  async execute(interaction, client) {
    try {
      const selectedId = parseInt(interaction.values?.[0], 10);
      if (!selectedId) return;

      const payload = buildDetailEphemeral(selectedId, interaction.member);
      if (!payload) return;

      await interaction.reply(payload);
    } catch (error) {
      logger.error('❌ [RoleIconShop] Lỗi khi xử lý roleicon_select:', error);
    }
  },
};

