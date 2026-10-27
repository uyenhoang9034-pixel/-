import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterDuelService } from '../../services/witchHunterDuelService.js';
import { logger } from '../../utils/logger.js';

function isWitchHunterAdmin(interaction) {
  const member = interaction.member;
  if (!member) return false;

  const ownerId = interaction.guild?.ownerId;
  if (ownerId && (interaction.user?.id === ownerId || member.id === ownerId)) {
    return true;
  }

  const configuredOwnerIds = (process.env.OWNER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (configuredOwnerIds.includes(interaction.user?.id) || configuredOwnerIds.includes(member.id)) {
    return true;
  }

  const adminRole = WITCH_HUNTER_CONFIG.adminRoleId;
  if (member.roles?.cache?.has?.(adminRole)) return true;
  if (Array.isArray(member._roles) && member._roles.includes(adminRole)) return true;
  if (Array.isArray(member.roles) && member.roles.includes(adminRole)) return true;

  return false;
}

export default {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Hệ thống giao tranh Huyết Thệ Witch Hunter')
    .addSubcommand((sub) =>
      sub
        .setName('challenge')
        .setDescription('Phát động lời khiêu chiến đối thủ (đích danh hoặc toàn phe đối địch)')
        .addUserOption((opt) =>
          opt
            .setName('doi-thu')
            .setDescription('Thành viên đối địch muốn thách đấu (để trống nếu khiêu chiến toàn phe)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('forfeit')
        .setDescription('Đầu hàng khẩn cấp trong trận đấu (Xử thua ngay, Trụ phe đầu hàng -2% HP)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Kiểm tra tình trạng trận đấu Huyết Thệ đang diễn ra trên sàn đấu')
    )
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

      // ────────────────────────────────────────────────────────────
      // 1. SUBCOMMAND: CHALLENGE
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'challenge') {
        const targetUser = interaction.options.getUser('doi-thu');

        const result = await WitchHunterDuelService.startChallenge({
          interaction,
          challengerUser: interaction.user,
          targetUser,
          isBotTest: false,
        });

        if (!result.success) {
          return interaction.reply({
            content: `❌ ${result.message}`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const msg = await interaction.reply({
          embeds: [result.embed],
          components: result.components,
          fetchReply: true,
        });

        result.duelState.mainMessage = msg;
        return;
      }

      // ────────────────────────────────────────────────────────────
      // 2. SUBCOMMAND: FORFEIT (ĐẦU HÀNG)
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'forfeit') {
        const duel = WitchHunterDuelService.activeDuels.get(guild.id);
        if (!duel || duel.status === 'ENDED') {
          return interaction.reply({
            content: 'Hiện không có trận đấu nào đang diễn ra để đầu hàng!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const userId = interaction.user.id;
        const isChallenger = userId === duel.challenger.id;
        const isDefender = duel.defender && userId === duel.defender.id;

        if (!isChallenger && !isDefender) {
          return interaction.reply({
            content: 'Bạn không phải là Thần Khí Sĩ hoặc Cổ Thuật Sĩ trong trận chiến hiện tại!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const loser = isChallenger ? duel.challenger : duel.defender;
        const winner = isChallenger ? duel.defender : duel.challenger;

        if (!winner) {
          WitchHunterDuelService.activeDuels.delete(guild.id);
          return interaction.reply({
            content: 'Đã hủy lời khiêu chiến!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const loserRole = loser.faction === 'hunter' ? 'Thần Khí Sĩ (Artificer)' : 'Cổ Thuật Sĩ (Hexer)';
        await interaction.reply({
          content: `<a:whg1:1564145184965525504> ${loserRole} <@${userId}> đã tuyên bố đầu hàng khẩn cấp! Trận đấu kết thúc ngay lập tức.`,
        });

        await WitchHunterDuelService.endDuel(duel, winner, loser);
        return;
      }

      // ────────────────────────────────────────────────────────────
      // 3. SUBCOMMAND: STATUS
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'status') {
        const duel = WitchHunterDuelService.activeDuels.get(guild.id);
        if (!duel || duel.status === 'ENDED') {
          return interaction.reply({
            content: 'Hiện không có trận đấu nào đang diễn ra trên sàn đấu. Hãy dùng lệnh `/duel challenge` để phát động khiêu chiến!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const challenger = duel.challenger;
        const defender = duel.defender;
        const challengerRole = challenger.faction === 'hunter' ? 'Thần Khí Sĩ (Artificer)' : 'Cổ Thuật Sĩ (Hexer)';
        const defenderRole = defender ? (defender.faction === 'hunter' ? 'Thần Khí Sĩ (Artificer)' : 'Cổ Thuật Sĩ (Hexer)') : 'Đối thủ';

        return interaction.reply({
          content:
            `<a:whg1:1564145184965525504> **TÌNH TRẠNG TRẬN ĐẤU HIỆN TẠI:**\n` +
            `• **Trạng thái:** \`${duel.status}\` (Hiệp ${duel.currentRound})\n` +
            `• **${challengerRole} phát động:** <@${challenger.id}> (${challenger.faction === 'hunter' ? 'Thợ Săn' : 'Phù Thủy'}) - Kháng cự: **${challenger.hp}%**\n` +
            `• **${defenderRole} tiếp chiến:** ${defender ? `<@${defender.id}> (${defender.faction === 'hunter' ? 'Thợ Săn' : 'Phù Thủy'}) - Kháng cự: **${defender.hp}%**` : '*Đang chờ tiếp nhận...*'}\n` +
            `• **Số lượt cược:** ${duel.bets.length} lượt`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // ────────────────────────────────────────────────────────────
      // 4. SUBCOMMAND: TEST (ADMIN TEST VỚI BOT)
      // ────────────────────────────────────────────────────────────
      if (subcommand === 'test') {
        if (!isWitchHunterAdmin(interaction)) {
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
      logger.error('❌ [DuelCommand] Lỗi lệnh /duel:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
