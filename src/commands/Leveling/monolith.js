import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { WitchHunterDuelService } from '../../services/witchHunterDuelService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('monolith')
    .setDescription('Hệ thống Trụ Tổng Pháo Đài Witch Hunter')
    .addSubcommand((sub) =>
      sub
        .setName('warlog')
        .setDescription('Tra cứu lịch sử chiến sự và các đợt biến động máu của Trụ Tổng')
    ),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'warlog') {
        const data = await WitchHunterDuelService.getMonolithData();
        const { emojis, colors } = WITCH_HUNTER_CONFIG;

        const hunterBar = WitchHunterDuelService.buildBar(data.hunterHp, 10);
        const witchBar = WitchHunterDuelService.buildBar(data.witchHp, 10);

        const logs = data.logs || [];
        const logLines =
          logs.length > 0
            ? logs
                .map((l) => {
                  const dateStr = new Date(l.time).toLocaleDateString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                  });
                  return `> \`[${dateStr}]\` ${l.text}`;
                })
                .join('\n')
            : '> *(Chưa có sự kiện chiến sự nào được ghi nhận)*';

        const embed = new EmbedBuilder()
          .setColor(colors.pastelPurple)
          .setTitle(`${emojis.titleLeft} ─── ✦ ⟨ **NHẬT KÝ CHIẾN SỰ TRỤ TỔNG: WAR LOG** ⟩ ✦ ─── ${emojis.titleRight}`)
          .setDescription(
            `📊 **TÌNH TRẠNG SINH LỰC TRỤ TỔNG HIỆN TẠI:**\n` +
            `• <a:trangtrig36:1563065680922808340> **Trụ Tổng Thợ Săn:** \`${hunterBar} ${data.hunterHp}%\` (Tử thủ thành công: **${data.hunterDefends || 0}** trận)\n` +
            `• <a:trangtrig32:1546906170994856026> **Trụ Tổng Phù Thủy:** \`${witchBar} ${data.witchHp}%\` (Tử thủ thành công: **${data.witchDefends || 0}** trận)\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `<a:trangtrig1:1546040442548654140> **LỊCH SỬ BIẾN ĐỘNG GẦN NHẤT:**\n` +
            `${logLines}\n\n` +
            `*🏰 Kênh theo dõi trực tiếp Trụ Tổng: <#${WITCH_HUNTER_CONFIG.channels.monolithChannelId}>*`
          )
          .setFooter({ text: 'Witch Hunter Monolith War Log' })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      logger.error('❌ [MonolithCommand] Lỗi lệnh /monolith:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
