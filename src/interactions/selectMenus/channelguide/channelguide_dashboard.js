import { MessageFlags } from 'discord.js';

import {
    getChannelGuideConfig,
} from '../../../services/channelguide/channelGuideService.js';

import {
    getDashboardSession,
    showChannelGuideDashboard,
} from '../../../commands/Community/modules/channelguide_dashboard.js';

export default {
    name: 'channelguide_dashboard_select',

    async execute(interaction, client, args) {
        const sessionId = args[0];
        const session = getDashboardSession(sessionId);

        if (!session) {
            return interaction.reply({
                content:
                    '❌ Phiên Channel Guide đã hết hạn. Hãy chạy lại `/channelguide setup`.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (interaction.user.id !== session.userId) {
            return interaction.reply({
                content:
                    '❌ Dashboard này không thuộc về bạn.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const config =
            await getChannelGuideConfig(
                client,
                interaction.guild.id,
            );

        const guideId =
            interaction.values[0];

        const guide =
            config.guides.find(
                item =>
                    item.id === guideId,
            );

        if (!guide) {
            return interaction.reply({
                content:
                    '❌ Không tìm thấy guide này.',
                flags: MessageFlags.Ephemeral,
            });
        }

        session.selectedGuideId =
            guide.id;

        await interaction.deferUpdate();

        await showChannelGuideDashboard(
            interaction,
            client,
            session,
        );
    },
};
