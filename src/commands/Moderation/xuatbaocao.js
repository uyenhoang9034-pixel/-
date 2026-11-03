import { executeFinancialExport, financialExportCommand } from '../../services/financial/financialLedgerService.js';

export default {
  data: financialExportCommand,
  category: 'moderation',
  async execute(interaction, config, client) {
    return executeFinancialExport(interaction, client);
  },
};
