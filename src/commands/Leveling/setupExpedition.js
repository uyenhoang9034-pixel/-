import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterExpeditionService } from '../../services/witchHunterExpeditionService.js';
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
    .setName('setup-expedition')
    .setDescription('Tạo bảng cố định Viễn Chinh: Ranh Giới Hắc Ám (Chỉ Admin)')
    .addChannelOption((opt) =>
      opt
        .setName('kenh')
        .setDescription('Kênh gửi bảng viễn chinh cố định (mặc định kênh hiện tại)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép tạo bảng viễn chinh 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const chosenChannel = interaction.options.getChannel('kenh');
      let targetChannel = chosenChannel;

      if (!targetChannel) {
        targetChannel =
          interaction.guild.channels.cache.find(
            (c) =>
              c.name === 'vien-chinh' ||
              c.name === 'expedition' ||
              c.name === 'ranh-gioi-hac-am'
          ) || interaction.channel;
      }

      const embed = WitchHunterExpeditionService.buildExpeditionDashboardEmbed();
      const components = WitchHunterExpeditionService.createExpeditionDashboardComponents();

      await targetChannel.send({
        embeds: [embed],
        components,
      });

      return interaction.reply({
        content: `✅ Đã thiết lập bảng **Viễn Chinh: Ranh Giới Hắc Ám** tại kênh <#${targetChannel.id}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterExpedition] Lỗi thực thi lệnh /setup-expedition:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
