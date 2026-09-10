import {
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../../config/cultivationGame.js';

import {
  clearAdventureV2Session,
} from '../../services/cultivationAdventureV2.js';

import {
  startAdventureMerchant,
  resolveHeavenlyFortune,
} from '../../services/cultivationAdventureV294.js';

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
 * Ép thẳng event để test.
 *
 * KHÔNG:
 * - roll map
 * - chờ random Đào Hoa Cốc
 * - kiểm tra cooldown trước khi tạo event
 *
 * CÓ:
 * - dùng service event thật
 * - dùng UI thật
 * - button Merchant thật
 * - mua/rời Merchant thật
 * - reward Heavenly Fortune thật
 */

const TUTIEN_ADMIN_ROLE_ID =
  '1541303749916754001';

const ADVENTURE_SESSION_PREFIX =
  'games:cultivation:adventureV2:';

/**
 * =========================================================
 * SESSION KEY
 * =========================================================
 */

function getAdventureSessionKey(
  guildId,
  userId,
) {
  return `${ADVENTURE_SESSION_PREFIX}${guildId}:${userId}`;
}

/**
 * =========================================================
 * CREATE FORCED ĐÀO HOA CỐC SESSION
 * =========================================================
 */

async function createForcedPavilionSession(
  client,
  guildId,
  userId,
) {
  /**
   * Dọn session cũ trước.
   */
  await clearAdventureV2Session(
    client,
    guildId,
    userId,
  );

  const now =
    Date.now();

  /**
   * Đây chính là format session
   * cultivationAdventureV2 đang sử dụng.
   */
  const session = {
    version:
      1,

    guildId,
    userId,

    locationId:
      'dao_hoa_coc',

    state:
      'location',

    monster:
      null,

    createdAt:
      now,

    updatedAt:
      now,
  };

  await client.db.set(
    getAdventureSessionKey(
      guildId,
      userId,
    ),
    session,
  );

  return session;
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
              'Chọn event muốn test.',
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
     * CHANNEL CHECK
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

    const client =
      interaction.client;

    const guildId =
      interaction.guildId;

    const userId =
      interaction.user.id;

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
       * Ép session thẳng vào:
       *
       * Đào Hoa Cốc
       * -> state location
       * -> pavilion
       */
      await createForcedPavilionSession(
        client,
        guildId,
        userId,
      );

      /**
       * Gọi service Merchant thật.
       */
      const result =
        await startAdventureMerchant(
          client,
          guildId,
          userId,
        );

      if (!result.ok) {
        await clearAdventureV2Session(
          client,
          guildId,
          userId,
        );

        return interaction.reply({
          content:
            `❌ Không thể tạo Merchant test: \`${result.reason || 'unknown'}\``,

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
            userId,
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
       * Ép session Đào Hoa Cốc.
       */
      await createForcedPavilionSession(
        client,
        guildId,
        userId,
      );

      /**
       * Gọi Thiên Đạo Cơ Duyên thật.
       *
       * Không cần random vì gọi trực tiếp service.
       */
      const result =
        await resolveHeavenlyFortune(
          client,
          guildId,
          userId,
        );

      if (!result.ok) {
        await clearAdventureV2Session(
          client,
          guildId,
          userId,
        );

        return interaction.reply({
          content:
            `❌ Không thể tạo Thiên Đạo Cơ Duyên test: \`${result.reason || 'unknown'}\``,

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
            userId,
          ),
      });
    }

    /**
     * =====================================================
     * UNKNOWN
     * =====================================================
     */

    return interaction.reply({
      content:
        'Không tìm thấy event test tương ứng.',

      flags:
        MessageFlags.Ephemeral,
    });
  },
};
