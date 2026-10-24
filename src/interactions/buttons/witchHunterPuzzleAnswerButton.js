import { logger } from '../../utils/logger.js';
import { WitchHunterQuestService } from '../../services/witchHunterQuestService.js';

export default {
  name: 'btn_puzzle_ans',

  async execute(interaction, client, args = []) {
    try {
      const [chosenOption, sessionId] = args;

      if (!sessionId || !chosenOption) {
        return interaction.update({
          content: '⚠️ Dữ liệu câu trả lời không hợp lệ!',
          embeds: [],
          components: [],
        });
      }

      const result = await WitchHunterQuestService.submitAnswer(sessionId, chosenOption, interaction.guild);

      if (!result.success) {
        return interaction.update({
          content: result.message || 'Phiên làm bài đã hết hạn.',
          embeds: [],
          components: [],
        });
      }

      // Chưa kết thúc -> chuyển sang câu tiếp theo
      if (!result.isFinished) {
        const nextEmbed = WitchHunterQuestService.buildQuestionEmbed(result.session);
        const nextButtons = WitchHunterQuestService.buildQuestionButtons(sessionId);

        return interaction.update({
          embeds: [nextEmbed],
          components: [nextButtons],
        });
      }

      // Đã hoàn thành 10 câu -> hiển thị kết quả theo 3 trường hợp
      const finalScore = result.finalScore;
      const rewardPumpkins = result.rewardPumpkins;
      let outcomeMessage = '';

      if (finalScore === 10) {
        outcomeMessage = `<a:heartg1:1545307544808071258> "Chính xác! Ngươi đã thấu suốt tàn tích cổ ngữ. Nhận được +20 Bí Ngô <a:bingo:1563061901800243253>."`;
      } else if (finalScore === 0) {
        outcomeMessage = `<a:meongg12:1546092641467506688> "Sai lầm! Ảo giác ma thuật đã đánh lừa giác quan của ngươi. Hãy thử lại vào kỳ trăng tới."`;
      } else {
        outcomeMessage = `<a:trangtrig37:1547237647850807420> "Chưa tài đâu! Ngươi trả lời đúng **${finalScore}/10 câu**, nhận được **+${rewardPumpkins} <a:bingo:1563061901800243253>**. Hãy thử lại và cố gắng thấu suốt tàn tích cổ ngữ vào tuần sau nhé!"`;
      }

      return interaction.update({
        content: outcomeMessage,
        embeds: [],
        components: [],
      });
    } catch (error) {
      logger.error('❌ [WitchHunterQuest] Lỗi trả lời câu hỏi cổ ngữ:', error);
      return interaction.update({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        embeds: [],
        components: [],
      }).catch(() => null);
    }
  },
};
