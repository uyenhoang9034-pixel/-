import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import path from 'node:path';
import { getPrisonRecord, releaseMember, PRISON_CHANNEL_ID } from '../../services/prisonService.js';

const PRISON_ROLE_ID = '1541818610639446066';
const PRISON_IMAGE_NAME = 'nhatu.png';
const PRISON_IMAGE_PATH = path.resolve(process.cwd(), 'assets', 'nhatu', PRISON_IMAGE_NAME);

export default {
  data: new SlashCommandBuilder()
    .setName('thatu')
    .setDescription('Thả một phạm nhân khỏi Nhà Tù ngay lập tức.')
    .addUserOption(option =>
      option.setName('thanhvien').setDescription('Phạm nhân cần thả').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  category: 'moderation',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const user = interaction.options.getUser('thanhvien');
    const member = interaction.options.getMember('thanhvien');

    if (!member || !user) {
      return InteractionHelper.safeEditReply(interaction, {
        content: 'Không tìm thấy thành viên này trong server.',
      });
    }

    const record = await getPrisonRecord(client, interaction.guildId, user.id);
    const hasPrisonRole = member.roles.cache.has(PRISON_ROLE_ID);

    if (!record?.active && !hasPrisonRole) {
      return InteractionHelper.safeEditReply(interaction, {
        content: `<@${user.id}> hiện không ở trong Nhà Tù.`,
      });
    }

    const releaseRecord = record?.active
      ? record
      : {
          active: true,
          guildId: interaction.guildId,
          userId: user.id,
          originalRoleIds: [],
          totalLabor: 0,
          completedLabor: 0,
          remainingLabor: 0,
          reason: 'Thả tù thủ công',
          jailedAt: Date.now(),
        };

    const released = await releaseMember(client, member, releaseRecord);

    const channel = await interaction.guild.channels.fetch(PRISON_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) {
      return InteractionHelper.safeEditReply(interaction, {
        content: `Đã thả <@${user.id}> nhưng không tìm thấy kênh Nhà Tù để gửi thông báo.`,
      });
    }

    const total = Math.max(0, Number(released.totalLabor || 0));
    const completedBeforeRelease = record?.active
      ? Math.max(0, total - Number(record.remainingLabor || 0))
      : 0;

    const embed = new EmbedBuilder()
      .setColor(0xfceec9)
      .setTitle('<a:trangtrig2:1546040703375904801> 𝓤𝓼𝓪𝓰𝓲 · 𝓜𝓪̃𝓷 𝓗𝓪̣𝓷 𝓣𝓾̀ <a:trangtrig3:1546040818261954610>')
      .setDescription([
        '<a:trangtrig1:1546040442548654140> **TỰ DO!**',
        '',
        `<@${user.id}> đã được thả khỏi Nhà Tù!`,
        `<a:trangtrig31:1546905996893626440> Lao động: **${completedBeforeRelease} / ${total} lần**`,
        `<a:danceg1:1541433201904455832> Án phạt: **${released.reason || 'Không có lý do'}**`,
        '<a:danceg1:1541433201904455832> Trạng thái: **ĐÃ MÃN HẠN**',
        '',
        '━━━━━━━━━━━━━━━━━━━━',
        '<a:trangtrig6:1546043036390260756> Cửa Nhà Tù đã được mở.',
        '<a:trangtrig6:1546043036390260756> Các role trước khi thụ án đang được khôi phục.',
        '',
        '<a:catg11:1546058047393239151> Quản Ngục Usagi: *Lần sau ngoan nhé, không là vào lau tiếp đấy!*',
      ].join('\n'))
      .setImage(`attachment://${PRISON_IMAGE_NAME}`);

    const image = new AttachmentBuilder(PRISON_IMAGE_PATH, { name: PRISON_IMAGE_NAME });
    await channel.send({ embeds: [embed], files: [image] });

    return InteractionHelper.safeEditReply(interaction, {
      content: `Đã thả <@${user.id}> và gửi thông báo tại <#${PRISON_CHANNEL_ID}>.`,
    });
  },
};
