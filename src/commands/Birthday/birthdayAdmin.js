import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import birthdaySet from './modules/birthday_set.js';
import birthdayRemove from './modules/birthday_remove.js';
import birthdaySetchannel from './modules/birthday_setchannel.js';
import birthdaySend from './modules/birthday_send.js';

export default {
    data: new SlashCommandBuilder()
        .setName('birthday-admin')
        .setDescription('Quản lý sinh nhật thành viên (Dành cho Quản Trị)')
        .setDefaultMemberPermissions(0n)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a birthday')
                .addIntegerOption(option =>
                    option
                        .setName('day')
                        .setDescription('Ngày sinh (1-31)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31)
                )
                .addIntegerOption(option =>
                    option
                        .setName('month')
                        .setDescription('Tháng sinh (1-12)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(12)
                )
                .addIntegerOption(option =>
                    option
                        .setName('year')
                        .setDescription('Năm sinh')
                        .setRequired(true)
                        .setMinValue(1900)
                        .setMaxValue(new Date().getFullYear())
                )
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to set birthday for')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a birthday')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to remove birthday for')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Send today\'s birthday announcement manually')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Send for a specific user whose birthday is today; leave empty for everyone today')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Set or disable the channel for birthday announcements')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The text channel for announcements. Leave empty to disable.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        ),

    category: 'Birthday',

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'set':
                return await birthdaySet.execute(interaction, config, client);
            case 'remove':
                return await birthdayRemove.execute(interaction, config, client);
            case 'send':
                return await birthdaySend.execute(interaction, config, client);
            case 'setchannel':
                return await birthdaySetchannel.execute(interaction, config, client);
            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand' });
        }
    }
};

