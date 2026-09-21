import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getPrisonRecord, performLabor, progressBar, PRISON_CHANNEL_ID } from '../../services/prisonService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('laudon')
    .setDescription('Lau dọn Nhà Tù để hoàn thành án phạt.'),
  category: 'moderation',

  async execute(interaction, config, client) {
    if (interaction.channelId !== PRISON_CHANNEL_ID) {
      return interaction.reply({
        content: `Chỉ có thể dùng **/laudon** trong <#${PRISON_CHANNEL_ID}>.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const current = await getPrisonRecord(client, interaction.guildId, interaction.user.id);
    if (!current?.active) {
      return interaction.reply({
        content: 'Bạn hiện không phải phạm nhân.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await InteractionHelper.safeDefer(interaction);
    const result = await performLabor(client, interaction.member);
    const record = result.record;

    if (result.status === 'released') {
      const embed = new EmbedBuilder()
        .setColor(0xffffff)
        .setTitle('<a:trangtrig2:1546040703375904801> 𝓤𝓼𝓪𝓰𝓲 · 𝓜𝓪̃𝓷 𝓗𝓪̣𝓷 𝓣𝓾̀ <a:trangtrig3:1546040818261954610>')
        .setDescription([
          '<a:trangtrig1:1546040442548654140> **TỰ DO!**',
          '',
          `<@${interaction.user.id}> đã hoàn thành toàn bộ hình phạt!`,
          `<a:danceg1:1541433201904455832> Lao động: **${record.totalLabor} / ${record.totalLabor} lần** ✅`,
          `<a:danceg1:1541433201904455832> Án phạt: **${record.reason}**`,
          '<a:danceg1:1541433201904455832> Trạng thái: **ĐÃ MÃN HẠN**',
          '',
          '━━━━━━━━━━━━━━━━━━━━',
          '<a:trangtrig6:1546043036390260756> Cửa Nhà Tù đã được mở.',
          '<a:trangtrig6:1546043036390260756> Các role trước khi thụ án đang được khôi phục.',
          '',
          '<a:catg11:1546058047393239151> Quản Ngục Usagi: *Lần sau ngoan nhé, không là vào lau tiếp đấy!*',
        ].join('\n'));
      return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    const bar = progressBar(record.completedLabor, record.totalLabor);
    const description = result.status === 'last_one'
      ? [
          `Cửa tù sắp mở rồi <@${interaction.user.id}> ơi...`,
          '',
          `<a:trangtrig31:1546905996893626440> Hoàn thành **${record.completedLabor} lần lao động**.`,
          '<a:capybarag1:1546058369566122015> Còn lại: **1 lần**',
          '',
          bar,
          '',
          '<a:catg11:1546058047393239151> Quản ngục Usagi: *Một lần cuối!*',
        ]
      : [
          `<@${interaction.user.id}> đang cặm cụi lau dọn nhà tù...`,
          '',
          '<a:trangtrig31:1546905996893626440> Hoàn thành **1 lần lao động**.',
          `<a:capybarag1:1546058369566122015> Còn lại: **${record.remainingLabor} lần**`,
          '',
          bar,
          '',
          '<a:catg11:1546058047393239151> Quản ngục Usagi: *Lau tiếp đi, sàn vẫn còn bẩn lắm!*',
        ];

    const embed = new EmbedBuilder().setColor(0xffffff).setDescription(description.join('\n'));
    return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
  },
};
