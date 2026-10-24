import { MessageFlags, EmbedBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterService } from '../../services/witchHunterService.js';
import { logger } from '../../utils/logger.js';

export default {
  name: 'witch_hunter_join',

  async execute(interaction, client, args = []) {
    try {
      const [chosenFaction] = args;
      const member = interaction.member;
      const guild = interaction.guild;

      if (!guild || !member) {
        return interaction.reply({
          content: 'Không tìm thấy dữ liệu máy chủ hoặc thông tin thành viên!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // RÀNG BUỘC KÊNH: CHỈ NHẬN ROLE ĐƯỢC Ở KÊNH ID 1563069959658143894
      const requiredChannelId = WITCH_HUNTER_CONFIG.channels.selectionChannelId;
      if (interaction.channelId !== requiredChannelId) {
        return interaction.reply({
          content: `❌ Nghi thức chọn phe và nhận role chỉ có thể thực hiện tại kênh <#${requiredChannelId}> thôi nè vợ của Kim Nong ơi! 💕`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!['hunter', 'witch'].includes(chosenFaction)) {
        return interaction.reply({
          content: 'Phe phái không hợp lệ!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Xử lý gia nhập phe qua Service (Tự động nhận diện Admin role 1541303749916754001 để cho phép đổi phe)
      const result = await WitchHunterService.joinFaction(guild, member, chosenFaction);

      // 1. Trường hợp ĐÃ CHỌN PHE TRƯỚC ĐÓ:
      if (result.alreadyChosen) {
        return interaction.reply({
          content: result.message || WITCH_HUNTER_CONFIG.messages.alreadyChosen,
          flags: MessageFlags.Ephemeral,
        });
      }

      const { emojis, colors } = WITCH_HUNTER_CONFIG;

      // 2. Trường hợp ADMIN ĐỔI PHE:
      if (result.changedFaction) {
        const newFactionName = chosenFaction === 'witch' ? 'Hội Phù Thủy (Witches)' : 'Hiệp Hội Thợ Săn (W.H. Association)';
        const newEmoji = chosenFaction === 'witch' ? emojis.witchButton : emojis.hunterButton;
        const rankInfo = WitchHunterService.getRankInfo(chosenFaction, result.rank);

        const changeEmbed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(`${emojis.titleLeft} 𝓐𝓭𝓶𝓲𝓷 𝓒𝓱𝓾𝔂𝓮̂̉𝓷 Đ𝓸̂̉𝓲 𝓟𝓱𝓮 𝓣𝓱𝓪̀𝓷𝓱 𝓒𝓸̂𝓷𝓰 ${emojis.titleRight}`)
          .setDescription(
            `Vợ của Kim Nong ơi, khế ước đặc quyền Admin của bạn đã được chuyển đổi thành công sang ${newEmoji} **${newFactionName}**!\n\n` +
            `> 🎖️ **Cấp bậc tương ứng:** **${rankInfo.name}** *(Bậc ${result.rank})*\n` +
            `> ${emojis.pumpkin} **Bí Ngô tích lũy:** **${result.pumpkins.toLocaleString('vi-VN')}** ${emojis.pumpkin}\n` +
            `> 🛡️ **Role đã cập nhật:** <@&${rankInfo.roleId}>\n\n` +
            `*Hệ thống đã tự động thu hồi toàn bộ role của phe cũ và thông báo đến kênh nội bộ Admin.* 💕`
          )
          .setFooter({ text: 'Witch Hunter System • Em bot Usagi múp rụp 💕' })
          .setTimestamp();

        // Gửi DM thêm cho Admin nếu mở DM
        try {
          await interaction.user.send({ embeds: [changeEmbed] }).catch(() => null);
        } catch {}

        return interaction.reply({
          embeds: [changeEmbed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // 3. Trường hợp GIA NHẬP MỚI THÀNH CÔNG:
      const welcomeMessage = chosenFaction === 'witch'
        ? WITCH_HUNTER_CONFIG.messages.welcomeWitch(interaction.user.id)
        : WITCH_HUNTER_CONFIG.messages.welcomeHunter(interaction.user.id);

      const welcomeEmbed = new EmbedBuilder()
        .setColor(colors.pastelPurple) // Cố định tím pastel nhạt nhạt
        .setTitle(`${emojis.titleLeft} 𝓚𝓱𝓮̂́ 𝓤̛𝓸̛́𝓬 𝓜𝓪 𝓣𝓱𝓾𝓪̣̂𝓽 𝓚𝓱𝓸̛̉𝓲 𝓢𝓪̆́𝓬 ${emojis.titleRight}`)
        .setDescription(welcomeMessage)
        .setFooter({ text: 'Witch Hunter System • Em bot Usagi múp rụp 💕' })
        .setTimestamp();

      // Gửi riêng thêm vào Direct Message (DM) cho người pick role
      try {
        await interaction.user.send({ embeds: [welcomeEmbed] }).catch(() => null);
      } catch {}

      return interaction.reply({
        embeds: [welcomeEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [WitchHunter] Lỗi khi xử lý nút chọn phe:', error);
      return interaction.reply({
        content: `Có lỗi bất ngờ xảy ra khi ký kết khế ước: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
