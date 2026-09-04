import {
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

import {
    getHuanqianConfig,
} from '../../../services/huanqian/huanqianService.js';

import {
    getHuanqianSession,
    deleteHuanqianSession,
    showHuanqianDashboard,
} from '../../../commands/Community/modules/huanqian_dashboard.js';


function hasAdminPermission(
    interaction,
) {
    return (
        interaction.member?.permissions?.has(
            'Administrator',
        ) ||
        interaction.member?.permissions?.has(
            'ManageGuild',
        )
    );
}


function getSession(
    interaction,
    sessionId,
) {
    const session =
        getHuanqianSession(
            sessionId,
        );

    if (!session) {
        return null;
    }

    if (
        session.userId !==
        interaction.user.id
    ) {
        return null;
    }

    if (
        session.guildId !==
        interaction.guild?.id
    ) {
        return null;
    }

    return session;
}


export default [
    /*
     * ==========================================================
     * PUBLIC HUANQIAN BUTTON
     * ==========================================================
     *
     * huanqian:info
     * huanqian:source
     * huanqian:note
     */

    {
        name:
            'huanqian',

        async execute(
            interaction,
            client,
            args,
        ) {
            if (
                !interaction.guild
            ) {
                return;
            }

            const buttonId =
                args[0];

            const config =
                await getHuanqianConfig(
                    client,
                    interaction.guild.id,
                );

            const button =
                config.buttons.find(
                    item =>
                        item.id ===
                        buttonId,
                );

            if (!button) {
                return interaction.reply({
                    content:
                        '❌ Không tìm thấy thông tin này.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const embed =
                new EmbedBuilder()
                    .setColor(
                        config.panelColor ||
                        '#6F5846',
                    )
                    .setTitle(
                        button.title ||
                        button.label,
                    )
                    .setDescription(
                        button.description ||
                        'Chưa có nội dung.',
                    )
                    .setFooter({
                        text:
                            '🌸 Huan Qian',
                    });

            return interaction.reply({
                embeds: [
                    embed,
                ],

                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },


    /*
     * ==========================================================
     * DASHBOARD BUTTON
     * ==========================================================
     */

    {
        name:
            'huanqiandashboard',

        async execute(
            interaction,
            client,
            args,
        ) {
            if (
                !interaction.guild
            ) {
                return;
            }

            if (
                !hasAdminPermission(
                    interaction,
                )
            ) {
                return interaction.reply({
                    content:
                        '❌ Bạn cần quyền Administrator hoặc Manage Server.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const sessionId =
                args[0];

            const action =
                args[1];

            const extra =
                args[2];

            const session =
                getSession(
                    interaction,
                    sessionId,
                );

            if (!session) {
                return interaction.reply({
                    content:
                        '❌ Dashboard đã hết hạn hoặc không thuộc về bạn.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            const guildId =
                interaction.guild.id;

            /*
             * --------------------------------------------------
             * CLOSE
             * --------------------------------------------------
             */

            if (
                action === 'close'
            ) {
                deleteHuanqianSession(
                    sessionId,
                );

                return interaction.update({
                    content:
                        '🌸 Huan Qian Dashboard đã đóng.',

                    embeds: [],

                    components: [],
                });
            }


            /*
             * --------------------------------------------------
             * PANEL SETTINGS
             * --------------------------------------------------
             */

            if (
                action === 'panel'
            ) {
                return interaction.showModal(
                    await import(
                        '../../modals/huanqian/huanqian.js'
                    ).then(
                        module =>
                            module.buildPanelModal(
                                client,
                                guildId,
                                sessionId,
                            ),
                    ),
                );
            }


            /*
             * --------------------------------------------------
             * IMAGE
             * --------------------------------------------------
             */

            if (
                action === 'image'
            ) {
                return interaction.showModal(
                    await import(
                        '../../modals/huanqian/huanqian.js'
                    ).then(
                        module =>
                            module.buildImageModal(
                                client,
                                guildId,
                                sessionId,
                            ),
                    ),
                );
            }


            /*
             * --------------------------------------------------
             * EDIT BUTTON
             * --------------------------------------------------
             */

            if (
                action === 'button'
            ) {
                if (!extra) {
                    return interaction.reply({
                        content:
                            '❌ Không xác định được button.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                return interaction.showModal(
                    await import(
                        '../../modals/huanqian/huanqian.js'
                    ).then(
                        module =>
                            module.buildButtonModal(
                                client,
                                guildId,
                                sessionId,
                                extra,
                            ),
                    ),
                );
            }


            /*
             * --------------------------------------------------
             * PREVIEW
             * --------------------------------------------------
             */

            if (
                action === 'preview'
            ) {
                const config =
                    await getHuanqianConfig(
                        client,
                        guildId,
                    );

                const {
                    buildHuanqianPanel,
                } = await import(
                    '../../../commands/Community/modules/huanqian_dashboard.js'
                );

                const payload =
                    buildHuanqianPanel(
                        config,
                        interaction.guild,
                    );

                return interaction.reply({
                    ...payload,

                    flags:
                        MessageFlags.Ephemeral,
                });
            }


            /*
             * --------------------------------------------------
             * PUBLISH
             * --------------------------------------------------
             */

            if (
                action === 'publish'
            ) {
                const config =
                    await getHuanqianConfig(
                        client,
                        guildId,
                    );

                if (
                    !config.panelChannelId
                ) {
                    return interaction.reply({
                        content:
                            '❌ Chưa cài Panel Channel. Hãy mở Panel Settings trước.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                const channel =
                    await interaction.guild.channels
                        .fetch(
                            config.panelChannelId,
                        )
                        .catch(
                            () => null,
                        );

                if (
                    !channel ||
                    !channel.isTextBased()
                ) {
                    return interaction.reply({
                        content:
                            '❌ Panel Channel không hợp lệ hoặc bot không thể truy cập.',

                        flags:
                            MessageFlags.Ephemeral,
                    });
                }

                const {
                    buildHuanqianPanel,
                } = await import(
                    '../../../commands/Community/modules/huanqian_dashboard.js'
                );

                const payload =
                    buildHuanqianPanel(
                        config,
                        interaction.guild,
                    );

                let message =
                    null;

                if (
                    config.panelMessageId
                ) {
                    message =
                        await channel.messages
                            .fetch(
                                config.panelMessageId,
                            )
                            .catch(
                                () => null,
                            );
                }

                if (message) {
                    await message.edit(
                        payload,
                    );
                } else {
                    message =
                        await channel.send(
                            payload,
                        );

                    const {
                        updateHuanqianPanel,
                    } = await import(
                        '../../../services/huanqian/huanqianService.js'
                    );

                    await updateHuanqianPanel(
                        client,
                        guildId,
                        {
                            panelMessageId:
                                message.id,
                        },
                    );
                }

                return interaction.reply({
                    content:
                        '✅ Huan Qian Panel đã được Publish / Update.',

                    flags:
                        MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                content:
                    '❌ Thao tác Dashboard không hợp lệ.',

                flags:
                    MessageFlags.Ephemeral,
            });
        },
    },
];
