import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../config/cultivationGame.js';

import {
  getAlchemyIngredientQuantity,
  getAlchemyRecipe,
  getAlchemyRecipes,
} from './cultivationAlchemy.js';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const SEPARATOR =
  '꒷꒦︶꒷꒦︶ ๋ ࣭ ⭑꒷꒦';

const GAME_BUTTON_EMOJI = {
  id:
    CULTIVATION_CONFIG
      .ui
      .buttonEmojiId,
};

const USE_BUTTON_EMOJI = {
  id:
    '1546089838128791663',
};

/**
 * =========================================================
 * STYLE
 * =========================================================
 */

function applyStyle(
  embed,
) {
  embed.setColor(
    CULTIVATION_CONFIG
      .ui
      .color,
  );

  embed.setFooter({
    text:
      CULTIVATION_CONFIG
        .ui
        .footer,
  });

  /**
   * Giữ cùng ảnh Tiên Lộ hiện tại.
   */

  if (
    CULTIVATION_CONFIG
      .ui
      .image
  ) {
    embed.setImage(
      CULTIVATION_CONFIG
        .ui
        .image,
    );
  }

  return embed;
}

function formatPercent(
  chance,
) {
  return `${Math.round(
    Number(
      chance || 0,
    ) * 100,
  )}%`;
}

/**
 * =========================================================
 * MAIN ALCHEMY EMBED
 * =========================================================
 */

export function buildAlchemyEmbed(
  user,
  profile,
) {
  const herbQuantity =
    Math.max(
      0,
      Number(
        profile.inventory
          ?.thien_linh_thao,
      ) || 0,
    );

  const recipeLines =
    getAlchemyRecipes()
      .map(
        (recipe) =>
          [
            `**${recipe.name}**`,

            `Cần: **${recipe.ingredientAmount} Thiên Linh Thảo**`,

            `Tỷ lệ thành công: **${formatPercent(
              recipe.successChance,
            )}**`,
          ].join(
            '\n',
          ),
      )
      .join(
        '\n\n',
      );

  const embed =
    new EmbedBuilder()
      .setTitle(
        'ĐAN LÔ · 炼丹',
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> **Đạo Hữu**: <@${user.id}>`,

          '',

          SEPARATOR,

          '',

          '<a:trangtrig33:1546908181060526130> **Nguyên Liệu Hiện Có**',

          `Thiên Linh Thảo: **${herbQuantity}**`,

          '',

          '<a:trangtrig34:1547237010572582982> **Đan Phương Có Thể Luyện**',

          '',

          recipeLines,
        ].join(
          '\n',
        ),
      );

  return applyStyle(
    embed,
  );
}

/**
 * =========================================================
 * MAIN COMPONENTS
 * =========================================================
 */

export function buildAlchemyRows(
  ownerId,
  profile,
) {
  const options =
    getAlchemyRecipes()
      .map(
        (recipe) => {
          const available =
            getAlchemyIngredientQuantity(
              profile,
              recipe,
            );

          return {
            label:
              recipe.name,

            value:
              recipe.id,

            description:
              [
                `Cần ${recipe.ingredientAmount} Linh Thảo`,
                `Có ${available}`,
                formatPercent(
                  recipe.successChance,
                ),
              ]
                .join(
                  ' · ',
                )
                .slice(
                  0,
                  100,
                ),
          };
        },
      );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        `tutien_alchemy_select:${ownerId}`,
      )
      .setPlaceholder(
        'Chọn Đan Dược muốn luyện',
      )
      .setMinValues(
        1,
      )
      .setMaxValues(
        1,
      )
      .addOptions(
        options,
      );

  return [
    new ActionRowBuilder()
      .addComponents(
        menu,
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:dashboard`,
          )
          .setLabel(
            'Quay lại Tiên Lộ',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}

/**
 * =========================================================
 * CONFIRM EMBED
 * =========================================================
 */

export function buildAlchemyConfirmEmbed(
  user,
  profile,
  recipeId,
) {
  const recipe =
    getAlchemyRecipe(
      recipeId,
    );

  if (!recipe) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          'KHÔNG TÌM THẤY ĐAN PHƯƠNG',
        )
        .setDescription(
          '<a:angryg1:1541441195144773652> Đan phương này không tồn tại.',
        ),
    );
  }

  const available =
    getAlchemyIngredientQuantity(
      profile,
      recipe,
    );

  const embed =
    new EmbedBuilder()
      .setTitle(
        `LUYỆN ${recipe.name.toUpperCase()}`,
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> **Đạo Hữu**: <@${user.id}>`,

          '',

          `<a:trangtrig33:1546908181060526130> **Thiên Linh Thảo**: ${available}`,

          `<a:trangtrig33:1546908181060526130> **Cần**: ${recipe.ingredientAmount}`,

          '',

          `<a:trangtrig19:1546068350030053406> **Tỷ Lệ Thành Công**: ${formatPercent(
            recipe.successChance,
          )}`,

          '',

          SEPARATOR,

          '',

          '*Một lò đan thành hay bại, chỉ cách nhau một tia hỏa hậu.*',
        ].join(
          '\n',
        ),
      );

  return applyStyle(
    embed,
  );
}

/**
 * =========================================================
 * CONFIRM BUTTONS
 * =========================================================
 */

export function buildAlchemyConfirmRows(
  ownerId,
  recipeId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:alchemy_make:${recipeId}`,
          )
          .setLabel(
            'Luyện Đan',
          )
          .setEmoji(
            USE_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:alchemy`,
          )
          .setLabel(
            'Quay lại Đan Lô',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}

/**
 * =========================================================
 * RESULT
 * =========================================================
 */

export function buildAlchemyResultEmbed(
  result,
) {
  /**
   * Không đủ Linh Thảo.
   */

  if (
    !result.ok &&
    result.reason ===
      'not_enough_material'
  ) {
    const embed =
      new EmbedBuilder()
        .setTitle(
          'NGUYÊN LIỆU KHÔNG ĐỦ',
        )
        .setDescription(
          [
            '<a:angryg1:1541441195144773652> **KHÔNG THỂ KHAI LÒ**',

            '<a:bang2:1546891483250954290> Linh thảo trong Túi Đồ chưa đủ để luyện đan.',

            '',

            SEPARATOR,

            '',

            `<a:trangtrig33:1546908181060526130> **Hiện Có**: ${result.available}`,

            `<a:trangtrig33:1546908181060526130> **Cần**: ${result.recipe.ingredientAmount}`,
          ].join(
            '\n',
          ),
        );

    return applyStyle(
      embed,
    );
  }

  /**
   * Lỗi khác.
   */

  if (!result.ok) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          'LUYỆN ĐAN KHÔNG THÀNH',
        )
        .setDescription(
          '<a:angryg1:1541441195144773652> Không thể tiến hành luyện đan.',
        ),
    );
  }

  /**
   * Thành công.
   */

  if (
    result.success
  ) {
    const embed =
      new EmbedBuilder()
        .setTitle(
          'ĐAN THÀNH',
        )
        .setDescription(
          [
            '<a:trangtrig2:1546040703375904801> **ĐAN THÀNH** <a:trangtrig3:1546040818261954610>',

            '',

            'Linh hỏa dần tắt, đan hương lan khắp động phủ.',

            '',

            SEPARATOR,

            '',

            `<a:trangtrig34:1547237010572582982> **Nhận Được**: ${result.resultItem.name} ×1`,

            `<a:trangtrig33:1546908181060526130> **Thiên Linh Thảo**: -${result.consumed}`,

            '',

            '*Đan văn ngưng tụ, dược lực viên mãn.*',
          ].join(
            '\n',
          ),
        );

    return applyStyle(
      embed,
    );
  }

  /**
   * Thất bại.
   */

  const embed =
    new EmbedBuilder()
      .setTitle(
        'LUYỆN ĐAN THẤT BẠI',
      )
      .setDescription(
        [
          '<a:angryg1:1541441195144773652> **LUYỆN ĐAN THẤT BẠI**',

          '',

          '<a:bang2:1546891483250954290> Hỏa hậu mất cân bằng, linh dược hóa thành tro bụi.',

          '',

          SEPARATOR,

          '',

          `<a:trangtrig33:1546908181060526130> **Thiên Linh Thảo**: -${result.consumed}`,

          '',

          '*Đan đạo vốn khó, một lần thất bại chưa thể đoạn tiên tâm.*',
        ].join(
          '\n',
        ),
      );

  return applyStyle(
    embed,
  );
}

/**
 * =========================================================
 * RESULT BUTTONS
 * =========================================================
 */

export function buildAlchemyResultRows(
  ownerId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:alchemy`,
          )
          .setLabel(
            'Quay lại Đan Lô',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:dashboard`,
          )
          .setLabel(
            'Quay lại Tiên Lộ',
          )
          .setEmoji(
            GAME_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}
