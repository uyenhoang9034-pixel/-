import {
  getCultivationProfile,
  removeInventoryItem,
  saveCultivationProfile,
} from './cultivationService.js';

/**
 * =========================================================
 * CÔNG PHÁP · 功法
 * =========================================================
 */

export const CULTIVATION_TECHNIQUES = {
  thanh_van_kiem_quyet: {
    id: 'thanh_van_kiem_quyet',

    name: 'Thanh Vân Kiếm Quyết',

    emoji:
      '<a:trangtrig18:1546068102817775626>',

    description:
      'Kiếm tâm nhất niệm, thanh vân tự khai.',

    materialId:
      'vo_danh_kiem_pho',

    materialName:
      'Vô Danh Kiếm Phổ',

    materialAmount: 1,

    effect:
      '+8% Tu Vi khi Tu Luyện',

    effectType:
      'cultivation_bonus',

    effectValue:
      0.08,
  },

  huyen_nguyen_tam_phap: {
    id: 'huyen_nguyen_tam_phap',

    name:
      'Huyền Nguyên Tâm Pháp',

    emoji:
      '<a:trangtrig18:1546068102817775626>',

    description:
      'Tâm định khí hòa, đạo cơ tự nhiên viên mãn.',

    materialId:
      'vo_danh_kiem_pho',

    materialName:
      'Vô Danh Kiếm Phổ',

    materialAmount: 1,

    effect:
      '+5% Tỷ Lệ Đột Phá',

    effectType:
      'breakthrough_bonus',

    effectValue:
      0.05,
  },

  tu_linh_chan_kinh: {
    id: 'tu_linh_chan_kinh',

    name:
      'Tụ Linh Chân Kinh',

    emoji:
      '<a:trangtrig18:1546068102817775626>',

    description:
      'Tụ thiên địa linh vận, hóa vạn khí thành tài.',

    materialId:
      'vo_danh_kiem_pho',

    materialName:
      'Vô Danh Kiếm Phổ',

    materialAmount: 1,

    effect:
      '+8% Linh Thạch nhận được',

    effectType:
      'spirit_stone_bonus',

    effectValue:
      0.08,
  },
};

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

export function getTechnique(
  techniqueId,
) {
  return (
    CULTIVATION_TECHNIQUES[
      techniqueId
    ] || null
  );
}

export function getTechniqueList() {
  return Object.values(
    CULTIVATION_TECHNIQUES,
  );
}

export function ensureTechniqueData(
  profile,
) {
  if (
    !profile.techniques ||
    typeof profile.techniques !==
      'object'
  ) {
    profile.techniques = {
      learned: {},
      active: null,
    };
  }

  if (
    !profile.techniques.learned ||
    typeof profile.techniques.learned !==
      'object'
  ) {
    profile.techniques.learned = {};
  }

  if (
    typeof profile.techniques.active !==
      'string'
  ) {
    profile.techniques.active =
      null;
  }

  return profile;
}

export function getLearnedTechniques(
  profile,
) {
  ensureTechniqueData(
    profile,
  );

  return getTechniqueList()
    .filter(
      (technique) =>
        profile.techniques
          .learned[
            technique.id
          ] === true,
    );
}

export function getActiveTechnique(
  profile,
) {
  ensureTechniqueData(
    profile,
  );

  if (
    !profile.techniques.active
  ) {
    return null;
  }

  return getTechnique(
    profile.techniques.active,
  );
}

export function getTechniqueBonus(
  profile,
  effectType,
) {
  const technique =
    getActiveTechnique(
      profile,
    );

  if (
    !technique ||
    technique.effectType !==
      effectType
  ) {
    return 0;
  }

  return (
    Number(
      technique.effectValue,
    ) || 0
  );
}

export function getTechniqueMaterialQuantity(
  profile,
) {
  return Math.max(
    0,
    Number(
      profile.inventory
        ?.vo_danh_kiem_pho,
    ) || 0,
  );
}

/**
 * =========================================================
 * PLAYER LOCK
 * =========================================================
 */

const techniqueLocks =
  new Map();

async function withTechniqueLock(
  key,
  callback,
) {
  while (
    techniqueLocks.has(
      key,
    )
  ) {
    await techniqueLocks.get(
      key,
    );
  }

  let release;

  const lock =
    new Promise(
      (resolve) => {
        release = resolve;
      },
    );

  techniqueLocks.set(
    key,
    lock,
  );

  try {
    return await callback();
  } finally {
    techniqueLocks.delete(
      key,
    );

    release();
  }
}

/**
 * =========================================================
 * LĨNH NGỘ CÔNG PHÁP
 * =========================================================
 */

export async function learnCultivationTechnique(
  client,
  guildId,
  userId,
  techniqueId,
) {
  const lockKey =
    `cultivation:${guildId}:${userId}`;

  return withTechniqueLock(
    lockKey,

    async () => {
      const technique =
        getTechnique(
          techniqueId,
        );

      if (!technique) {
        return {
          ok: false,
          reason:
            'invalid_technique',
        };
      }

      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      ensureTechniqueData(
        profile,
      );

      if (
        profile.techniques
          .learned[
            technique.id
          ] === true
      ) {
        return {
          ok: false,
          reason:
            'already_learned',
          technique,
          profile,
        };
      }

      const available =
        getTechniqueMaterialQuantity(
          profile,
        );

      if (
        available <
        technique.materialAmount
      ) {
        return {
          ok: false,
          reason:
            'not_enough_material',
          technique,
          available,
          profile,
        };
      }

      const removed =
        removeInventoryItem(
          profile,
          technique.materialId,
          technique.materialAmount,
        );

      if (!removed) {
        return {
          ok: false,
          reason:
            'consume_failed',
          technique,
          available,
          profile,
        };
      }

      profile.techniques
        .learned[
          technique.id
        ] = true;

      /**
       * Công Pháp đầu tiên học được
       * sẽ tự động kích hoạt.
       */

      if (
        !profile.techniques.active
      ) {
        profile.techniques.active =
          technique.id;
      }

      const saved =
        await saveCultivationProfile(
          client,
          profile,
        );

      return {
        ok: true,

        technique,

        consumed:
          technique.materialAmount,

        remaining:
          saved.inventory
            ?.vo_danh_kiem_pho ||
          0,

        autoActivated:
          saved.techniques
            .active ===
          technique.id,

        profile:
          saved,
      };
    },
  );
}

/**
 * =========================================================
 * KÍCH HOẠT CÔNG PHÁP
 * =========================================================
 */

export async function activateCultivationTechnique(
  client,
  guildId,
  userId,
  techniqueId,
) {
  const technique =
    getTechnique(
      techniqueId,
    );

  if (!technique) {
    return {
      ok: false,
      reason:
        'invalid_technique',
    };
  }

  const profile =
    await getCultivationProfile(
      client,
      guildId,
      userId,
    );

  ensureTechniqueData(
    profile,
  );

  if (
    profile.techniques
      .learned[
        technique.id
      ] !== true
  ) {
    return {
      ok: false,
      reason:
        'not_learned',
      technique,
      profile,
    };
  }

  profile.techniques.active =
    technique.id;

  const saved =
    await saveCultivationProfile(
      client,
      profile,
    );

  return {
    ok: true,
    technique,
    profile:
      saved,
  };
}
