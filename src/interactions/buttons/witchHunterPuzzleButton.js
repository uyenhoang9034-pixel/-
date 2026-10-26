import { MessageFlags } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import {
  WitchHunterQuestService,
  witchHunterQuestStorage,
  getVietnamWeekIdentifier,
  isPuzzleWeekendOpen,
} from '../../services/witchHunterQuestService.js';
import { WitchHunterService, witchHunterStorage } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

// Bộ nhớ đệm chống click spam / race condition nhiều lần cùng lúc
const activePuzzleUsers = new Set();

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

/**
 * Xử lý sự kiện nhấn nút Bắt Đầu Giải Mã Cổ Ngữ
 */
async function handlePuzzleStart(interaction) {
  const userId = interaction.user.id;

  try {
    const currentWeek = getVietnamWeekIdentifier();
    const weekendKey = WitchHunterService.getWeekendSessionKey?.() || currentWeek;

    // 1. CHỐNG SPAM CLICK / RACE CONDITION
    if (activePuzzleUsers.has(userId)) {
      return interaction.reply({
        content: '⚠️ Bạn đang có một thao tác giải mã đang xử lý. Vui lòng không nhấn nút liên tục!',
        flags: MessageFlags.Ephemeral,
      });
    }

    activePuzzleUsers.add(userId);
    const releaseLockTimer = setTimeout(() => {
      activePuzzleUsers.delete(userId);
    }, 5000);

    // 2. EARLY RETURN (GUARD CLAUSE) TUYỆT ĐỐI:
    // Kiểm tra ngay lập tức xem người chơi đã hoàn thành bài thi của tuần này chưa
    const record = witchHunterQuestStorage.getPuzzleRecord(userId, currentWeek);
    const mainUser = witchHunterStorage.getUser(userId);
    const hasCompletedInService = await WitchHunterService.hasUserCompletedPuzzle(userId, weekendKey).catch(() => false);
    const hasCompletedInServiceWeek = await WitchHunterService.hasUserCompletedPuzzle(userId, currentWeek).catch(() => false);

    if (
      record ||
      (mainUser && (
        mainUser.last_puzzle_week === currentWeek ||
        mainUser.last_puzzle_week === weekendKey ||
        mainUser.last_puzzle_session === weekendKey ||
        mainUser.last_puzzle_session === currentWeek
      )) ||
      hasCompletedInService ||
      hasCompletedInServiceWeek
    ) {
      clearTimeout(releaseLockTimer);
      activePuzzleUsers.delete(userId);
      return interaction.reply({
        content: '❌ Lữ khách đã tham gia và hoàn thành đợt **Giải Mã Cổ Ngữ** của tuần này rồi! Mỗi thành viên chỉ được tham gia duy nhất 1 lần trong suốt 2 ngày Thứ 7 và Chủ Nhật. Hẹn gặp lại lữ khách vào cuối tuần sau nhé! 💕',
        flags: MessageFlags.Ephemeral,
      });
    }

    // 3. KIỂM TRA THỜI GIAN MỞ: CHỈ THỨ 7 VÀ CHỦ NHẬT (Admin được phép bypass để test)
    const isAdmin = isWitchHunterAdmin(interaction);
    if (!isAdmin && !isPuzzleWeekendOpen()) {
      clearTimeout(releaseLockTimer);
      activePuzzleUsers.delete(userId);
      return interaction.reply({
        content: '⏳ Nghi thức **Giải Mã Cổ Ngữ** chỉ mở vào **Thứ 7 & Chủ Nhật** hàng tuần! Hãy quay lại vào cuối tuần nhé lữ khách 💕',
        flags: MessageFlags.Ephemeral,
      });
    }

    // 4. BẮT ĐẦU PHIÊN LÀM BÀI
    const startResult = WitchHunterQuestService.startPuzzleSession(userId, isAdmin);

    clearTimeout(releaseLockTimer);
    activePuzzleUsers.delete(userId);

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
    activePuzzleUsers.delete(userId);
    logger.error('❌ [WitchHunterQuest] Lỗi bắt đầu Giải Mã Cổ Ngữ:', error);
    return interaction.reply({
      content: `Đã có lỗi xảy ra khi bắt đầu giải mã: ${error.message}`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  }
}

// Xuất cả 2 handler để hỗ trợ đồng thời btn_start_puzzle và witch_hunter_puzzle_start
export default [
  {
    name: 'btn_start_puzzle',
    execute: handlePuzzleStart,
  },
  {
    name: 'witch_hunter_puzzle_start',
    execute: handlePuzzleStart,
  },
];
