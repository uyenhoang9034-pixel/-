import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WitchHunterDuelService } from '../../services/witchHunterDuelService.js';
import { hasRoleTier } from '../../config/commands/roleAccess.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('duel-admin')
    .setDescription('Quản trị & thử nghiệm hệ thống Huyết Thệ Witch Hunter (Chỉ Admin)')
    .setDefaultMemberPermissions(0n)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setDescription('Chế độ đấu thử nghiệm hoàn chỉnh với Bot giả lập (Dành cho Quản Trị Viên)')
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: 'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (subcommand === 'test') {
        if (!hasRoleTier(interaction.member, 'TOP_ADMIN', guild, interaction.user)) {
          return interaction.reply({
            content: '❌ Lệnh thử nghiệm này chỉ dành riêng cho Quản Trị Viên (Admin) kiểm tra hệ thống!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const result = await WitchHunterDuelService.startChallenge({
          interaction,
          challengerUser: interaction.user,
          targetUser: null,
          isBotTest: true,
        });

        if (!result.success) {
          return interaction.reply({
            content: `❌ ${result.message}`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const msg = await interaction.reply({
          content: '🤖 **CHẾ ĐỘ THỬ NGHIỆM CHIẾN ĐẤU VỚI BOT ĐÃ KÍCH HOẠT!**\n> *Bot giả lập phe đối địch sẽ tự động tiếp nhận sau 3 giây và mở sòng cược...*',
          embeds: [result.embed],
          components: result.components,
          fetchReply: true,
        });

        result.duelState.mainMessage = msg;
        return;
      }
    } catch (error) {
      logger.error('❌ [DuelAdminCommand] Lỗi lệnh /duel-admin:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};

