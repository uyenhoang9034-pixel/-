import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { WitchHunterDuelService } from '../../services/witchHunterDuelService.js';
import { logger } from '../../utils/logger.js';

export default [
  // 1. Nút Tiếp Nhận Huyết Chiến
  {
    name: 'btn_duel_accept',
    async execute(interaction) {
      try {
        await WitchHunterDuelService.acceptChallenge(interaction);
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_duel_accept:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Đã có lỗi xảy ra khi tiếp nhận khiêu chiến!',
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        }
      }
    },
  },

  // 2. Nút Từ Chối Khiêu Chiến
  {
    name: 'btn_duel_decline',
    async execute(interaction) {
      try {
        await WitchHunterDuelService.declineChallenge(interaction);
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_duel_decline:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Đã có lỗi xảy ra khi từ chối khiêu chiến!',
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        }
      }
    },
  },

  // 3. Nút Cược Thợ Săn (10 Bí Ngô)
  {
    name: 'btn_bet_hunter_10',
    async execute(interaction) {
      try {
        const res = await WitchHunterDuelService.placeBet({
          interaction,
          userId: interaction.user.id,
          faction: 'hunter',
          amount: 10,
        });
        return interaction.reply({
          content: res.message,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_bet_hunter_10:', err);
      }
    },
  },

  // 4. Nút Cược Phù Thủy (10 Bí Ngô)
  {
    name: 'btn_bet_witch_10',
    async execute(interaction) {
      try {
        const res = await WitchHunterDuelService.placeBet({
          interaction,
          userId: interaction.user.id,
          faction: 'witch',
          amount: 10,
        });
        return interaction.reply({
          content: res.message,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_bet_witch_10:', err);
      }
    },
  },

  // 5. Nút Cược Tùy Chọn (Mở Modal)
  {
    name: 'btn_bet_custom',
    async execute(interaction) {
      try {
        const modal = new ModalBuilder()
          .setCustomId('modal_bet_custom')
          .setTitle('Đặt Cược Sòng Cược Huyết Thệ');

        const factionInput = new TextInputBuilder()
          .setCustomId('bet_faction')
          .setLabel('Phe muốn cược (nhập "hunter" hoặc "witch")')
          .setPlaceholder('hunter (Thợ Săn) hoặc witch (Phù Thủy)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(4)
          .setMaxLength(6);

        const amountInput = new TextInputBuilder()
          .setCustomId('bet_amount')
          .setLabel('Số lượng Bí Ngô muốn cược')
          .setPlaceholder('Ví dụ: 20, 50, 100...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(factionInput),
          new ActionRowBuilder().addComponents(amountInput)
        );

        await interaction.showModal(modal);
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_bet_custom:', err);
      }
    },
  },

  // 6. Nút Tấn Công Trực Diện
  {
    name: 'btn_combat_attack',
    async execute(interaction) {
      try {
        await WitchHunterDuelService.handlePlayerChoice(interaction, 'ATTACK');
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_combat_attack:', err);
      }
    },
  },

  // 7. Nút Phòng Thủ Phản Đòn
  {
    name: 'btn_combat_defend',
    async execute(interaction) {
      try {
        await WitchHunterDuelService.handlePlayerChoice(interaction, 'DEFEND');
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_combat_defend:', err);
      }
    },
  },

  // 8. Nút Giải Phóng Khế Ước
  {
    name: 'btn_combat_release',
    async execute(interaction) {
      try {
        await WitchHunterDuelService.handlePlayerChoice(interaction, 'RELEASE');
      } catch (err) {
        logger.error('❌ [DuelButton] Lỗi btn_combat_release:', err);
      }
    },
  },
];
