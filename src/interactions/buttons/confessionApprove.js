import { MessageFlags,ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder } from 'discord.js';
import { CONFESSION,getConfession,saveConfession,publishConfession,infoEmbed } from '../../services/confessionService.js';
const CFS_IMAGE='https://raw.githubusercontent.com/uyenhoang9034-pixel/-/main/assets/confessions/cfs.png';
export default {name:'confession_approve',async execute(interaction,client,args){
 if(!interaction.member?.roles?.cache?.has(CONFESSION.reviewerRoleId))return interaction.reply({content:'❌ Bạn không có role duyệt confession.',flags:MessageFlags.Ephemeral});
 const d=await getConfession(client,args[0]);if(!d||d.status!=='pending')return interaction.reply({content:'ℹ️ Confession này đã được xử lý hoặc không tồn tại.',flags:MessageFlags.Ephemeral});
 await interaction.deferReply({flags:MessageFlags.Ephemeral});
 const thread=await publishConfession(client,interaction.guild,d);
 d.status='approved';d.reviewedBy=interaction.user.id;d.reviewedAt=Date.now();d.publicThreadId=thread.id;await saveConfession(client,d);
 await interaction.message.edit({content:'',embeds:[infoEmbed(d)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${d.guildId}/${thread.id}`).setLabel('Đi tới bài đăng').setEmoji('1546047657963819048'))]});
 try{
  const u=await client.users.fetch(d.authorId);
  const dmEmbed=new EmbedBuilder().setColor(CONFESSION.color).setDescription(
   `${CONFESSION.emojiApproved} **Confession của bạn đã được duyệt!**\n\n`+
   `${CONFESSION.emojiHeart} Confession #${d.number} đã được đăng.\n\n`+
   `**Chế độ:** ${CONFESSION.emojiMode} ${d.mode==='public'?'Public':'Ẩn danh'}`+
   `${d.anonymousCode?`\n**Mã ẩn danh:** ${d.anonymousCode}`:''}`
  ).setImage(CFS_IMAGE);
  await u.send({embeds:[dmEmbed],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${d.guildId}/${thread.id}`).setLabel('Xem confession').setEmoji('1546047657963819048'))]});
 }catch{}
 await interaction.editReply(`${CONFESSION.emojiApproved} Đã duyệt Confession #${d.number}.`);
}};