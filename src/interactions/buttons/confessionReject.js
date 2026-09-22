import { MessageFlags } from 'discord.js';
import { CONFESSION, getConfession, saveConfession } from '../../services/confessionService.js';

export default {
  name: 'confession_reject',
  async execute(interaction, client, args) {
    if (!interaction.member?.roles?.cache?.has(CONFESSION.reviewerRoleId)) {
      return interaction.reply({ content: '❌ Bạn không có role duyệt confession.', flags: MessageFlags.Ephemeral });
    }

    const id = args[0];
    const data = await getConfession(client, id);
    if (!data) return interaction.reply({ content: '❌ Không tìm thấy confession này.', flags: MessageFlags.Ephemeral });
    if (data.status !== 'pending') return interaction.reply({ content: `ℹ️ Confession này đã được xử lý: **${data.status}**.`, flags: MessageFlags.Ephemeral });

    data.status = 'rejected';
    data.reviewedBy = interaction.user.id;
    data.reviewedAt = Date.now();
    await saveConfession(client, data);

    await interaction.message.edit({
      content: '',
      embeds: [interaction.message.embeds[0].toJSON()].map(e => ({ ...e, title: `💌 Confession #${data.number} · Đã từ chối`, color: CONFESSION.color })),
      components: [],
    });

    await interaction.reply({ content: `✖️ Đã từ chối **Confession #${data.number}**.`, flags: MessageFlags.Ephemeral });
  },
};
