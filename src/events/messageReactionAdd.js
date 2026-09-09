import {
    Events,
} from 'discord.js';

import {
    addGameRoleFromReaction,
    isGameRolePanelReaction,
} from '../services/gameRoleService.js';

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

            /**
             * =================================================
             * IGNORE BOTS
             * =================================================
             */

            if (
                !user ||
                user.bot
            ) {
                return;
            }


            /**
             * =================================================
             * FETCH PARTIAL REACTION
             * =================================================
             */

            if (
                reaction.partial
            ) {
                try {
                    await reaction.fetch();

                } catch (error) {
                    logger.warn(
                        'Could not fetch partial MessageReactionAdd reaction:',
                        error,
                    );

                    return;
                }
            }


            /**
             * =================================================
             * FETCH PARTIAL MESSAGE
             * =================================================
             */

            if (
                reaction.message?.partial
            ) {
                try {
                    await reaction.message.fetch();

                } catch (error) {
                    logger.warn(
                        'Could not fetch partial MessageReactionAdd message:',
                        error,
                    );

                    return;
                }
            }


            /**
             * =================================================
             * DEBUG
             * =================================================
             */

            logger.info(
                `Reaction received: user=${user.tag ?? user.id}, message=${reaction.message?.id}, emoji=${reaction.emoji?.name}, emojiId=${reaction.emoji?.id ?? 'unicode'}`,
            );


            /**
             * =================================================
             * CHECK PANEL
             * =================================================
             */

            const isPanel =
                await isGameRolePanelReaction(
                    reaction,
                    client,
                );


            if (
                !isPanel
            ) {
                logger.debug(
                    `Reaction ignored because message ${reaction.message?.id} is not the active Game Role panel.`,
                );

                return;
            }


            logger.info(
                `Game Role panel reaction detected: ${user.tag ?? user.id} -> ${reaction.emoji?.name}`,
            );


            /**
             * =================================================
             * ADD ROLE
             * =================================================
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
                    `Game Role reaction successfully processed for ${user.tag ?? user.id}.`,
                );
            }

            else {
                logger.warn(
                    `Game Role reaction detected but role assignment failed for ${user.tag ?? user.id}.`,
                );
            }

        } catch (error) {
            logger.error(
                'Error in MessageReactionAdd Game Role event:',
                error,
            );
        }
    },
};
