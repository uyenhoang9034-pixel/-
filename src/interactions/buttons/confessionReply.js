import { ModalBuilder,TextInputBuilder,TextInputStyle,ActionRowBuilder,MessageFlags } from 'discord.js';
import { getConfession } from '../../services/confessionService.js';
export default {name:'confession_reply',async execute(interaction,client,args){
 const d=await getConfession(client,args[0]);
 if(!d||d.status!=='approved')return interaction.reply({content:'❌ Confession không còn khả dụng.',flags:MessageFlags.Ephemeral});
 const input=new TextInputBuilder().setCustomId('content').setLabel('Nội dung trả lời').setPlaceholder('Hãy viết điều bạn muốn chia sẻ...').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true);
 await interaction.showModal(new ModalBuilder().setCustomId(`confession_reply_submit:${args[0]}`).setTitle(`Trả lời Confession #${d.number}`).addComponents(new ActionRowBuilder().addComponents(input)));
}};