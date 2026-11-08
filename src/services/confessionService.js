import fs from 'fs';
import path from 'path';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from 'discord.js';

export const CFS_IMAGE_PATH = path.resolve(process.cwd(), 'assets/confessions/cfs.png');
export const CFS_IMAGE_URL = 'https://files.catbox.moe/wlet8p.png';

export function getConfessionImageAttachment() {
  try {
    if (fs.existsSync(CFS_IMAGE_PATH)) {
      return new AttachmentBuilder(CFS_IMAGE_PATH, { name: 'cfs.png' });
    }
  } catch {}
  return null;
}

export function applyConfessionImage(embed) {
  const att = getConfessionImageAttachment();
  if (att) {
    embed.setImage('attachment://cfs.png');
    return [att];
  }
  embed.setImage(CFS_IMAGE_URL);
  return [];
}

export function getConfessionPanelFiles() {
  const att = getConfessionImageAttachment();
  return att ? [att] : [];
}

export function buildConfessionPanelContainer() {
  const container = new ContainerBuilder();

  // 1. Header Title V2: (trangtrig2) **TITLE** (trangtrig3)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '# <a:trangtrig2:1546040703375904801> **𝓤𝓼𝓪𝓰𝓲 𝓒𝓸𝓷𝓯𝓮𝓼𝓼𝓲𝓸𝓷** <a:trangtrig3:1546040818261954610>'
    )
  );

  // 2. Đường kẻ sau tiêu đề
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 3. Nội dung mở đầu
  const introText =
    'Chọn một trong hai nút bên dưới để gửi confession.\n' +
    'Confession của bạn sẽ được gửi đến Ban Quản Lý để duyệt trước khi xuất hiện.';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(introText)
  );

  // 4. Đường kẻ phân cách
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 5. Chế độ gửi (Ẩn danh / Public)
  const modesText =
    '<a:trangtrig30:1546905942476464178> **Ẩn danh**\n' +
    'Tên và tài khoản Discord của bạn sẽ không được hiển thị khi confession được đăng.\n\n' +
    '<a:trangtrig30:1546905942476464178> **Public**\n' +
    'Tên của bạn sẽ được hiển thị cùng confession sau khi được duyệt.';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(modesText)
  );

  // 6. Đường kẻ phân cách
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 7. Thông báo riêng & Hỗ trợ
  const notesText =
    '<a:heartg1:1545307544808071258> Bot sẽ gửi tin nhắn riêng cho bạn khi confession được duyệt hoặc từ chối.\n' +
    '<a:heartg1:1545307544808071258> Nếu gặp bất cứ vấn đề gì liên quan đến cfs, vui lòng tag <@872792190651334707> để được giải quyết nhanh chóng. Xin cảm ơn!';

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(notesText)
  );

  // 8. Đường kẻ phân cách trước ảnh
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  // 9. Ảnh Usagi Confessions
  const att = getConfessionImageAttachment();
  const imageUrl = att ? 'attachment://cfs.png' : CFS_IMAGE_URL;

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(imageUrl)
    )
  );

  // 10. Buttons row (cả 2 nút màu xám Secondary)
  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confession_open_anonymous')
      .setLabel('Ẩn danh')
      .setEmoji('1546905942476464178')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('confession_open_public')
      .setLabel('Public')
      .setEmoji('1546905942476464178')
      .setStyle(ButtonStyle.Secondary)
  );

  container.addActionRowComponents(buttonsRow);

  return container;
}

export const CONFESSION = {
  publicForumId: '1551813977502130216',
  reviewChannelId: '1551820171306606632',
  reviewerRoleId: '1545295139390619768',
  color: 0xfceec9,
  emojiMain: '<a:trangtrig30:1546905942476464178>',
  emojiMode: '<a:trangtrig30:1546905942476464178>',
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
 return new EmbedBuilder().setDescription(
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
 return new EmbedBuilder().setDescription(
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

 const container = new ContainerBuilder();
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `# <a:trangtrig2:1546040703375904801> **Confession #${data.number}** <a:trangtrig3:1546040818261954610>`
  )
 );
 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
 );
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(data.content)
 );
 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
 );
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(identity)
 );
 container.addActionRowComponents(publicButtons(data.id));

 const embed=new EmbedBuilder().setDescription(`${CONFESSION.emojiMain} **Confession #${data.number}**\n\n${data.content}\n\n${identity}`);

 let thread;
 try {
  thread = await forum.threads.create({
   name: `Confession #${data.number}`,
   message: {
    content: null,
    embeds: [],
    components: [container],
    flags: MessageFlags.IsComponentsV2,
   },
   reason: `Approved confession #${data.number}`
  });
 } catch (v2Err) {
  thread = await forum.threads.create({
   name: `Confession #${data.number}`,
   message: { embeds: [embed], components: [publicButtons(data.id)] },
   reason: `Approved confession #${data.number}`
  });
 }

 try{
  const starter=await thread.fetchStarterMessage();
  if(starter)await starter.react('1546905942476464178');
 }catch(error){
  console.warn(`[Confession] Không thể tự react trangtrig30 cho #${data.number}:`,error?.message||error);
 }
 return thread;
}