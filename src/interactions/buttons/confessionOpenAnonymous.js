import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
export default { name:'confession_open_anonymous', async execute(interaction) {
 const input=new TextInputBuilder().setCustomId('content').setLabel('Nội dung confession').setPlaceholder('Hãy viết điều bạn muốn chia sẻ...').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true);
 const modal=new ModalBuilder().setCustomId('confession_submit_anonymous').setTitle('Gửi confession ẩn danh').addComponents(new ActionRowBuilder().addComponents(input));
 await interaction.showModal(modal);
}};