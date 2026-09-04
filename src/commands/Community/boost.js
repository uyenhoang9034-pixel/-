import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
} from 'discord.js';

import {
    getBoostConfig,
    setBoostConfig,
    sendTestBoost,
} from '../../services/boost/boostService.js';


export default {
    data: new SlashCommandBuilder()
        .setName('boost')
        .setDescription(
            'Quản lý hệ thống Server Boost',
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild,
        )

        // =====================================================
        // SETUP
        // =====================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('setup')
                    .setDescription(
                        'Mở Boost Dashboard',
                    ),
        )

        // =====================================================
        // TESTBOOST
        // =====================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('testboost')
                    .setDescription(
                        'Test Embed Boost',
                    ),
        )

        // =====================================================
        // SET CHANNEL
        // =====================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('channel')
                    .setDescription(
                        'Đặt kênh thông báo Boost',
                    )
                    .addChannelOption(
                        option =>
                            option
                                .setName('channel')
                                .setDescription(
                                    'Kênh nhận thông báo Boost',
                                )
                                .setRequired(
                                    true,
                                ),
                    ),
        )

        // =====================================================
        // SET ROLE
        // =====================================================

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('role')
                    .setDescription(
                        'Đặt role TỶ PHÚ',
                    )
                    .addRoleOption(
                        option =>
                            option
                                .setName('role')
                                .setDescription(
                                    'Role TỶ PHÚ',
                                )
                                .setRequired(
                                    true,
                                ),
                    ),
        ),


    async execute(
        interaction,
    ) {
        const subcommand =
            interaction.options.getSubcommand();


        // =====================================================
        // SETUP
        // =====================================================

        if (
            subcommand === 'setup'
        ) {
            const config =
                await getBoostConfig(
                    interaction.guild.id,
                );


            const embed =
                new EmbedBuilder()
                    .setColor(
                        parseInt(
                            config.color.replace(
                                '#',
                                '',
                            ),
                            16,
                        ) || 0xF5A9C6,
                    )

                    .setTitle(
                        '🌸 BOOST DASHBOARD',
                    )

                    .setDescription(
                        [
                            'Quản lý hệ thống **Server Boost** tại đây.',

                            '',

                            `**Status:** ${
                                config.enabled
                                    ? '🟢 Enabled'
                                    : '🔴 Disabled'
                            }`,

                            `**Boost Channel:** ${
                                config.channelId
                                    ? `<#${config.channelId}>`
                                    : '`Chưa cài`'
                            }`,

                            `**TỶ PHÚ Role:** ${
                                config.tyPhuRoleId
                                    ? `<@&${config.tyPhuRoleId}>`
                                    : '`Chưa cài`'
                            }`,
                        ].join('\n'),
                    )

                    .setFooter({
                        text:
                            interaction.guild.name,
                    });


            const {
                ActionRowBuilder,
                ButtonBuilder,
                ButtonStyle,
            } = await import(
                'discord.js'
            );


            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                'boost_dashboard:embed',
                            )
                            .setLabel(
                                'Edit Embed',
                            )
                            .setStyle(
                                ButtonStyle.Primary,
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                'boost_dashboard:image',
                            )
                            .setLabel(
                                'Image',
                            )
                            .setStyle(
                                ButtonStyle.Secondary,
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                'boost_dashboard:settings',
                            )
                            .setLabel(
                                'Settings',
                            )
                            .setStyle(
                                ButtonStyle.Secondary,
                            ),

                        new ButtonBuilder()
                            .setCustomId(
                                'boost_dashboard:test',
                            )
                            .setLabel(
                                'Test Boost',
                            )
                            .setStyle(
                                ButtonStyle.Success,
                            ),
                    );


            await interaction.reply({
                embeds: [
                    embed,
                ],

                components: [
                    row,
                ],

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }


        // =====================================================
        // TEST
        // =====================================================

        if (
            subcommand === 'testboost'
        ) {
            const result =
                await sendTestBoost(
                    interaction.member,
                );


            if (
                !result.success
            ) {
                await interaction.reply({
                    content:
                        '❌ Không thể gửi Test Boost. Hãy kiểm tra Boost Channel trong `/boost setup`.',

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }


            await interaction.reply({
                content:
                    '✅ Đã gửi Test Boost Embed.',

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }


        // =====================================================
        // CHANNEL
        // =====================================================

        if (
            subcommand === 'channel'
        ) {
            const channel =
                interaction.options.getChannel(
                    'channel',
                );


            await setBoostConfig(
                interaction.guild.id,
                {
                    channelId:
                        channel.id,
                },
            );


            await interaction.reply({
                content:
                    `✅ Đã đặt kênh Boost thành ${channel}.`,

                flags:
                    MessageFlags.Ephemeral,
            });

            return;
        }


        // =====================================================
        // ROLE
        // =====================================================

        if (
            subcommand === 'role'
        ) {
            const role =
                interaction.options.getRole(
                    'role',
                );


            await setBoostConfig(
                interaction.guild.id,
                {
                    tyPhuRoleId:
                        role.id,
                },
            );


            await interaction.reply({
                content:
                    `✅ Đã đặt role TỶ PHÚ thành ${role}.`,

                flags:
                    MessageFlags.Ephemeral,
            });
        }
    },
};
