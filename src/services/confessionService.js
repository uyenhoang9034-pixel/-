import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';

export const CONFESSION = {
  publicForumId: '1551813977502130216',
  reviewChannelId: '1551820171306606632',
  reviewerRoleId: '1545305594712432640',
  color: 0xfceec9,
  emojiMain: '<a:trangtrig30:1546905942476464178>',
  emojiMode: '<a:trangtrig47:1547249293944029308>',
  emojiFollow: '<a:trangtrig1:1546040442548654140>',
  emojiApproved: '<a:trangtrig31:1546905996893626440>',
  emojiHeart: '<a:heartg3:1546047728314884226>',
  emojiLink: '<a:trangtrig13:1546047657963819048>',
  emojiReject: '<a:bang2:1546891483250954290>',
};
const key=id=>`confession:${id}`;
const numberKey=(guildId,n)=>`confession:number:${guildId}:${n}`;
const counterKey=guildId=>`confession:counter:${guildId}`;
export async function nextConfessionNumber(client,guildId){const current=Number(await client.db.get(counterKey(guildId),0))||0;const next=current+1;await client.db.set(counterKey(guildId),next);return next;}
export async function saveConfession(client,data){await client.db.set(key(data.id),data);await client.db.set(numberKey(data.guildId,data.number),data.id);}
export async function getConfession(client,id){return await client.db.get(key(id),null);}
export async function getConfessionByNumber(client,guildId,number){const id=await client.db.get(numberKey(guildId,number),null);return id?getConfession(client,id):null;}

export function reviewEmbed(data){
 const mode=data.mode==='public'?'Public':'Ẩn danh';
 return new EmbedBuilder().setColor(CONFESSION.color).setDescription(
  `${CONFESSION.emojiMain} **Confession #${data.number}**\n\n`+
  `${data.content}\n\n`+
  `**Người gửi:** <@${data.authorId}>\n`+
  `**Chế độ:** ${CONFESSION.emojiMode} ${mode}\n`+
  `**User ID:** \`${data.authorId}\`\n`+
  `**Gửi lúc:** <t:${Math.floor(data.createdAt/1000)}:f>\n\n`+
  `**Trạng thái:** Đang chờ duyệt`
 );
}
export function reviewButtons(id){return new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId(`confession_approve:${id}`).setLabel('Duyệt').setStyle(ButtonStyle.Success),
 new ButtonBuilder().setCustomId(`confession_reject:${id}`).setLabel('Từ chối').setStyle(ButtonStyle.Danger)
);}
export function publicButtons(id){return new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId(`confession_reply:${id}`).setLabel('Trả lời ẩn danh').setStyle(ButtonStyle.Secondary).setEmoji('1546905942476464178'),
 new ButtonBuilder().setCustomId(`confession_follow:${id}`).setLabel('Theo dõi').setStyle(ButtonStyle.Secondary).setEmoji('1546040442548654140')
);}
export function infoEmbed(data){
 const status=data.status==='approved'?`${CONFESSION.emojiApproved} Đã duyệt`:data.status==='rejected'?`${CONFESSION.emojiReject} Đã từ chối`:'Đang chờ duyệt';
 return new EmbedBuilder().setColor(CONFESSION.color).setDescription(
  `${CONFESSION.emojiMain} **Confession #${data.number}**\n\n`+
  `**Trạng thái:** ${status}\n`+
  `**Người gửi thật:** <@${data.authorId}>\n`+
  `**Chế độ:** ${CONFESSION.emojiMode} ${data.mode==='public'?'Public':'Ẩn danh'}`+
  `${data.anonymousCode?`\n**Mã công khai:** \`${data.anonymousCode}\``:''}`+
  `${data.reviewedBy?`\n**Người duyệt:** <@${data.reviewedBy}>`:''}\n`+
  `**Replies:** ${data.replyCount||0}\n**Followers:** ${(data.followers||[]).length}\n\n`+
  `${data.content}`
 );
}
export async function publishConfession(client,guild,data){
 const forum=await guild.channels.fetch(CONFESSION.publicForumId);
 if(!forum||forum.type!==ChannelType.GuildForum)throw new Error('Kênh confession công khai không phải Forum channel.');
 const identity=data.mode==='public'
  ?`${CONFESSION.emojiMode} **Gửi bởi <@${data.authorId}>**`
  :`${CONFESSION.emojiMode} **Ẩn danh · \`${data.anonymousCode}\`**\n\nMã \`${data.anonymousCode}\` là danh tính ẩn danh của người viết **trong confession này**.`;
 const embed=new EmbedBuilder().setColor(CONFESSION.color).setDescription(`${CONFESSION.emojiMain} **Confession #${data.number}**\n\n${data.content}\n\n${identity}`);
 const thread=await forum.threads.create({name:`Confession #${data.number}`,message:{embeds:[embed],components:[publicButtons(data.id)]},reason:`Approved confession #${data.number}`});
 try{
  const starter=await thread.fetchStarterMessage();
  if(starter)await starter.react('1546905942476464178');
 }catch(error){
  console.warn(`[Confession] Không thể tự react trangtrig30 cho #${data.number}:`,error?.message||error);
 }
 return thread;
}