import { buildGuideContainer, buildWardrobeContainer } from '../../../services/roleIconShopService.js';
import { logger } from '../../../utils/logger.js';

export default [
  {
    name: 'roleicon_btn_guide',
    async execute(interaction, client) {
      try {
        const payload = buildGuideContainer();
        await interaction.reply(payload);
      } catch (error) {
        logger.error('❌ [RoleIconShop] Lỗi khi mở hướng dẫn:', error);
      }
    },
  },
  {
    name: 'roleicon_btn_wardrobe',
    async execute(interaction, client) {
      try {
        const payload = await buildWardrobeContainer(interaction.member, interaction.guild, client);
        await interaction.reply(payload);
      } catch (error) {
        logger.error('❌ [RoleIconShop] Lỗi khi mở tủ đồ:', error);
      }
    },
  },
];

