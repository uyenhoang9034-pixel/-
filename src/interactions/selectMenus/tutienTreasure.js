import {
  MessageFlags,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../../config/cultivationGame.js';

import {
  getCultivationProfile,
} from '../../services/cultivationService.js';

import {
  getCultivationTalisman,
} from '../../services/cultivationTreasure.js';

import {
  buildTalismanConfirmEmbed,
  buildTalismanConfirmRows,
} from '../../services/cultivationTreasureUI.js';

/**
 * =========================================================
 * COMMON VALIDATION
 * =========================================================
 */

async function validateInteraction(
  interaction,
  ownerId,
) {
  if (!ownerId) {
    return false;
  }

  if (
    interaction.user.id !==
    ownerId
  ) {
    await interaction.reply({
      content:
        'Đây là Bí Bảo của một đạo hữu khác.',

      flags:
        MessageFlags.Ephemeral,
    });

    return false;
  }

  if (
    CULTIVATION_CONFIG
      .channelId &&
    interaction.channelId !==
      CULTIVATION_CONFIG
        .channelId
  ) {
    await interaction.reply({
      content:
        `Tiên Lộ chỉ mở tại <#${CULTIVATION_CONFIG.channelId}>.`,

      flags:
        MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
}

/**
 * =========================================================
 * CHỌN PHÙ HIỆU
 * =========================================================
 */

export const talismanSelectHandler = {
  name:
    'tutien_talisman_select',

  async execute(
    interaction,
    client,
    args = [],
  ) {
    const [
      ownerId,
    ] = args;

    if (
      !(await validateInteraction(
        interaction,
        ownerId,
      ))
    ) {
      return;
    }

    const talismanId =
      interaction.values?.[
        0
      ];

    if (!talismanId) {
      return interaction.reply({
        content:
          'Không xác định được Phù Hiệu.',

        flags:
          MessageFlags.Ephemeral,
      });
    }

    const talisman =
      getCultivationTalisman(
        talismanId,
      );

    if (!talisman) {
      return interaction.reply({
        content:
          'Không tìm thấy Phù Hiệu này.',

        flags:
          MessageFlags.Ephemeral,
      });
    }

    const profile =
      await getCultivationProfile(
        client,
        interaction.guildId,
        interaction.user.id,
      );

    /**
     * Nếu đang có phù khác active,
     * không mở confirm nữa.
     */

    if (
      profile.treasure
        ?.activeTalisman
    ) {
      return interaction.reply({
        content:
          'Đạo hữu hiện đã có một Phù Hiệu đang kích hoạt.',

        flags:
          MessageFlags.Ephemeral,
      });
    }

    return interaction.update({
      embeds: [
        buildTalismanConfirmEmbed(
          interaction.user,
          profile,
          talismanId,
        ),
      ],

      components:
        buildTalismanConfirmRows(
          ownerId,
          talismanId,
        ),
    });
  },
};

export default [
  talismanSelectHandler,
];
