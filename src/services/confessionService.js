import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';

export const CONFESSION = {
  publicForumId: '1551813977502130216',
  reviewChannelId: '1551820171306606632',
  reviewerRoleId: '1545305594712432640',
  color: 0xfceec9,
};

const key = id => `confession:${id}`;
const counterKey = guildId => `confession:counter:${guildId}`;

export async function nextConfessionNumber(client, guildId) {
  const current = Number(await client.db.get(counterKey(guildId), 0)) || 0;
  const next = current + 1;
  await client.db.set(counterKey(guildId), next);
  return next;
}

export async function saveConfession(client, data) {
  await client.db.set(key(data.id), data);
}

export async function getConfession(client, id) {
  return await client.db.get(key(id), null);
}

export function reviewEmbed(data) {
  return new EmbedBuilder()
    .setColor(CONFESSION.color)
    .setTitle(`💌 Confession #${data.number} · Chờ duyệt`)
    .setDescription(data.content)
    .addFields({ name: 'Người gửi', value: `<@${data.authorId}> · \`${data.authorId}\`` })
    .setFooter({ text: 'Chỉ BQL có quyền duyệt mới được thao tác.' })
    .setTimestamp();
}

export function reviewButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confession_approve:${id}`).setLabel('Duyệt').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`confession_reject:${id}`).setLabel('Từ chối').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );
}

export async function publishConfession(client, guild, data) {
  const forum = await guild.channels.fetch(CONFESSION.publicForumId);
  if (!forum || forum.type !== ChannelType.GuildForum) throw new Error('Kênh confession công khai không phải Forum channel.');

  const embed = new EmbedBuilder()
    .setColor(CONFESSION.color)
    .setTitle(`💌 Confession #${data.number}`)
    .setDescription(data.content)
    .setFooter({ text: 'Confession được gửi ẩn danh qua Usagi.' })
    .setTimestamp();

  // Sau này muốn gắn ảnh: thêm .setImage('URL') tại embed phía trên.
  return forum.threads.create({
    name: `Confession #${data.number}`,
    message: { embeds: [embed] },
    reason: `Approved confession #${data.number}`,
  });
}
