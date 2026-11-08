import {
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
    .setName('setup-chon-phe')
    .setDescription('Tạo hộp thoại ký kết khế ước chọn phe Witch Hunter (Chỉ Admin)'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      // 1. Kiểm tra phân quyền Admin (Role ID 1541303749916754001 hoặc Owner)
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép tạo bảng chọn phe ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const { emojis, colors, channels } = WITCH_HUNTER_CONFIG;

      // 2. Xác định kênh hiển thị: Hộp thoại cố định xuất hiện ở kênh 1563069959658143894
      const targetChannelId = channels.selectionChannelId;
      const targetChannel = interaction.guild.channels.cache.get(targetChannelId) || interaction.channel;

      if (!targetChannel) {
        return interaction.reply({
          content: `❌ Không tìm thấy kênh chỉ định (<#${targetChannelId}>) để tạo hộp thoại chọn phe!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // 3. Gửi hộp thoại giao diện Components V2 vào đúng kênh 1563069959658143894 (kèm fallback Embed)
      try {
        await targetChannel.send(WitchHunterService.buildFactionSelectionV2Payload());
      } catch (v2Error) {
        logger.warn('Failed to send V2 faction selection panel, falling back to embed:', v2Error);
        await targetChannel.send(WitchHunterService.buildFactionSelectionFallbackPayload());
      }

      return interaction.reply({
        content: `✅ Em bot Usagi múp rụp đã thiết lập lại bảng chọn phe Witch Hunter giao diện V2 tại kênh <#${targetChannel.id}> thành công và bảo toàn 100% dữ liệu rồi nè vợ của Kim Nong ơi! 💕`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi lệnh setup-chon-phe:', error);
      if (interaction.deferred) {
        return interaction.editReply({
          content: `Đã xảy ra lỗi khi tạo bảng chọn phe: ${error.message}`,
        }).catch(() => null);
      }
      return interaction.reply({
        content: `Đã xảy ra lỗi khi tạo bảng chọn phe: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
