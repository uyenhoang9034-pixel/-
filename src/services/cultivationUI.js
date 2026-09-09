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
  getBreakthroughChance,
  getCultivationItem,
  getCultivationRequired,
  getInventoryEntries,
  getRealmDisplay,
  getUsableInventoryEntries,
} from './cultivationService.js';

import {
  getEquippedEquipment,
} from './cultivationEquipment.js';

import {
  getActiveTechnique,
} from './cultivationTechnique.js';

import {
  getActiveTalisman,
} from './cultivationTreasure.js';

import {
  getActivePet,
  PET_EMOJI,
} from './cultivationPet.js';

const SEPARATOR =
  '꒷꒦︶꒷꒦︶ ๋ ࣭ ⭑꒷꒦';

export const CULTIVATION_BUTTON_EMOJIS = {
  cultivate: {
    id: '1546070789734924418',
  },

  breakthrough: {
    id: '1546086115210170478',
  },

  adventure: {
    id: '1546072124270055464',
  },

  inventory: {
    id: '1546070876263284807',
  },

  profile: {
    id: '1546070498570539019',
  },

  /**
   * Tiên Bảng giữ emoji cũ.
   */
  leaderboard: {
    id: '1546070728309350421',
  },

  /**
   * Luyện Đan đổi sang dog15.
   */
  alchemy: {
    id: '1546072075821645844',
  },

  forge: {
    id: '1546086548632506459',
  },

  equipment: {
    id: '1546071877586391121',
  },

  technique: {
    id: '1546070442169864193',
  },

  treasure: {
    id: '1546070834471239730',
  },

  /**
   * V2.8 Linh Thú.
   */
  pet: {
    id: '1546070976964333741',
  },
};

function applyStyle(
  embed,
) {
  embed.setColor(
    CULTIVATION_CONFIG.ui.color,
  );

  embed.setFooter({
    text:
      CULTIVATION_CONFIG.ui.footer,
  });

  if (
    CULTIVATION_CONFIG.ui.image
  ) {
    embed.setImage(
      CULTIVATION_CONFIG.ui.image,
    );
  }

  return embed;
}

function number(
  value,
) {
  return new Intl.NumberFormat(
    'vi-VN',
  ).format(
    Math.max(
      0,
      Math.round(
        value || 0,
      ),
    ),
  );
}

function signedNumber(
  value,
) {
  const amount =
    Math.round(
      value || 0,
    );

  if (
    amount > 0
  ) {
    return `+${number(
      amount,
    )}`;
  }

  if (
    amount < 0
  ) {
    return `-${number(
      Math.abs(
        amount,
      ),
    )}`;
  }

  return '+0';
}

function percent(
  value,
) {
  return `${Math.round(
    (
      Number(
        value,
      ) || 0
    ) * 100,
  )}%`;
}

function progressBar(
  current,
  max,
  size = 12,
) {
  if (
    !max ||
    max <= 0
  ) {
    return '░'.repeat(
      size,
    );
  }

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        current / max,
      ),
    );

  const filled =
    Math.round(
      ratio * size,
    );

  return (
    '█'.repeat(
      filled,
    ) +
    '░'.repeat(
      size - filled,
    )
  );
}

function duration(
  ms,
) {
  const seconds =
    Math.max(
      0,
      Math.ceil(
        ms / 1000,
      ),
    );

  const minutes =
    Math.floor(
      seconds / 60,
    );

  const remaining =
    seconds % 60;

  if (
    minutes <= 0
  ) {
    return `${remaining}s`;
  }

  if (
    remaining <= 0
  ) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remaining}s`;
}

function getItemEmoji(
  item,
) {
  if (
    item?.type ===
    'herb'
  ) {
    return (
      CULTIVATION_CONFIG
        .ui
        .itemEmojis
        .herb
    );
  }

  if (
    item?.type ===
    'pill'
  ) {
    return (
      CULTIVATION_CONFIG
        .ui
        .itemEmojis
        .pill
    );
  }

  if (
    item?.type ===
    'ore'
  ) {
    return (
      CULTIVATION_CONFIG
        .ui
        .itemEmojis
        .ore
    );
  }

  return (
    CULTIVATION_CONFIG
      .ui
      .itemEmojis
      .treasure
  );
}

function buildDropText(
  droppedItem,
) {
  if (!droppedItem) {
    return null;
  }

  return [
    '',
    `${CULTIVATION_CONFIG.ui.itemEmojis.received} **VẬT PHẨM NHẬN ĐƯỢC**`,
    `${getItemEmoji(
      droppedItem.item,
    )} **${droppedItem.item.name}** × ${droppedItem.quantity}`,
    `*${droppedItem.item.rarity}*`,
  ].join(
    '\n',
  );
}

function buildEffectsText(
  profile,
) {
  const lines = [];

  const cultivationBonus =
    Math.max(
      0,
      Number(
        profile.effects
          ?.nextCultivationBonus,
      ) || 0,
    );

  const breakthroughBonus =
    Math.max(
      0,
      Number(
        profile.effects
          ?.nextBreakthroughBonus,
      ) || 0,
    );

  if (
    cultivationBonus > 0
  ) {
    lines.push(
      `Tụ Khí Đan: **+${percent(
        cultivationBonus,
      )} Tu Vi lần kế tiếp**`,
    );
  }

  if (
    breakthroughBonus > 0
  ) {
    lines.push(
      `Phá Cảnh Đan: **+${percent(
        breakthroughBonus,
      )} Đột Phá lần kế tiếp**`,
    );
  }

  if (
    lines.length === 0
  ) {
    return null;
  }

  return [
    SEPARATOR,
    '',
    '<a:trangtrig34:1547237010572582982> **Dược Hiệu**',
    ...lines,
  ].join(
    '\n',
  );
}

/**
 * =========================================================
 * DASHBOARD
 * =========================================================
 */

export function buildDashboardEmbed(
  user,
  profile,
  {
    isNew = false,
  } = {},
) {
  const required =
    getCultivationRequired(
      profile,
    );

  const realm =
    getRealmDisplay(
      profile,
    );

  const intro =
    isNew
      ? [
          '<a:trangtrig2:1546040703375904801> **THIÊN ĐẠO KHAI MỞ** <a:trangtrig3:1546040818261954610>',
          '',
          `<@${user.id}> đã chính thức bước vào Tiên Lộ.`,
          '',
          `Linh căn thức tỉnh: **${profile.spiritRoot.name}**`,
          `Phẩm chất: **${profile.spiritRoot.rarity}**`,
          '',
          SEPARATOR,
          '',
        ].join(
          '\n',
        )
      : '';

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> 𝓣𝓲𝓮̂𝓷 𝓛𝓸̣̂ · 修仙之路 <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          intro,

          `<a:catg11:1546058047393239151> **Đạo Hữu**: <@${user.id}>`,

          `<a:trangtrig43:1547238351869059082> [**境界**] **${realm}**`,

          `<a:trangtrig44:1547238495494348891> [**灵根**] **${profile.spiritRoot.name}**`,

          '',

          '<:trangtri1:1546093044535660644> **Tu Vi**',

          `${progressBar(
            profile.cultivation,
            required,
          )} **${number(
            profile.cultivation,
          )} / ${number(
            required,
          )}**`,

          '',

          `<a:trangtrig46:1547240249761996812> **Linh Thạch**: ${number(
            profile.spiritStones,
          )}`,

          `<a:heartg4:1546068063500369940> **Thể Lực**: ${profile.stamina}/${profile.maxStamina}`,

          '',

          SEPARATOR,

          '',

          '*Một niệm nhập tiên đồ — từ phàm nhân, từng bước nghịch thiên mà hành.*',
        ]
          .filter(
            Boolean,
          )
          .join(
            '\n',
          ),
      ),
  );
}

export function buildDashboardRows(
  ownerId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:cultivate`,
          )
          .setLabel(
            'Tu Luyện',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .cultivate,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:breakthrough`,
          )
          .setLabel(
            'Đột Phá',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .breakthrough,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:adventure`,
          )
          .setLabel(
            'Thám Hiểm',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .adventure,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:inventory`,
          )
          .setLabel(
            'Túi Đồ',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .inventory,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:profile`,
          )
          .setLabel(
            'Hồ Sơ',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .profile,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),

    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:leaderboard`,
          )
          .setLabel(
            'Tiên Bảng',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .leaderboard,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:alchemy`,
          )
          .setLabel(
            'Luyện Đan',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .alchemy,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:forge`,
          )
          .setLabel(
            'Luyện Khí',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .forge,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:equipment`,
          )
          .setLabel(
            'Pháp Khí',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .equipment,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:technique`,
          )
          .setLabel(
            'Công Pháp',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .technique,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),

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
            CULTIVATION_BUTTON_EMOJIS
              .treasure,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:pet`,
          )
          .setLabel(
            'Linh Thú',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .pet,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}

export function buildBackRow(
  ownerId,
  action = 'cultivate',
) {
  const emoji =
    CULTIVATION_BUTTON_EMOJIS[
      action
    ] ||
    CULTIVATION_BUTTON_EMOJIS
      .cultivate;

  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `tutien_action:${ownerId}:dashboard`,
        )
        .setLabel(
          'Quay lại Tiên Lộ',
        )
        .setEmoji(
          emoji,
        )
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
}

/**
 * =========================================================
 * INVENTORY
 * =========================================================
 */

export function buildInventoryRows(
  ownerId,
  profile,
) {
  const usableItems =
    getUsableInventoryEntries(
      profile,
    );

  const rows = [];

  if (
    usableItems.length > 0
  ) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `tutien_inventory_select:${ownerId}`,
            )
            .setPlaceholder(
              'Chọn Đan Dược muốn sử dụng',
            )
            .setMinValues(
              1,
            )
            .setMaxValues(
              1,
            )
            .addOptions(
              usableItems
                .slice(
                  0,
                  25,
                )
                .map(
                  (
                    item,
                  ) => ({
                    label:
                      item.name,

                    value:
                      item.id,

                    description:
                      `${item.rarity} · Đang có x${item.quantity}`.slice(
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
    buildBackRow(
      ownerId,
      'inventory',
    ),
  );

  return rows;
}

export function buildItemDetailRows(
  ownerId,
  itemId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:use_item:${itemId}`,
          )
          .setLabel(
            'Sử Dụng',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .inventory,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:inventory`,
          )
          .setLabel(
            'Quay lại Túi Đồ',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .inventory,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}

export function buildUseItemResultRows(
  ownerId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:inventory`,
          )
          .setLabel(
            'Quay lại Túi Đồ',
          )
          .setEmoji(
            CULTIVATION_BUTTON_EMOJIS
              .inventory,
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
            CULTIVATION_BUTTON_EMOJIS
              .inventory,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}

/**
 * =========================================================
 * TU LUYỆN
 * =========================================================
 */

export function buildCultivateEmbed(
  result,
) {
  if (
    !result.ok &&
    result.reason ===
      'cooldown'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> ĐẠO TÂM CHƯA ỔN ĐỊNH',
        )
        .setDescription(
          [
            '<a:bang2:1546891483250954290> Linh khí trong kinh mạch vẫn chưa hoàn toàn ổn định.',
            '',
            SEPARATOR,
            '',
            `<a:chiikawag13:1541429102668554250> Đạo hữu cần chờ **${duration(
              result.cooldownRemaining,
            )}** trước lần tu luyện tiếp theo.`,
          ].join(
            '\n',
          ),
        ),
    );
  }

  if (
    !result.ok &&
    result.reason ===
      'stamina'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> THỂ LỰC KHÔNG ĐỦ',
        )
        .setDescription(
          [
            '<a:bang2:1546891483250954290> Đạo hữu đã tiêu hao quá nhiều tinh lực.',
            '',
            SEPARATOR,
            '',
            '<a:chiikawag13:1541429102668554250> Hiện tại chưa đủ Thể Lực để tiếp tục tu luyện.',
          ].join(
            '\n',
          ),
        ),
    );
  }

  const pillLine =
    result.cultivationPillBonus >
      0
      ? `<a:trangtrig34:1547237010572582982> Tụ Khí Đan: **+${number(
          result.cultivationPillBonus,
        )} Tu Vi**`
      : null;

  const equipmentCultivationLine =
    result
      .equipmentCultivationBonus >
    0
      ? `<a:trangtrig36:1547237577231302737> Thanh Phong Kiếm: **+${number(
          result.equipmentCultivationBonus,
        )} Tu Vi**`
      : null;

  const equipmentStoneLine =
    result.equipmentStoneBonus >
    0
      ? `<a:trangtrig18:1546068102817775626> Tụ Linh Bội: **+${number(
          result.equipmentStoneBonus,
        )} Linh Thạch**`
      : null;

  const techniqueCultivationLine =
    result
      .techniqueCultivationBonus >
    0
      ? `<a:trangtrig18:1546068102817775626> Thanh Vân Kiếm Quyết: **+${number(
          result.techniqueCultivationBonus,
        )} Tu Vi**`
      : null;

  const techniqueStoneLine =
    result.techniqueStoneBonus >
    0
      ? `<a:trangtrig18:1546068102817775626> Tụ Linh Chân Kinh: **+${number(
          result.techniqueStoneBonus,
        )} Linh Thạch**`
      : null;

  const petCultivationLine =
    result.petCultivationBonus >
    0
      ? `${PET_EMOJI} Thanh Phong Linh Hồ: **+${number(
          result.petCultivationBonus,
        )} Tu Vi**`
      : null;

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        result.event.title,
      )
      .setDescription(
        [
          result.event.text,
          '',
          SEPARATOR,
          '',
          `**Tu Vi**: ${signedNumber(
            result.cultivationDelta,
          )}`,
          `**Linh Thạch**: ${signedNumber(
            result.stoneDelta,
          )}`,
          `**Thể Lực**: -${result.staminaCost}`,
          equipmentCultivationLine,
          techniqueCultivationLine,
          petCultivationLine,
          equipmentStoneLine,
          techniqueStoneLine,
          pillLine,
          '',
          `<a:trangtrig43:1547238351869059082> [**境界**] **${getRealmDisplay(
            result.profile,
          )}**`,
          `${progressBar(
            result.profile
              .cultivation,
            result.required,
          )} ${number(
            result.profile
              .cultivation,
          )} / ${number(
            result.required,
          )}`,
        ]
          .filter(
            (
              line,
            ) =>
              line !== null,
          )
          .join(
            '\n',
          ),
      ),
  );
}

/**
 * =========================================================
 * THÁM HIỂM
 * =========================================================
 */

export function buildAdventureEmbed(
  result,
) {
  if (
    !result.ok &&
    result.reason ===
      'cooldown'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> HÀNH TRÌNH CHƯA THỂ TIẾP TỤC',
        )
        .setDescription(
          [
            '<a:bang2:1546891483250954290> Đạo hữu vừa trải qua một chuyến thám hiểm, cần thời gian chỉnh đốn.',
            '',
            SEPARATOR,
            '',
            `<a:chiikawag13:1541429102668554250> Đạo hữu cần chờ **${duration(
              result.cooldownRemaining,
            )}** trước lần Thám Hiểm tiếp theo.`,
          ].join(
            '\n',
          ),
        ),
    );
  }

  const talismanLine =
    result.talismanConsumed
      ? result.talismanId ===
        'tam_bao_phu'
        ? '<a:trangtrig18:1546068102817775626> Tầm Bảo Phù: **Phù lực đã tiêu hao**'
        : result.talismanId ===
          'tu_tai_phu'
          ? `<a:trangtrig18:1546068102817775626> Tụ Tài Phù: **+${number(
              result.talismanStoneBonus,
            )} Linh Thạch · Đã tiêu hao**`
          : null
      : null;

  if (
    result.event.type ===
    'monster'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> YÊU THÚ TẬP KÍCH',
        )
        .setDescription(
          [
            `<a:catg10:1546031290803945594> ${result.event.text}`,
            '',
            SEPARATOR,
            '',
            `**Tu Vi**: ${signedNumber(
              result.cultivationDelta,
            )}`,
            '**Linh Thạch**: +0',
            talismanLine,
            '',
            `<a:trangtrig43:1547238351869059082> [**境界**] **${getRealmDisplay(
              result.profile,
            )}**`,
            `${progressBar(
              result.profile
                .cultivation,
              result.required,
            )} ${number(
              result.profile
                .cultivation,
            )} / ${number(
              result.required,
            )}`,
            '',
            '*Tiên lộ vốn không phải nơi bình yên.*',
          ]
            .filter(
              (
                line,
              ) =>
                line !== null,
            )
            .join(
              '\n',
            ),
        ),
    );
  }

  const dropText =
    buildDropText(
      result.droppedItem,
    );

  const equipmentStoneLine =
    result.equipmentStoneBonus >
    0
      ? `<a:trangtrig18:1546068102817775626> Tụ Linh Bội: **+${number(
          result.equipmentStoneBonus,
        )} Linh Thạch**`
      : null;

  const techniqueStoneLine =
    result.techniqueStoneBonus >
    0
      ? `<a:trangtrig18:1546068102817775626> Tụ Linh Chân Kinh: **+${number(
          result.techniqueStoneBonus,
        )} Linh Thạch**`
      : null;

  const petStoneLine =
    result.petStoneBonus >
    0
      ? `${PET_EMOJI} Xích Viêm Hỏa Điểu: **+${number(
          result.petStoneBonus,
        )} Linh Thạch**`
      : null;

  const title =
    result.event.type ===
      'great_fortune'
      ? result.event.title
      : `<a:trangtrig2:1546040703375904801> ${result.location.name} <a:trangtrig3:1546040818261954610>`;

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        title,
      )
      .setDescription(
        [
          result.event.text,
          '',
          SEPARATOR,
          '',
          `**Tu Vi**: ${signedNumber(
            result.cultivationDelta,
          )}`,
          `**Linh Thạch**: ${signedNumber(
            result.stoneDelta,
          )}`,
          equipmentStoneLine,
          techniqueStoneLine,
          petStoneLine,
          talismanLine,
          dropText,
          '',
          `<a:trangtrig43:1547238351869059082> [**境界**] **${getRealmDisplay(
            result.profile,
          )}**`,
          `${progressBar(
            result.profile
              .cultivation,
            result.required,
          )} ${number(
            result.profile
              .cultivation,
          )} / ${number(
            result.required,
          )}`,
        ]
          .filter(
            (
              line,
            ) =>
              line !== null,
          )
          .join(
            '\n',
          ),
      ),
  );
}

/**
 * =========================================================
 * TÚI ĐỒ EMBED
 * =========================================================
 */

export function buildInventoryEmbed(
  user,
  profile,
) {
  const entries =
    getInventoryEntries(
      profile,
    );

  const itemLines =
    entries.map(
      (
        item,
      ) => [
        `${getItemEmoji(
          item,
        )} **${item.name}** × **${item.quantity}**`,
        `*${item.rarity} · ${item.description}*`,
      ].join(
        '\n',
      ),
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> **TÚI ĐỒ TIÊN NHÂN** <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,
          '',
          SEPARATOR,
          '',
          itemLines.length > 0
            ? itemLines.join(
                '\n\n',
              )
            : '*Túi Đồ hiện đang trống.*',
          '',
          SEPARATOR,
          '',
          `<a:trangtrig45:1547239010190237819> Vật Phẩm Đã Tìm Thấy: **${profile.stats.itemsFound || 0}**`,
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildItemDetailEmbed(
  user,
  profile,
  itemId,
) {
  const item =
    getCultivationItem(
      itemId,
    );

  if (!item) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> KHÔNG TÌM THẤY VẬT PHẨM',
        )
        .setDescription(
          'Vật phẩm này không còn tồn tại trong Túi Đồ.',
        ),
    );
  }

  const quantity =
    profile.inventory?.[
      itemId
    ] || 0;

  let effectText =
    'Vật phẩm này hiện chưa thể sử dụng.';

  if (
    itemId ===
    'tu_khi_dan'
  ) {
    effectText =
      'Tăng **+25% Tu Vi** cho lần Tu Luyện kế tiếp.';
  }

  if (
    itemId ===
    'hoi_nguyen_dan'
  ) {
    effectText =
      'Khôi phục tối đa **30 Thể Lực**.';
  }

  if (
    itemId ===
    'pha_canh_dan'
  ) {
    effectText =
      'Tăng **+10%** tỷ lệ cho lần Đột Phá kế tiếp, tối đa **95%**.';
  }

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        `${getItemEmoji(
          item,
        )} ${item.name.toUpperCase()}`,
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,
          '',
          `**Phẩm Chất**: ${item.rarity}`,
          `**Số Lượng**: ${quantity}`,
          '',
          SEPARATOR,
          '',
          effectText,
          '',
          `*${item.description}*`,
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildUseItemResultEmbed(
  result,
) {
  if (!result.ok) {
    if (
      result.reason ===
      'stamina_full'
    ) {
      return applyStyle(
        new EmbedBuilder()
          .setTitle(
            '<a:angryg1:1541441195144773652> KHÔNG THỂ SỬ DỤNG',
          )
          .setDescription(
            [
              '<a:bang2:1546891483250954290> Thể Lực của đạo hữu hiện đã viên mãn.',
              '',
              SEPARATOR,
              '',
              '*Không cần lãng phí Hồi Nguyên Đan lúc này.*',
            ].join(
              '\n',
            ),
          ),
      );
    }

    if (
      result.reason ===
      'effect_active'
    ) {
      return applyStyle(
        new EmbedBuilder()
          .setTitle(
            '<a:angryg1:1541441195144773652> DƯỢC HIỆU VẪN CÒN',
          )
          .setDescription(
            [
              '<a:bang2:1546891483250954290> Dược lực của viên đan trước vẫn chưa được tiêu hao.',
              '',
              SEPARATOR,
              '',
              '*Hãy sử dụng hết dược hiệu hiện tại trước khi dùng thêm.*',
            ].join(
              '\n',
            ),
          ),
      );
    }

    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> KHÔNG THỂ SỬ DỤNG',
        )
        .setDescription(
          'Đạo hữu không còn vật phẩm này hoặc vật phẩm hiện chưa thể sử dụng.',
        ),
    );
  }

  if (
    result.type ===
    'cultivation_buff'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig34:1547237010572582982> TỤ KHÍ ĐAN',
        )
        .setDescription(
          [
            'Đạo hữu nuốt xuống một viên Tụ Khí Đan, dược lực lập tức hóa thành linh khí tinh thuần.',
            '',
            SEPARATOR,
            '',
            `<:trangtri1:1546093044535660644> Hiệu quả Tu Luyện kế tiếp: **+${percent(
              result.bonus,
            )} Tu Vi**`,
            `<a:trangtrig34:1547237010572582982> Còn lại: **${result.remaining}**`,
            '',
            '*Dược lực sẽ tiêu hao sau lần Tu Luyện tiếp theo.*',
          ].join(
            '\n',
          ),
        ),
    );
  }

  if (
    result.type ===
    'stamina_restore'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig34:1547237010572582982> HỒI NGUYÊN ĐAN',
        )
        .setDescription(
          [
            'Dược lực lan khắp kinh mạch, tinh khí dần khôi phục.',
            '',
            SEPARATOR,
            '',
            `<a:heartg4:1546068063500369940> Thể Lực: **${result.before} → ${result.after}**`,
            `<a:trangtrig34:1547237010572582982> Còn lại: **${result.remaining}**`,
            '',
            '*Khí huyết đã ổn định hơn.*',
          ].join(
            '\n',
          ),
        ),
    );
  }

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig34:1547237010572582982> PHÁ CẢNH ĐAN',
      )
      .setDescription(
        [
          'Dược lực xung kích bình cảnh, đạo cơ dần trở nên thông suốt.',
          '',
          SEPARATOR,
          '',
          `<a:trangtrig19:1546068350030053406> Lần Đột Phá kế tiếp: **+${percent(
            result.bonus,
          )}**`,
          `<a:trangtrig34:1547237010572582982> Còn lại: **${result.remaining}**`,
          '',
          '*Dược lực sẽ tiêu hao sau lần Đột Phá tiếp theo.*',
        ].join(
          '\n',
        ),
      ),
  );
}

/**
 * =========================================================
 * ĐỘT PHÁ
 * =========================================================
 */

export function buildBreakthroughEmbed(
  result,
) {
  if (
    !result.ok &&
    result.reason ===
      'max_realm'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig2:1546040703375904801> ĐẠO TẬN CỬU TIÊU <a:trangtrig3:1546040818261954610>',
        )
        .setDescription(
          'Đạo hữu đã đứng tại cảnh giới cao nhất hiện có của Tiên Lộ.',
        ),
    );
  }

  if (
    !result.ok &&
    result.reason ===
      'not_ready'
  ) {
    const missing =
      Math.max(
        0,
        result.required -
          result.profile
            .cultivation,
      );

    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig45:1547239010190237819> BÌNH CẢNH CHƯA MỞ <a:trangtrig45:1547239010190237819>',
        )
        .setDescription(
          [
            `<a:trangtrig6:1546043036390260756> Cảnh giới hiện tại: **${getRealmDisplay(
              result.profile,
            )}**`,
            `<a:trangtrig6:1546043036390260756> Tu Vi: **${number(
              result.profile
                .cultivation,
            )}**`,
            `<a:trangtrig6:1546043036390260756> Thiếu: **${number(
              missing,
            )}**`,
            '',
            '<:chiikawa4:1541429063392956516> *Tiếp tục tu luyện để chạm tới bình cảnh.*',
          ].join(
            '\n',
          ),
        ),
    );
  }

  const chance =
    Math.round(
      result.chance * 100,
    );

  const pillLine =
    result.breakthroughPillBonus >
      0
      ? `<a:trangtrig34:1547237010572582982> Phá Cảnh Đan: **+${percent(
          result.breakthroughPillBonus,
        )}**`
      : null;

  const techniqueLine =
    result
      .techniqueBreakthroughBonus >
    0
      ? `<a:trangtrig18:1546068102817775626> Huyền Nguyên Tâm Pháp: **+${percent(
          result.techniqueBreakthroughBonus,
        )}**`
      : null;

  const petChanceLine =
    result.petBreakthroughBonus >
    0
      ? `${PET_EMOJI} Thiên Lôi Bạch Hổ: **+${percent(
          result.petBreakthroughBonus,
        )}**`
      : null;

  if (
    result.success
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:trangtrig2:1546040703375904801> PHÁ CẢNH THÀNH CÔNG <a:trangtrig3:1546040818261954610>',
        )
        .setDescription(
          [
            'Thiên địa linh khí chấn động, đạo cơ viên mãn.',
            '',
            SEPARATOR,
            '',
            `**${result.oldRealm}**`,
            '↓',
            `**${result.newRealm}**`,
            '',
            `<a:trangtrig19:1546068350030053406> Tỷ Lệ Đột Phá: **${chance}%**`,
            techniqueLine,
            petChanceLine,
            pillLine,
          ]
            .filter(
              (
                line,
              ) =>
                line !== null,
            )
            .join(
              '\n',
            ),
        ),
    );
  }

  const protectionLine =
    result.talismanProtected
      ? '<a:trangtrig18:1546068102817775626> Hộ Đạo Phù: **Bảo toàn toàn bộ Tu Vi · Đã tiêu hao**'
      : null;

  const equipmentLossLine =
    result.equipmentLossSaved >
    0
      ? `<a:trangtrig18:1546068102817775626> Huyền Thiết Hộ Phù: **Giảm ${number(
          result.equipmentLossSaved,
        )} Tu Vi hao tổn**`
      : null;

  const petLossLine =
    result.petLossSaved >
    0
      ? `${PET_EMOJI} Huyền Giáp Linh Quy: **Giảm ${number(
          result.petLossSaved,
        )} Tu Vi hao tổn**`
      : null;

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:angryg1:1541441195144773652> ĐỘT PHÁ THẤT BẠI',
      )
      .setDescription(
        [
          'Thiên uy giáng xuống, linh lực nhất thời tan loạn.',
          '',
          SEPARATOR,
          '',
          `<a:trangtrig43:1547238351869059082> Cảnh Giới: **${result.oldRealm}**`,
          `<:trangtri1:1546093044535660644> Tu Vi Hao Tổn: **-${number(
            result.loss,
          )}**`,
          protectionLine,
          equipmentLossLine,
          petLossLine,
          `<a:trangtrig19:1546068350030053406> Tỷ Lệ Đột Phá: **${chance}%**`,
          techniqueLine,
          petChanceLine,
          pillLine,
          '',
          '*Chỉnh tức đạo tâm rồi hãy thử lại.*',
        ]
          .filter(
            (
              line,
            ) =>
              line !== null,
          )
          .join(
            '\n',
          ),
      ),
  );
}

/**
 * =========================================================
 * HỒ SƠ
 * =========================================================
 */

export function buildProfileEmbed(
  user,
  profile,
) {
  const required =
    getCultivationRequired(
      profile,
    );

  const baseChance =
    Math.round(
      getBreakthroughChance(
        profile,
      ) * 100,
    );

  const effects =
    buildEffectsText(
      profile,
    );

  const equippedEquipment =
    getEquippedEquipment(
      profile,
    );

  const activeTechnique =
    getActiveTechnique(
      profile,
    );

  const activeTalisman =
    getActiveTalisman(
      profile,
    );

  const activePet =
    getActivePet(
      profile,
    );

  const equipmentLine =
    equippedEquipment
      ? `${equippedEquipment.emoji} Pháp Khí: **${equippedEquipment.name}**`
      : '<a:trangtrig18:1546068102817775626> Pháp Khí: **Chưa Trang Bị**';

  const techniqueLine =
    activeTechnique
      ? `${activeTechnique.emoji} Công Pháp: **${activeTechnique.name}**`
      : '<a:trangtrig18:1546068102817775626> Công Pháp: **Chưa Tu Luyện**';

  const talismanLine =
    activeTalisman
      ? `<a:trangtrig18:1546068102817775626> Phù Hiệu: **${activeTalisman.name}**`
      : '<a:trangtrig18:1546068102817775626> Phù Hiệu: **Chưa Kích Hoạt**';

  const petLine =
    activePet
      ? `${PET_EMOJI} Linh Thú: **${activePet.name}**`
      : `${PET_EMOJI} Linh Thú: **Chưa Có**`;

  const techniqueBreakthroughBonus =
    activeTechnique
      ?.effectType ===
      'breakthrough_bonus'
      ? Math.round(
          activeTechnique
            .effectValue * 100,
        )
      : 0;

  const petBreakthroughBonus =
    activePet
      ?.effectType ===
      'breakthrough_bonus'
      ? Math.round(
          activePet
            .effectValue * 100,
        )
      : 0;

  const chance =
    Math.min(
      95,
      baseChance +
        techniqueBreakthroughBonus +
        petBreakthroughBonus,
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> HỒ SƠ TIÊN NHÂN <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,
          `<a:trangtrig43:1547238351869059082> Cảnh Giới: **${getRealmDisplay(
            profile,
          )}**`,
          `<a:trangtrig44:1547238495494348891> Linh Căn: **${profile.spiritRoot.name}**`,
          `<a:trangtrig31:1546905996893626440> Phẩm Chất: **${profile.spiritRoot.rarity}**`,
          equipmentLine,
          techniqueLine,
          talismanLine,
          petLine,
          '',
          `<:trangtri1:1546093044535660644> Tu Vi: **${number(
            profile.cultivation,
          )} / ${number(
            required,
          )}**`,
          `<a:trangtrig46:1547240249761996812> Linh Thạch: **${number(
            profile.spiritStones,
          )}**`,
          `<a:heartg4:1546068063500369940> Thể Lực: **${profile.stamina} / ${profile.maxStamina}**`,
          `<a:trangtrig19:1546068350030053406> Tỷ Lệ Đột Phá: **${chance}%**`,
          effects,
          '',
          SEPARATOR,
          '',
          `<a:trangtrig45:1547239010190237819> Tu Luyện: **${profile.stats.cultivateCount || 0} lần**`,
          `<a:trangtrig45:1547239010190237819> Kỳ Ngộ: **${profile.stats.fortunes || 0} lần**`,
          `<a:trangtrig45:1547239010190237819> Thám Hiểm: **${profile.stats.adventureCount || 0} lần**`,
          `<a:trangtrig45:1547239010190237819> Đại Cơ Duyên: **${profile.stats.greatFortunes || 0} lần**`,
          `<a:trangtrig45:1547239010190237819> Vật Phẩm Tìm Thấy: **${profile.stats.itemsFound || 0}**`,
          `<a:trangtrig45:1547239010190237819> Công Pháp Lĩnh Ngộ: **${profile.stats.techniquesLearned || 0}**`,
          `<a:trangtrig45:1547239010190237819> Phù Hiệu Kích Hoạt: **${profile.stats.talismansActivated || 0}**`,
          `<a:trangtrig45:1547239010190237819> Linh Thú Thu Phục: **${profile.stats.petsCaptured || 0}**`,
          `<a:trangtrig45:1547239010190237819> Đột Phá Thành Công: **${profile.stats.breakthroughSuccess || 0}**`,
          `<a:trangtrig45:1547239010190237819> Đột Phá Thất Bại: **${profile.stats.breakthroughFail || 0}**`,
        ]
          .filter(
            (
              line,
            ) =>
              line !== null,
          )
          .join(
            '\n',
          ),
      ),
  );
}

/**
 * =========================================================
 * TIÊN BẢNG
 * =========================================================
 */

export function buildLeaderboardEmbed(
  entries,
  guild,
) {
  const lines =
    entries.map(
      (
        entry,
        index,
      ) => {
        const member =
          guild?.members
            ?.cache
            ?.get(
              entry.userId,
            );

        const name =
          member
            ?.displayName ||
          `<@${entry.userId}>`;

        return [
          `<a:trangtrig32:1546906170994856026>${index + 1} · **${name}**`,
          `<a:animeg3:1546040346717331477> **${getRealmDisplay(
            entry.profile,
          )}** <a:trangtrig29:1546385117478527016> **${number(
            entry.profile
              .cultivation,
          )}** Tu Vi`,
        ].join(
          '\n',
        );
      },
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:animeg2:1546040159886114846> 𝓣𝓲𝓮̂𝓷 𝓑𝓪̉𝓷𝓰 <a:animeg2:1546040159886114846>',
      )
      .setDescription(
        lines.length > 0
          ? lines.join(
              '\n\n',
            )
          : '<a:animeg3:1546040346717331477> Tiên Bảng hiện chưa lưu danh bất kỳ đạo hữu nào.',
      ),
  );
}
