import { executeFinancialSlash, financialLedgerCommand } from '../../services/financial/financialLedgerService.js';

export default {
  data: financialLedgerCommand,
  category: 'community',
  async execute(interaction, config, client) {
    return executeFinancialSlash(interaction, client);
  },
};
