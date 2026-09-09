import {
    Events,
} from 'discord.js';

import {
    isGameRolePanelReaction,
    removeGameRoleFromReaction,
} from '../services/gameRoleService.js';

import {
    logger,
} from '../utils/logger.js';


export default {

    name:
        Events.MessageReactionRemove,

    once:
        false,


    async execute(
        reaction,
        user,
        client,
    ) {
        try {

            /**
             * Không xử lý bot.
             */

            if (
                !user ||
                user.bot
            ) {
                return;
            }


            /**
             * =================================================
             * PARTIAL REACTION
             * =================================================
             */

            if (
                reaction.partial
            ) {
                try {
                    await reaction.fetch();

                } catch (error) {
                    logger.warn(
                        'Could not fetch partial removed reaction:',
                        error,
                    );

                    return;
                }
            }


            /**
             * =================================================
             * PARTIAL MESSAGE
             * =================================================
             */

            if (
                reaction.message?.partial
            ) {
                try {
                    await reaction.message.fetch();

                } catch (error) {
                    logger.warn(
                        'Could not fetch partial reaction message:',
                        error,
                    );

                    return;
                }
            }


            /**
             * Chỉ xử lý panel Game Role.
             */

            const isPanel =
                await isGameRolePanelReaction(
                    reaction,
                    client,
                );

            if (
                !isPanel
            ) {
                return;
            }


            /**
             * =================================================
             * REMOVE ROLE
             * =================================================
             */

            await removeGameRoleFromReaction(
                reaction,
                user,
            );

        } catch (error) {
            logger.error(
                'Error in messageReactionRemove game role event:',
                error,
            );
        }
    },
};
