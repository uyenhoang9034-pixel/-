import { MessageFlags,ActionRowBuilder,ButtonBuilder,ButtonStyle } from 'discord.js';
import { CONFESSION,getConfession,saveConfession } from '../../services/confessionService.js';
export default {name:'confession_follow',async execute(interaction,client,args){
 const d=await getConfession(client,args[0]);if(!d)return interaction.reply({content:'❌ Không tìm thấy confession.',flags:MessageFlags.Ephemeral});
 d.followers ||= [];const i=d.followers.indexOf(interaction.user.id);const following=i<0;
 if(following)d.followers.push(interaction.user.id);else d.followers.splice(i,1);
 await saveConfession(client,d);
 const button=new ButtonBuilder().setCustomId(`confession_follow:${d.id}`).setEmoji('1546040442548654140').setStyle(ButtonStyle.Secondary).setLabel(following?'Bỏ theo dõi':'Theo dõi');
 await interaction.reply({content:following?`${CONFESSION.emojiFollow} **Đã theo dõi Confession #${d.number}**\nBạn sẽ nhận được thông báo khi confession này có câu trả lời mới.`:`${CONFESSION.emojiFollow} **Đã bỏ theo dõi Confession #${d.number}**`,components:[new ActionRowBuilder().addComponents(button)],flags:MessageFlags.Ephemeral});
}};