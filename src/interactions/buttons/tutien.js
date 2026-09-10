import {
  MessageFlags,
} from 'discord.js';

import {
  CULTIVATION_CONFIG,
} from '../../config/cultivationGame.js';

import {
breakthrough,
  cultivate,
  getCultivationLeaderboard,
  getCultivationProfile,
  useCultivationItem,
} from '../../services/cultivationService.js';
import {
  comprehendAncientTablet,
  disarmAncientChest,
  fightAdventureV2Monster,
  getAdventureV2CombatInfo,
  getAdventureV2Preview,
  inspectAncientChest,
  leaveAncientChest,
  openAncientChest,
  openAncientStoneGate,
  resolveAdventureV2Choice,
  retreatAdventureV2,
  startAdventureV2,
} from '../../services/cultivationAdventureV2.js';

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
  buildAdventureV2AssistEmbed,
  buildAdventureV2AssistRows,
  buildAdventureV2CombatResultEmbed,
  buildAdventureV2ErrorEmbed,
  buildAdventureV2ErrorRows,
  buildAdventureV2LocationEmbed,
  buildAdventureV2LocationRows,
  buildAdventureV2MonsterEmbed,
  buildAdventureV2MonsterRows,
  buildAdventureV2PreviewEmbed,
  buildAdventureV2PreviewRows,
  buildAdventureV2ResultEmbed,
  buildAdventureV2ResultRows,
  buildAdventureV2RetreatEmbed,
  buildAdventureV2RetreatRows,

  buildAncientChestEmbed,
  buildAncientChestInspectEmbed,
  buildAncientChestInspectRows,
  buildAncientChestLeaveEmbed,
  buildAncientChestResultEmbed,
  buildAncientChestRows,

  buildAncientGateEmbed,
  buildAncientGateFailedEmbed,
  buildAncientGateRows,

  buildAncientTabletEmbed,
  buildAncientTabletRows,

  buildChestDisarmEmbed,
  buildChestDisarmRows,
} from '../../services/cultivationAdventureV2UI.js';

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
 * PLAYER CHECK
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
     * OWNER
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
     * CHANNEL
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
 * THÁM HIỂM · V2.9
 * =====================================================
 */

if (
  action ===
  'adventure'
) {
  const result =
    await getAdventureV2Preview(
      client,
      guildId,
      userId,
    );

  return interaction.update({
    embeds: [
      buildAdventureV2PreviewEmbed(
        interaction.user,
        result,
      ),
    ],

    components:
      buildAdventureV2PreviewRows(
        ownerId,
        result.ok,
      ),
  });
}

/**
 * =====================================================
 * THÁM HIỂM · BẮT ĐẦU
 * =====================================================
 */

if (
  action ===
  'adventure_v2_start'
) {
  const result =
    await startAdventureV2(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    const preview =
      await getAdventureV2Preview(
        client,
        guildId,
        userId,
      );

    return interaction.update({
      embeds: [
        buildAdventureV2PreviewEmbed(
          interaction.user,
          preview,
        ),
      ],

      components:
        buildAdventureV2PreviewRows(
          ownerId,
          false,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAdventureV2LocationEmbed(
        result.location,
      ),
    ],

    components:
      buildAdventureV2LocationRows(
        ownerId,
        result.location,
      ),
  });
}

/**
 * =====================================================
 * THÁM HIỂM · CHỌN HƯỚNG
 * =====================================================
 */

if (
  action ===
  'adventure_v2_choice'
) {
  if (!extra) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  const result =
    await resolveAdventureV2Choice(
      client,
      guildId,
      userId,
      extra,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  /**
   * ===============================================
   * LINH THÚ HIỆN THẾ
   * ===============================================
   */

  if (
    result.type ===
      'pet_encounter' &&
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
 * ===============================================
 * BIA ĐÁ / CỔ VĂN
 * ===============================================
 */

if (
  result.type ===
  'stone_tablet'
) {
  return interaction.update({
    embeds: [
      buildAncientTabletEmbed(),
    ],

    components:
      buildAncientTabletRows(
        ownerId,
      ),
  });
}

/**
 * ===============================================
 * CỔNG ĐÁ
 * ===============================================
 */

if (
  result.type ===
  'stone_gate'
) {
  return interaction.update({
    embeds: [
      buildAncientGateEmbed(),
    ],

    components:
      buildAncientGateRows(
        ownerId,
      ),
  });
}
  /**
   * ===============================================
   * YÊU THÚ
   * ===============================================
   */

  if (
    result.type ===
    'monster'
  ) {
    return interaction.update({
      embeds: [
        buildAdventureV2MonsterEmbed(
          result,
        ),
      ],

      components:
        buildAdventureV2MonsterRows(
          ownerId,
        ),
    });
  }

  /**
   * ===============================================
   * KẾT QUẢ THƯỜNG
   * ===============================================
   */

  return interaction.update({
    embeds: [
      buildAdventureV2ResultEmbed(
        result,
      ),
    ],

    components:
      buildAdventureV2ResultRows(
        ownerId,
      ),
  });
}

/**
 * =====================================================
 * THÁM HIỂM · LINH THÚ TRỢ CHIẾN
 * =====================================================
 */

if (
  action ===
  'adventure_v2_assist'
) {
  const result =
    await getAdventureV2CombatInfo(
      client,
      guildId,
      userId,
      {
        petAssist: true,
      },
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAdventureV2AssistEmbed(
        result,
      ),
    ],

    components:
      buildAdventureV2AssistRows(
        ownerId,
        Boolean(
          result.pet,
        ),
      ),
  });
}

/**
 * =====================================================
 * THÁM HIỂM · GIAO CHIẾN
 * =====================================================
 */

if (
  action ===
  'adventure_v2_fight'
) {
  const result =
    await fightAdventureV2Monster(
      client,
      guildId,
      userId,
      {
        petAssist: false,
      },
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAdventureV2CombatResultEmbed(
        result,
      ),
    ],

    components:
      buildAdventureV2ResultRows(
        ownerId,
      ),
  });
}

/**
 * =====================================================
 * THÁM HIỂM · LINH THÚ TRỢ CHIẾN + GIAO CHIẾN
 * =====================================================
 */

if (
  action ===
  'adventure_v2_fight_assist'
) {
  const result =
    await fightAdventureV2Monster(
      client,
      guildId,
      userId,
      {
        petAssist: true,
      },
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAdventureV2CombatResultEmbed(
        result,
      ),
    ],

    components:
      buildAdventureV2ResultRows(
        ownerId,
      ),
  });
}

/**
 * =====================================================
 * THÁM HIỂM · RÚT LUI
 * =====================================================
 */

if (
  action ===
  'adventure_v2_retreat'
) {
  const result =
    await retreatAdventureV2(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAdventureV2RetreatEmbed(
        result,
      ),
    ],

    components:
      buildAdventureV2RetreatRows(
        ownerId,
        result.success,
      ),
  });
}
    /**
 * =====================================================
 * V2.9.2 · THAM NGỘ CỔ VĂN
 * =====================================================
 */

if (
  action ===
  'adventure_v2_comprehend'
) {
  const result =
    await comprehendAncientTablet(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAdventureV2ResultEmbed(
        result,
      ),
    ],

    components:
      buildAdventureV2ResultRows(
        ownerId,
      ),
  });
}

/**
 * =====================================================
 * V2.9.2 · PHÁ GIẢI CỔNG ĐÁ
 * =====================================================
 */

if (
  action ===
  'adventure_v2_gate_open'
) {
  const result =
    await openAncientStoneGate(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  /**
   * Phá phong ấn làm
   * Yêu Thú thức tỉnh.
   */

  if (
    result.type ===
    'monster'
  ) {
    return interaction.update({
      embeds: [
        buildAdventureV2MonsterEmbed(
          result,
        ),
      ],

      components:
        buildAdventureV2MonsterRows(
          ownerId,
        ),
    });
  }

  /**
   * Phản phệ.
   */

  if (
    result.type ===
    'gate_failed'
  ) {
    return interaction.update({
      embeds: [
        buildAncientGateFailedEmbed(
          result,
        ),
      ],

      components:
        buildAdventureV2ResultRows(
          ownerId,
        ),
    });
  }

  /**
   * Cổng mở →
   * Rương Cổ xuất hiện.
   */

  if (
    result.type ===
    'ancient_chest'
  ) {
    return interaction.update({
      embeds: [
        buildAncientChestEmbed(),
      ],

      components:
        buildAncientChestRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAdventureV2ErrorEmbed(),
    ],

    components:
      buildAdventureV2ErrorRows(
        ownerId,
      ),
  });
}

/**
 * =====================================================
 * V2.9.2 · KIỂM TRA RƯƠNG
 * =====================================================
 */

if (
  action ===
  'adventure_v2_chest_inspect'
) {
  const result =
    await inspectAncientChest(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAncientChestInspectEmbed(
        result,
      ),
    ],

    components:
      buildAncientChestInspectRows(
        ownerId,
        result.trapped,
      ),
  });
}

/**
 * =====================================================
 * V2.9.2 · PHÁ GIẢI CẤM CHẾ RƯƠNG
 * =====================================================
 */

if (
  action ===
  'adventure_v2_chest_disarm'
) {
  const result =
    await disarmAncientChest(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildChestDisarmEmbed(
        result,
      ),
    ],

    components:
      buildChestDisarmRows(
        ownerId,
        result.success,
      ),
  });
}

/**
 * =====================================================
 * V2.9.2 · MỞ RƯƠNG
 * =====================================================
 */

if (
  action ===
  'adventure_v2_chest_open'
) {
  const result =
    await openAncientChest(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAncientChestResultEmbed(
        result,
      ),
    ],

    components:
      buildAdventureV2ResultRows(
        ownerId,
      ),
  });
}

/**
 * =====================================================
 * V2.9.2 · BỎ QUA RƯƠNG
 * =====================================================
 */

if (
  action ===
  'adventure_v2_chest_leave'
) {
  const result =
    await leaveAncientChest(
      client,
      guildId,
      userId,
    );

  if (!result.ok) {
    return interaction.update({
      embeds: [
        buildAdventureV2ErrorEmbed(),
      ],

      components:
        buildAdventureV2ErrorRows(
          ownerId,
        ),
    });
  }

  return interaction.update({
    embeds: [
      buildAncientChestLeaveEmbed(),
    ],

    components:
      buildAdventureV2ResultRows(
        ownerId,
      ),
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
     * LUYỆN ĐAN · MAKE
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
     * LUYỆN KHÍ · MAKE
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
     * KÍCH HOẠT BÍ BẢO
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
     * THU PHỤC LINH THÚ
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
     * UNKNOWN
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
