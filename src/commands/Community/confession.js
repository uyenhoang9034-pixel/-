import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { randomUUID } from 'crypto';
import { CONFESSION, nextConfessionNumber, saveConfession, reviewEmbed, reviewButtons } from '../../services/confessionService.js';

export default {
  slashOnly: true,
  data: new SlashCommandBuilder()
    .setName('confession')
    .setDescription('Gửi confession ẩn danh để BQL duyệt.')
    .setDMPermission(false),

  category: 'Community',

  async execute(interaction, config, client) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: '❌ Lệnh này chỉ dùng trong server.', flags: MessageFlags.Ephemeral });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('confession_submit')
      .setTitle('💌 Gửi Confession');

    const content = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('Nội dung confession')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(1)
      .setMaxLength(4000)
      .setRequired(true)
      .setPlaceholder('Viết confession của bạn tại đây...');

    modal.addComponents(new ActionRowBuilder().addComponents(content));
    await interaction.showModal(modal);
  },
};

export async function submitConfession(interaction, client) {
  const content = interaction.fields.getTextInputValue('content').trim();
  const number = await nextConfessionNumber(client, interaction.guildId);
  const data = {
    id: randomUUID(),
    number,
    guildId: interaction.guildId,
    authorId: interaction.user.id,
    content,
    status: 'pending',
    createdAt: Date.now(),
  };

  const reviewChannel = await interaction.guild.channels.fetch(CONFESSION.reviewChannelId);
  if (!reviewChannel?.isTextBased()) throw new Error('Không tìm thấy kênh BQL duyệt confession.');

  const reviewMessage = await reviewChannel.send({
    content: `<@&${CONFESSION.reviewerRoleId}>`,
    embeds: [reviewEmbed(data)],
    components: [reviewButtons(data.id)],
    allowedMentions: { roles: [CONFESSION.reviewerRoleId] },
  });

  data.reviewMessageId = reviewMessage.id;
  await saveConfession(client, data);

  await interaction.reply({
    content: `💌 Đã gửi **Confession #${number}** tới BQL để duyệt. Danh tính của bạn sẽ không hiển thị ở bài đăng công khai.`,
    flags: MessageFlags.Ephemeral,
  });
}
