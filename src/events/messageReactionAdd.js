import {
    Events,
} from 'discord.js';

import {
    addGameRoleFromReaction,
} from '../services/gameRoleService.js';

import {
    getGameRoleByEmoji,
} from '../config/gameRoles.js';

import {
    logger,
} from '../utils/logger.js';


export default {

    name:
        Events.MessageReactionAdd,

    once:
        false,


    async execute(
        reaction,
        user,
        client,
    ) {
        try {

            if (
                !user ||
                user.bot
            ) {
                return;
            }


            /**
             * =============================================
             * FETCH REACTION
             * =============================================
             */

            if (
                reaction.partial
            ) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    logger.warn(
                        'GameRole: failed to fetch partial reaction:',
                        error,
                    );

                    return;
                }
            }


            /**
             * =============================================
             * FETCH FULL MESSAGE
             * =============================================
             */

            let message =
                reaction.message;


            try {
                message =
                    await reaction.message.fetch();
            } catch (error) {
                logger.warn(
                    'GameRole: failed to fetch reaction message:',
                    error,
                );

                return;
            }


            /**
             * =============================================
             * DEBUG - EVENT ĐÃ CHẠY
             * =============================================
             */

            logger.info(
                `[GAME ROLE] ReactionAdd fired | user=${user.tag ?? user.id} | message=${message.id} | emoji=${reaction.emoji.name} | emojiId=${reaction.emoji.id ?? 'unicode'}`,
            );


            /**
             * =============================================
             * CHECK EMOJI
             * =============================================
             */

            const config =
                getGameRoleByEmoji(
                    reaction.emoji,
                );


            if (!config) {
                logger.debug(
                    `[GAME ROLE] Ignored unmapped emoji ${reaction.emoji.id ?? reaction.emoji.name}`,
                );

                return;
            }


            /**
             * =============================================
             * MESSAGE PHẢI Ở SERVER
             * =============================================
             */

            if (
                !message.guild
            ) {
                return;
            }


            /**
             * =============================================
             * MESSAGE PHẢI DO BOT NÀY GỬI
             * =============================================
             */

            if (
                message.author?.id !==
                client.user?.id
            ) {
                logger.debug(
                    `[GAME ROLE] Message ${message.id} was not sent by this bot.`,
                );

                return;
            }


            /**
             * =============================================
             * CHECK GET ROLE EMBED
             * =============================================
             */

            const embed =
                message.embeds?.[0];


            const title =
                embed?.title ??
                '';


            if (
                !title.includes(
                    '𝓖𝓸́𝓬 𝓵𝓪̂́𝔂 𝓻𝓸𝓵𝓮',
                )
            ) {
                logger.debug(
                    `[GAME ROLE] Message ${message.id} is not a Get Role panel. Title="${title}"`,
                );

                return;
            }


            /**
             * =============================================
             * VALID PANEL
             * =============================================
             */

            logger.info(
                `[GAME ROLE] Valid panel reaction | ${user.tag ?? user.id} -> ${config.label} -> role ${config.roleId}`,
            );


            /**
             * =============================================
             * ADD ROLE
             * =============================================
             */

            const success =
                await addGameRoleFromReaction(
                    reaction,
                    user,
                );


            if (
                success
            ) {
                logger.info(
                    `[GAME ROLE] SUCCESS | ${user.tag ?? user.id} -> ${config.label}`,
                );
            }

            else {
                logger.error(
                    `[GAME ROLE] FAILED | ${user.tag ?? user.id} -> ${config.label}`,
                );
            }

        } catch (error) {
            logger.error(
                '[GAME ROLE] Unexpected error in messageReactionAdd:',
                error,
            );
        }
    },
};
