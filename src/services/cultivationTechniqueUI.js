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
  getActiveTechnique,
  getLearnedTechniques,
  getTechnique,
  getTechniqueList,
  getTechniqueMaterialQuantity,
} from './cultivationTechnique.js';

const SEPARATOR =
  '꒷꒦︶꒷꒦︶ ๋ ࣭ ⭑꒷꒦';

const TECHNIQUE_BUTTON_EMOJI = {
  id:
    '1546070442169864193',
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

export function buildTechniqueEmbed(
  user,
  profile,
) {
  const active =
    getActiveTechnique(
      profile,
    );

  const learned =
    getLearnedTechniques(
      profile,
    );

  const material =
    getTechniqueMaterialQuantity(
      profile,
    );

  const learnedText =
    learned.length > 0
      ? learned
          .map(
            (
              technique,
            ) => {
              const activeText =
                active?.id ===
                technique.id
                  ? ' · **Đang Tu**'
                  : '';

              return [
                `${technique.emoji} **${technique.name}**${activeText}`,
                `└ ${technique.effect}`,
              ].join(
                '\n',
              );
            },
          )
          .join(
            '\n\n',
          )
      : '*Chưa lĩnh ngộ Công Pháp nào.*';

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> CÔNG PHÁP · 功法 <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,
          '',
          SEPARATOR,
          '',
          '<a:trangtrig18:1546068102817775626> **Công Pháp Đang Tu**',
          active
            ? `${active.emoji} **${active.name}**\n└ ${active.effect}`
            : '**Chưa Tu Luyện**',
          '',
          '<a:trangtrig18:1546068102817775626> **Bí Tịch Hiện Có**',
          `Vô Danh Kiếm Phổ: **${material}**`,
          '',
          SEPARATOR,
          '',
          '<a:trangtrig18:1546068102817775626> **Công Pháp Đã Lĩnh Ngộ**',
          learnedText,
          '',
          '*Vạn pháp quy nhất, đạo tại tâm sinh.*',
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildTechniqueRows(
  ownerId,
  profile,
) {
  const learned =
    getLearnedTechniques(
      profile,
    );

  const unlearned =
    getTechniqueList()
      .filter(
        (
          technique,
        ) =>
          !profile.techniques
            ?.learned?.[
              technique.id
            ],
      );

  const rows = [];

  if (
    unlearned.length > 0
  ) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `tutien_technique_learn_select:${ownerId}`,
            )
            .setPlaceholder(
              'Chọn Công Pháp muốn lĩnh ngộ',
            )
            .addOptions(
              unlearned.map(
                (
                  technique,
                ) => ({
                  label:
                    technique.name,

                  value:
                    technique.id,

                  description:
                    technique.effect.slice(
                      0,
                      100,
                    ),
                }),
              ),
            ),
        ),
    );
  }

  if (
    learned.length > 0
  ) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `tutien_technique_activate_select:${ownerId}`,
            )
            .setPlaceholder(
              'Chọn Công Pháp muốn tu luyện',
            )
            .addOptions(
              learned.map(
                (
                  technique,
                ) => ({
                  label:
                    technique.name,

                  value:
                    technique.id,

                  description:
                    technique.effect.slice(
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
            TECHNIQUE_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  );

  return rows;
}

export function buildTechniqueConfirmEmbed(
  user,
  profile,
  techniqueId,
) {
  const technique =
    getTechnique(
      techniqueId,
    );

  if (!technique) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          'KHÔNG TÌM THẤY CÔNG PHÁP',
        ),
    );
  }

  const material =
    getTechniqueMaterialQuantity(
      profile,
    );

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        `${technique.emoji} ${technique.name.toUpperCase()}`,
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> Đạo Hữu: <@${user.id}>`,
          '',
          '**Hiệu Quả**',
          `**${technique.effect}**`,
          '',
          '<a:trangtrig18:1546068102817775626> **Cần**',
          'Vô Danh Kiếm Phổ: **1**',
          `Hiện Có: **${material}**`,
          '',
          SEPARATOR,
          '',
          `*${technique.description}*`,
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildTechniqueConfirmRows(
  ownerId,
  techniqueId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:technique_learn:${techniqueId}`,
          )
          .setLabel(
            'Lĩnh Ngộ',
          )
          .setEmoji(
            TECHNIQUE_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:technique`,
          )
          .setLabel(
            'Quay lại',
          )
          .setEmoji(
            TECHNIQUE_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}

export function buildTechniqueLearnResultEmbed(
  result,
) {
  if (
    !result.ok &&
    result.reason ===
      'not_enough_material'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> BÍ TỊCH KHÔNG ĐỦ',
        )
        .setDescription(
          [
            '<a:bang2:1546891483250954290> Đạo hữu chưa có đủ bí tịch để lĩnh ngộ Công Pháp này.',
            '',
            SEPARATOR,
            '',
            '<a:trangtrig18:1546068102817775626> Cần: **Vô Danh Kiếm Phổ ×1**',
            `<a:trangtrig18:1546068102817775626> Hiện Có: **${result.available}**`,
          ].join(
            '\n',
          ),
        ),
    );
  }

  if (
    !result.ok &&
    result.reason ===
      'already_learned'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> ĐÃ LĨNH NGỘ',
        )
        .setDescription(
          `Đạo hữu đã lĩnh ngộ **${result.technique.name}**.`,
        ),
    );
  }

  if (!result.ok) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> LĨNH NGỘ THẤT BẠI',
        )
        .setDescription(
          'Không thể lĩnh ngộ Công Pháp này.',
        ),
    );
  }

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> CÔNG PHÁP LĨNH NGỘ <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          'Linh quang nhập thức hải, đạo ý dần ngưng tụ trong tâm cảnh.',
          '',
          SEPARATOR,
          '',
          `<a:hamsterg2:1546057566209974292> Lĩnh Ngộ: **${result.technique.name}**`,
          '<a:trangtrig18:1546068102817775626> Vô Danh Kiếm Phổ: **-1**',
          '',
          '**Hiệu Quả**',
          result.technique.effect,
          '',
          result.autoActivated
            ? '<a:trangtrig18:1546068102817775626> Công Pháp đã được **tự động kích hoạt**.'
            : null,
          '',
          `*${result.technique.description}*`,
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

export function buildTechniqueActivateResultEmbed(
  result,
) {
  if (!result.ok) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> KHÔNG THỂ TU LUYỆN',
        )
        .setDescription(
          'Đạo hữu chưa lĩnh ngộ Công Pháp này.',
        ),
    );
  }

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> CÔNG PHÁP VẬN CHUYỂN <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          `Đã chuyển sang tu luyện **${result.technique.name}**.`,
          '',
          SEPARATOR,
          '',
          `${result.technique.emoji} **Hiệu Quả Đang Kích Hoạt**`,
          result.technique.effect,
          '',
          `*${result.technique.description}*`,
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildTechniqueResultRows(
  ownerId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:technique`,
          )
          .setLabel(
            'Công Pháp',
          )
          .setEmoji(
            TECHNIQUE_BUTTON_EMOJI,
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
            TECHNIQUE_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}
