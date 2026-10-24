import { MessageFlags } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterQuestService } from '../../services/witchHunterQuestService.js';
import { logger } from '../../utils/logger.js';

function isWitchHunterAdmin(interaction) {
  const member = interaction.member;
  if (!member) return false;
  const ownerId = interaction.guild?.ownerId;
  if (ownerId && (interaction.user?.id === ownerId || member.id === ownerId)) return true;
  const configuredOwnerIds = (process.env.OWNER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (configuredOwnerIds.includes(interaction.user?.id) || configuredOwnerIds.includes(member.id)) return true;
  const adminRole = WITCH_HUNTER_CONFIG.adminRoleId;
  if (member.roles?.cache?.has?.(adminRole)) return true;
  if (Array.isArray(member._roles) && member._roles.includes(adminRole)) return true;
  if (Array.isArray(member.roles) && member.roles.includes(adminRole)) return true;
  return false;
}

export default {
  name: 'btn_start_puzzle',

  async execute(interaction) {
    try {
      const isAdmin = isWitchHunterAdmin(interaction);
      const startResult = WitchHunterQuestService.startPuzzleSession(interaction.user.id, isAdmin);

      if (!startResult.success) {
        return interaction.reply({
          content: startResult.message,
          flags: MessageFlags.Ephemeral,
        });
      }

      const session = startResult.session;
      const questionEmbed = WitchHunterQuestService.buildQuestionEmbed(session);
      const buttonsRow = WitchHunterQuestService.buildQuestionButtons(session.sessionId);

      return interaction.reply({
        embeds: [questionEmbed],
        components: [buttonsRow],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterQuest] Lỗi bắt đầu Giải Mã Cổ Ngữ:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
