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
             * Không xử lý reaction của bot.
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
                        'Could not fetch partial reaction:',
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
             * Chỉ xử lý reaction trên panel
             * Game Role do bot quản lý.
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
             * ADD ROLE
             * =================================================
             */

            await addGameRoleFromReaction(
                reaction,
                user,
            );

        } catch (error) {
            logger.error(
                'Error in messageReactionAdd game role event:',
                error,
            );
        }
    },
};
