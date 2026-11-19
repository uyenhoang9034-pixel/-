import {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    EmbedBuilder,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { hasRoleTier, ROLE_IDS } from '../../config/commands/roleAccess.js';

export default {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Get detailed information about a user")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The user to inspect (defaults to you)"),
        )
        .setDMPermission(false),
    category: "Utility",

    async execute(interaction) {
        const targetOption = interaction.options.getUser("target");
        const isViewingOther = Boolean(targetOption && targetOption.id !== interaction.user.id);

        if (isViewingOther) {
            const canViewOther = hasRoleTier(interaction.member, 'MID_ADMIN', interaction.guild, interaction.user);
            if (!canViewOther) {
                return await replyUserError(interaction, {
                    type: ErrorTypes.PERMISSION,
                    message: `Chỉ role <@&${ROLE_IDS.MID_ADMIN}> (hoặc cấp quản trị cao hơn) mới có quyền xem thông tin của người khác.`,
                    context: { source: 'userinfo.execute', commandName: 'userinfo' }
                });
            }
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`UserInfo interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'userinfo'
            });
            return;
        }

        const user = targetOption || interaction.user;
        let member = null;
        if (interaction.guild) {
            member = interaction.guild.members.cache.get(user.id)
                || await interaction.guild.members.fetch(user.id).catch(() => null);
        }

        const createdTimestamp = Math.floor(user.createdAt.getTime() / 1000);
        const joinedTimestamp = member?.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;

        const roles = member?.roles?.cache
            ? member.roles.cache.filter((r) => r.id !== interaction.guildId && r.name !== '@everyone')
            : null;

        let roleNames = roles && roles.size > 0
            ? roles
                .sort((a, b) => b.position - a.position)
                .map((r) => r.name)
                .join(', ')
            : 'None';

        if (roleNames.length > 3000) {
            roleNames = roleNames.slice(0, 2997) + '...';
        }

        const titleText = `<a:trangtrig2:1546040703375904801> **USER INFO: ${user.username}** <a:trangtrig3:1546040818261954610>`;

        const bodyContent = [
            `<a:heartg8:1567818755793358928> Member: <@${user.id}> | ID: ${user.id}`,
            `<a:heartg8:1567818755793358928> Roles: ${roleNames}`,
            '',
            `<a:trangtrig31:1546905996893626440> Account Created: <t:${createdTimestamp}:R>`,
            `<a:trangtrig31:1546905996893626440> Joined Server: ${joinedTimestamp ? `<t:${joinedTimestamp}:R>` : 'Chưa tham gia'}`,
        ].join('\n');

        const avatarUrl = user.displayAvatarURL({ size: 1024, extension: 'png', forceStatic: false }) || user.defaultAvatarURL;

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

        if (avatarUrl) {
            container.addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
            );
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(avatarUrl)
                )
            );
        }

        try {
            await InteractionHelper.safeEditReply(interaction, {
                content: null,
                embeds: [],
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (v2Error) {
            logger.warn('Failed to send UserInfo with Components V2, falling back to Embed:', v2Error);
            const fallbackEmbed = new EmbedBuilder()
                .setTitle(`USER INFO: ${user.username}`)
                .setDescription(bodyContent);

            if (avatarUrl) {
                fallbackEmbed.setImage(avatarUrl);
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [fallbackEmbed],
                components: [],
            });
        }

        logger.info(`UserInfo command executed`, {
            userId: interaction.user.id,
            targetUserId: user.id,
            guildId: interaction.guildId
        });
    },
};
