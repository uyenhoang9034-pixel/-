import { WITCH_HUNTER_CONFIG } from './witchHunterConfig.js';

export const SUMMON_CONFIG = {
  costs: {
    single: 20,
    multi: 180, // x10 pulls (saving 10%)
    costPerMultiPull: 18,
    missRefundPumpkins: 5,
  },

  rates: {
    ss: 2.5,
    s: 12.5,
    a: 25.0,
    miss: 60.0,
  },

  pity: {
    aCap: 20,
    sCap: 30,
    ssCap: 60,
    ceilingRefundRate: 0.8, // 80% when hitting pity ceiling
    earlyRefundRate: 0.6,   // 60% when early drop
  },

  emojis: {
    pumpkin: WITCH_HUNTER_CONFIG.emojis.pumpkin || '<a:bingo:1563061901800243253>',
    titleLeft: WITCH_HUNTER_CONFIG.emojis.titleLeft || '<a:trangtrig2:1546040703375904801>',
    titleRight: WITCH_HUNTER_CONFIG.emojis.titleRight || '<a:trangtrig3:1546040818261954610>',
    rankSS: '<a:trangtrig14:1546047912969113622>',
    rankS: '<a:trangtrig45:1547239010190237819>',
    rankA: '<a:trangtrig37:1547237647850807420>',
    miss: '<a:trangtrig46:1547240249761996812>',
    memoryShard: '<a:trangtrig46:1547240249761996812>',
    pityCheck: '<a:trangtrig18:1546068102817775626>',
    supporterBanner: '<a:linhtocg:1563399670351536310>',
    weaponBanner: '<a:trangtrig36:1563065680922808340>',
    sparkles: '✨',
    star: '⭐',
  },

  // DANH MỤC VẬT PHẨM TRONG BỂ THEO PHE
  pools: {
    hunter: {
      supporter: [
        // A-Rank
        { id: 'fenris', name: 'Fenris — Băng Tật Sói Hoang', rank: 'A', category: 'Linh Tộc', weaponName: 'Frostbite Fangs' },
        { id: 'brand', name: 'Brand — Tử Tù Lửa Ngục', rank: 'A', category: 'Nguyền Thể', weaponName: 'Chain of Penance' },
        { id: 'iron_maiden', name: 'Iron Maiden — Trinh Nữ Thiết Giáp', rank: 'A', category: 'Cấm Khí', weaponName: 'Spike Cage Shield' },
        // S-Rank
        { id: 'bailong', name: 'Bailong — Bạch Lân Dạ Xoa', rank: 'S', category: 'Linh Tộc', weaponName: 'Thunder Pearl Rapier' },
        { id: 'thanatos', name: 'Thanatos — Hắc Giáp Kỵ Sĩ', rank: 'S', category: 'Nguyền Thể', weaponName: 'Executioner’s Guise' },
        { id: 'astrarium', name: 'Astrarium — Tinh Bàn Vô Cực', rank: 'S', category: 'Cấm Khí', weaponName: 'Singularity Staff' },
        // SS-Rank
        { id: 'deus_ex', name: 'Deus Ex — Lõi Thần Cơ Khí', rank: 'SS', category: 'Cấm Khí', weaponName: 'Judgement Cannon' },
        { id: 'ouroboros_core', name: 'Ouroboros Core — Cỗ Máy Khởi Nguyên', rank: 'SS', category: 'Cấm Khí', weaponName: 'Absolute Singularity Lance' },
      ],
      weapon: [
        // A-Rank
        { id: 'wep_frostbite_fangs', name: 'Frostbite Fangs (Song Nanh Hàn Băng)', supporterId: 'fenris', supporterName: 'Fenris', rank: 'A', category: 'Thần Binh A-Rank' },
        { id: 'wep_chain_of_penance', name: 'Chain of Penance (Xích Sắt Chuộc Tội)', supporterId: 'brand', supporterName: 'Brand', rank: 'A', category: 'Thần Binh A-Rank' },
        { id: 'wep_spike_cage_shield', name: 'Spike Cage Shield (Khiên Lồng Chông Sắt)', supporterId: 'iron_maiden', supporterName: 'Iron Maiden', rank: 'A', category: 'Thần Binh A-Rank' },
        // S-Rank
        { id: 'wep_thunder_pearl_rapier', name: 'Thunder Pearl Rapier (Liễu Kiếm Lôi Châu)', supporterId: 'bailong', supporterName: 'Bailong', rank: 'S', category: 'Thần Binh S-Rank' },
        { id: 'wep_executioners_guise', name: 'Executioner’s Guise (Đại Kiếm Tử Vong)', supporterId: 'thanatos', supporterName: 'Thanatos', rank: 'S', category: 'Thần Binh S-Rank' },
        { id: 'wep_singularity_staff', name: 'Singularity Staff (Trượng Điểm Kỳ Dị)', supporterId: 'astrarium', supporterName: 'Astrarium', rank: 'S', category: 'Thần Binh S-Rank' },
        // SS-Rank
        { id: 'wep_judgement_cannon', name: 'Judgement Cannon (Đại Pháo Thần Phán)', supporterId: 'deus_ex', supporterName: 'Deus Ex', rank: 'SS', category: 'Thần Binh SS-Rank' },
        { id: 'wep_absolute_singularity_lance', name: 'Absolute Singularity Lance (Thần Thương Kỳ Dị)', supporterId: 'ouroboros_core', supporterName: 'Ouroboros Core', rank: 'SS', category: 'Thần Binh SS-Rank' },
      ],
    },
    witch: {
      supporter: [
        // A-Rank
        { id: 'sylph', name: 'Sylph — Vũ Xà Rừng Cấm', rank: 'A', category: 'Linh Tộc', weaponName: 'Gale Plume Whip' },
        { id: 'morpheus', name: 'Morpheus — Chiêm Mộng Độc Thiềm', rank: 'A', category: 'Nguyền Thể', weaponName: 'Slumber Mist Censer' },
        { id: 'hemlock', name: 'Hemlock — Cối Xay Huyết Dược', rank: 'A', category: 'Cấm Khí', weaponName: 'Blight Pestle' },
        // S-Rank
        { id: 'cerastes', name: 'Cerastes — Huyết Tích Vạn Mắt', rank: 'S', category: 'Linh Tộc', weaponName: 'Petrification Gaze Flute' },
        { id: 'banshee', name: 'Banshee — Vong Hồn Bạch Y', rank: 'S', category: 'Nguyền Thể', weaponName: 'Screaming Veil' },
        { id: 'ouroboros_witch', name: 'Ouroboros — Vòng Lặp Vô Tận', rank: 'S', category: 'Cấm Khí', weaponName: 'Infinity Mirror' },
        // SS-Rank
        { id: 'lilith', name: 'Lilith — Huyết Mẫu Cổ Xưa', rank: 'SS', category: 'Nguyền Thể', weaponName: 'Genesis Blood Chalice' },
        { id: 'tiamat', name: 'Tiamat — Thủy Tổ Long Mẫu', rank: 'SS', category: 'Linh Tộc', weaponName: 'Calamity Dragon Horn' },
      ],
      weapon: [
        // A-Rank
        { id: 'wep_gale_plume_whip', name: 'Gale Plume Whip (Roi Lông Phong Nhận)', supporterId: 'sylph', supporterName: 'Sylph', rank: 'A', category: 'Thần Khí A-Rank' },
        { id: 'wep_slumber_mist_censer', name: 'Slumber Mist Censer (Lư Hương Mê Giác)', supporterId: 'morpheus', supporterName: 'Morpheus', rank: 'A', category: 'Thần Khí A-Rank' },
        { id: 'wep_blight_pestle', name: 'Blight Pestle (Chày Nghiền Độc Ma)', supporterId: 'hemlock', supporterName: 'Hemlock', rank: 'A', category: 'Thần Khí A-Rank' },
        // S-Rank
        { id: 'wep_petrification_gaze_flute', name: 'Petrification Gaze Flute (Sáo Hóa Đá)', supporterId: 'cerastes', supporterName: 'Cerastes', rank: 'S', category: 'Thần Khí S-Rank' },
        { id: 'wep_screaming_veil', name: 'Screaming Veil (Khăn Tang Ai Oán)', supporterId: 'banshee', supporterName: 'Banshee', rank: 'S', category: 'Thần Khí S-Rank' },
        { id: 'wep_infinity_mirror', name: 'Infinity Mirror (Gương Kính Phản Chiếu)', supporterId: 'ouroboros_witch', supporterName: 'Ouroboros', rank: 'S', category: 'Thần Khí S-Rank' },
        // SS-Rank
        { id: 'wep_genesis_blood_chalice', name: 'Genesis Blood Chalice (Chén Thánh Huyết Nguyện)', supporterId: 'lilith', supporterName: 'Lilith', rank: 'SS', category: 'Thần Khí SS-Rank' },
        { id: 'wep_calamity_dragon_horn', name: 'Calamity Dragon Horn (Tù Và Tai Ương)', supporterId: 'tiamat', supporterName: 'Tiamat', rank: 'SS', category: 'Thần Khí SS-Rank' },
      ],
    },
  },
};

export default SUMMON_CONFIG;
