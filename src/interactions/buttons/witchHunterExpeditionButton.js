import { MessageFlags } from 'discord.js';
import { WitchHunterExpeditionService } from '../../services/witchHunterExpeditionService.js';
import { logger } from '../../utils/logger.js';

export default [
  // 1. Nút Chọn Khu Vực Viễn Chinh
  {
    name: 'btn_expedition_choose',
    async execute(interaction) {
      try {
        const userId = interaction.user.id;
        const embed = WitchHunterExpeditionService.buildDispatchEmbed(userId);
        const components = WitchHunterExpeditionService.createDispatchComponents(userId);

        if (components.length === 0) {
          return interaction.reply({
            content:
              '❌ Lữ Khách chưa ký kết khế ước gia nhập phe phái! Vui lòng chọn phe trước khi tham gia viễn chinh 💕',
            flags: MessageFlags.Ephemeral,
          });
        }

        return interaction.reply({
          embeds: [embed],
          components,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        logger.error('❌ [WitchHunterExpedition] Lỗi khi mở menu chọn viễn chinh:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    },
  },

  // 2. Nút Theo Dõi Tiến Trình
  {
    name: 'btn_expedition_status',
    async execute(interaction) {
      try {
        const userId = interaction.user.id;
        const embed = WitchHunterExpeditionService.buildProgressEmbed(userId);

        return interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        logger.error('❌ [WitchHunterExpedition] Lỗi khi theo dõi tiến trình:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    },
  },

  // 3. Nút Nhận Thưởng Thu Hoạch
  {
    name: 'btn_expedition_claim',
    async execute(interaction) {
      try {
        const userId = interaction.user.id;
        const result = await WitchHunterExpeditionService.claimExpedition(userId);

        return interaction.reply({
          embeds: [result.embed],
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        logger.error('❌ [WitchHunterExpedition] Lỗi khi nhận thưởng viễn chinh:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    },
  },

  // 4. Nút Hủy Viễn Chinh
  {
    name: 'btn_expedition_cancel',
    async execute(interaction) {
      try {
        const userId = interaction.user.id;
        const embed = WitchHunterExpeditionService.buildCancelConfirmationEmbed(userId);

        // Nếu không có viễn chinh
        if (!embed.data.title) {
          return interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
          });
        }

        const components = WitchHunterExpeditionService.createCancelConfirmationComponents(userId);
        return interaction.reply({
          embeds: [embed],
          components,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        logger.error('❌ [WitchHunterExpedition] Lỗi khi bấm nút hủy viễn chinh:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    },
  },

  // 5. Nút Xác Nhận Rút Lui (-20% HP)
  {
    name: 'btn_expedition_confirm_cancel',
    async execute(interaction, client, args) {
      try {
        const userId = interaction.user.id;
        const cancelResult = await WitchHunterExpeditionService.cancelExpedition(userId);

        if (!cancelResult.success) {
          return interaction.update({
            content: cancelResult.message,
            embeds: [],
            components: [],
          });
        }

        return interaction.update({
          content: null,
          embeds: [
            {
              color: 0xc3b1e1,
              description:
                `<a:bang2:1546891483250954290> **ĐÃ RÚT LUI ĐOÀN THÁM HIỂM THÀNH CÔNG!**\n` +
                `Đoàn thám hiểm đã an toàn trở về doanh trại.\n` +
                `> Supporter **${cancelResult.supporterName}** đã bị trừ **-20% Sinh Lực** *(Còn ${cancelResult.newHp}% HP)*\n` +
                `> Trạng thái viễn chinh đã được làm mới. Lữ Khách có thể cử Supporter đi tiếp ngay lúc này!`,
            },
          ],
          components: [],
        });
      } catch (error) {
        logger.error('❌ [WitchHunterExpedition] Lỗi khi xác nhận hủy viễn chinh:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    },
  },

  // 6. Nút Không, Tiếp Tục Đi
  {
    name: 'btn_expedition_dismiss_cancel',
    async execute(interaction) {
      try {
        return interaction.update({
          content: null,
          embeds: [
            {
              color: 0xc3b1e1,
              description:
                `<a:bang2:1546891483250954290> **ĐÃ HỦY LỆNH TRIỆU HỒI KHẨN CẤP!**\n` +
                `Đoàn thám hiểm vẫn đang tiếp tục thâm nhập vùng đất bí ẩn. Hãy quay lại kiểm tra khi hoàn thành nhé!`,
            },
          ],
          components: [],
        });
      } catch (error) {
        logger.error('❌ [WitchHunterExpedition] Lỗi khi dismiss cancel viễn chinh:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    },
  },

  // 7. Nút Xác Nhận Xuất Quân Khởi Hành
  {
    name: 'btn_expedition_launch',
    async execute(interaction, client, args) {
      try {
        const userId = interaction.user.id;
        let [zoneId, supporterId] = args || [];

        const draft = WitchHunterExpeditionService.getUserDraft(userId);
        if (!zoneId) zoneId = draft.zoneId;
        if (!supporterId) supporterId = draft.supporterId;

        const result = await WitchHunterExpeditionService.launchExpedition(
          userId,
          zoneId,
          supporterId
        );

        if (!result.success) {
          return interaction.reply({
            content: result.message,
            flags: MessageFlags.Ephemeral,
          });
        }

        const progressEmbed = WitchHunterExpeditionService.buildProgressEmbed(userId);
        return interaction.update({
          content: null,
          embeds: [progressEmbed],
          components: [],
        });
      } catch (error) {
        logger.error('❌ [WitchHunterExpedition] Lỗi khi xuất quân viễn chinh:', error);
        return interaction.reply({
          content: `Đã có lỗi xảy ra: ${error.message}`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    },
  },
];
