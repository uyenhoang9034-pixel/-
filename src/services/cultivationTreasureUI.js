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
  getActiveTalisman,
  getAncientTalismanQuantity,
  getCultivationTalisman,
  getCultivationTalismanList,
} from './cultivationTreasure.js';

const SEPARATOR =
  '꒷꒦︶꒷꒦︶ ๋ ࣭ ⭑꒷꒦';

const NEW_BUTTON_EMOJI = {
  id:
    '1546092721012342804',
};

const USE_BUTTON_EMOJI = {
  id:
    '1546089838128791663',
};

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

/**
 * =========================================================
 * BÍ BẢO DASHBOARD
 * =========================================================
 */

export function buildTreasureEmbed(
  user,
  profile,
) {
  const active =
    getActiveTalisman(
      profile,
    );

  const quantity =
    getAncientTalismanQuantity(
      profile,
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> BÍ BẢO · 秘宝 <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,

          '',

          SEPARATOR,

          '',

          '<a:trangtrig18:1546068102817775626> **Bí Bảo Hiện Có**',

          `Thượng Cổ Phù: **${quantity}**`,

          '',

          '<a:trangtrig18:1546068102817775626> **Phù Hiệu Đang Kích Hoạt**',

          active
            ? `**${active.name}**\n${active.effect}`
            : '**Chưa Có**',

          '',

          SEPARATOR,

          '',

          '*Một đạo cổ phù, có thể nghịch chuyển một phần thiên cơ.*',
        ].join(
          '\n',
        ),
      ),
  );
}

/**
 * =========================================================
 * BÍ BẢO COMPONENTS
 * =========================================================
 */

export function buildTreasureRows(
  ownerId,
  profile,
) {
  const active =
    getActiveTalisman(
      profile,
    );

  const rows = [];

  /**
   * Nếu chưa có phù active thì
   * mới cho chọn phù mới.
   */

  if (!active) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `tutien_talisman_select:${ownerId}`,
            )
            .setPlaceholder(
              'Chọn Phù Hiệu muốn kích hoạt',
            )
            .setMinValues(
              1,
            )
            .setMaxValues(
              1,
            )
            .addOptions(
              getCultivationTalismanList()
                .map(
                  (
                    talisman,
                  ) => ({
                    label:
                      talisman.name,

                    value:
                      talisman.id,

                    description:
                      talisman.effect.slice(
                        0,
                        100,
                      ),
                  }),
                ),
            ),
        ),
    );
  }

  rows.push(
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
            NEW_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  );

  return rows;
}

/**
 * =========================================================
 * CONFIRM
 * =========================================================
 */

export function buildTalismanConfirmEmbed(
  user,
  profile,
  talismanId,
) {
  const talisman =
    getCultivationTalisman(
      talismanId,
    );

  if (!talisman) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> KHÔNG TÌM THẤY PHÙ HIỆU',
        ),
    );
  }

  const quantity =
    getAncientTalismanQuantity(
      profile,
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        `<a:trangtrig18:1546068102817775626> ${talisman.name.toUpperCase()}`,
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,

          '',

          '**Hiệu Quả**',

          `**${talisman.effect}**`,

          '',

          '<a:trangtrig18:1546068102817775626> **Cần**',

          'Thượng Cổ Phù: **1**',

          `Hiện Có: **${quantity}**`,

          '',

          SEPARATOR,

          '',

          `*${talisman.description}*`,
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildTalismanConfirmRows(
  ownerId,
  talismanId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:talisman_activate:${talismanId}`,
          )
          .setLabel(
            'Kích Hoạt',
          )
          .setEmoji(
            USE_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:treasure`,
          )
          .setLabel(
            'Quay lại',
          )
          .setEmoji(
            NEW_BUTTON_EMOJI,
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

export function buildTalismanResultEmbed(
  result,
) {
  /**
   * Đang có phù khác.
   */

  if (
    !result.ok &&
    result.reason ===
      'talisman_active'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> PHÙ LỰC CHƯA TIÊU TÁN',
        )
        .setDescription(
          [
            `<a:bang2:1546891483250954290> **${result.activeTalisman.name}** vẫn đang được kích hoạt.`,

            '',

            SEPARATOR,

            '',

            result
              .activeTalisman
              .effect,

            '',

            '*Hãy chờ phù hiệu hiện tại phát huy tác dụng trước khi kích hoạt Thượng Cổ Phù khác.*',
          ].join(
            '\n',
          ),
        ),
    );
  }

  /**
   * Không đủ Thượng Cổ Phù.
   */

  if (
    !result.ok &&
    result.reason ===
      'not_enough_material'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> KHÔNG ĐỦ THƯỢNG CỔ PHÙ',
        )
        .setDescription(
          [
            '<a:bang2:1546891483250954290> Đạo hữu hiện không có đủ Thượng Cổ Phù.',

            '',

            SEPARATOR,

            '',

            '<a:trangtrig18:1546068102817775626> Cần: **1**',

            `<a:trangtrig18:1546068102817775626> Hiện Có: **${result.available}**`,
          ].join(
            '\n',
          ),
        ),
    );
  }

  /**
   * Generic fail.
   */

  if (!result.ok) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> KHÔNG THỂ KÍCH HOẠT',
        )
        .setDescription(
          'Thượng Cổ Phù không thể kích hoạt vào lúc này.',
        ),
    );
  }

  /**
   * Success.
   */

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> CỔ PHÙ KÍCH HOẠT <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          'Kim quang từ cổ phù hóa thành đạo văn, chậm rãi nhập vào khí hải.',

          '',

          SEPARATOR,

          '',

          `<a:hamsterg2:1546057566209974292> Kích Hoạt: **${result.talisman.name}**`,

          '<a:trangtrig18:1546068102817775626> Thượng Cổ Phù: **-1**',

          '',

          '**Hiệu Quả**',

          result.talisman.effect,

          '',

          `*${result.talisman.description}*`,
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildTalismanResultRows(
  ownerId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:treasure`,
          )
          .setLabel(
            'Bí Bảo',
          )
          .setEmoji(
            NEW_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:dashboard`,
          )
          .setLabel(
            'Tiên Lộ',
          )
          .setEmoji(
            NEW_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}
