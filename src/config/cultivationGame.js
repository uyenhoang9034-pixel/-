export const CULTIVATION_CONFIG = {
  enabled: true,

  /**
   * =========================================================
   * GAME CHANNEL
   * =========================================================
   */

  channelId: '1547233544412205066',

  /**
   * =========================================================
   * UI
   * =========================================================
   */

  ui: {
    color: '#F3AFC8',

    footer:
      'Usagi Tu Tiên · Tiên đạo bắt đầu từ một niệm.',

    /**
     * Sau khi upload ảnh Tiên Lộ lên asset,
     * thay null bằng RAW URL của ảnh.
     */
    image: null,

    buttonEmojiId:
      '1546092641467506688',
  },

  /**
   * =========================================================
   * GAMEPLAY
   * =========================================================
   */

  gameplay: {
    maxStamina: 100,

    cultivateStaminaCost: 5,

    cultivateCooldownMs:
      5 * 60 * 1000,

    cultivateBaseMin: 90,
    cultivateBaseMax: 150,

    spiritStoneMin: 8,
    spiritStoneMax: 25,

    breakthroughBaseChance: 0.88,

    breakthroughMinChance: 0.55,

    breakthroughFailureLossPercent: 0.10,
  },
};

/**
 * =========================================================
 * CẢNH GIỚI
 * =========================================================
 */

export const CULTIVATION_REALMS = [
  'Luyện Khí',
  'Trúc Cơ',
  'Kim Đan',
  'Nguyên Anh',
  'Hóa Thần',
  'Luyện Hư',
  'Hợp Thể',
  'Đại Thừa',
  'Độ Kiếp',
  'Chân Tiên',
  'Kim Tiên',
  'Thái Ất Kim Tiên',
  'Đại La Kim Tiên',
];

export const CULTIVATION_STAGES = [
  'Sơ Kỳ',
  'Trung Kỳ',
  'Hậu Kỳ',
  'Viên Mãn',
];

/**
 * =========================================================
 * LINH CĂN
 * =========================================================
 */

export const SPIRIT_ROOTS = [
  {
    id: 'kim',
    name: 'Kim Linh Căn',
    emoji: '⚔️',
    rarity: 'Phàm',
    weight: 18,
    cultivateBonus: 0.02,
  },

  {
    id: 'moc',
    name: 'Mộc Linh Căn',
    emoji: '🌿',
    rarity: 'Phàm',
    weight: 18,
    cultivateBonus: 0.02,
  },

  {
    id: 'thuy',
    name: 'Thủy Linh Căn',
    emoji: '💧',
    rarity: 'Phàm',
    weight: 18,
    cultivateBonus: 0.02,
  },

  {
    id: 'hoa',
    name: 'Hỏa Linh Căn',
    emoji: '🔥',
    rarity: 'Phàm',
    weight: 18,
    cultivateBonus: 0.02,
  },

  {
    id: 'tho',
    name: 'Thổ Linh Căn',
    emoji: '🪨',
    rarity: 'Phàm',
    weight: 18,
    cultivateBonus: 0.02,
  },

  {
    id: 'phong',
    name: 'Phong Linh Căn',
    emoji: '🌪️',
    rarity: 'Hiếm',
    weight: 4,
    cultivateBonus: 0.05,
  },

  {
    id: 'bang',
    name: 'Băng Linh Căn',
    emoji: '❄️',
    rarity: 'Hiếm',
    weight: 3,
    cultivateBonus: 0.06,
  },

  {
    id: 'loi',
    name: 'Lôi Linh Căn',
    emoji: '⚡',
    rarity: 'Hiếm',
    weight: 2,
    cultivateBonus: 0.08,
  },

  {
    id: 'thien',
    name: 'Thiên Linh Căn',
    emoji: '✨',
    rarity: 'Cực Hiếm',
    weight: 0.8,
    cultivateBonus: 0.12,
  },

  {
    id: 'hon_don',
    name: 'Hỗn Độn Linh Căn',
    emoji: '☯️',
    rarity: 'Thần Thoại',
    weight: 0.2,
    cultivateBonus: 0.18,
  },
];

/**
 * =========================================================
 * RANDOM TU LUYỆN EVENT
 * =========================================================
 */

export const CULTIVATION_EVENTS = [
  {
    id: 'normal',

    weight: 70,

    title:
      '<a:trangtrig2:1546040703375904801> TĨNH TÂM TU LUYỆN <a:trangtrig3:1546040818261954610>',

    text:
      'Đạo hữu tĩnh tọa nhập định, vận chuyển công pháp một chu thiên.',

    cultivationMultiplier: 1,

    stoneMultiplier: 1,
  },

  {
    id: 'minor_fortune',

    weight: 18,

    title:
      '<a:trangtrig2:1546040703375904801> KỲ NGỘ <a:trangtrig3:1546040818261954610>',

    text:
      'Một luồng linh khí tinh thuần bất ngờ hội tụ quanh động phủ.',

    cultivationMultiplier: 1.35,

    stoneMultiplier: 1.25,
  },

  {
    id: 'great_fortune',

    weight: 7,

    title:
      '<a:trangtrig2:1546040703375904801> THIÊN ĐẠO CƠ DUYÊN <a:trangtrig3:1546040818261954610>',

    text:
      'Thiên địa sinh dị tượng, một tia tiên khí từ thiên ngoại giáng xuống.',

    cultivationMultiplier: 2.25,

    stoneMultiplier: 2,
  },

  {
    id: 'deviation',

    weight: 5,

    title:
      '<a:angryg1:1541441195144773652> TẨU HỎA NHẬP MA',

    text:
      'Linh khí nghịch chuyển, kinh mạch chấn động. May mắn đạo cơ chưa tổn hại.',

    cultivationMultiplier: -0.35,

    stoneMultiplier: 0,
  },
];

export default CULTIVATION_CONFIG;
