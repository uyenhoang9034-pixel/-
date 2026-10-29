import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterBlackMarketService } from '../../services/witchHunterBlackMarketService.js';
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
    .setName('setup-black-market')
    .setDescription('Tạo bảng cố định Chợ Đen Hư Không: Thương Đài Trao Đổi Ký Ức (Chỉ Admin)')
    .addChannelOption((opt) =>
      opt
        .setName('kenh')
        .setDescription('Kênh gửi bảng Chợ Đen (mặc định kênh hiện tại hoặc #cho-den)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép tạo bảng Chợ Đen 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const chosenChannel = interaction.options.getChannel('kenh');
      let targetChannel = chosenChannel;

      if (!targetChannel) {
        targetChannel =
          interaction.guild.channels.cache.find(
            (c) =>
              c.name === 'cho-den' ||
              c.name === 'black-market' ||
              c.name === 'trading-post'
          ) || interaction.channel;
      }

      const embed = WitchHunterBlackMarketService.buildMainMarketEmbed();
      const components = WitchHunterBlackMarketService.createMainMarketComponents();

      await targetChannel.send({
        embeds: [embed],
        components,
      });

      return interaction.reply({
        content: `✅ Em bot Usagi múp rụp đã thiết lập bảng **Chợ Đen Hư Không: Thương Đài Trao Đổi Ký Ức** tại kênh <#${targetChannel.id}> thành công và bảo toàn 100% dữ liệu rồi nè vợ của Kim Nong ơi! 💕`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunterBlackMarket] Lỗi khi tạo bảng Chợ Đen cố định:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Đã có lỗi xảy ra khi tạo bảng Chợ Đen, vui lòng thử lại sau!',
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
    }
  },
};
