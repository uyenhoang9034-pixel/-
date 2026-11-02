import {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    AttachmentBuilder,
    MessageFlags,
    EmbedBuilder,
} from 'discord.js';
import path from 'node:path';
import fsSync from 'node:fs';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const SERVERINFO_IMAGE_PATH = path.resolve(
    process.cwd(),
    'assets',
    'serverinfo',
    'serverinfo.jpg',
);

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

        const hasImage = fsSync.existsSync(SERVERINFO_IMAGE_PATH);
        const files = hasImage
            ? [new AttachmentBuilder(SERVERINFO_IMAGE_PATH, { name: 'serverinfo.jpg' })]
            : [];

        const container = new ContainerBuilder()
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

        if (hasImage) {
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            );
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://serverinfo.jpg')
                )
            );
        }

        try {
            await InteractionHelper.safeEditReply(interaction, {
                content: null,
                embeds: [],
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                files,
            });
        } catch (v2Error) {
            logger.warn('Failed to send ServerInfo with Components V2, falling back to Embed:', v2Error);
            const fallbackEmbed = new EmbedBuilder()
                .setTitle(`SERVER INFO: ${guild.name}`)
                .setDescription(bodyContent);

            if (hasImage) {
                fallbackEmbed.setImage('attachment://serverinfo.jpg');
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [fallbackEmbed],
                components: [],
                files,
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