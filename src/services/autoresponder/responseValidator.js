const MAX_CONTENT_LENGTH = 2000;
const MAX_EMBEDS = 10;
const MAX_FILES = 10;
const MAX_BUTTONS = 20;

export function normalizeAutoresponderResponse(response = {}) {
    return {
        content:
            typeof response.content === 'string'
                ? response.content
                : '',

        embeds:
            Array.isArray(response.embeds)
                ? response.embeds
                : [],

        files:
            Array.isArray(response.files)
                ? response.files
                : [],

        buttons:
            Array.isArray(response.buttons)
                ? response.buttons
                : [],

        allowedMentions:
            response.allowedMentions &&
            typeof response.allowedMentions === 'object'
                ? response.allowedMentions
                : {
                    parse: [],
                },

        reply:
            response.reply &&
            typeof response.reply === 'object'
                ? {
                    enabled:
                        response.reply.enabled === true,
                    mentionAuthor:
                        response.reply.mentionAuthor === true,
                }
                : {
                    enabled: false,
                    mentionAuthor: false,
                },
    };
}

export function validateAutoresponderResponse(
    rawResponse,
) {
    const response =
        normalizeAutoresponderResponse(
            rawResponse,
        );

    if (
        response.content.length >
        MAX_CONTENT_LENGTH
    ) {
        return {
            valid: false,
            error:
                `Nội dung không được vượt quá ${MAX_CONTENT_LENGTH} ký tự.`,
        };
    }

    if (
        response.embeds.length >
        MAX_EMBEDS
    ) {
        return {
            valid: false,
            error:
                `Một response chỉ được có tối đa ${MAX_EMBEDS} embeds.`,
        };
    }

    if (
        response.files.length >
        MAX_FILES
    ) {
        return {
            valid: false,
            error:
                `Một response chỉ được có tối đa ${MAX_FILES} files.`,
        };
    }

    if (
        response.buttons.length >
        MAX_BUTTONS
    ) {
        return {
            valid: false,
            error:
                `Một response chỉ được có tối đa ${MAX_BUTTONS} buttons.`,
        };
    }

    for (const button of response.buttons) {
        if (!button?.label) {
            return {
                valid: false,
                error: 'Button phải có tên.',
            };
        }

        if (button.label.length > 80) {
            return {
                valid: false,
                error:
                    'Tên button không được vượt quá 80 ký tự.',
            };
        }

        if (
            ![
                'primary',
                'secondary',
                'success',
                'danger',
                'link',
            ].includes(button.style)
        ) {
            return {
                valid: false,
                error:
                    'Button style không hợp lệ.',
            };
        }

if (
    button.style === 'link' &&
    !button.url
) {
    return {
        valid: false,
        error:
            'Link button phải có URL.',
    };
}

if (
    button.style !== 'link' &&
    !button.customId
) {
    return {
        valid: false,
        error:
            'Button không phải link phải có customId.',
    };
}
    }

    const hasContent =
        Boolean(response.content) ||
        response.embeds.length > 0 ||
        response.files.length > 0;

    if (!hasContent) {
        return {
            valid: false,
            error:
                'Response phải có ít nhất content, embed hoặc file.',
        };
    }

    return {
        valid: true,
        response,
    };
}
