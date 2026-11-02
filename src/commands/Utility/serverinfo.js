import {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    EmbedBuilder,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Get detailed information about the server"),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`ServerInfo interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'serverinfo'
            });
            return;
        }

        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        const createdTimestamp = Math.floor(guild.createdAt.getTime() / 1000);
        const ownerTag = owner.user.tag || owner.user.username;

        const titleText = `<a:trangtrig2:1546040703375904801> **SERVER INFO: ${guild.name}** <a:trangtrig3:1546040818261954610>`;

        const bodyContent = [
            `<a:trangtrig14:1546047912969113622> Owner: <@${owner.id}> | ID: ${ownerTag}`,
            '',
            `<a:heartg1:1545307544808071258> Members: ${guild.memberCount}`,
            `<a:heartg1:1545307544808071258> Channels: ${guild.channels.cache.size}`,
            `<a:heartg1:1545307544808071258> Roles: ${guild.roles.cache.size}`,
            '',
            `<a:trangtrig8:1546047024334503997> Boosts: Level ${guild.premiumTier} - **${guild.premiumSubscriptionCount}**`,
            `<a:trangtrig8:1546047024334503997> Ngày thành lập: <t:${createdTimestamp}:R>`,
        ].join('\n');

        const container = new ContainerBuilder()
            .setAccentColor(0x2B8BE3)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${titleText}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(bodyContent)
            );

        try {
            await InteractionHelper.safeEditReply(interaction, {
                content: null,
                embeds: [],
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (v2Error) {
            logger.warn('Failed to send ServerInfo with Components V2, falling back to Embed:', v2Error);
            const fallbackEmbed = new EmbedBuilder()
                .setColor(0x2B8BE3)
                .setTitle(`SERVER INFO: ${guild.name}`)
                .setDescription(bodyContent);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [fallbackEmbed],
                components: [],
            });
        }

        logger.info(`ServerInfo command executed`, {
            userId: interaction.user.id,
            guildId: guild.id,
            guildName: guild.name,
            memberCount: guild.memberCount
        });
    },
};