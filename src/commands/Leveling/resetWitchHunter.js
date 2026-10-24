import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG, getAllWitchHunterRoleIds } from '../../config/witchHunterConfig.js';
import { witchHunterStorage } from '../../services/witchHunterService.js';
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
    .setName('reset-witch-hunter')
    .setDescription('Xóa 1 lần duy nhất toàn bộ bí ngô và gỡ sạch role phe cũ của tất cả member (Chỉ Admin)'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được thực hiện reset dữ liệu ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Gỡ toàn bộ 10 role của Thợ Săn & Phù Thủy khỏi tất cả thành viên trong server
      const allRoles = getAllWitchHunterRoleIds();
      let strippedCount = 0;
      for (const roleId of allRoles) {
        try {
          const role =
            interaction.guild.roles.cache.get(roleId) ||
            (await interaction.guild.roles.fetch(roleId).catch(() => null));
          if (role) {
            for (const [memberId, member] of role.members) {
              await member.roles.remove(roleId).catch(() => null);
              strippedCount++;
            }
          }
        } catch (err) {
          logger.warn(`⚠️ [WitchHunter] Lỗi khi gỡ role ${roleId}:`, err.message);
        }
      }

      // Xóa sạch cơ sở dữ liệu
      witchHunterStorage.clearAllData();

      return interaction.editReply({
        content: `🧹 **Đã hoàn tất dọn dẹp sạch sẽ toàn bộ dữ liệu Witch Hunter!**\n` +
          `• Đã xóa sạch dữ liệu bí ngô, phe phái và supporter của tất cả thành viên trong Database.\n` +
          `• Đã gỡ thành công **${strippedCount}** lượt role Thợ Săn & Phù Thủy trên Discord.\n\n` +
          `*Từ bây giờ, dữ liệu khi ký khế ước mới hoặc được cấp role/bí ngô sẽ được lưu trữ vĩnh viễn và không bị xóa khi cập nhật bot.* 💕`,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh reset-witch-hunter:', error);
      if (interaction.deferred) {
        return interaction.editReply({
          content: `Đã xảy ra lỗi khi reset dữ liệu: ${error.message}`,
        }).catch(() => null);
      }
      return interaction.reply({
        content: `Đã xảy ra lỗi khi reset dữ liệu: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
