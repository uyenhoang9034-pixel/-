import { MessageFlags } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import {
  WitchHunterQuestService,
  witchHunterQuestStorage,
  getVietnamWeekIdentifier,
} from '../../services/witchHunterQuestService.js';
import { witchHunterStorage } from '../../services/witchHunterService.js';
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
      const userId = interaction.user.id;
      const currentWeek = getVietnamWeekIdentifier();

      // Early Return (Guard Clause) tuyệt đối:
      // Kiểm tra ngay lập tức xem người chơi này đã hoàn thành bài thi của tuần hiện tại chưa
      const record = witchHunterQuestStorage.getPuzzleRecord(userId, currentWeek);
      const mainUser = witchHunterStorage.getUser(userId);

      if (record || (mainUser && mainUser.last_puzzle_week === currentWeek)) {
        return interaction.reply({
          content: 'Bạn đã hoàn thành thí luyện giải mã cổ ngữ của tuần này rồi. Hãy quay lại vào cuối tuần sau nhé! 💕',
          flags: MessageFlags.Ephemeral,
        });
      }

      const isAdmin = isWitchHunterAdmin(interaction);
      const startResult = WitchHunterQuestService.startPuzzleSession(userId, isAdmin);

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
