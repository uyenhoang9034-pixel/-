import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildMainShopContainer, backfillDonorRoles, initRoleIconStorage } from '../../services/roleIconShopService.js';
import { ROLE_ICON_DONOR_ROLE_ID } from '../../config/roleIconShopConfig.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup-role-icon-shop')
    .setDescription('Thiết lập bảng Tiệm Role Icon V2 cố định và cấp bù role cho donor (Chỉ Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('kenh')
        .setDescription('Kênh kín gửi bảng Shop (mặc định kênh hiện tại)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  category: 'Community',

  async execute(interaction, config, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Khởi tạo storage DB
      await initRoleIconStorage(client);

      const targetChannel = interaction.options.getChannel('kenh') || interaction.channel;

      // 1. Dựng và gửi Container V2
      const shopContainer = buildMainShopContainer();
      await targetChannel.send({
        components: [shopContainer],
        flags: MessageFlags.IsComponentsV2,
      });

      // 2. Chạy cấp bù tự động cho các thành viên từng donate
      const backfillResult = await backfillDonorRoles(interaction.guild, client);

      return interaction.editReply({
        content:
          `✅ Em bot Usagi múp rụp đã thiết lập bảng **Tiệm Role Icon Usagi** tại kênh <#${targetChannel.id}> thành công rực rỡ rồi nè vợ của Kim Nong ơi! ${ROLE_ICON_EMOJIS.heart}✨\n` +
          `> 🔄 **Cấp bù Role Đặc Quyền:** Đã rà soát dữ liệu và cấp bù cho **${backfillResult.synced} / ${backfillResult.total}** nhà hảo tâm đã từng donate trước đây để mở khóa kênh <#${targetChannel.id}>!\n` +
          `> ${ROLE_ICON_EMOJIS.crown} **Role ID Đặc Quyền:** <@&${ROLE_ICON_DONOR_ROLE_ID}>`,
      });
    } catch (error) {
      logger.error('❌ [RoleIconShop] Lỗi khi tạo bảng Shop Role Icon:', error);
      if (interaction.deferred) {
        return interaction.editReply({
          content: '❌ Đã có lỗi xảy ra khi thiết lập Tiệm Role Icon, vui lòng kiểm tra lại quyền hạn của bot!',
        });
      }
    }
  },
};

