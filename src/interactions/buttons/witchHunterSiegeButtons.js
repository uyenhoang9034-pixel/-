import { witchHunterSiegeService } from '../../services/witchHunterSiegeService.js';
import { logger } from '../../utils/logger.js';

export default [
  {
    name: 'btn_siege_tower_1',
    async execute(interaction) {
      try {
        await witchHunterSiegeService.handleTowerAttack(interaction, 0);
      } catch (err) {
        logger.error('❌ [WitchHunterSiegeButton] Lỗi công Tháp I:', err);
      }
    },
  },
  {
    name: 'btn_siege_tower_2',
    async execute(interaction) {
      try {
        await witchHunterSiegeService.handleTowerAttack(interaction, 1);
      } catch (err) {
        logger.error('❌ [WitchHunterSiegeButton] Lỗi công Tháp II:', err);
      }
    },
  },
  {
    name: 'btn_siege_tower_3',
    async execute(interaction) {
      try {
        await witchHunterSiegeService.handleTowerAttack(interaction, 2);
      } catch (err) {
        logger.error('❌ [WitchHunterSiegeButton] Lỗi công Tháp III:', err);
      }
    },
  },
  {
    name: 'btn_siege_my_stats',
    async execute(interaction) {
      try {
        await witchHunterSiegeService.handleMyStats(interaction);
      } catch (err) {
        logger.error('❌ [WitchHunterSiegeButton] Lỗi xem chiến tích cá nhân:', err);
      }
    },
  },
  {
    name: 'btn_siege_mechanics',
    async execute(interaction) {
      try {
        await witchHunterSiegeService.handleMechanics(interaction);
      } catch (err) {
        logger.error('❌ [WitchHunterSiegeButton] Lỗi xem cơ chế chiếm tháp:', err);
      }
    },
  },
];
