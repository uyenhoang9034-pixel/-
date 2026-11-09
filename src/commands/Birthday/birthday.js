import { SlashCommandBuilder } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import birthdayInfo from './modules/birthday_info.js';
import birthdayList from './modules/birthday_list.js';
import nextBirthdays from './modules/next_birthdays.js';

export default {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Birthday system commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View birthday information')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to check birthday for')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all birthdays in the server')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('next')
                .setDescription('Show upcoming birthdays')
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'info':
                return await birthdayInfo.execute(interaction, config, client);
            case 'list':
                return await birthdayList.execute(interaction, config, client);
            case 'next':
                return await nextBirthdays.execute(interaction, config, client);
            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand' });
        }
    }
};