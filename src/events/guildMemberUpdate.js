import {
    Events,
} from 'discord.js';

import {
    handleBoostStarted,
    handleBoostEnded,
} from '../services/boost/boostService.js';

import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

import {
    logger,
} from '../utils/logger.js';


export default {
    name: Events.GuildMemberUpdate,

    once: false,

    async execute(
        oldMember,
        newMember,
    ) {
        try {
            if (
                !newMember?.guild
            ) {
                return;
            }


            // ==================================================
            // NICKNAME CHANGE
            // ==================================================

            if (
                oldMember.nickname !==
                newMember.nickname
            ) {
                await logEvent({
                    client:
                        newMember.client,

                    guildId:
                        newMember.guild.id,

                    eventType:
                        EVENT_TYPES.MEMBER_NAME_CHANGE,

                    data: {
                        title:
                            'Nickname changed',

                        lines: [
                            `**User:** ${newMember.user.toString()} (${newMember.user.tag})`,

                            `**ID:** \`${newMember.user.id}\``,

                            `**Before:** ${
                                oldMember.nickname ||
                                '*(no nickname)*'
                            }`,

                            `**After:** ${
                                newMember.nickname ||
                                '*(no nickname)*'
                            }`,
                        ],

                        thumbnail:
                            newMember.user.displayAvatarURL({
                                dynamic: true,
                            }),

                        userId:
                            newMember.user.id,
                    },
                });
            }


            // ==================================================
            // BOOST DETECTION
            // ==================================================

            const wasBoosting =
                Boolean(
                    oldMember.premiumSince,
                );

            const isBoosting =
                Boolean(
                    newMember.premiumSince,
                );


            // ==================================================
            // BOOST STARTED
            // ==================================================

            if (
                !wasBoosting &&
                isBoosting
            ) {
                await handleBoostStarted(
                    newMember,
                );
            }


            // ==================================================
            // BOOST ENDED
            // ==================================================

            if (
                wasBoosting &&
                !isBoosting
            ) {
                await handleBoostEnded(
                    newMember,
                );
            }

        } catch (error) {
            logger.error(
                'Error in guildMemberUpdate event:',
                error,
            );
        }
    },
};
