import {
    Events,
} from 'discord.js';

import {
    handleBoostStarted,
    handleBoostEnded,
} from '../services/boost/boostService.js';

import {
    GAME_ROLE_IDS,
} from '../config/gameRoles.js';

import {
    sendGameRoleNotification,
} from '../services/gameRoleService.js';

import {
    logEvent,
    EVENT_TYPES,
} from '../services/loggingService.js';

import {
    logger,
} from '../utils/logger.js';


export default {

    name:
        Events.GuildMemberUpdate,

    once:
        false,


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
                                dynamic:
                                    true,
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


            // ==================================================
            // GAME ROLE ADDED
            // ==================================================
            //
            // Không quan tâm role được cấp từ đâu.
            //
            // Có thể là:
            //
            // - Reaction Get Role
            // - Admin cấp trực tiếp
            // - Mod cấp trực tiếp
            // - Command khác cấp role
            //
            // Miễn là một game role xuất hiện trong newMember
            // nhưng chưa có trong oldMember -> gửi notification.
            //

            if (
                !newMember.user?.bot
            ) {
                const addedGameRoleIds =
                    GAME_ROLE_IDS.filter(
                        (
                            roleId,
                        ) =>
                            !oldMember.roles.cache.has(
                                roleId,
                            ) &&
                            newMember.roles.cache.has(
                                roleId,
                            ),
                    );


                /**
                 * Nếu cùng lúc được cấp nhiều role:
                 *
                 * mỗi role gửi một notification riêng,
                 * đúng ảnh riêng của role đó.
                 */

                for (
                    const roleId
                    of addedGameRoleIds
                ) {
                    try {
                        await sendGameRoleNotification(
                            newMember,
                            roleId,
                        );

                    } catch (error) {
                        logger.error(
                            `Failed to process game role notification for ${newMember.user.tag}, role ${roleId}:`,
                            error,
                        );
                    }
                }
            }

        } catch (error) {
            logger.error(
                'Error in guildMemberUpdate event:',
                error,
            );
        }
    },
};
