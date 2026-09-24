import { EmbedBuilder, MessageFlags } from 'discord.js';
import { getUserBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

const BIRTHDAY_ADMIN_ROLE_ID = '1545305594712432640';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        const requestedUser = interaction.options.getUser('user');
        const isAdmin = interaction.member?.roles?.cache?.has(BIRTHDAY_ADMIN_ROLE_ID);
        const targetUser = requestedUser || interaction.user;

        if (targetUser.id !== interaction.user.id && !isAdmin) {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription('<a:heartg1:1545307544808071258> Bạn chỉ có thể xem thông tin sinh nhật của chính mình.');
            return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        const userId = targetUser.id;
        const guildId = interaction.guildId;
        const birthdayData = await getUserBirthday(client, guildId, userId);

        if (!birthdayData) {
            const embed = new EmbedBuilder()
                .setColor(0xFCEEC9)
                .setDescription(
                    targetUser.id === interaction.user.id
                        ? '<a:heartg1:1545307544808071258> Bạn chưa lưu ngày sinh nhật. Hãy dùng `/birthday set` để thêm.'
                        : `<a:heartg1:1545307544808071258> Chưa có ngày sinh nhật được lưu cho ${targetUser.toString()}.`
                );
            return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        const dateText = birthdayData.year
            ? `${birthdayData.day}/${birthdayData.month}/${birthdayData.year}`
            : `${birthdayData.day}/${birthdayData.month}`;

        const embed = new EmbedBuilder()
            .setColor(0xFCEEC9)
            .setDescription(
                `## <a:trangtrig2:1546040703375904801> **BIRTHDAY INFO** <a:trangtrig3:1546040818261954610>\n` +
                `<a:heartg1:1545307544808071258> **Date:** ${dateText}\n` +
                `<a:heartg1:1545307544808071258> **User:** ${targetUser.toString()}`
            );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

        logger.info('Birthday info retrieved successfully', {
            userId: interaction.user.id,
            targetUserId: targetUser.id,
            guildId,
            commandName: 'birthday_info'
        });
    }
};
