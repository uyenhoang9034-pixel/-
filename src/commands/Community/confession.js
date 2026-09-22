import { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { CONFESSION, getConfessionByNumber, infoEmbed } from '../../services/confessionService.js';

export default {
 slashOnly:true,
 data:new SlashCommandBuilder().setName('confession').setDescription('Usagi Confession.')
  .setDMPermission(false)
  .addSubcommand(s=>s.setName('panel').setDescription('Đăng bài panel Usagi Confession lên forum.'))
  .addSubcommand(s=>s.setName('info').setDescription('Xem thông tin confession dành cho BQL.')
    .addIntegerOption(o=>o.setName('id').setDescription('Số confession, ví dụ 3552').setRequired(true).setMinValue(1))),
 category:'Community',
 async execute(interaction){
  if(!interaction.inGuild())return interaction.reply({content:'❌ Lệnh này chỉ dùng trong server.',flags:MessageFlags.Ephemeral});
  const sub=interaction.options.getSubcommand();

  if(sub==='info'){
   if(!interaction.member.roles.cache.has(CONFESSION.reviewerRoleId))return interaction.reply({content:'❌ Bạn không có role duyệt confession.',flags:MessageFlags.Ephemeral});
   const number=interaction.options.getInteger('id');
   const d=await getConfessionByNumber(interaction.client,interaction.guildId,number);
   if(!d)return interaction.reply({content:`❌ Không tìm thấy Confession #${number}.`,flags:MessageFlags.Ephemeral});
   const rows=[];
   if(d.publicThreadId)rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${d.guildId}/${d.publicThreadId}`).setLabel('Đi tới bài đăng').setEmoji('1546047657963819048')));
   return interaction.reply({embeds:[infoEmbed(d)],components:rows,flags:MessageFlags.Ephemeral});
  }

  if(!interaction.member.roles.cache.has(CONFESSION.reviewerRoleId))return interaction.reply({content:'❌ Chỉ Ban Quản Lý mới có thể đăng panel Confession.',flags:MessageFlags.Ephemeral});
  await interaction.deferReply({flags:MessageFlags.Ephemeral});

  const forum=await interaction.guild.channels.fetch(CONFESSION.publicForumId);
  if(!forum||forum.type!==ChannelType.GuildForum)return interaction.editReply('❌ Kênh Confession đã cấu hình không phải Forum channel.');

  const embed=new EmbedBuilder().setColor(CONFESSION.color).setDescription(
   '<a:trangtrig2:1546040703375904801> **𝓤𝓼𝓪𝓰𝓲 𝓒𝓸𝓷𝓯𝓮𝓼𝓼𝓲𝓸𝓷** <a:trangtrig3:1546040818261954610>\n\n'+
   'Chọn một trong hai nút bên dưới để gửi confession.\nConfession của bạn sẽ được gửi đến Ban Quản Lý để duyệt trước khi xuất hiện.\n\n'+
   '<a:trangtrig47:1547249293944029308> **Ẩn danh**\nTên và tài khoản Discord của bạn sẽ không được hiển thị khi confession được đăng.\n'+
   '<a:trangtrig47:1547249293944029308> **Public**\nTên của bạn sẽ được hiển thị cùng confession sau khi được duyệt.\n\n'+
   '<a:heartg6:1546906117551030382> *Bot sẽ gửi tin nhắn riêng cho bạn khi confession được duyệt hoặc từ chối.*\n'+
   '<a:heartg6:1546906117551030382> *Nếu gặp bất cứ vấn đề gì liên quan đến cfs, vui lòng tag <@872792190651334707> để được giải quyết nhanh chóng. Xin cảm ơn!*'
  );
  const row=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId('confession_open_anonymous').setLabel('Ẩn danh').setEmoji('1547249293944029308').setStyle(ButtonStyle.Secondary),
   new ButtonBuilder().setCustomId('confession_open_public').setLabel('Public').setEmoji('1547249293944029308').setStyle(ButtonStyle.Success)
  );

  const thread=await forum.threads.create({
   name:'Usagi Confession',
   message:{embeds:[embed],components:[row]},
   reason:`Confession panel created by ${interaction.user.tag}`
  });
  await interaction.editReply(`✅ Đã đăng panel Usagi Confession lên Forum. Bạn có thể ghim bài này:\nhttps://discord.com/channels/${interaction.guildId}/${thread.id}`);
 }
};