import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';

import {
    normalizeAutoresponderResponse,
    validateAutoresponderResponse,
} from './responseValidator.js';
export function buildEmbedFromData(
    data,
) {
    return buildEmbed(data);
}
