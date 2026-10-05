import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import { setupPrivateVerification } from '../../services/privateVerificationService.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('privateverify')
        .setDescription('Thiết lập xác nhận trước khi trò chuyện trong kênh riêng tư')
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

        if (
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
            !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
            return interaction.reply({
                content: '❌ Bạn cần quyền Administrator hoặc Manage Server.',
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
