import { witchHunterBountyService } from '../../services/witchHunterBountyService.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'witch_hunter_bounty_hunt',

  async execute(interaction, client, args = []) {
    try {
      await witchHunterBountyService.handleHuntInteraction(interaction, client);
    } catch (err) {
      logger.error('❌ [BountyButton] Lỗi thực thi nút Nhận Lệnh Truy Nã:', err);
    }
  },
};

