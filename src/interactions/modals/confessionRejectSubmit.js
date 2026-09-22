import { MessageFlags } from 'discord.js';
import { CONFESSION,getConfession,saveConfession,infoEmbed } from '../../services/confessionService.js';
export default {name:'confession_reject_submit',async execute(interaction,client,args){
 if(!interaction.member?.roles?.cache?.has(CONFESSION.reviewerRoleId))return interaction.reply({content:'❌ Bạn không có role duyệt confession.',flags:MessageFlags.Ephemeral});
 const d=await getConfession(client,args[0]);if(!d||d.status!=='pending')return interaction.reply({content:'ℹ️ Confession này đã được xử lý hoặc không tồn tại.',flags:MessageFlags.Ephemeral});
 const reason=interaction.fields.getTextInputValue('reason').trim();d.status='rejected';d.reviewedBy=interaction.user.id;d.reviewedAt=Date.now();d.rejectReason=reason;await saveConfession(client,d);
 await interaction.message.edit({content:'',embeds:[infoEmbed(d)],components:[]});
 try{const u=await client.users.fetch(d.authorId);await u.send(`${CONFESSION.emojiReject} **Confession của bạn chưa được duyệt**\n\nConfession #${d.number} đã bị từ chối.\n\n**Lý do:**\n*${reason}*\n\n*Bạn có thể chỉnh lại nội dung và gửi confession mới.*`);}catch{}
 await interaction.reply({content:`${CONFESSION.emojiReject} Đã từ chối Confession #${d.number}.`,flags:MessageFlags.Ephemeral});
}};