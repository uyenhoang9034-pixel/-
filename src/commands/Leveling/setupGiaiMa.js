import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
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
    .setName('setup-giai-ma')
    .setDescription('Tạo hộp thoại Thí Luyện Cuối Tuần: Giải Mã Cổ Ngữ (Chỉ Admin)')
    .addChannelOption((opt) =>
      opt
        .setName('kenh')
        .setDescription('Kênh muốn gửi tin nhắn thông báo (mặc định kênh hiện tại hoặc #giai-ma-co-ngu)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này đâu nè vợ của Kim Nong ơi! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép tạo bảng giải mã cổ ngữ ạ 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const chosenChannel = interaction.options.getChannel('kenh');
      let targetChannel = chosenChannel;

      if (!targetChannel) {
        // Tìm kênh tên giai-ma-co-ngu nếu có
        targetChannel = interaction.guild.channels.cache.find((c) => c.name === 'giai-ma-co-ngu') || interaction.channel;
      }

      const embed = WitchHunterQuestService.buildPuzzleNoticeEmbed();
      const row = WitchHunterQuestService.buildPuzzleNoticeButton();

      await targetChannel.send({
        embeds: [embed],
        components: [row],
      });

      return interaction.reply({
        content: `✅ Em bot Usagi múp rụp đã thiết lập bảng Thí Luyện Cuối Tuần: Giải Mã Cổ Ngữ tại kênh <#${targetChannel.id}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterQuest] Lỗi lệnh setup-giai-ma:', error);
      return interaction.reply({
        content: `Đã xảy ra lỗi khi tạo bảng giải mã cổ ngữ: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
