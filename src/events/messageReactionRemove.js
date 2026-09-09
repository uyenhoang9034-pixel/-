import {
    Events,
} from 'discord.js';

import {
    removeGameRoleFromReaction,
} from '../services/gameRoleService.js';

import {
    getGameRoleByEmoji,
} from '../config/gameRoles.js';

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
                        'GameRole: failed to fetch partial removed reaction:',
                        error,
                    );

                    return;
                }
            }


            let message =
                reaction.message;


            try {
                message =
                    await reaction.message.fetch();
            } catch (error) {
                logger.warn(
                    'GameRole: failed to fetch removed reaction message:',
                    error,
                );

                return;
            }


            const config =
                getGameRoleByEmoji(
                    reaction.emoji,
                );


            if (!config) {
                return;
            }


            if (
                !message.guild
            ) {
                return;
            }


            if (
                message.author?.id !==
                client.user?.id
            ) {
                return;
            }


            const title =
                message.embeds?.[0]?.title ??
                '';


            if (
                !title.includes(
                    '𝓖𝓸́𝓬 𝓵𝓪̂́𝔂 𝓻𝓸𝓵𝓮',
                )
            ) {
                return;
            }


            logger.info(
                `[GAME ROLE] Reaction removed | ${user.tag ?? user.id} -> ${config.label}`,
            );


            const success =
                await removeGameRoleFromReaction(
                    reaction,
                    user,
                );


            if (
                success
            ) {
                logger.info(
                    `[GAME ROLE] Role removed | ${user.tag ?? user.id} -> ${config.label}`,
                );
            }

        } catch (error) {
            logger.error(
                '[GAME ROLE] Unexpected error in messageReactionRemove:',
                error,
            );
        }
    },
};
