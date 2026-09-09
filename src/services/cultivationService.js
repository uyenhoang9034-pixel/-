import { Mutex } from '../utils/mutex.js';

import {
  CULTIVATION_CONFIG,
  CULTIVATION_ADVENTURE_EVENTS,
  CULTIVATION_ADVENTURE_LOCATIONS,
  CULTIVATION_EVENTS,
  CULTIVATION_ITEMS,
  CULTIVATION_REALMS,
  CULTIVATION_STAGES,
  SPIRIT_ROOTS,
} from '../config/cultivationGame.js';

const PROFILE_PREFIX =
  'games:cultivation:profile:';

const ITEM_EFFECTS = {
  tu_khi_dan: {
    cultivationBonus: 0.25,
  },

  hoi_nguyen_dan: {
    staminaRestore: 30,
  },

  pha_canh_dan: {
    breakthroughBonus: 0.10,
  },
};

const USABLE_ITEM_IDS =
  new Set(
    Object.keys(
      ITEM_EFFECTS,
    ),
  );

/**
 * =========================================================
 * EQUIPMENT EFFECTS
 * =========================================================
 *
 * Không import cultivationEquipment.js tại đây
 * để tránh circular import.
 */

function getEquippedEquipmentId(
  profile,
) {
  return (
    profile.equipment
      ?.equipped || null
  );
}

function getEquipmentCultivationBonus(
  profile,
) {
  return (
    getEquippedEquipmentId(
      profile,
    ) ===
    'thanh_phong_kiem'
      ? 0.05
      : 0
  );
}

function getEquipmentSpiritStoneBonus(
  profile,
) {
  return (
    getEquippedEquipmentId(
      profile,
    ) ===
    'tu_linh_boi'
      ? 0.10
      : 0
  );
}

function getEquipmentBreakthroughLossReduction(
  profile,
) {
  return (
    getEquippedEquipmentId(
      profile,
    ) ===
    'huyen_thiet_ho_phu'
      ? 0.20
      : 0
  );
}

function getProfileKey(
  guildId,
  userId,
) {
  return `${PROFILE_PREFIX}${guildId}:${userId}`;
}

function getGuildProfilePrefix(
  guildId,
) {
  return `${PROFILE_PREFIX}${guildId}:`;
}

function randomInt(
  min,
  max,
) {
  return (
    Math.floor(
      Math.random() *
        (max - min + 1),
    ) + min
  );
}

function randomItem(
  array,
) {
  return array[
    Math.floor(
      Math.random() *
        array.length,
    )
  ];
}

function weightedPick(
  entries,
) {
  if (
    !Array.isArray(entries) ||
    entries.length === 0
  ) {
    return null;
  }

  const total =
    entries.reduce(
      (sum, entry) =>
        sum +
        Number(
          entry.weight || 0,
        ),
      0,
    );

  if (
    total <= 0
  ) {
    return entries[0];
  }

  let roll =
    Math.random() * total;

  for (
    const entry of entries
  ) {
    roll -=
      Number(
        entry.weight || 0,
      );

    if (
      roll <= 0
    ) {
      return entry;
    }
  }

  return entries[
    entries.length - 1
  ];
}

/**
 * =========================================================
 * PROFILE
 * =========================================================
 */

export function createCultivationProfile(
  guildId,
  userId,
) {
  const spiritRoot =
    weightedPick(
      SPIRIT_ROOTS,
    );

  return {
    version: 5,

    guildId,
    userId,

    realmIndex: 0,
    stageIndex: 0,

    cultivation: 0,
    totalCultivation: 0,

    spiritStones: 100,

    stamina:
      CULTIVATION_CONFIG
        .gameplay
        .maxStamina,

    maxStamina:
      CULTIVATION_CONFIG
        .gameplay
        .maxStamina,

    spiritRoot: {
      id:
        spiritRoot.id,

      name:
        spiritRoot.name,

      rarity:
        spiritRoot.rarity,

      cultivateBonus:
        spiritRoot
          .cultivateBonus ||
        0,
    },

    inventory: {},

    /**
     * =====================================================
     * PHÁP KHÍ
     * =====================================================
     *
     * owned:
     * {
     *   thanh_phong_kiem: 1,
     *   ...
     * }
     *
     * equipped:
     * id Pháp Khí đang trang bị.
     */

    equipment: {
      owned: {},
      equipped: null,
    },

    /**
     * Dược hiệu chỉ có tác dụng 1 lần.
     */

    effects: {
      nextCultivationBonus: 0,
      nextBreakthroughBonus: 0,
    },

    cooldowns: {
      cultivateAt: 0,
      adventureAt: 0,
    },

    stats: {
      cultivateCount: 0,

      breakthroughSuccess: 0,
      breakthroughFail: 0,

      fortunes: 0,

      adventureCount: 0,
      greatFortunes: 0,
      monsterEncounters: 0,

      itemsFound: 0,
      itemsUsed: 0,

      /**
       * Luyện Đan
       */

      alchemyCount: 0,
      alchemySuccess: 0,
      alchemyFail: 0,

      /**
       * Luyện Khí
       */

      forgeCount: 0,
      forgeSuccess: 0,
      forgeFail: 0,
    },

    createdAt:
      Date.now(),

    updatedAt:
      Date.now(),
  };
}

export function normalizeCultivationProfile(
  raw,
  guildId,
  userId,
) {
  if (
    !raw ||
    typeof raw !==
      'object'
  ) {
    return createCultivationProfile(
      guildId,
      userId,
    );
  }

  const base =
    createCultivationProfile(
      guildId,
      userId,
    );

  /**
   * =====================================================
   * INVENTORY
   * =====================================================
   */

  const rawInventory =
    raw.inventory &&
    typeof raw.inventory ===
      'object' &&
    !Array.isArray(
      raw.inventory,
    )
      ? raw.inventory
      : {};

  const inventory = {};

  for (
    const [
      itemId,
      quantity,
    ] of Object.entries(
      rawInventory,
    )
  ) {
    const normalizedQuantity =
      Math.max(
        0,
        Math.floor(
          Number(
            quantity,
          ) || 0,
        ),
      );

    if (
      normalizedQuantity >
      0
    ) {
      inventory[itemId] =
        normalizedQuantity;
    }
  }

  /**
   * =====================================================
   * EQUIPMENT
   * =====================================================
   */

  const rawOwnedEquipment =
    raw.equipment?.owned &&
    typeof raw.equipment
      .owned ===
      'object' &&
    !Array.isArray(
      raw.equipment.owned,
    )
      ? raw.equipment.owned
      : {};

  const ownedEquipment = {};

  for (
    const [
      equipmentId,
      quantity,
    ] of Object.entries(
      rawOwnedEquipment,
    )
  ) {
    const safeQuantity =
      Math.max(
        0,
        Math.floor(
          Number(
            quantity,
          ) || 0,
        ),
      );

    if (
      safeQuantity > 0
    ) {
      ownedEquipment[
        equipmentId
      ] =
        safeQuantity;
    }
  }

  const equipped =
    typeof raw.equipment
      ?.equipped ===
      'string'
      ? raw.equipment
          .equipped
      : null;

  return {
    ...base,
    ...raw,

    version: 5,

    guildId,
    userId,

    inventory,

    equipment: {
      owned:
        ownedEquipment,

      equipped,
    },

    effects: {
      ...base.effects,
      ...(raw.effects || {}),
    },

    cooldowns: {
      ...base.cooldowns,
      ...(raw.cooldowns || {}),
    },

    stats: {
      ...base.stats,
      ...(raw.stats || {}),
    },

    spiritRoot:
      raw.spiritRoot ||
      base.spiritRoot,

    realmIndex:
      Math.max(
        0,
        Math.min(
          Number(
            raw.realmIndex,
          ) || 0,

          CULTIVATION_REALMS.length -
            1,
        ),
      ),

    stageIndex:
      Math.max(
        0,
        Math.min(
          Number(
            raw.stageIndex,
          ) || 0,

          CULTIVATION_STAGES.length -
            1,
        ),
      ),

    cultivation:
      Math.max(
        0,
        Number(
          raw.cultivation,
        ) || 0,
      ),

    totalCultivation:
      Math.max(
        0,
        Number(
          raw.totalCultivation,
        ) || 0,
      ),

    spiritStones:
      Math.max(
        0,
        Number(
          raw.spiritStones,
        ) || 0,
      ),

    stamina:
      Math.max(
        0,
        Number(
          raw.stamina,
        ) || 0,
      ),

    maxStamina:
      Math.max(
        1,
        Number(
          raw.maxStamina,
        ) ||
          CULTIVATION_CONFIG
            .gameplay
            .maxStamina,
      ),
  };
}

export async function getCultivationProfile(
  client,
  guildId,
  userId,
  {
    create = true,
  } = {},
) {
  const key =
    getProfileKey(
      guildId,
      userId,
    );

  const raw =
    await client.db.get(
      key,
      null,
    );

  if (
    !raw &&
    !create
  ) {
    return null;
  }

  const profile =
    normalizeCultivationProfile(
      raw,
      guildId,
      userId,
    );

  if (
    !raw &&
    create
  ) {
    await client.db.set(
      key,
      profile,
    );
  }

  return profile;
}

export async function saveCultivationProfile(
  client,
  profile,
) {
  const data = {
    ...profile,

    version: 5,

    updatedAt:
      Date.now(),
  };

  await client.db.set(
    getProfileKey(
      data.guildId,
      data.userId,
    ),
    data,
  );

  return data;
}

/**
 * =========================================================
 * INVENTORY
 * =========================================================
 */

export function addInventoryItem(
  profile,
  itemId,
  quantity = 1,
) {
  if (
    !CULTIVATION_ITEMS[
      itemId
    ]
  ) {
    return false;
  }

  const safeQuantity =
    Math.max(
      1,
      Math.floor(
        Number(
          quantity,
        ) || 1,
      ),
    );

  if (
    !profile.inventory ||
    typeof profile.inventory !==
      'object'
  ) {
    profile.inventory = {};
  }

  profile.inventory[
    itemId
  ] =
    Math.max(
      0,
      Number(
        profile.inventory[
          itemId
        ],
      ) || 0,
    ) +
    safeQuantity;

  if (
    !profile.stats ||
    typeof profile.stats !==
      'object'
  ) {
    profile.stats = {};
  }

  profile.stats.itemsFound =
    Math.max(
      0,
      Number(
        profile.stats.itemsFound,
      ) || 0,
    ) +
    safeQuantity;

  return true;
}

export function removeInventoryItem(
  profile,
  itemId,
  quantity = 1,
) {
  const current =
    Math.max(
      0,
      Number(
        profile.inventory?.[
          itemId
        ],
      ) || 0,
    );

  const safeQuantity =
    Math.max(
      1,
      Math.floor(
        Number(
          quantity,
        ) || 1,
      ),
    );

  if (
    current <
    safeQuantity
  ) {
    return false;
  }

  const next =
    current -
    safeQuantity;

  if (
    next <= 0
  ) {
    delete profile.inventory[
      itemId
    ];
  } else {
    profile.inventory[
      itemId
    ] = next;
  }

  return true;
}

export function getInventoryEntries(
  profile,
) {
  const inventory =
    profile.inventory || {};

  return Object.entries(
    inventory,
  )
    .map(
      ([
        itemId,
        quantity,
      ]) => {
        const item =
          CULTIVATION_ITEMS[
            itemId
          ];

        if (
          !item ||
          quantity <= 0
        ) {
          return null;
        }

        return {
          ...item,
          quantity,
        };
      },
    )
    .filter(Boolean);
}

export function getUsableInventoryEntries(
  profile,
) {
  return getInventoryEntries(
    profile,
  ).filter(
    (item) =>
      USABLE_ITEM_IDS.has(
        item.id,
      ),
  );
}

export function isCultivationItemUsable(
  itemId,
) {
  return USABLE_ITEM_IDS.has(
    itemId,
  );
}

export function getCultivationItem(
  itemId,
) {
  return (
    CULTIVATION_ITEMS[
      itemId
    ] || null
  );
}

function rollAdventureDrop(
  event,
) {
  const dropChance =
    Number(
      event.dropChance,
    ) || 0;

  if (
    dropChance <= 0 ||
    Math.random() >
      dropChance
  ) {
    return null;
  }

  const drop =
    weightedPick(
      event.drops || [],
    );

  if (
    !drop ||
    !CULTIVATION_ITEMS[
      drop.itemId
    ]
  ) {
    return null;
  }

  const quantity =
    randomInt(
      Math.max(
        1,
        Number(
          drop.min,
        ) || 1,
      ),

      Math.max(
        1,
        Number(
          drop.max,
        ) || 1,
      ),
    );

  return {
    item:
      CULTIVATION_ITEMS[
        drop.itemId
      ],

    itemId:
      drop.itemId,

    quantity,
  };
}

/**
 * =========================================================
 * USE ITEM
 * =========================================================
 */

export async function useCultivationItem(
  client,
  guildId,
  userId,
  itemId,
) {
  const lockKey =
    `cultivation:${guildId}:${userId}`;

  return Mutex.runExclusive(
    lockKey,

    async () => {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      const item =
        CULTIVATION_ITEMS[
          itemId
        ];

      if (
        !item ||
        !USABLE_ITEM_IDS.has(
          itemId,
        )
      ) {
        return {
          ok: false,
          reason:
            'not_usable',
          profile,
          item,
        };
      }

      const quantity =
        Math.max(
          0,
          Number(
            profile.inventory?.[
              itemId
            ],
          ) || 0,
        );

      if (
        quantity <= 0
      ) {
        return {
          ok: false,
          reason:
            'not_owned',
          profile,
          item,
        };
      }

      /**
       * TỤ KHÍ ĐAN
       */

      if (
        itemId ===
        'tu_khi_dan'
      ) {
        if (
          Number(
            profile.effects
              ?.nextCultivationBonus,
          ) > 0
        ) {
          return {
            ok: false,
            reason:
              'effect_active',
            effect:
              'cultivation',
            profile,
            item,
          };
        }

        profile.effects
          .nextCultivationBonus =
          ITEM_EFFECTS
            .tu_khi_dan
            .cultivationBonus;

        removeInventoryItem(
          profile,
          itemId,
          1,
        );

        profile.stats
          .itemsUsed += 1;

        const saved =
          await saveCultivationProfile(
            client,
            profile,
          );

        return {
          ok: true,
          type:
            'cultivation_buff',

          item,

          bonus:
            ITEM_EFFECTS
              .tu_khi_dan
              .cultivationBonus,

          remaining:
            saved.inventory?.[
              itemId
            ] || 0,

          profile:
            saved,
        };
      }

      /**
       * HỒI NGUYÊN ĐAN
       */

      if (
        itemId ===
        'hoi_nguyen_dan'
      ) {
        if (
          profile.stamina >=
          profile.maxStamina
        ) {
          return {
            ok: false,
            reason:
              'stamina_full',
            profile,
            item,
          };
        }

        const before =
          profile.stamina;

        profile.stamina =
          Math.min(
            profile.maxStamina,
            profile.stamina +
              ITEM_EFFECTS
                .hoi_nguyen_dan
                .staminaRestore,
          );

        const restored =
          profile.stamina -
          before;

        removeInventoryItem(
          profile,
          itemId,
          1,
        );

        profile.stats
          .itemsUsed += 1;

        const saved =
          await saveCultivationProfile(
            client,
            profile,
          );

        return {
          ok: true,
          type:
            'stamina_restore',

          item,

          before,
          after:
            saved.stamina,

          restored,

          remaining:
            saved.inventory?.[
              itemId
            ] || 0,

          profile:
            saved,
        };
      }

      /**
       * PHÁ CẢNH ĐAN
       */

      if (
        itemId ===
        'pha_canh_dan'
      ) {
        if (
          Number(
            profile.effects
              ?.nextBreakthroughBonus,
          ) > 0
        ) {
          return {
            ok: false,
            reason:
              'effect_active',
            effect:
              'breakthrough',
            profile,
            item,
          };
        }

        profile.effects
          .nextBreakthroughBonus =
          ITEM_EFFECTS
            .pha_canh_dan
            .breakthroughBonus;

        removeInventoryItem(
          profile,
          itemId,
          1,
        );

        profile.stats
          .itemsUsed += 1;

        const saved =
          await saveCultivationProfile(
            client,
            profile,
          );

        return {
          ok: true,
          type:
            'breakthrough_buff',

          item,

          bonus:
            ITEM_EFFECTS
              .pha_canh_dan
              .breakthroughBonus,

          remaining:
            saved.inventory?.[
              itemId
            ] || 0,

          profile:
            saved,
        };
      }

      return {
        ok: false,
        reason:
          'not_usable',
        profile,
        item,
      };
    },
  );
}

/**
 * =========================================================
 * REALM
 * =========================================================
 */

export function getRealmName(
  profile,
) {
  return (
    CULTIVATION_REALMS[
      profile.realmIndex
    ] ||
    CULTIVATION_REALMS[0]
  );
}

export function getStageName(
  profile,
) {
  return (
    CULTIVATION_STAGES[
      profile.stageIndex
    ] ||
    CULTIVATION_STAGES[0]
  );
}

export function getRealmDisplay(
  profile,
) {
  return `${getRealmName(
    profile,
  )} · ${getStageName(
    profile,
  )}`;
}

export function getProgressionIndex(
  profile,
) {
  return (
    profile.realmIndex *
      CULTIVATION_STAGES.length +
    profile.stageIndex
  );
}

export function getCultivationRequired(
  profile,
) {
  const step =
    getProgressionIndex(
      profile,
    );

  return Math.round(
    500 *
      Math.pow(
        1.42,
        step,
      ),
  );
}

export function isMaxRealm(
  profile,
) {
  return (
    profile.realmIndex >=
      CULTIVATION_REALMS.length -
        1 &&
    profile.stageIndex >=
      CULTIVATION_STAGES.length -
        1
  );
}

export function getBreakthroughChance(
  profile,
) {
  const step =
    getProgressionIndex(
      profile,
    );

  const base =
    CULTIVATION_CONFIG
      .gameplay
      .breakthroughBaseChance;

  const min =
    CULTIVATION_CONFIG
      .gameplay
      .breakthroughMinChance;

  return Math.max(
    min,
    base -
      step * 0.008,
  );
}

export function getEffectiveBreakthroughChance(
  profile,
) {
  const base =
    getBreakthroughChance(
      profile,
    );

  const bonus =
    Math.max(
      0,
      Number(
        profile.effects
          ?.nextBreakthroughBonus,
      ) || 0,
    );

  return Math.min(
    0.95,
    base + bonus,
  );
}

/**
 * =========================================================
 * COOLDOWN
 * =========================================================
 */

export function getCultivateCooldownRemaining(
  profile,
) {
  const availableAt =
    Number(
      profile.cooldowns
        ?.cultivateAt,
    ) || 0;

  return Math.max(
    0,
    availableAt -
      Date.now(),
  );
}

export function getAdventureCooldownRemaining(
  profile,
) {
  const availableAt =
    Number(
      profile.cooldowns
        ?.adventureAt,
    ) || 0;

  return Math.max(
    0,
    availableAt -
      Date.now(),
  );
}

/**
 * =========================================================
 * TU LUYỆN
 * =========================================================
 */

export async function cultivate(
  client,
  guildId,
  userId,
) {
  const lockKey =
    `cultivation:${guildId}:${userId}`;

  return Mutex.runExclusive(
    lockKey,

    async () => {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      const cooldown =
        getCultivateCooldownRemaining(
          profile,
        );

      if (
        cooldown > 0
      ) {
        return {
          ok: false,

          reason:
            'cooldown',

          cooldownRemaining:
            cooldown,

          profile,
        };
      }

      const staminaCost =
        CULTIVATION_CONFIG
          .gameplay
          .cultivateStaminaCost;

      if (
        profile.stamina <
        staminaCost
      ) {
        return {
          ok: false,

          reason:
            'stamina',

          profile,
        };
      }

      const event =
        weightedPick(
          CULTIVATION_EVENTS,
        );

      const baseCultivation =
        randomInt(
          CULTIVATION_CONFIG
            .gameplay
            .cultivateBaseMin,

          CULTIVATION_CONFIG
            .gameplay
            .cultivateBaseMax,
        );

      const baseStones =
        randomInt(
          CULTIVATION_CONFIG
            .gameplay
            .spiritStoneMin,

          CULTIVATION_CONFIG
            .gameplay
            .spiritStoneMax,
        );

      const rootBonus =
        Number(
          profile
            .spiritRoot
            ?.cultivateBonus,
        ) || 0;

      let cultivationDelta =
        Math.round(
          baseCultivation *
            event
              .cultivationMultiplier *
            (1 +
              rootBonus),
        );

      /**
       * =====================================================
       * LINH THẠCH CƠ BẢN
       * =====================================================
       */

      let stoneDelta =
        Math.max(
          0,
          Math.round(
            baseStones *
              event
                .stoneMultiplier,
          ),
        );

      /**
       * =====================================================
       * TỤ LINH BỘI
       * =====================================================
       *
       * +10% Linh Thạch nhận được.
       */

      const equipmentStonePercent =
        getEquipmentSpiritStoneBonus(
          profile,
        );

      let equipmentStoneBonus =
        0;

      if (
        equipmentStonePercent >
          0 &&
        stoneDelta > 0
      ) {
        equipmentStoneBonus =
          Math.max(
            1,
            Math.round(
              stoneDelta *
                equipmentStonePercent,
            ),
          );

        stoneDelta +=
          equipmentStoneBonus;
      }

      /**
       * Nếu gặp event mất Tu Vi,
       * không cho mất quá số đang có.
       */

      if (
        cultivationDelta <
        0
      ) {
        cultivationDelta =
          -Math.min(
            profile.cultivation,
            Math.abs(
              cultivationDelta,
            ),
          );
      }

      /**
       * =====================================================
       * THANH PHONG KIẾM
       * =====================================================
       *
       * +5% Tu Vi khi Tu Luyện.
       *
       * Chỉ kích hoạt khi lần Tu Luyện
       * thực sự nhận Tu Vi.
       */

      const equipmentCultivationPercent =
        getEquipmentCultivationBonus(
          profile,
        );

      let equipmentCultivationBonus =
        0;

      if (
        equipmentCultivationPercent >
          0 &&
        cultivationDelta > 0
      ) {
        equipmentCultivationBonus =
          Math.max(
            1,
            Math.round(
              cultivationDelta *
                equipmentCultivationPercent,
            ),
          );
      }

      profile.cultivation =
        Math.max(
          0,
          profile.cultivation +
            cultivationDelta,
        );

      profile.totalCultivation +=
        Math.max(
          0,
          cultivationDelta,
        );

      /**
       * Cộng bonus Thanh Phong Kiếm.
       */

      if (
        equipmentCultivationBonus >
        0
      ) {
        profile.cultivation +=
          equipmentCultivationBonus;

        profile.totalCultivation +=
          equipmentCultivationBonus;
      }

      /**
       * =====================================================
       * TỤ KHÍ ĐAN
       * =====================================================
       */

      const pillPercent =
        Math.max(
          0,
          Number(
            profile.effects
              ?.nextCultivationBonus,
          ) || 0,
        );

      let cultivationPillBonus =
        0;

      if (
        pillPercent > 0
      ) {
        if (
          cultivationDelta >
          0
        ) {
          cultivationPillBonus =
            Math.max(
              1,
              Math.round(
                cultivationDelta *
                  pillPercent,
              ),
            );

          profile.cultivation +=
            cultivationPillBonus;

          profile.totalCultivation +=
            cultivationPillBonus;
        }

        /**
         * Tiêu hao dược hiệu sau
         * lần Tu Luyện kế tiếp.
         */

        profile.effects
          .nextCultivationBonus =
          0;
      }

      profile.spiritStones +=
        stoneDelta;

      profile.stamina =
        Math.max(
          0,
          profile.stamina -
            staminaCost,
        );

      profile.cooldowns
        .cultivateAt =
        Date.now() +
        CULTIVATION_CONFIG
          .gameplay
          .cultivateCooldownMs;

      profile.stats
        .cultivateCount += 1;

      if (
        event.id ===
          'minor_fortune' ||
        event.id ===
          'great_fortune'
      ) {
        profile.stats
          .fortunes += 1;
      }

      const saved =
        await saveCultivationProfile(
          client,
          profile,
        );

      return {
        ok: true,

        event,

        profile:
          saved,

        cultivationDelta,

        equipmentCultivationBonus,

        equipmentCultivationPercent,

        cultivationPillBonus,

        cultivationPillPercent:
          pillPercent,

        stoneDelta,

        equipmentStoneBonus,

        equipmentStonePercent,

        staminaCost,

        required:
          getCultivationRequired(
            saved,
          ),
      };
    },
  );
}

/**
 * =========================================================
 * THÁM HIỂM
 * =========================================================
 */

export async function adventure(
  client,
  guildId,
  userId,
) {
  const lockKey =
    `cultivation:${guildId}:${userId}`;

  return Mutex.runExclusive(
    lockKey,

    async () => {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      const cooldown =
        getAdventureCooldownRemaining(
          profile,
        );

      if (
        cooldown > 0
      ) {
        return {
          ok: false,

          reason:
            'cooldown',

          cooldownRemaining:
            cooldown,

          profile,
        };
      }

      const location =
        randomItem(
          CULTIVATION_ADVENTURE_LOCATIONS,
        );

      const event =
        weightedPick(
          CULTIVATION_ADVENTURE_EVENTS,
        );

      let cultivationDelta =
        0;

      let stoneDelta =
        0;

      let equipmentStoneBonus =
        0;

      let droppedItem =
        null;

      if (
        event.type ===
        'monster'
      ) {
        const requestedLoss =
          randomInt(
            event.cultivationLossMin,
            event.cultivationLossMax,
          );

        const actualLoss =
          Math.min(
            profile.cultivation,
            requestedLoss,
          );

        cultivationDelta =
          -actualLoss;

        profile.cultivation =
          Math.max(
            0,
            profile.cultivation -
              actualLoss,
          );

        profile.stats
          .monsterEncounters +=
          1;
      } else {
        cultivationDelta =
          randomInt(
            event.cultivationMin ||
              0,

            event.cultivationMax ||
              0,
          );

        stoneDelta =
          randomInt(
            event.stonesMin ||
              0,

            event.stonesMax ||
              0,
          );

        /**
         * ===================================================
         * TỤ LINH BỘI
         * ===================================================
         */

        const equipmentStonePercent =
          getEquipmentSpiritStoneBonus(
            profile,
          );

        if (
          equipmentStonePercent >
            0 &&
          stoneDelta > 0
        ) {
          equipmentStoneBonus =
            Math.max(
              1,
              Math.round(
                stoneDelta *
                  equipmentStonePercent,
              ),
            );

          stoneDelta +=
            equipmentStoneBonus;
        }

        const rootBonus =
          Number(
            profile
              .spiritRoot
              ?.cultivateBonus,
          ) || 0;

        cultivationDelta =
          Math.round(
            cultivationDelta *
              (1 +
                rootBonus),
          );

        profile.cultivation +=
          cultivationDelta;

        profile.totalCultivation +=
          cultivationDelta;

        profile.spiritStones +=
          stoneDelta;

        if (
          event.type ===
          'great_fortune'
        ) {
          profile.stats
            .greatFortunes +=
            1;

          profile.stats
            .fortunes += 1;
        }

        droppedItem =
          rollAdventureDrop(
            event,
          );

        if (
          droppedItem
        ) {
          addInventoryItem(
            profile,
            droppedItem.itemId,
            droppedItem.quantity,
          );
        }
      }

      profile.stats
        .adventureCount +=
        1;

      profile.cooldowns
        .adventureAt =
        Date.now() +
        CULTIVATION_CONFIG
          .gameplay
          .adventureCooldownMs;

      const saved =
        await saveCultivationProfile(
          client,
          profile,
        );

      return {
        ok: true,

        location,
        event,

        cultivationDelta,
        stoneDelta,

        equipmentStoneBonus,

        droppedItem,

        profile:
          saved,

        required:
          getCultivationRequired(
            saved,
          ),
      };
    },
  );
}

/**
 * =========================================================
 * ĐỘT PHÁ
 * =========================================================
 */

export async function breakthrough(
  client,
  guildId,
  userId,
) {
  const lockKey =
    `cultivation:${guildId}:${userId}`;

  return Mutex.runExclusive(
    lockKey,

    async () => {
      const profile =
        await getCultivationProfile(
          client,
          guildId,
          userId,
        );

      if (
        isMaxRealm(
          profile,
        )
      ) {
        return {
          ok: false,

          reason:
            'max_realm',

          profile,
        };
      }

      const required =
        getCultivationRequired(
          profile,
        );

      if (
        profile.cultivation <
        required
      ) {
        return {
          ok: false,

          reason:
            'not_ready',

          required,

          profile,
        };
      }

      const baseChance =
        getBreakthroughChance(
          profile,
        );

      const breakthroughPillBonus =
        Math.max(
          0,
          Number(
            profile.effects
              ?.nextBreakthroughBonus,
          ) || 0,
        );

      const chance =
        Math.min(
          0.95,
          baseChance +
            breakthroughPillBonus,
        );

      const oldRealm =
        getRealmDisplay(
          profile,
        );

      /**
       * Chỉ tiêu hao Phá Cảnh Đan
       * khi thực sự bắt đầu Đột Phá.
       */

      if (
        breakthroughPillBonus >
        0
      ) {
        profile.effects
          .nextBreakthroughBonus =
          0;
      }

      const success =
        Math.random() <
        chance;

      /**
       * =====================================================
       * ĐỘT PHÁ THÀNH CÔNG
       * =====================================================
       */

      if (
        success
      ) {
        profile.cultivation -=
          required;

        if (
          profile.stageIndex <
          CULTIVATION_STAGES.length -
            1
        ) {
          profile.stageIndex +=
            1;
        } else {
          profile.stageIndex =
            0;

          profile.realmIndex +=
            1;
        }

        profile.stats
          .breakthroughSuccess +=
          1;

        const saved =
          await saveCultivationProfile(
            client,
            profile,
          );

        return {
          ok: true,

          success: true,

          chance,

          baseChance,

          breakthroughPillBonus,

          oldRealm,

          newRealm:
            getRealmDisplay(
              saved,
            ),

          profile:
            saved,
        };
      }

      /**
       * =====================================================
       * ĐỘT PHÁ THẤT BẠI
       * =====================================================
       */

      const originalLoss =
        Math.max(
          1,
          Math.round(
            required *
              CULTIVATION_CONFIG
                .gameplay
                .breakthroughFailureLossPercent,
          ),
        );

      /**
       * =====================================================
       * HUYỀN THIẾT HỘ PHÙ
       * =====================================================
       *
       * Giảm 20% lượng Tu Vi
       * bị mất khi Đột Phá thất bại.
       */

      const equipmentLossReduction =
        getEquipmentBreakthroughLossReduction(
          profile,
        );

      const equipmentLossSaved =
        equipmentLossReduction >
        0
          ? Math.max(
              1,
              Math.round(
                originalLoss *
                  equipmentLossReduction,
              ),
            )
          : 0;

      const loss =
        Math.max(
          1,
          originalLoss -
            equipmentLossSaved,
        );

      profile.cultivation =
        Math.max(
          0,
          profile.cultivation -
            loss,
        );

      profile.stats
        .breakthroughFail +=
        1;

      const saved =
        await saveCultivationProfile(
          client,
          profile,
        );

      return {
        ok: true,

        success: false,

        chance,

        baseChance,

        breakthroughPillBonus,

        loss,

        originalLoss,

        equipmentLossReduction,

        equipmentLossSaved,

        oldRealm,

        profile:
          saved,
      };
    },
  );
}

/**
 * =========================================================
 * LEADERBOARD
 * =========================================================
 */

export async function getCultivationLeaderboard(
  client,
  guildId,
  limit = 10,
) {
  const prefix =
    getGuildProfilePrefix(
      guildId,
    );

  const keys =
    await client.db.list(
      prefix,
    );

  if (
    !Array.isArray(keys) ||
    keys.length === 0
  ) {
    return [];
  }

  const entries = [];

  for (
    const key of keys
  ) {
    const userId =
      key.slice(
        prefix.length,
      );

    if (!userId) {
      continue;
    }

    const profile =
      await getCultivationProfile(
        client,
        guildId,
        userId,
        {
          create: false,
        },
      );

    if (!profile) {
      continue;
    }

    entries.push({
      userId,

      profile,

      progressionIndex:
        getProgressionIndex(
          profile,
        ),
    });
  }

  entries.sort(
    (a, b) => {
      if (
        b.progressionIndex !==
        a.progressionIndex
      ) {
        return (
          b.progressionIndex -
          a.progressionIndex
        );
      }

      if (
        b.profile
          .cultivation !==
        a.profile
          .cultivation
      ) {
        return (
          b.profile
            .cultivation -
          a.profile
            .cultivation
        );
      }

      return (
        b.profile
          .totalCultivation -
        a.profile
          .totalCultivation
      );
    },
  );

  return entries.slice(
    0,
    limit,
  );
}
