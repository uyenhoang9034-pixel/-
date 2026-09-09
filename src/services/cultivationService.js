import { Mutex } from '../utils/mutex.js';

import {
  getCultivationProfile,
  removeInventoryItem,
  saveCultivationProfile,
} from './cultivationService.js';

export const CULTIVATION_TALISMANS = {
  ho_dao_phu: {
    id:
      'ho_dao_phu',

    name:
      'Hộ Đạo Phù',

    materialId:
      'thuong_co_phu',

    materialName:
      'Thượng Cổ Phù',

    materialAmount: 1,

    description:
      'Phù văn hộ thể, thiên kiếp cũng khó tổn đạo cơ.',

    effect:
      'Lần Đột Phá thất bại kế tiếp không mất Tu Vi.',

    effectType:
      'breakthrough_protection',
  },

  tam_bao_phu: {
    id:
      'tam_bao_phu',

    name:
      'Tầm Bảo Phù',

    materialId:
      'thuong_co_phu',

    materialName:
      'Thượng Cổ Phù',

    materialAmount: 1,

    description:
      'Phù quang dẫn lối, cơ duyên ẩn sâu cũng khó thoát khỏi linh thức.',

    effect:
      'Lần Thám Hiểm kế tiếp tăng mạnh tỷ lệ tìm thấy vật phẩm.',

    effectType:
      'adventure_drop_bonus',

    effectValue:
      0.35,
  },

  tu_tai_phu: {
    id:
      'tu_tai_phu',

    name:
      'Tụ Tài Phù',

    materialId:
      'thuong_co_phu',

    materialName:
      'Thượng Cổ Phù',

    materialAmount: 1,

    description:
      'Tài khí hội tụ, linh thạch theo phù lực mà đến.',

    effect:
      'Lần Thám Hiểm kế tiếp nhận thêm 50% Linh Thạch.',

    effectType:
      'adventure_stone_bonus',

    effectValue:
      0.50,
  },
};

export function getCultivationTalisman(
  talismanId,
) {
  return (
    CULTIVATION_TALISMANS[
      talismanId
    ] || null
  );
}

export function getCultivationTalismanList() {
  return Object.values(
    CULTIVATION_TALISMANS,
  );
}

export function ensureTreasureData(
  profile,
) {
  if (
    !profile.treasure ||
    typeof profile.treasure !==
      'object' ||
    Array.isArray(
      profile.treasure,
    )
  ) {
    profile.treasure = {
      activeTalisman:
        null,
    };
  }

  if (
    typeof profile.treasure
      .activeTalisman !==
      'string'
  ) {
    profile.treasure
      .activeTalisman =
      null;
  }

  return profile;
}

export function getActiveTalisman(
  profile,
) {
  ensureTreasureData(
    profile,
  );

  if (
    !profile.treasure
      .activeTalisman
  ) {
    return null;
  }

  return getCultivationTalisman(
    profile.treasure
      .activeTalisman,
  );
}

export function hasActiveTalisman(
  profile,
  effectType,
) {
  const talisman =
    getActiveTalisman(
      profile,
    );

  return (
    talisman?.effectType ===
    effectType
  );
}

export function getTalismanEffectValue(
  profile,
  effectType,
) {
  const talisman =
    getActiveTalisman(
      profile,
    );

  if (
    !talisman ||
    talisman.effectType !==
      effectType
  ) {
    return 0;
  }

  return Math.max(
    0,
    Number(
      talisman.effectValue,
    ) || 0,
  );
}

export function getAncientTalismanQuantity(
  profile,
) {
  return Math.max(
    0,
    Number(
      profile.inventory
        ?.thuong_co_phu,
    ) || 0,
  );
}

export async function activateCultivationTalisman(
  client,
  guildId,
  userId,
  talismanId,
) {
  const lockKey =
    `cultivation:${guildId}:${userId}`;

  return Mutex.runExclusive(
    lockKey,

    async () => {
      const talisman =
        getCultivationTalisman(
          talismanId,
        );

      if (!talisman) {
        return {
          ok: false,
          reason:
            'invalid_talisman',
        };
      }

      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      ensureTreasureData(
        profile,
      );

      const current =
        getActiveTalisman(
          profile,
        );

      if (current) {
        return {
          ok: false,
          reason:
            'talisman_active',
          activeTalisman:
            current,
          talisman,
          profile,
        };
      }

      const available =
        getAncientTalismanQuantity(
          profile,
        );

      if (
        available <
        talisman.materialAmount
      ) {
        return {
          ok: false,
          reason:
            'not_enough_material',
          available,
          required:
            talisman.materialAmount,
          talisman,
          profile,
        };
      }

      const removed =
        removeInventoryItem(
          profile,
          talisman.materialId,
          talisman.materialAmount,
        );

      if (!removed) {
        return {
          ok: false,
          reason:
            'consume_failed',
          talisman,
          profile,
        };
      }

      profile.treasure
        .activeTalisman =
        talisman.id;

      profile.stats
        .talismansActivated =
        Math.max(
          0,
          Number(
            profile.stats
              .talismansActivated,
          ) || 0,
        ) + 1;

      const saved =
        await saveCultivationProfile(
          client,
          profile,
        );

      return {
        ok: true,
        talisman,
        consumed: 1,

        remaining:
          saved.inventory
            ?.thuong_co_phu ||
          0,

        profile:
          saved,
      };
    },
  );
}
