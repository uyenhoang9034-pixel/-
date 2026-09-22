import { randomUUID, randomBytes } from 'crypto';
import { MessageFlags } from 'discord.js';
import { CONFESSION, nextConfessionNumber, saveConfession, reviewEmbed, reviewButtons } from '../../services/confessionService.js';
const code=()=> 'USG-'+randomBytes(3).toString('hex').slice(0,4).toUpperCase();
async function submit(interaction,client,mode){
 const content=interaction.fields.getTextInputValue('content').trim();
 const number=await nextConfessionNumber(client,interaction.guildId);
 const data={id:randomUUID(),number,guildId:interaction.guildId,authorId:interaction.user.id,content,mode,status:'pending',anonymousCode:mode==='anonymous'?code():null,createdAt:Date.now(),followers:[interaction.user.id],replyAliases:{},replyCount:0};
 const ch=await interaction.guild.channels.fetch(CONFESSION.reviewChannelId);
 const msg=await ch.send({content:`<@&${CONFESSION.reviewerRoleId}>`,embeds:[reviewEmbed(data)],components:[reviewButtons(data.id)],allowedMentions:{roles:[CONFESSION.reviewerRoleId]}});
 data.reviewMessageId=msg.id; await saveConfession(client,data);
 await interaction.reply({content:`${CONFESSION.emojiMain} **Đã gửi confession!**\n\nConfession của bạn đã được chuyển đến Ban Quản Lý và đang chờ duyệt.\n\n**Mã:** #${number}\n**Chế độ:** ${CONFESSION.emojiMode} ${mode==='public'?'Public':'Ẩn danh'}\n\nBạn sẽ nhận được tin nhắn riêng khi confession được xử lý.\n**Tin nhắn này chỉ hiển thị với bạn.**`,flags:MessageFlags.Ephemeral});
}
export default [
 {name:'confession_submit_anonymous',execute:(i,c)=>submit(i,c,'anonymous')},
 {name:'confession_submit_public',execute:(i,c)=>submit(i,c,'public')}
];