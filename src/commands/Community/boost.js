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
                        'Gửi thông báo Boost thủ công để test hoặc gửi bù',
                    )
                    .addUserOption(
                        option =>
                            option
                                .setName('member')
                                .setDescription(
                                    'Người được hiển thị trong thông báo Boost',
                                )
                                .setRequired(
                                    true,
                                ),
                    )
                    .addIntegerOption(
                        option =>
                            option
                                .setName('member_boosts')
                                .setDescription(
                                    'Số boost của riêng người này',
                                )
                                .setMinValue(
                                    1,
                                )
                                .setRequired(
                                    true,
                                ),
                    )
                    .addIntegerOption(
                        option =>
                            option
                                .setName('total_boosts')
                                .setDescription(
                                    'Tổng số Boost hiện tại muốn hiển thị',
                                )
                                .setMinValue(
                                    0,
                                )
                                .setRequired(
                                    true,
                                ),
                    )
                    .addIntegerOption(
                        option =>
                            option
                                .setName('level')
                                .setDescription(
                                    'Boost Level muốn hiển thị (0 - 3)',
                                )
                                .setMinValue(
                                    0,
                                )
                                .setMaxValue(
                                    3,
                                )
                                .setRequired(
                                    true,
                                ),
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
        // TESTBOOST
        // =====================================================

        if (
            subcommand === 'testboost'
        ) {
            const user =
                interaction.options.getUser(
                    'member',
                    true,
                );

            const memberBoosts =
                interaction.options.getInteger(
                    'member_boosts',
                    true,
                );

            const totalBoosts =
                interaction.options.getInteger(
                    'total_boosts',
                    true,
                );

            const level =
                interaction.options.getInteger(
                    'level',
                    true,
                );


            const member =
                interaction.guild.members.cache.get(
                    user.id,
                ) ||
                await interaction.guild.members.fetch(
                    user.id,
                ).catch(
                    () => null,
                );


            if (!member) {
                await interaction.reply({
                    content:
                        '❌ Không tìm thấy thành viên này trong server.',

                    flags:
                        MessageFlags.Ephemeral,
                });

                return;
            }


            const result =
                await sendTestBoost(
                    member,
                    null,
                    {
                        memberBoosts,
                        boostCount:
                            totalBoosts,
                        currentLevel:
                            level,
                    },
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
                    `✅ Đã gửi thông báo Boost cho ${member}.\n` +
                    `• Boost của member: **${memberBoosts}**\n` +
                    `• Tổng Boost hiển thị: **${totalBoosts}**\n` +
                    `• Boost Level hiển thị: **${level}**`,

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
