import { handleFinancialPage } from '../../services/financial/financialLedgerService.js';

export default {
  name: 'financial_page',
  async execute(interaction, client, args) {
    return handleFinancialPage(interaction, client, args);
  },
};
