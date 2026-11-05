import { handleLeaderboardButton } from '../../services/financial/financialLedgerService.js';

export default {
  name: 'financial_bxh',
  async execute(interaction, client, args) {
    return handleLeaderboardButton(interaction, client, args);
  },
};

