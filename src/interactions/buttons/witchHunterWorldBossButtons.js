import { witchHunterWorldBossService } from '../../services/witchHunterWorldBossService.js';
import { logger } from '../../utils/logger.js';

export default [
  {
    name: 'wb_attack',
    async execute(interaction) {
      try {
        await witchHunterWorldBossService.handleAttack(interaction);
      } catch (err) {
        logger.error('❌ [WorldBossButton] Lỗi nút tung đòn tấn công:', err);
      }
    },
  },
  {
    name: 'wb_top12',
    async execute(interaction) {
      try {
        await witchHunterWorldBossService.handleTop12(interaction);
      } catch (err) {
        logger.error('❌ [WorldBossButton] Lỗi nút xem Top 12:', err);
      }
    },
  },
  {
    name: 'wb_my_stats',
    async execute(interaction) {
      try {
        await witchHunterWorldBossService.handleMyStats(interaction);
      } catch (err) {
        logger.error('❌ [WorldBossButton] Lỗi nút xem chiến tích cá nhân:', err);
      }
    },
  },
];
