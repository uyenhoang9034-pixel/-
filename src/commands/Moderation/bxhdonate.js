import { executeBxhDonate, financialBxhCommand } from '../../services/financial/financialLedgerService.js';

export default {
  data: financialBxhCommand,
  category: 'moderation',
  async execute(interaction, config, client) {
    return executeBxhDonate(interaction, client);
  },
};
