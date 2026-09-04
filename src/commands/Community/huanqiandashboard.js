import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';


export default {
    slashOnly: true,

    data:
        new SlashCommandBuilder()
            .setName(
                'huanqiandashboard',
            )
            .setDescription(
                'Manage the Huan Qian panel.',
            )
            .addSubcommand(
                sub =>
                    sub
                        .setName(
                            'setup',
                        )
                        .setDescription(
                            'Open the Huan Qian Dashboard.',
                        ),
            )
            .setDMPermission(
                false,
            ),

    category:
        'Community',

    async execute(
        interaction,
        config,
        client,
    ) {
        if (
            !interaction.inGuild()
        ) {
            return interaction.reply({
                content:
                    '❌ Lệnh này chỉ dùng trong server.',

                flags:
                    MessageFlags.Ephemeral,
            });
        }

        const member =
            interaction.member;

        const allowed =
            member.permissions.has(
                PermissionFlagsBits.Administrator,
            ) ||
            member.permissions.has(
                PermissionFlagsBits.ManageGuild,
            );

        if (!allowed) {
            return interaction.reply({
                content:
                    '❌ Bạn cần quyền Administrator hoặc Manage Server.',

                flags:
                    MessageFlags.Ephemeral,
            });
        }

        const {
            showHuanqianDashboard,
        } = await import(
            './modules/huanqian_dashboard.js'
        );

        await showHuanqianDashboard(
            interaction,
            client,
        );
    },
};
