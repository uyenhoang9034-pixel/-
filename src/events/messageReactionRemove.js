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
            if (
                !user ||
                user.bot
            ) {
                return;
            }


            if (
                reaction.partial
            ) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    logger.warn(
                        'Could not fetch partial MessageReactionRemove reaction:',
                        error,
                    );

                    return;
                }
            }


            if (
                reaction.message?.partial
            ) {
                try {
                    await reaction.message.fetch();
                } catch (error) {
                    logger.warn(
                        'Could not fetch partial MessageReactionRemove message:',
                        error,
                    );

                    return;
                }
            }


            logger.warn(
                `REACTION REMOVED: user=${user.tag ?? user.id}, message=${reaction.message?.id}, emoji=${reaction.emoji?.name}, emojiId=${reaction.emoji?.id ?? 'unicode'}`,
            );


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


            logger.warn(
                `Game Role reaction was removed: ${user.tag ?? user.id} -> ${reaction.emoji?.name}. Role removal will now run.`,
            );


            const removed =
                await removeGameRoleFromReaction(
                    reaction,
                    user,
                );


            if (
                removed
            ) {
                logger.info(
                    `Game Role removal processed for ${user.tag ?? user.id}.`,
                );
            } else {
                logger.warn(
                    `Game Role removal failed for ${user.tag ?? user.id}.`,
                );
            }

        } catch (error) {
            logger.error(
                'Error in MessageReactionRemove Game Role event:',
                error,
            );
        }
    },
};
