import { MessageFlags } from 'discord.js';
import { WitchHunterSummonService } from '../../services/witchHunterSummonService.js';
import { logger } from '../../utils/logger.js';

/**
 * Xử lý triệu hồi chung cho nút bấm
 */
async function handleSummon(interaction, pullCount, customType = null) {
  try {
    const user = interaction.user;
    const summonType = customType || WitchHunterSummonService.getUserSelectedType(user.id);

    const result = await WitchHunterSummonService.executeSummon({
      guild: interaction.guild,
      user,
      summonType,
      pullCount,
    });

    if (!result.success) {
      return interaction.reply({
        content: result.message,
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = WitchHunterSummonService.buildSummonResultEmbed(user, result);
    const components = WitchHunterSummonService.createSummonResultComponents(user.id, summonType);

    // Gửi phản hồi CÔNG KHAI vào kênh để toàn bộ server cùng chiêm ngưỡng
    return interaction.reply({
      embeds: [embed],
      components,
    });
  } catch (error) {
    logger.error('❌ [WitchHunterSummon] Lỗi khi xử lý nút triệu hồi:', error);
    return interaction.reply({
      content: `Đã có lỗi xảy ra khi triệu hồi: ${error.message}`,
      flags: MessageFlags.Ephemeral,
    }).catch(() => null);
  }
}

export default [
  // Nút quay 1 lần trên dashboard cố định
  {
    name: 'btn_summon_single',
    async execute(interaction) {
      await handleSummon(interaction, 1);
    },
  },

  // Nút quay 10 lần trên dashboard cố định
  {
    name: 'btn_summon_multi',
    async execute(interaction) {
      await handleSummon(interaction, 10);
    },
  },

  // Nút kiểm tra tiến trình Pity
  {
    name: 'btn_view_pity',
    async execute(interaction) {
      try {
        const pityEmbed = WitchHunterSummonService.buildPityStatusEmbed(interaction.user.id);
        return interaction.reply({
          embeds: [pityEmbed],
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        logger.error('❌ [WitchHunterSummon] Lỗi xem Pity:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra khi kiểm tra Pity: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    },
  },

  // Nút quay tiếp 1 lần gắn dưới tin nhắn kết quả
  {
    name: 'btn_summon_again_single',
    async execute(interaction, client, args = []) {
      const [authorId, type] = args;
      if (authorId && interaction.user.id !== authorId) {
        return interaction.reply({
          content: `❌ Nút này thuộc phiên triệu hồi của <@${authorId}>! Lữ khách hãy bấm nút ở Tế Đàn chính hoặc tự triệu hồi nhé 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await handleSummon(interaction, 1, type);
    },
  },

  // Nút quay tiếp 10 lần gắn dưới tin nhắn kết quả
  {
    name: 'btn_summon_again_multi',
    async execute(interaction, client, args = []) {
      const [authorId, type] = args;
      if (authorId && interaction.user.id !== authorId) {
        return interaction.reply({
          content: `❌ Nút này thuộc phiên triệu hồi của <@${authorId}>! Lữ khách hãy bấm nút ở Tế Đàn chính hoặc tự triệu hồi nhé 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }
      await handleSummon(interaction, 10, type);
    },
  },

  // Nút chuyển đổi bể triệu hồi gắn dưới tin nhắn kết quả
  {
    name: 'btn_summon_switch_type',
    async execute(interaction, client, args = []) {
      const [authorId, currentType] = args;
      if (authorId && interaction.user.id !== authorId) {
        return interaction.reply({
          content: `❌ Nút này thuộc phiên triệu hồi của <@${authorId}>!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const nextType = currentType === 'supporter' ? 'weapon' : 'supporter';
      WitchHunterSummonService.setUserSelectedType(interaction.user.id, nextType);

      const nextTypeName = nextType === 'supporter' ? 'Triệu Hồi Supporter' : 'Triệu Hồi Thần Khí';
      return interaction.reply({
        content: `✅ Đã chuyển sang tế đàn: **${nextTypeName}**! Giờ lữ khách có thể nhấn nút quay tiếp nhé 💕`,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
