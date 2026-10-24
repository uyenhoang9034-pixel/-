import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterService, witchHunterStorage } from '../../services/witchHunterService.js';
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
    .setName('supporter')
    .setDescription('Tra cứu danh sách & chi tiết khế ước Supporter thế giới Witch Hunter'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const guild = interaction.guild;
      const member = interaction.member;
      const user = interaction.user;

      if (!guild || !member) {
        return interaction.reply({
          content: 'Lệnh này chỉ có thể sử dụng bên trong máy chủ Discord!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const isAdmin = isWitchHunterAdmin(interaction);

      // Phân quyền kênh cố định:
      // - ADMIN có role 1541303749916754001 hoặc Owner: CÓ THỂ DÙNG Ở BẤT CỨ KÊNH NÀO để test tiện lợi
      // - Thành viên bình thường: bắt buộc đúng kênh theo phe
      if (!isAdmin) {
        let userData = witchHunterStorage.getUser(user.id);
        let faction = userData?.faction;

        // Nếu database chưa kịp lưu phe, đối chiếu từ role Discord hiện có
        if (!faction && member.roles?.cache) {
          for (const roleId of Object.values(WITCH_HUNTER_CONFIG.roles.hunter)) {
            if (member.roles.cache.has(roleId)) {
              faction = 'hunter';
              break;
            }
          }
          if (!faction) {
            for (const roleId of Object.values(WITCH_HUNTER_CONFIG.roles.witch)) {
              if (member.roles.cache.has(roleId)) {
                faction = 'witch';
                break;
              }
            }
          }
        }

        // Trường hợp chưa gia nhập phe nào
        if (!faction) {
          return interaction.reply({
            content: `❌ Lữ khách chưa ký khế ước chọn phe nào trong thế giới Witch Hunter!\nHãy ghé qua kênh <#${WITCH_HUNTER_CONFIG.channels.selectionChannelId}> để ký khế ước trước nha lữ khách ơi! 💕`,
            flags: MessageFlags.Ephemeral,
          });
        }

        // Ràng buộc Phe Thợ Săn: Chỉ được dùng ở kênh 1563385216800657479
        if (faction === 'hunter') {
          const requiredHunterChannel = WITCH_HUNTER_CONFIG.channels.hunterChannelId;
          if (interaction.channelId !== requiredHunterChannel) {
            return interaction.reply({
              content: `❌ Lệnh tra cứu Supporter của **Hiệp Hội Thợ Săn** chỉ có thể sử dụng tại kênh <#${requiredHunterChannel}> thôi nè lữ khách ơi! 💕`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        // Ràng buộc Phe Phù Thủy: Chỉ được dùng ở kênh 1563385150660808846
        if (faction === 'witch') {
          const requiredWitchChannel = WITCH_HUNTER_CONFIG.channels.witchChannelId;
          if (interaction.channelId !== requiredWitchChannel) {
            return interaction.reply({
              content: `❌ Lệnh tra cứu Supporter của **Hội Phù Thủy** chỉ có thể sử dụng tại kênh <#${requiredWitchChannel}> thôi nè lữ khách ơi! 💕`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      }

      // Khởi tạo giao diện Tra cứu Supporter công khai trong kênh (người khác thấy được)
      const overviewEmbed = WitchHunterService.buildSupporterOverviewEmbed();
      const selectMenuRow = WitchHunterService.createSupporterSelectRow(user.id);

      await interaction.reply({
        embeds: [overviewEmbed],
        components: [selectMenuRow],
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi thực thi lệnh /supporter:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi mở bảng tra cứu Supporter, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
