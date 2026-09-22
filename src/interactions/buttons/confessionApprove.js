import { MessageFlags } from 'discord.js';
import { CONFESSION, getConfession, saveConfession, publishConfession } from '../../services/confessionService.js';

export default {
  name: 'confession_approve',
  async execute(interaction, client, args) {
    if (!interaction.member?.roles?.cache?.has(CONFESSION.reviewerRoleId)) {
      return interaction.reply({ content: '❌ Bạn không có role duyệt confession.', flags: MessageFlags.Ephemeral });
    }

    const id = args[0];
    const data = await getConfession(client, id);
    if (!data) return interaction.reply({ content: '❌ Không tìm thấy confession này.', flags: MessageFlags.Ephemeral });
    if (data.status !== 'pending') return interaction.reply({ content: `ℹ️ Confession này đã được xử lý: **${data.status}**.`, flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const thread = await publishConfession(client, interaction.guild, data);

    data.status = 'approved';
    data.reviewedBy = interaction.user.id;
    data.reviewedAt = Date.now();
    data.publicThreadId = thread.id;
    await saveConfession(client, data);

    await interaction.message.edit({
      content: '',
      embeds: [interaction.message.embeds[0].toJSON()].map(e => ({ ...e, title: `💌 Confession #${data.number} · Đã duyệt`, color: CONFESSION.color })),
      components: [],
    });

    await interaction.editReply(`✅ Đã duyệt và đăng **Confession #${data.number}** lên diễn đàn.`);
  },
};
