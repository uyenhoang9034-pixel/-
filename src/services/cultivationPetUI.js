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
  getActivePet,
  getCultivationPet,
  getOwnedPets,
  PET_EMOJI,
} from './cultivationPet.js';

const SEPARATOR =
  '꒷꒦︶꒷꒦︶ ๋ ࣭ ⭑꒷꒦';

const PET_BUTTON_EMOJI = {
  id:
    '1546070976964333741',
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

/**
 * =========================================================
 * LINH THÚ DASHBOARD
 * =========================================================
 */

export function buildPetEmbed(
  user,
  profile,
) {
  const owned =
    getOwnedPets(
      profile,
    );

  const active =
    getActivePet(
      profile,
    );

  const ownedText =
    owned.length > 0
      ? owned
          .map(
            (
              pet,
            ) => {
              const mark =
                active?.id ===
                pet.id
                  ? ' · **Đồng Hành**'
                  : '';

              return [
                `${PET_EMOJI} **${pet.name}**${mark}`,
                `Phẩm Chất: **${pet.rarity}**`,
                `Hiệu Quả: **${pet.effect}**`,
              ].join(
                '\n',
              );
            },
          )
          .join(
            '\n\n',
          )
      : '*Chưa thu phục Linh Thú nào.*';

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> LINH THÚ · 灵兽 <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          `<a:catg11:1546058047393239151> **Đạo Hữu**: <@${user.id}>`,
          '',
          SEPARATOR,
          '',
          `${PET_EMOJI} **Linh Thú Đồng Hành**`,
          active
            ? `**${active.name}**`
            : '**Chưa Có**',
          '',
          `${PET_EMOJI} **Linh Thú Đã Thu Phục**`,
          `**${owned.length}**`,
          '',
          SEPARATOR,
          '',
          ownedText,
          '',
          SEPARATOR,
          '',
          '*Vạn linh hữu tính, hữu duyên tự sẽ tương phùng.*',
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildPetRows(
  ownerId,
  profile,
) {
  const owned =
    getOwnedPets(
      profile,
    );

  const rows = [];

  if (
    owned.length > 0
  ) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `tutien_pet_select:${ownerId}`,
            )
            .setPlaceholder(
              'Chọn Linh Thú Đồng Hành',
            )
            .setMinValues(
              1,
            )
            .setMaxValues(
              1,
            )
            .addOptions(
              owned
                .slice(
                  0,
                  25,
                )
                .map(
                  (
                    pet,
                  ) => ({
                    label:
                      pet.name,

                    value:
                      pet.id,

                    description:
                      `${pet.rarity} · ${pet.effect}`.slice(
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
            PET_BUTTON_EMOJI,
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
 * ENCOUNTER
 * =========================================================
 */

export function buildPetEncounterEmbed(
  petId,
) {
  const pet =
    getCultivationPet(
      petId,
    );

  if (!pet) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          'LINH THÚ HIỆN THẾ',
        )
        .setDescription(
          'Một luồng linh khí kỳ lạ thoáng qua rồi biến mất.',
        ),
    );
  }

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> LINH THÚ HIỆN THẾ <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          'Trong sương mù, một sinh linh mang theo linh khí tinh thuần đang âm thầm quan sát đạo hữu.',
          '',
          SEPARATOR,
          '',
          `${PET_EMOJI} Linh Thú: **${pet.name}**`,
          `Phẩm Chất: **${pet.rarity}**`,
          '',
          `Tỷ Lệ Thu Phục: **${Math.round(
            pet.captureChance *
              100,
          )}%**`,
        ].join(
          '\n',
        ),
      ),
  );
}

export function buildPetEncounterRows(
  ownerId,
  petId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:pet_capture:${petId}`,
          )
          .setLabel(
            'Thu Phục',
          )
          .setEmoji(
            PET_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:dashboard`,
          )
          .setLabel(
            'Bỏ Qua',
          )
          .setEmoji({
            id:
              '1546072124270055464',
          })
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}

/**
 * =========================================================
 * CAPTURE RESULT
 * =========================================================
 */

export function buildPetCaptureResultEmbed(
  result,
) {
  const pet =
    result.pet;

  if (
    !result.ok &&
    result.reason ===
      'already_owned'
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          `${PET_EMOJI} LINH THÚ ĐÃ NHẬN CHỦ`,
        )
        .setDescription(
          [
            `**${pet.name}** đã có duyên với đạo hữu từ trước.`,
            '',
            '*Linh thú khẽ cọ đầu vào tay đạo hữu, dường như vẫn còn nhớ khí tức quen thuộc.*',
          ].join(
            '\n',
          ),
        ),
    );
  }

  if (
    !result.ok
  ) {
    return applyStyle(
      new EmbedBuilder()
        .setTitle(
          '<a:angryg1:1541441195144773652> LINH THÚ RỜI ĐI',
        )
        .setDescription(
          [
            'Linh thú cảnh giác nhìn đạo hữu một lúc rồi hóa thành một đạo lưu quang biến mất giữa núi rừng.',
            '',
            SEPARATOR,
            '',
            `${PET_EMOJI} **${pet?.name || 'Linh Thú'}**`,
            'Thu Phục: **Thất Bại**',
            '',
            '*Hữu duyên, ngày sau ắt sẽ gặp lại.*',
          ].join(
            '\n',
          ),
        ),
    );
  }

  return applyStyle(
    new EmbedBuilder()
      .setTitle(
        '<a:trangtrig2:1546040703375904801> LINH THÚ NHẬN CHỦ <a:trangtrig3:1546040818261954610>',
      )
      .setDescription(
        [
          'Linh thú chậm rãi tiến đến, khí tức dần hòa cùng thần thức của đạo hữu.',
          '',
          SEPARATOR,
          '',
          `${PET_EMOJI} Thu Phục: **${pet.name}**`,
          `Phẩm Chất: **${pet.rarity}**`,
          '',
          '**Hiệu Quả**',
          `**${pet.effect}**`,
          '',
          result.autoEquipped
            ? `${PET_EMOJI} Đã tự động trở thành **Linh Thú Đồng Hành**.`
            : null,
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

export function buildPetResultRows(
  ownerId,
) {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tutien_action:${ownerId}:pet`,
          )
          .setLabel(
            'Linh Thú',
          )
          .setEmoji(
            PET_BUTTON_EMOJI,
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
            PET_BUTTON_EMOJI,
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  ];
}
