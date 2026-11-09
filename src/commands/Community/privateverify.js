import {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import { setupPrivateVerification } from '../../services/privateVerificationService.js';
import { hasRoleTier, buildRoleDeniedMessage } from '../../config/commands/roleAccess.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('privateverify')
        .setDescription('Thiết lập xác nhận trước khi trò chuyện trong kênh riêng tư')
        .setDefaultMemberPermissions(0n)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Thiết lập kênh cần xác nhận')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Kênh cần xác nhận trước khi nhắn')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                ),
        ),
    category: 'Community',

    async execute(interaction, guildConfig, client) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ Lệnh này chỉ dùng trong server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!hasRoleTier(interaction.member, 'MID_ADMIN', interaction.guild, interaction.user)) {
            return interaction.reply({
                content: `❌ ${buildRoleDeniedMessage('privateverify')}`,
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channel = interaction.options.getChannel('channel', true);
        const result = await setupPrivateVerification(client, interaction.guild, channel);

        return interaction.editReply({
            content:
                `✅ Đã bật xác nhận cho <#${channel.id}>.\n` +
                `Role xác nhận: <@&${result.roleId}>\n` +
                'Người chưa xác nhận không thể gửi tin nhắn; xác nhận xong sẽ được mở quyền.',
        });
    },
};
