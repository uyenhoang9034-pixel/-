import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterQuestService } from '../../services/witchHunterQuestService.js';
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
    .setName('setup-thap-nen')
    .setDescription('Tạo hộp thoại Thắp Nến Cầu Nguyện cố định tại kênh 1562351868888354816 (Chỉ Admin)'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép tạo bảng thắp nến ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const targetChannelId = WITCH_HUNTER_CONFIG.channels.candleChannelId || '1562351868888354816';
      const targetChannel = interaction.guild.channels.cache.get(targetChannelId) ||
        await interaction.guild.channels.fetch(targetChannelId).catch(() => null) ||
        interaction.channel;

      if (!targetChannel) {
        return interaction.reply({
          content: `❌ Không tìm thấy kênh chỉ định (<#${targetChannelId}>) để tạo hộp thoại thắp nến!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const embed = WitchHunterQuestService.buildDailyCandleEmbed();
      const row = WitchHunterQuestService.buildDailyCandleButton();

      await targetChannel.send({
        embeds: [embed],
        components: [row],
      });

      return interaction.reply({
        content: `✅ Em bot Usagi múp rụp đã thiết lập bảng Thắp Nến Cầu Nguyện tại kênh <#${targetChannel.id}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterQuest] Lỗi lệnh setup-thap-nen:', error);
      return interaction.reply({
        content: `Đã xảy ra lỗi khi tạo bảng thắp nến: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
