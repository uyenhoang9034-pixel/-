import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
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
    .setName('doi-phe')
    .setDescription('Đổi phe phái Witch Hunter cho thành viên (Chỉ Admin)')
    .addUserOption((opt) =>
      opt
        .setName('thanh-vien')
        .setDescription('Thành viên cần đổi phe phái')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('phe-moi')
        .setDescription('Phe phái mới muốn chuyển sang')
        .setRequired(true)
        .addChoices(
          { name: '🏹 Hiệp Hội Thợ Săn (Hunter)', value: 'hunter' },
          { name: '🔮 Hội Phù Thủy (Witch)', value: 'witch' }
        )
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      // 1. Kiểm tra phân quyền Admin
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép đổi phe cho người khác ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const targetUser = interaction.options.getUser('thanh-vien', true);
      const newFaction = interaction.options.getString('phe-moi', true);

      if (targetUser.bot) {
        return interaction.editReply({
          content: '❌ Không thể đổi phe cho tài khoản bot!',
        });
      }

      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply({
          content: '❌ Không tìm thấy thông tin máy chủ!',
        });
      }

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        return interaction.editReply({
          content: '❌ Không tìm thấy thành viên này trong máy chủ Discord!',
        });
      }

      // 2. Thực hiện đổi phe qua WitchHunterService
      const result = await WitchHunterService.changeMemberFaction(
        guild,
        interaction.user,
        targetMember,
        newFaction
      );

      if (!result.success) {
        return interaction.editReply({
          content: result.message || '❌ Không thể đổi phe cho thành viên này!',
        });
      }

      const { emojis, colors } = WITCH_HUNTER_CONFIG;
      const oldFactionName = result.oldFaction
        ? result.oldFaction === 'witch'
          ? 'Hội Phù Thủy'
          : 'Hiệp Hội Thợ Săn'
        : 'Chưa có phe (Vô môn vô phái)';

      const successEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} Đổi Phe Phái Thành Công ${emojis.titleRight}`)
        .setDescription(
          `Vợ của Kim Nong ơi, bạn vừa chuyển đổi phe phái thành công cho <@${targetUser.id}>!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `👤 **Thành viên:** <@${targetUser.id}> (\`${targetUser.username}\`)\n` +
          `🔄 **Phe cũ:** **${oldFactionName}**\n` +
          `✨ **Phe mới:** ${result.newEmoji} **${result.newFactionName}**\n` +
          `🎖️ **Cấp bậc tương ứng:** **${result.rankInfo.name}** *(Bậc ${result.rank})*\n` +
          `🛡️ **Role đã cấp:** <@&${result.rankInfo.roleId}>\n` +
          `${emojis.pumpkin} **Bí Ngô tích lũy:** **${result.pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*Hệ thống đã thu hồi role phe cũ, cấp role phe mới, gửi thông báo DM chúc mừng kèm giao diện Supporter riêng cho lữ khách rồi nha!* 💕`
        )
        .setFooter({ text: 'Witch Hunter System' })
        .setTimestamp();

      return interaction.editReply({
        embeds: [successEmbed],
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh doi-phe:', error);
      if (interaction.deferred) {
        return interaction.editReply({
          content: `Đã xảy ra lỗi khi đổi phe: ${error.message}`,
        }).catch(() => null);
      }
      return interaction.reply({
        content: `Đã xảy ra lỗi khi đổi phe: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
