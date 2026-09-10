import {
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../../config/cultivationGame.js';

import {
  startAdventureV2,
  resolveAdventureV2Choice,
  clearAdventureV2Session,
} from '../../services/cultivationAdventureV2.js';

import {
  buildAdventureMerchantEmbed,
  buildAdventureMerchantRows,
  buildHeavenlyFortuneEmbed,
  buildAdventureV294BackRows,
} from '../../services/cultivationAdventureV294UI.js';

/**
 * =========================================================
 * TU TIÊN TEST · GM COMMAND
 * =========================================================
 *
 * Lệnh admin dùng để ép event Thám Hiểm.
 *
 * Hiện hỗ trợ:
 * - Thương Nhân Thần Bí
 * - Thiên Đạo Cơ Duyên
 *
 * Event test chạy SERVICE + UI THẬT.
 */

const TUTIEN_ADMIN_ROLE_ID =
  '1541303749916754001';

/**
 * =========================================================
 * TEST LOCATION
 * =========================================================
 *
 * Merchant / Heavenly Fortune chỉ xuất hiện
 * ở nhánh pavilion của Đào Hoa Cốc.
 */

const TEST_LOCATION_ID =
  'dao_hoa_coc';

const TEST_CHOICE_ID =
  'pavilion';

/**
 * =========================================================
 * FORCE RANDOM HELPER
 * =========================================================
 *
 * resolveAdventureV2Choice() gọi
 * rollPavilionSpecialEvent() -> Math.random().
 *
 * merchant:
 *   roll < 0.30
 *
 * heavenly_fortune:
 *   0.30 <= roll < 0.38
 *
 * Ta tạm override Math.random CHỈ trong lúc
 * resolve event rồi lập tức restore.
 */

async function withForcedRandom(
  value,
  task,
) {
  const originalRandom =
    Math.random;

  try {
    Math.random =
      () => value;

    return await task();
  } finally {
    Math.random =
      originalRandom;
  }
}

/**
 * =========================================================
 * FORCE LOCATION
 * =========================================================
 *
 * startAdventureV2() chọn location random.
 *
 * Để không phải sửa service production,
 * command sẽ gọi startAdventureV2 nhiều lần
 * sau khi clear session cho tới khi gặp đúng
 * Đào Hoa Cốc.
 *
 * Tuy nhiên cách đó không ổn vì startAdventureV2
 * có thể liên quan state.
 *
 * Vì vậy command dùng Math.random để ép location.
 */

async function createTestAdventure(
  client,
  guildId,
  userId,
) {
  await clearAdventureV2Session(
    client,
    guildId,
    userId,
  );

  /**
   * Thử các random value cố định để tìm Đào Hoa Cốc.
   *
   * Nếu cấu trúc location thay đổi sau này,
   * fallback sẽ thử nhiều vùng random khác nhau.
   */
  const values = [
    0.50,
    0.55,
    0.60,
    0.65,
    0.70,
    0.75,
    0.80,
    0.85,
    0.90,
    0.95,
    0.40,
    0.30,
    0.20,
    0.10,
  ];

  for (
    const value of
      values
  ) {
    await clearAdventureV2Session(
      client,
      guildId,
      userId,
    );

    const result =
      await withForcedRandom(
        value,

        () =>
          startAdventureV2(
            client,
            guildId,
            userId,
          ),
      );

    if (
      result?.ok &&
      result.location?.id ===
        TEST_LOCATION_ID
    ) {
      return result;
    }
  }

  await clearAdventureV2Session(
    client,
    guildId,
    userId,
  );

  return {
    ok: false,

    reason:
      'cannot_force_location',
  };
}

/**
 * =========================================================
 * COMMAND
 * =========================================================
 */

export default {
  data:
    new SlashCommandBuilder()
      .setName(
        'tutientest',
      )

      .setDescription(
        'GM: Ép event để test hệ thống Thám Hiểm Tiên Lộ.',
      )

      .addStringOption(
        option =>
          option
            .setName(
              'event',
            )

            .setDescription(
              'Chọn event muốn ép xuất hiện.',
            )

            .setRequired(
              true,
            )

            .addChoices(
              {
                name:
                  '🛒 Thương Nhân Thần Bí',

                value:
                  'merchant',
              },

              {
                name:
                  '✨ Thiên Đạo Cơ Duyên',

                value:
                  'heavenly_fortune',
              },
            ),
      ),

  category:
    'Games',

  async execute(
    interaction,
  ) {
    /**
     * =====================================================
     * SERVER ONLY
     * =====================================================
     */

    if (
      !interaction.guildId ||
      !interaction.guild
    ) {
      return interaction.reply({
        content:
          'Lệnh này chỉ có thể sử dụng trong server.',

        flags:
          MessageFlags.Ephemeral,
      });
    }

    /**
     * =====================================================
     * ADMIN ROLE
     * =====================================================
     */

    const member =
      interaction.member;

    const hasAdminRole =
      member
        ?.roles
        ?.cache
        ?.has(
          TUTIEN_ADMIN_ROLE_ID,
        );

    if (!hasAdminRole) {
      return interaction.reply({
        content:
          '<a:angryg1:1541441195144773652> Bạn không có quyền sử dụng lệnh test Tiên Lộ.',

        flags:
          MessageFlags.Ephemeral,
      });
    }

    /**
     * =====================================================
     * GAME ENABLED
     * =====================================================
     */

    if (
      !CULTIVATION_CONFIG
        .enabled
    ) {
      return interaction.reply({
        content:
          'Tiên Lộ hiện đang tạm đóng.',

        flags:
          MessageFlags.Ephemeral,
      });
    }

    /**
     * =====================================================
     * CHANNEL
     * =====================================================
     */

    if (
      CULTIVATION_CONFIG
        .channelId &&
      interaction.channelId !==
        CULTIVATION_CONFIG
          .channelId
    ) {
      return interaction.reply({
        content:
          `Tiên Lộ chỉ mở tại <#${CULTIVATION_CONFIG.channelId}>.`,

        flags:
          MessageFlags.Ephemeral,
      });
    }

    const event =
      interaction.options
        .getString(
          'event',
          true,
        );

    /**
     * =====================================================
     * PREPARE TEST SESSION
     * =====================================================
     */

    const adventure =
      await createTestAdventure(
        interaction.client,
        interaction.guildId,
        interaction.user.id,
      );

    if (!adventure.ok) {
      return interaction.reply({
        content:
          '❌ Không thể tạo phiên Đào Hoa Cốc để test. Báo mình để mình cập nhật test helper.',

        flags:
          MessageFlags.Ephemeral,
      });
    }

    /**
     * =====================================================
     * MERCHANT
     * =====================================================
     */

    if (
      event ===
      'merchant'
    ) {
      /**
       * 0.10 chắc chắn nằm trong:
       * roll < 0.30
       */
      const result =
        await withForcedRandom(
          0.10,

          () =>
            resolveAdventureV2Choice(
              interaction.client,
              interaction.guildId,
              interaction.user.id,
              TEST_CHOICE_ID,
            ),
        );

      if (
        !result?.ok ||
        result.type !==
          'merchant'
      ) {
        await clearAdventureV2Session(
          interaction.client,
          interaction.guildId,
          interaction.user.id,
        );

        return interaction.reply({
          content:
            `❌ Test Merchant thất bại. Kết quả nhận được: \`${result?.type || result?.reason || 'unknown'}\``,

          flags:
            MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [
          buildAdventureMerchantEmbed(
            result,
          ),
        ],

        components:
          buildAdventureMerchantRows(
            interaction.user.id,
            result.stock,
          ),
      });
    }

    /**
     * =====================================================
     * HEAVENLY FORTUNE
     * =====================================================
     */

    if (
      event ===
      'heavenly_fortune'
    ) {
      /**
       * 0.34:
       *
       * không < 0.30
       * nhưng < 0.38
       *
       * => Heavenly Fortune.
       */
      const result =
        await withForcedRandom(
          0.34,

          () =>
            resolveAdventureV2Choice(
              interaction.client,
              interaction.guildId,
              interaction.user.id,
              TEST_CHOICE_ID,
            ),
        );

      if (
        !result?.ok ||
        result.type !==
          'heavenly_fortune'
      ) {
        await clearAdventureV2Session(
          interaction.client,
          interaction.guildId,
          interaction.user.id,
        );

        return interaction.reply({
          content:
            `❌ Test Thiên Đạo Cơ Duyên thất bại. Kết quả nhận được: \`${result?.type || result?.reason || 'unknown'}\``,

          flags:
            MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        embeds: [
          buildHeavenlyFortuneEmbed(
            result,
          ),
        ],

        components:
          buildAdventureV294BackRows(
            interaction.user.id,
          ),
      });
    }

    /**
     * =====================================================
     * UNKNOWN
     * =====================================================
     */

    await clearAdventureV2Session(
      interaction.client,
      interaction.guildId,
      interaction.user.id,
    );

    return interaction.reply({
      content:
        'Không tìm thấy event test tương ứng.',

      flags:
        MessageFlags.Ephemeral,
    });
  },
};
