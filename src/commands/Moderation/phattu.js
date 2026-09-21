import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import path from 'node:path';
import { jailMember, PRISON_CHANNEL_ID } from '../../services/prisonService.js';

const PRISON_ROLE_ID = '1541818610639446066';
const PRISON_IMAGE_NAME = 'nhatu.png';
const PRISON_IMAGE_PATH = path.resolve(process.cwd(), 'assets', 'nhatu', PRISON_IMAGE_NAME);

export default {
  data: new SlashCommandBuilder()
    .setName('phattu')
    .setDescription('Phạt một thành viên vào Nhà Tù.')
    .addUserOption(option =>
      option.setName('thanhvien').setDescription('Thành viên bị phạt').setRequired(true))
    .addIntegerOption(option =>
      option.setName('solan').setDescription('Số lần phải lau dọn').setMinValue(1).setMaxValue(10000).setRequired(true))
    .addStringOption(option =>
      option.setName('lydo').setDescription('Lý do phạt tù').setMaxLength(500).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  category: 'moderation',

  async execute(interaction, config, client) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('thanhvien');
    const member = interaction.options.getMember('thanhvien');
    const laborRequired = interaction.options.getInteger('solan');
    const reason = interaction.options.getString('lydo');

    if (!member || !user) {
      return InteractionHelper.safeEditReply(interaction, { content: 'Không tìm thấy thành viên này trong server.' });
    }
    if (user.id === interaction.user.id || user.id === client.user.id) {
      return InteractionHelper.safeEditReply(interaction, { content: 'Không thể phạt tù người này.' });
    }
    if (member.id === interaction.guild.ownerId) {
      return InteractionHelper.safeEditReply(interaction, { content: 'Không thể phạt tù chủ server.' });
    }

    const prisonRole = interaction.guild.roles.cache.get(PRISON_ROLE_ID);
    if (!prisonRole) {
      return InteractionHelper.safeEditReply(interaction, { content: 'Không tìm thấy role Tù Nhân.' });
    }

    const channel = await interaction.guild.channels.fetch(PRISON_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) {
      return InteractionHelper.safeEditReply(interaction, { content: 'Không tìm thấy kênh Nhà Tù.' });
    }

    const record = await jailMember(client, member, {
      laborRequired,
      reason,
      moderatorId: interaction.user.id,
    });

    const embed = new EmbedBuilder()
      .setColor(0xfceec9)
      .setTitle('<a:trangtrig2:1546040703375904801> 𝓤𝓼𝓪𝓰𝓲 · 𝓝𝓱𝓪̀ 𝓣𝓾̀ <a:trangtrig3:1546040818261954610>')
      .setDescription([
        '<a:bang3:1546891744237461635> **LỆNH PHẠT TÙ**',
        '',
        `<@${user.id}> đã bị tống vào Nhà Tù!`,
        '',
        `<a:hitg1:1541437857049346148> Phạm nhân: **<@${user.id}>**`,
        `<a:bang2:1546891483250954290> Lý do: **${reason}**`,
        `<a:bang2:1546891483250954290> Hình phạt - Lau dọn Nhà Tù: **${record.remainingLabor} lần**`,
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        'Muốn được thả?',
        `Dùng **/laudon** và hoàn thành đủ **${record.remainingLabor} lần** lao động.`,
        '',
        '<a:catg11:1546058047393239151> *Quản ngục Usagi đang canh cửa. Đừng hòng trốn!*',
      ].join('\n'))
      .setImage(`attachment://${PRISON_IMAGE_NAME}`);

    const image = new AttachmentBuilder(PRISON_IMAGE_PATH, { name: PRISON_IMAGE_NAME });
    await channel.send({ embeds: [embed], files: [image] });
    await InteractionHelper.safeEditReply(interaction, {
      content: `Đã phạt tù <@${user.id}>. Thông báo đã gửi tại <#${PRISON_CHANNEL_ID}>.`,
    });
  },
};
