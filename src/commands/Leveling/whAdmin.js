import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterSummonService } from '../../services/witchHunterSummonService.js';
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
    .setName('wh-admin')
    .setDescription('Lệnh quản trị hệ thống Witch Hunter (Chỉ Admin)')
    .addSubcommand((sub) =>
      sub
        .setName('setup-summon')
        .setDescription('Tạo bảng cố định Tế Đàn Triệu Gọi Huyết Nguyệt: Supporter & Thần Khí')
        .addChannelOption((opt) =>
          opt
            .setName('kenh')
            .setDescription('Kênh gửi bảng triệu hồi cố định (mặc định kênh hiện tại hoặc #trieu-hoi)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      if (!isWitchHunterAdmin(interaction)) {
        return interaction.reply({
          content: `❌ Bạn không có quyền sử dụng lệnh này! Chỉ chủ máy chủ hoặc thành viên sở hữu role <@&${WITCH_HUNTER_CONFIG.adminRoleId}> mới được phép quản trị Witch Hunter 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'setup-summon') {
        const chosenChannel = interaction.options.getChannel('kenh');
        let targetChannel = chosenChannel;

        if (!targetChannel) {
          targetChannel =
            interaction.guild.channels.cache.find(
              (c) => c.name === 'trieu-hoi' || c.name === 'summon' || c.name === 'te-dan'
            ) || interaction.channel;
        }

        const embed = WitchHunterSummonService.buildSummonDashboardEmbed();
        const components = WitchHunterSummonService.createSummonDashboardComponents();

        await targetChannel.send({
          embeds: [embed],
          components,
        });

        return interaction.reply({
          content: `✅ Đã thiết lập bảng **Tế Đàn Triệu Gọi Huyết Nguyệt** tại kênh <#${targetChannel.id}> thành công rồi nè vợ của Kim Nong ơi! 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      logger.error('❌ [WitchHunterAdmin] Lỗi thực thi lệnh /wh-admin:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
