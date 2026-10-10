import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
 data: new SlashCommandBuilder().setName('gdelay').setDescription('Toggle delayed giveaway announcements.')
  .addStringOption(o => o.setName('messageid').setDescription('Giveaway message ID.').setRequired(true))
  .addBooleanOption(o => o.setName('enabled').setDescription('Enable delayed announcement.').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
 async execute(interaction) {
  if (!interaction.inGuild() || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
   throw new TitanBotError('Permission denied', ErrorTypes.PERMISSION, 'Bạn cần quyền Quản lý máy chủ để dùng lệnh này.', { userId: interaction.user.id });
  }
  const messageId = interaction.options.getString('messageid', true).trim();
  const enabled = interaction.options.getBoolean('enabled', true);
  const list = await getGuildGiveaways(interaction.client, interaction.guildId);
  const giveaway = list.find(item => item.messageId === messageId);
  if (!giveaway) throw new TitanBotError('Giveaway not found', ErrorTypes.VALIDATION, 'Không tìm thấy giveaway theo Message ID này.', { messageId });
  if (giveaway.ended || giveaway.isEnded) throw new TitanBotError('Already ended', ErrorTypes.VALIDATION, 'Giveaway đã kết thúc; hãy bật chế độ này trước khi kết thúc.', { messageId });
  giveaway.delayAnnouncement = enabled;
  await saveGiveaway(interaction.client, interaction.guildId, giveaway);
  const text = enabled ? 'Đã bật trì hoãn. Khi giveaway kết thúc, bot sẽ giữ kín kết quả. Dùng /gselect để chọn riêng hoặc /gannounce để công bố sau.' : 'Đã tắt trì hoãn. Giveaway sẽ tự công bố người thắng như bình thường.';
  return InteractionHelper.safeReply(interaction, { embeds: [successEmbed('Cập nhật giveaway', text)], flags: MessageFlags.Ephemeral });
 }
};
