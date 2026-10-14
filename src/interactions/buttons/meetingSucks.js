import {
  interactMeetingSession,
  buildMeetingEmbed,
  buildMeetingActionRow,
} from '../../services/thanVanTuBanService.js';
import { logger } from '../../utils/logger.js';
import { MessageFlags } from 'discord.js';

export default {
  name: 'meeting_sucks',

  async execute(interaction, client, args) {
    try {
      const action = args?.[0] || 'gat_dau';
      const messageId = interaction.message.id;

      interactMeetingSession(messageId, interaction.user.id, action);
      const embed = buildMeetingEmbed(messageId);
      const row = buildMeetingActionRow();

      await interaction.update({
        embeds: [embed],
        components: [row],
      });

      logger.debug(
        `[MeetingSucks] ${interaction.user.tag} đã thực hiện ${action} trên tin nhắn ${messageId}`,
      );
    } catch (error) {
      logger.error('Error in meeting_sucks button:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content:
              '❌ Đã có lỗi xảy ra khi tương tác phòng họp. Vui lòng thử lại!',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  },
};
