import { MessageFlags } from 'discord.js';
import { WitchHunterDuelService } from '../../services/witchHunterDuelService.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'modal_bet_custom',

  async execute(interaction) {
    try {
      const rawFaction = interaction.fields.getTextInputValue('bet_faction').trim().toLowerCase();
      const rawAmount = interaction.fields.getTextInputValue('bet_amount').trim();

      let faction = null;
      if (rawFaction.includes('thợ săn') || rawFaction.includes('hunter') || rawFaction === 'h') {
        faction = 'hunter';
      } else if (rawFaction.includes('phù thủy') || rawFaction.includes('witch') || rawFaction === 'w') {
        faction = 'witch';
      } else {
        return interaction.reply({
          content: '❌ Tên phe không hợp lệ! Vui lòng nhập "hunter" (Thợ Săn) hoặc "witch" (Phù Thủy).',
          flags: MessageFlags.Ephemeral,
        });
      }

      const amount = parseInt(rawAmount.replace(/[.,]/g, ''), 10);
      if (isNaN(amount) || amount <= 0) {
        return interaction.reply({
          content: '❌ Số lượng Bí Ngô cược không hợp lệ! Vui lòng nhập số nguyên dương (ví dụ: 20, 50, 100...).',
          flags: MessageFlags.Ephemeral,
        });
      }

      const res = await WitchHunterDuelService.placeBet({
        interaction,
        userId: interaction.user.id,
        faction,
        amount,
      });

      return interaction.reply({
        content: res.message,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      logger.error('❌ [DuelModal] Lỗi modal_bet_custom:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi xử lý vé cược!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
