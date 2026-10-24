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
    .setName('thu-hoi-bi-ngo')
    .setDescription('Thu hồi Bí Ngô Witch Hunter từ thành viên (Chỉ Admin)')
    .addUserOption((opt) =>
      opt
        .setName('nguoi-bi-thu-hoi')
        .setDescription('Thành viên bị thu hồi Bí Ngô')
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('so-luong')
        .setDescription('Số lượng Bí Ngô muốn thu hồi (ví dụ: 10, 50, 100, 500...)')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('ly-do')
        .setDescription('Lý do thu hồi (vi phạm, điều chỉnh số dư, sự kiện...)')
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      // 1. Phân quyền: Chỉ Role Admin 1541303749916754001 hoặc Owner
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên có role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép thu hồi Bí Ngô thôi ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const targetUser = interaction.options.getUser('nguoi-bi-thu-hoi');
      const amount = interaction.options.getInteger('so-luong');
      const reason = interaction.options.getString('ly-do') || 'Admin thu hồi trực tiếp';
      const guild = interaction.guild;

      if (!targetUser) {
        return interaction.editReply({
          content: 'Không tìm thấy thông tin thành viên cần thu hồi Bí Ngô!',
        });
      }

      if (targetUser.bot) {
        return interaction.editReply({
          content: 'Không thể thu hồi Bí Ngô từ bot!',
        });
      }

      // 2. Thực hiện thu hồi Bí Ngô qua Service (Xử lý trừ điểm, giáng cấp, phong ấn supporter, gửi DM riêng)
      const result = await WitchHunterService.revokePumpkins(guild, targetUser.id, amount, {
        reason,
        executor: interaction.user,
        notifyDM: true,
        notifyAdminLog: true,
      });

      if (!result.success) {
        return interaction.editReply({
          content: `❌ Không thể thu hồi Bí Ngô: ${result.message || 'Lỗi không xác định'}`,
        });
      }

      const { emojis, colors } = WITCH_HUNTER_CONFIG;

      // 3. Phản hồi cho Admin thực hiện
      const replyEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} 𝓣𝓱𝓾 𝓗𝓸̂̀𝓲 𝓑𝓲́ 𝓝𝓰𝓸̂ 𝓣𝓱𝓪̀𝓷𝓱 𝓒𝓸̂𝓷𝓰 ${emojis.titleRight}`)
        .setDescription(`Đã thu hồi thành công **-${result.amount.toLocaleString('vi-VN')} Bí Ngô** ${emojis.pumpkin} từ thành viên!`)
        .addFields(
          {
            name: '👤 Người Bị Thu Hồi:',
            value: `<@${targetUser.id}> (\`${targetUser.tag}\`)`,
            inline: true,
          },
          {
            name: '📉 Số Lượng Thu Hồi:',
            value: `**-${result.amount.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
            inline: true,
          },
          {
            name: '📊 Số Dư Mới:',
            value: `${result.oldPumpkins.toLocaleString('vi-VN')} ➡️ **${result.newPumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}`,
            inline: true,
          },
          {
            name: '📜 Lý Do:',
            value: reason,
            inline: false,
          }
        )
        .setFooter({ text: 'Witch Hunter Admin System' })
        .setTimestamp();

      if (result.isDemoted) {
        replyEmbed.addFields({
          name: '⚠️ Giáng Cấp Danh Vị & Phong Ấn Supporter:',
          value: `Thành viên đã bị giáng cấp từ **${result.oldRankInfo?.name || `Bậc ${result.oldRank}`}** xuống **${result.newRankInfo?.name || `Bậc ${result.newRank}`}**!\nRole bậc cũ đã bị thu hồi, thay thế bằng role mới. Supporter bậc cao hơn đã bị phong ấn và giáng về bậc mới.\n*Thông báo giáng cấp đã được gửi riêng vào DM của thành viên (không báo kênh lớn).*`,
          inline: false,
        });
      } else {
        replyEmbed.addFields({
          name: 'ℹ️ Trạng Thái Cấp Bậc:',
          value: `Cấp bậc của thành viên vẫn được giữ nguyên (không bị giáng cấp). Đã gửi thông báo thu hồi riêng vào DM thành viên.`,
          inline: false,
        });
      }

      return interaction.editReply({
        embeds: [replyEmbed],
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi thực hiện lệnh /thu-hoi-bi-ngo:', error);
      return interaction.editReply({
        content: `Đã có lỗi xảy ra khi thu hồi Bí Ngô: ${error.message}`,
      });
    }
  },
};
