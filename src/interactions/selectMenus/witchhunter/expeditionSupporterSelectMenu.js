import { MessageFlags } from 'discord.js';
import { WitchHunterExpeditionService } from '../../../services/witchHunterExpeditionService.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'select_expedition_supporter',

  async execute(interaction, client, args = []) {
    try {
      const [authorId] = args;
      if (authorId && interaction.user.id !== authorId) {
        return interaction.reply({
          content: '❌ Lữ Khách chỉ có thể điều phối đội hình thám hiểm của riêng mình!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const selectedSupporterId = interaction.values?.[0];
      if (!selectedSupporterId) return;

      const updatedDraft = WitchHunterExpeditionService.setUserDraft(interaction.user.id, {
        supporterId: selectedSupporterId,
      });

      const updatedEmbed = WitchHunterExpeditionService.buildDispatchEmbed(interaction.user.id, updatedDraft);
      const updatedComponents = WitchHunterExpeditionService.createDispatchComponents(interaction.user.id, updatedDraft);

      await interaction.update({
        embeds: [updatedEmbed],
        components: updatedComponents,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterExpedition] Lỗi khi chọn Supporter viễn chinh:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
