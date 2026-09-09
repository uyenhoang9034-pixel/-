import {
  MessageFlags,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../../config/cultivationGame.js';

import {
  adventure,
  breakthrough,
  cultivate,
  getCultivationLeaderboard,
  getCultivationProfile,
  useCultivationItem,
} from '../../services/cultivationService.js';

import {
  brewCultivationPill,
} from '../../services/cultivationAlchemy.js';

import {
  forgeEquipment,
} from '../../services/cultivationEquipment.js';

import {
  learnCultivationTechnique,
} from '../../services/cultivationTechnique.js';

import {
  activateCultivationTalisman,
} from '../../services/cultivationTreasure.js';

import {
  captureCultivationPet,
} from '../../services/cultivationPet.js';

import {
  buildAdventureEmbed,
  buildBackRow,
  buildBreakthroughEmbed,
  buildCultivateEmbed,
  buildDashboardEmbed,
  buildDashboardRows,
  buildInventoryEmbed,
  buildInventoryRows,
  buildLeaderboardEmbed,
  buildProfileEmbed,
  buildUseItemResultEmbed,
  buildUseItemResultRows,
} from '../../services/cultivationUI.js';

import {
  buildAlchemyEmbed,
  buildAlchemyRows,
  buildAlchemyResultEmbed,
  buildAlchemyResultRows,
} from '../../services/cultivationAlchemyUI.js';

import {
  buildEquipmentEmbed,
  buildEquipmentRows,
  buildForgeEmbed,
  buildForgeResultEmbed,
  buildForgeResultRows,
  buildForgeRows,
} from '../../services/cultivationEquipmentUI.js';

import {
  buildTechniqueEmbed,
  buildTechniqueLearnResultEmbed,
  buildTechniqueResultRows,
  buildTechniqueRows,
} from '../../services/cultivationTechniqueUI.js';

import {
  buildTalismanResultEmbed,
  buildTalismanResultRows,
  buildTreasureEmbed,
  buildTreasureRows,
} from '../../services/cultivationTreasureUI.js';

import {
  buildPetCaptureResultEmbed,
  buildPetEmbed,
  buildPetEncounterEmbed,
  buildPetEncounterRows,
  buildPetResultRows,
  buildPetRows,
} from '../../services/cultivationPetUI.js';

/**
 * =========================================================
 * PLAYER LOCK
 * =========================================================
 */

async function rejectWrongPlayer(
  interaction,
  ownerId,
) {
  if (
    interaction.user.id ===
    ownerId
  ) {
    return false;
  }

  await interaction.reply({
    content:
      'Đây là Tiên Lộ của một đạo hữu khác. Dùng `/tutien` để mở hành trình của riêng bạn.',

    flags:
      MessageFlags.Ephemeral,
  });

  return true;
}

/**
 * =========================================================
 * CHANNEL CHECK
 * =========================================================
 */

async function enforceChannel(
  interaction,
) {
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
 * BUTTON HANDLER
 * =========================================================
 */

export default {
  name:
    'tutien_action',

  async execute(
    interaction,
    client,
    args = [],
  ) {
    const [
      ownerId,
      action,
      extra,
    ] = args;

    if (
      !ownerId ||
      !action
    ) {
      return;
    }

    /**
     * =====================================================
     * OWNER CHECK
     * =====================================================
     */

    if (
      await rejectWrongPlayer(
        interaction,
        ownerId,
      )
    ) {
      return;
    }

    /**
     * =====================================================
     * CHANNEL CHECK
     * =====================================================
     */

    if (
      !(await enforceChannel(
        interaction,
      ))
    ) {
      return;
    }

    const guildId =
      interaction.guildId;

    const userId =
      interaction.user.id;

    /**
     * =====================================================
     * DASHBOARD
     * =====================================================
     */

    if (
      action ===
      'dashboard'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildDashboardEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildDashboardRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * TU LUYỆN
     * =====================================================
     */

    if (
      action ===
      'cultivate'
    ) {
      const result =
        await cultivate(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildCultivateEmbed(
            result,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
            'cultivate',
          ),
        ],
      });
    }

    /**
     * =====================================================
     * ĐỘT PHÁ
     * =====================================================
     */

    if (
      action ===
      'breakthrough'
    ) {
      const result =
        await breakthrough(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildBreakthroughEmbed(
            result,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
            'breakthrough',
          ),
        ],
      });
    }

    /**
     * =====================================================
     * THÁM HIỂM
     * =====================================================
     */

    if (
      action ===
      'adventure'
    ) {
      const result =
        await adventure(
          client,
          guildId,
          userId,
        );

      /**
       * ===================================================
       * V2.8 — LINH THÚ HIỆN THẾ
       * ===================================================
       */

      if (
        result.ok &&
        result.petEncounter
      ) {
        return interaction.update({
          embeds: [
            buildPetEncounterEmbed(
              result.petEncounter,
            ),
          ],

          components:
            buildPetEncounterRows(
              ownerId,
              result.petEncounter,
            ),
        });
      }

      /**
       * Event Thám Hiểm bình thường.
       */

      return interaction.update({
        embeds: [
          buildAdventureEmbed(
            result,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
            'adventure',
          ),
        ],
      });
    }

    /**
     * =====================================================
     * TÚI ĐỒ
     * =====================================================
     */

    if (
      action ===
      'inventory'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildInventoryEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildInventoryRows(
            ownerId,
            profile,
          ),
      });
    }

    /**
     * =====================================================
     * SỬ DỤNG VẬT PHẨM
     * =====================================================
     */

    if (
      action ===
      'use_item'
    ) {
      if (!extra) {
        return interaction.reply({
          content:
            'Không xác định được vật phẩm cần sử dụng.',

          flags:
            MessageFlags.Ephemeral,
        });
      }

      const result =
        await useCultivationItem(
          client,
          guildId,
          userId,
          extra,
        );

      return interaction.update({
        embeds: [
          buildUseItemResultEmbed(
            result,
          ),
        ],

        components:
          buildUseItemResultRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * LUYỆN ĐAN
     * =====================================================
     */

    if (
      action ===
      'alchemy'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildAlchemyEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildAlchemyRows(
            ownerId,
            profile,
          ),
      });
    }

    /**
     * =====================================================
     * KHAI LÒ LUYỆN ĐAN
     * =====================================================
     */

    if (
      action ===
      'alchemy_make'
    ) {
      if (!extra) {
        return interaction.reply({
          content:
            'Không xác định được Đan Phương cần luyện.',

          flags:
            MessageFlags.Ephemeral,
        });
      }

      const result =
        await brewCultivationPill(
          client,
          guildId,
          userId,
          extra,
        );

      return interaction.update({
        embeds: [
          buildAlchemyResultEmbed(
            result,
          ),
        ],

        components:
          buildAlchemyResultRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * LUYỆN KHÍ
     * =====================================================
     */

    if (
      action ===
      'forge'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildForgeEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildForgeRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * KHAI LÒ LUYỆN KHÍ
     * =====================================================
     */

    if (
      action ===
      'forge_make'
    ) {
      if (!extra) {
        return interaction.reply({
          content:
            'Không xác định được Pháp Khí cần luyện.',

          flags:
            MessageFlags.Ephemeral,
        });
      }

      const result =
        await forgeEquipment(
          client,
          guildId,
          userId,
          extra,
        );

      return interaction.update({
        embeds: [
          buildForgeResultEmbed(
            result,
          ),
        ],

        components:
          buildForgeResultRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * PHÁP KHÍ
     * =====================================================
     */

    if (
      action ===
      'equipment'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildEquipmentEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildEquipmentRows(
            ownerId,
            profile,
          ),
      });
    }

    /**
     * =====================================================
     * CÔNG PHÁP
     * =====================================================
     */

    if (
      action ===
      'technique'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildTechniqueEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildTechniqueRows(
            ownerId,
            profile,
          ),
      });
    }

    /**
     * =====================================================
     * LĨNH NGỘ CÔNG PHÁP
     * =====================================================
     */

    if (
      action ===
      'technique_learn'
    ) {
      if (!extra) {
        return interaction.reply({
          content:
            'Không xác định được Công Pháp cần lĩnh ngộ.',

          flags:
            MessageFlags.Ephemeral,
        });
      }

      const result =
        await learnCultivationTechnique(
          client,
          guildId,
          userId,
          extra,
        );

      return interaction.update({
        embeds: [
          buildTechniqueLearnResultEmbed(
            result,
          ),
        ],

        components:
          buildTechniqueResultRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * BÍ BẢO · V2.7
     * =====================================================
     */

    if (
      action ===
      'treasure'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildTreasureEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildTreasureRows(
            ownerId,
            profile,
          ),
      });
    }

    /**
     * =====================================================
     * KÍCH HOẠT PHÙ HIỆU
     * =====================================================
     */

    if (
      action ===
      'talisman_activate'
    ) {
      if (!extra) {
        return interaction.reply({
          content:
            'Không xác định được Phù Hiệu cần kích hoạt.',

          flags:
            MessageFlags.Ephemeral,
        });
      }

      const result =
        await activateCultivationTalisman(
          client,
          guildId,
          userId,
          extra,
        );

      return interaction.update({
        embeds: [
          buildTalismanResultEmbed(
            result,
          ),
        ],

        components:
          buildTalismanResultRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * LINH THÚ · V2.8
     * =====================================================
     */

    if (
      action ===
      'pet'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildPetEmbed(
            interaction.user,
            profile,
          ),
        ],

        components:
          buildPetRows(
            ownerId,
            profile,
          ),
      });
    }

    /**
     * =====================================================
     * THU PHỤC LINH THÚ · V2.8
     * =====================================================
     */

    if (
      action ===
      'pet_capture'
    ) {
      if (!extra) {
        return interaction.reply({
          content:
            'Không xác định được Linh Thú cần thu phục.',

          flags:
            MessageFlags.Ephemeral,
        });
      }

      const result =
        await captureCultivationPet(
          client,
          guildId,
          userId,
          extra,
        );

      return interaction.update({
        embeds: [
          buildPetCaptureResultEmbed(
            result,
          ),
        ],

        components:
          buildPetResultRows(
            ownerId,
          ),
      });
    }

    /**
     * =====================================================
     * HỒ SƠ
     * =====================================================
     */

    if (
      action ===
      'profile'
    ) {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      return interaction.update({
        embeds: [
          buildProfileEmbed(
            interaction.user,
            profile,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
            'profile',
          ),
        ],
      });
    }

    /**
     * =====================================================
     * TIÊN BẢNG
     * =====================================================
     */

    if (
      action ===
      'leaderboard'
    ) {
      const entries =
        await getCultivationLeaderboard(
          client,
          guildId,
          10,
        );

      return interaction.update({
        embeds: [
          buildLeaderboardEmbed(
            entries,
            interaction.guild,
          ),
        ],

        components: [
          buildBackRow(
            ownerId,
            'leaderboard',
          ),
        ],
      });
    }

    /**
     * =====================================================
     * UNKNOWN ACTION
     * =====================================================
     */

    return interaction.reply({
      content:
        'Không tìm thấy hành động Tiên Lộ tương ứng.',

      flags:
        MessageFlags.Ephemeral,
    });
  },
};
