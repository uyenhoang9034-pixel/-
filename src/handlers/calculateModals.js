import { EmbedBuilder } from 'discord.js';
import { successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { evaluateMathExpression } from '../utils/safeMathParser.js';

import { replyUserError, ErrorTypes } from '../utils/errorHandler.js';
function evaluate(expression) {
    return evaluateMathExpression(expression);
}

async function calculateModalHandler(interaction, client, args) {
    try {
        const operation = args[0];
        const operandField =
            interaction.fields.fields?.first?.() ||
            interaction.fields.components?.[0]?.components?.[0];
        const contextKey =
            operandField?.customId?.split(':')[1] ||
            `${interaction.user.id}_${operation}`;
        
        if (!contextKey) {
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to retrieve calculation context.' });
        }

        const { calculationContexts, calculationHistory, MAX_HISTORY } = await import('../commands/Tools/calculate.js');
        const context = calculationContexts.get(contextKey);
        
        if (!context) {
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Phép tính này đã hết hạn. Vui lòng thực hiện phép tính mới.' });
        }

        await interaction.deferReply({ ephemeral: false });

        const operand =
            operandField?.value ||
            (operandField?.customId ? interaction.fields.getTextInputValue(operandField.customId) : null);
        
        if (!operand || isNaN(operand)) {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Vui lòng nhập một con số hợp lệ.' });
        }

        const { expression, formattedResult, operator } = context;
        const newExpression = `(${expression}) ${operator} (${operand})`;

        let newResult;
        try {
            newResult = evaluate(newExpression);
            
            let formattedNewResult;
            if (typeof newResult === "number") {
                formattedNewResult = newResult.toLocaleString("en-US", {
                    maximumFractionDigits: 10,
                });

                if (
                    Math.abs(newResult) > 0 &&
                    (Math.abs(newResult) >= 1e10 || Math.abs(newResult) < 1e-3)
                ) {
                    formattedNewResult = newResult.toExponential(6);
                }
            } else {
                formattedNewResult = String(newResult);
            }

            const updatedEmbed = new EmbedBuilder()
                .setTitle("CALCULATION RESULT")
                .setDescription(
                    `<a:linhtocg:1563399670351536310> **Biểu thức:** \`${newExpression.replace(/`/g, "\`")}\`\n` +
                        `<a:linhtocg:1563399670351536310> **Kết quả:** \`${formattedNewResult}\`\n\n` +
                        `*Sử dụng các nút bên dưới để thực hiện các thao tác tính toán.*`,
                );

            try {
                if (context.messageId && context.channelId) {
                    const channel = await client.channels.fetch(context.channelId);
                    const message = await channel.messages.fetch(context.messageId);
                    await message.edit({
                        embeds: [updatedEmbed],
                    });
                }
            } catch (editError) {
                logger.warn('Could not edit original message:', editError.message);
            }

            if (context.currentCalculation) {
                context.currentCalculation.expression = newExpression;
                context.currentCalculation.formattedResult = formattedNewResult;
            }

            if (calculationHistory) {
                const userHistory = calculationHistory.get(interaction.user.id);
                if (userHistory) {
                    userHistory.unshift({
                        expression: newExpression,
                        result: formattedNewResult,
                        timestamp: Date.now(),
                    });
                    if (userHistory.length > (MAX_HISTORY || 5)) {
                        userHistory.pop();
                    }
                }
            }

            calculationContexts.delete(contextKey);

            await interaction.editReply({
                embeds: [successEmbed('✅ Calculated', `\`${newExpression}\` = \`${formattedNewResult}\``)],
            });

        } catch (calcError) {
            logger.error('Calculate evaluation error:', calcError);
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to evaluate the expression.' });
        }
    } catch (error) {
        logger.error('Calculate modal handler error:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An error occurred processing your calculation.' });
            } else {
                await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An error occurred processing your calculation.' });
            }
        } catch (err) {
            logger.error('Failed to send error message:', err);
        }
    }
}

export default {
    execute: calculateModalHandler
};