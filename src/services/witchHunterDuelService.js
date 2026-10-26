import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../config/witchHunterConfig.js';
import { SUMMON_CONFIG } from '../config/summonConfig.js';
import { WitchHunterService } from './witchHunterService.js';
import { getFromDb, setInDb } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const MONOLITH_JSON_PATH = path.join(DATA_DIR, 'witch_hunter_monolith.json');

/**
 * ══════════════════════════════════════════════════════════════
 * WITCH HUNTER DUEL SERVICE
 * Hệ thống Đối Kháng Chiến Thuật, Sòng Cược & Trụ Tổng
 * ══════════════════════════════════════════════════════════════
 */
export class WitchHunterDuelService {
  // Trận đấu đang diễn ra theo Guild: Map<guildId, DuelState>
  static activeDuels = new Map();

  // Dữ liệu Trụ Tổng (Monolith Data) trong bộ nhớ cache
  static monolithCache = null;

  // ────────────────────────────────────────────────────────────
  // 1. DỮ LIỆU & HIỆU ỨNG CHIẾN ĐẤU CỦA 26 CẶP SUPPORTER + VŨ KHÍ
  // ────────────────────────────────────────────────────────────
  static COMBAT_PROFILES = {
    // --- PHE THỢ SĂN (HUNTER) ---
    // Bậc 1
    garmr: {
      name: 'Garmr — Ngân Khuyển',
      category: 'linhToc',
      tier: 1,
      rankLetter: 'C',
      weaponId: 'wep_hunter_1',
      weaponName: 'Silver Fang Dagger (Đoản Đao Răng Bạc)',
      passiveName: 'Nhiễm Bạc Sơ Cấp',
      passiveDesc: 'Chém rách màn chắn ma năng; giảm 10% khả năng chống chịu của đối thủ ở hiệp kế tiếp.',
      onHit(attacker, defender, battleLog) {
        defender.tempResistDebuff = (defender.tempResistDebuff || 0) + 10;
        battleLog.push(`• [Garmr & Đoản Đao]: Kích hoạt [Nhiễm Bạc Sơ Cấp], giảm 10% kháng cự của đối thủ ở hiệp kế tiếp!`);
      },
    },
    // Bậc 2
    zodiac: {
      name: 'Zodiac — Đao Phủ Răng Cưa',
      category: 'nguyenThe',
      tier: 2,
      rankLetter: 'B',
      weaponId: 'wep_hunter_2',
      weaponName: 'Clockwork Saw-Blade (Lưỡi Cưa Cơ Giới)',
      passiveName: 'Cưa Xé Kết Giới',
      passiveDesc: 'Bào mòn 12% Kháng Cự, 20% tỷ lệ gây [Chảy Máu/Hở Giáp] (mất thêm 4% Kháng Cự ở hiệp sau).',
      onHit(attacker, defender, battleLog) {
        defender.hp = Math.max(0, defender.hp - 12);
        battleLog.push(`• [Zodiac & Lưỡi Cưa]: Kích hoạt [Cưa Xé Kết Giới], cưa nát thêm 12% Kháng Cự của đối thủ!`);
        if (Math.random() < 0.2) {
          defender.bleedStacks = (defender.bleedStacks || 0) + 1;
          battleLog.push(`• [Vết Cắt Sâu]: Đối thủ bị [Chảy Máu/Hở Giáp] (mất thêm 4% Kháng Cự ở hiệp sau)!`);
        }
      },
    },
    // Bậc 3
    bastion: {
      name: 'Bastion — Trấn Ngục Pháo Đài',
      category: 'camKhi',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_hunter_3',
      weaponName: 'Aegis Heavy Tower (Đại Khiên Thành Trì)',
      passiveName: 'Khiên Chấn Vững Chãi',
      passiveDesc: 'Tăng 40% hiệu lực khi dùng lệnh Phòng Thủ; phản lại 30% sát thương nhận vào.',
      onDefend(defender, attacker, damageTaken, battleLog) {
        const reflectDmg = Math.round(damageTaken * 0.3);
        if (reflectDmg > 0) {
          attacker.hp = Math.max(0, attacker.hp - reflectDmg);
          battleLog.push(`• [Bastion & Trọng Khiên]: Phản chấn lại ${reflectDmg}% sát thương về phía kẻ tấn công!`);
        }
      },
    },
    // Bậc 4
    abyssus: {
      name: 'Abyssus — Hư Không Ma Khố',
      category: 'camKhi',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_hunter_4',
      weaponName: 'Dimension Breaker (Pháo Kích Không Gian)',
      passiveName: 'Phá Vỡ Không Gian',
      passiveDesc: 'Đạn pháo xuyên thẳng qua mọi dạng kết giới bảo hộ; bỏ qua 35% phòng ngự đối phương.',
      onHit(attacker, defender, battleLog) {
        attacker.ignoreDefense = 0.35;
        battleLog.push(`• [Abyssus & Trọng Pháo]: Đạn pháo xuyên thứ nguyên bỏ qua 35% phòng ngự đối phương!`);
      },
    },
    // Bậc 5
    oculus: {
      name: 'Oculus — Thiên Nhãn Tri Kỷ',
      category: 'linhToc',
      tier: 5,
      rankLetter: 'SS',
      weaponId: 'wep_hunter_5',
      weaponName: 'Chrono-Crossbow (Nỏ Máy Tiên Tri)',
      passiveName: 'Tiên Tri Chuẩn Xác',
      passiveDesc: 'Đòn bắn luôn trúng đích 100%, tự động bộc phá bạo kích nếu đối thủ niệm chú khế ước.',
      onHit(attacker, defender, battleLog) {
        if (defender.choice === 'RELEASE') {
          attacker.bonusCrit = 1.5;
          battleLog.push(`• [Oculus & Thiên Nhãn]: Bắt bài niệm chú, bộc phá bạo kích Tiên Tri Chuẩn Xác (x1.5 Sát Thương)!`);
        }
      },
    },
    // Summon A
    fenris: {
      name: 'Fenris — Băng Tật Sói Hoang',
      category: 'linhToc',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_frostbite_fangs',
      weaponName: 'Frostbite Fangs (Song Nanh Hàn Băng)',
      passiveName: 'Băng Tật',
      passiveDesc: 'Giảm 25% tốc độ ra chiêu đối thủ hiệp sau; tích 2 tầng gây đóng băng khiến đối thủ mất lượt.',
      onHit(attacker, defender, battleLog) {
        defender.frostStacks = (defender.frostStacks || 0) + 1;
        if (defender.frostStacks >= 2) {
          defender.isFrozen = true;
          defender.frostStacks = 0;
          battleLog.push(`• [Fenris & Song Nanh]: Đóng băng tuyệt đối! Đối thủ bị đóng băng và sẽ MẤT LƯỢT ở hiệp sau!`);
        } else {
          battleLog.push(`• [Fenris & Song Nanh]: Gieo 1 tầng [Băng Tật] (tích 2 tầng sẽ đóng băng mất lượt)!`);
        }
      },
    },
    brand: {
      name: 'Brand — Tử Tù Lửa Ngục',
      category: 'nguyenThe',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_chain_of_penance',
      weaponName: 'Chain of Penance (Xích Sắt Chuộc Tội)',
      passiveName: 'Hỏa Ngục',
      passiveDesc: 'Đốt cháy lớp ngoài kết giới; thiêu rụi 5% kháng cự đối thủ mỗi hiệp trong 2 hiệp liên tiếp.',
      onHit(attacker, defender, battleLog) {
        defender.burnDuration = 2;
        battleLog.push(`• [Brand & Xích Sắt]: Gieo ngọn lửa [Hỏa Ngục], thiêu đốt 5% Kháng Cự mỗi hiệp trong 2 hiệp!`);
      },
    },
    iron_maiden: {
      name: 'Iron Maiden — Trinh Nữ Thiết Giáp',
      category: 'camKhi',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_spike_cage_shield',
      weaponName: 'Spike Cage Shield (Khiên Lồng Chông Sắt)',
      passiveName: 'Giam Hãm Phản Phệ',
      passiveDesc: 'Chặn đứng đòn tấn công khi Phòng Thủ và phản lại đúng 50% uy lực về phía kẻ tấn công.',
      onDefend(defender, attacker, damageTaken, battleLog) {
        const reflectDmg = Math.round(damageTaken * 0.5);
        attacker.hp = Math.max(0, attacker.hp - reflectDmg);
        battleLog.push(`• [Iron Maiden & Khiên Chông]: Giam Hãm Phản Phệ phản lại đúng 50% uy lực (${reflectDmg}% Kháng Cự)!`);
      },
    },
    // Summon S
    bailong: {
      name: 'Bailong — Bạch Lân Dạ Xoa',
      category: 'linhToc',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_thunder_pearl_rapier',
      weaponName: 'Thunder Pearl Rapier (Liễu Kiếm Lôi Châu)',
      passiveName: 'Tê Liệt & Phá Giáp',
      passiveDesc: 'Bỏ qua 30% giáp ma thuật; 30% tỷ lệ phóng điện gây tê liệt ngắt chiêu niệm chú.',
      onHit(attacker, defender, battleLog) {
        attacker.ignoreDefense = 0.3;
        if (Math.random() < 0.3 && defender.choice === 'RELEASE') {
          defender.isParalyzed = true;
          battleLog.push(`• [Bailong & Liễu Kiếm]: Phóng điện Lôi Châu làm tê liệt và cưỡng chế ngắt niệm chú của đối thủ!`);
        }
      },
    },
    thanatos: {
      name: 'Thanatos — Hắc Giáp Kỵ Sĩ',
      category: 'nguyenThe',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_executioners_guise',
      weaponName: 'Executioner’s Guise (Đại Kiếm Tử Vong)',
      passiveName: 'Vết Thương Sâu',
      passiveDesc: 'Phá nát dòng chảy mana, khóa hoàn toàn khả năng hồi phục hoặc tạo khiên của đối thủ trong 1 hiệp.',
      onHit(attacker, defender, battleLog) {
        defender.healBlocked = true;
        battleLog.push(`• [Thanatos & Đại Kiếm]: Gây [Vết Thương Sâu], khóa hoàn toàn khả năng hồi phục/khiên của đối thủ hiệp sau!`);
      },
    },
    astrarium: {
      name: 'Astrarium — Tinh Bàn Vô Cực',
      category: 'camKhi',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_singularity_staff',
      weaponName: 'Singularity Staff (Trượng Điểm Kỳ Dị)',
      passiveName: 'Trọng Trường Hư Không',
      passiveDesc: 'Bóp nghẹt không gian, cưỡng ép đối thủ mất quyền ưu thế đánh trước ở hiệp kế tiếp.',
      onHit(attacker, defender, battleLog) {
        defender.lostPriority = true;
        battleLog.push(`• [Astrarium & Kỳ Dị Trượng]: Kích hoạt [Trọng Trường Hư Không], tước đoạt quyền đánh trước của đối thủ ở hiệp sau!`);
      },
    },
    // Summon SS
    deus_ex: {
      name: 'Deus Ex — Lõi Thần Cơ Khí',
      category: 'camKhi',
      tier: 5,
      rankLetter: 'SS',
      weaponId: 'wep_judgement_cannon',
      weaponName: 'Judgement Cannon (Đại Pháo Thần Phán)',
      passiveName: 'Phân Rã Tuyệt Đối',
      passiveDesc: 'Xóa sổ trực tiếp 25% thanh kháng cự của đối phương; đòn đánh không thể bị chặn bởi khiên.',
      onHit(attacker, defender, battleLog) {
        defender.hp = Math.max(0, defender.hp - 25);
        battleLog.push(`• [Deus Ex & Đại Pháo Thần Phán]: Tuyệt kỹ [Phân Rã Tuyệt Đối] xóa sổ trực tiếp 25% Kháng Cự, bỏ qua hoàn toàn khiên!`);
      },
    },
    ouroboros_core: {
      name: 'Ouroboros Core — Cỗ Máy Khởi Nguyên',
      category: 'camKhi',
      tier: 5,
      rankLetter: 'SS',
      weaponId: 'wep_absolute_singularity_lance',
      weaponName: 'Absolute Singularity Lance (Thần Thương Kỳ Dị)',
      passiveName: 'Kỳ Dị Vô Cực',
      passiveDesc: 'Tích lũy điểm bạo kích vô cực; tung đòn kết liễu ngay lập tức nếu đối phương dưới 20% kháng cự.',
      onHit(attacker, defender, battleLog) {
        if (defender.hp <= 20 && defender.hp > 0) {
          defender.hp = 0;
          battleLog.push(`• [Ouroboros Core & Thần Thương]: Đối thủ dưới 20% Kháng Cự, kích hoạt [Kỳ Dị Vô Cực] KẾT LIỄU NGAY LẬP TỨC!`);
        }
      },
    },

    // --- PHE PHÙ THỦY (WITCHES) ---
    // Bậc 1
    malice: {
      name: 'Malice — Hắc Thỏ Gỗ',
      category: 'nguyenThe',
      tier: 1,
      rankLetter: 'C',
      weaponId: 'wep_witch_1',
      weaponName: 'Soul-Stitch Needle (Hắc Châm Khâu Hồn)',
      passiveName: 'Đâm Thấu Linh Hồn',
      passiveDesc: 'Ghim kim độc làm tắc nghẽn khớp máy; giảm 10% sát thương của Thợ Săn ở lượt sau.',
      onHit(attacker, defender, battleLog) {
        defender.tempDmgDebuff = (defender.tempDmgDebuff || 0) + 10;
        battleLog.push(`• [Malice & Hắc Châm]: Đâm thấu linh hồn, làm kẹt khớp máy giảm 10% sát thương đối thủ ở lượt sau!`);
      },
    },
    // Bậc 2
    corvus: {
      name: 'Corvus — Dạ Quạ Điềm Gở',
      category: 'linhToc',
      tier: 2,
      rankLetter: 'B',
      weaponId: 'wep_witch_2',
      weaponName: 'Raven Glass Blade (Dao Găm Lông Quạ)',
      passiveName: 'Hư Ảnh Che Mắt',
      passiveDesc: 'Phóng lông quạ u ám; tăng 20% khả năng né tránh hoặc làm lệch đường đạn của Thợ Săn.',
      onTurnStart(self, opponent, battleLog) {
        self.dodgeChance = 0.2;
      },
    },
    // Bậc 3
    tamamo: {
      name: 'Tamamo — Huyễn Hồ Huyết Vực',
      category: 'linhToc',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_witch_3',
      weaponName: 'Kitsune Fox-Lantern (Đèn Lồng Ảo Ảnh)',
      passiveName: 'Huyễn Mộng Chi Hỏa',
      passiveDesc: 'Gieo rắc ảo giác mê hồn; khiến đối phương có 35% tỷ lệ đánh trượt mục tiêu.',
      onTurnStart(self, opponent, battleLog) {
        if (Math.random() < 0.35) {
          opponent.willMiss = true;
          battleLog.push(`• [Tamamo & Đèn Lồng Ảo Ảnh]: Ma trận mê hồn khiến đối phương hoa mắt, tỷ lệ đánh trượt ở hiệp này!`);
        }
      },
    },
    // Bậc 4
    vermilion: {
      name: 'Vermilion — Xích Điểu Bất Tử',
      category: 'linhToc',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_witch_4',
      weaponName: 'Cinder Cane (Trượng Tàn Hỏa)',
      passiveName: 'Tro Tàn Tái Sinh',
      passiveDesc: 'Khi thanh kháng cự chạm 0%, lập tức bùng cháy tái sinh lại 20% kháng cự (kích hoạt 1 lần/trận).',
      onLethal(self, battleLog) {
        if (!self.hasRevived) {
          self.hasRevived = true;
          self.hp = 20;
          battleLog.push(`• [Vermilion & Trượng Tàn Hỏa]: BÙNG CHÁY NIẾT BÀN! Kích hoạt [Tro Tàn Tái Sinh], hồi sinh lại 20% Kháng Cự!`);
          return true;
        }
        return false;
      },
    },
    // Bậc 5
    hallow: {
      name: 'Hallow — Vua Đầu Lửa',
      category: 'nguyenThe',
      tier: 5,
      rankLetter: 'SS',
      weaponId: 'wep_witch_5',
      weaponName: 'Soul-Harvest Scythe (Lưỡi Hái Đoạt Hồn)',
      passiveName: 'Đoạt Mệnh Huyết Nguyệt',
      passiveDesc: 'Lưỡi hái chém thẳng vào linh hồn, thiêu đốt 30% kháng cự và đánh cắp 10% chuyển hóa cho bản thân.',
      onHit(attacker, defender, battleLog) {
        const steal = 10;
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + steal);
        battleLog.push(`• [Hallow & Lưỡi Hái]: Kích hoạt [Đoạt Mệnh Huyết Nguyệt], thiêu rụi linh hồn và đánh cắp +${steal}% Kháng Cự cho bản thân!`);
      },
    },
    // Summon A
    sylph: {
      name: 'Sylph — Vũ Xà Rừng Cấm',
      category: 'linhToc',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_gale_plume_whip',
      weaponName: 'Gale Plume Whip (Roi Lông Phong Nhận)',
      passiveName: 'Lưỡi Gió Bào Mòn',
      passiveDesc: 'Roi quất bão độc làm giảm 15% độ chính xác của các vũ khí cơ giới Thợ Săn.',
      onHit(attacker, defender, battleLog) {
        defender.tempDmgDebuff = (defender.tempDmgDebuff || 0) + 15;
        battleLog.push(`• [Sylph & Roi Lông]: Lưỡi gió bào mòn làm giảm 15% uy lực đòn đánh của Thợ Săn hiệp sau!`);
      },
    },
    morpheus: {
      name: 'Morpheus — Chiêm Mộng Độc Thiềm',
      category: 'nguyenThe',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_slumber_mist_censer',
      weaponName: 'Slumber Mist Censer (Lư Hương Mê Giác)',
      passiveName: 'Rối Loạn Giác Quan',
      passiveDesc: 'Khói mê độc làm nhiễu loạn tâm trí; đảo ngược thao tác chọn nút của đối phương ở hiệp sau.',
      onHit(attacker, defender, battleLog) {
        defender.isConfused = true;
        battleLog.push(`• [Morpheus & Lư Hương]: Khói mê làm [Rối Loạn Giác Quan], đảo lộn tâm trí đối phương ở hiệp sau!`);
      },
    },
    hemlock: {
      name: 'Hemlock — Cối Xay Huyết Dược',
      category: 'camKhi',
      tier: 3,
      rankLetter: 'A',
      weaponId: 'wep_blight_pestle',
      weaponName: 'Blight Pestle (Chày Nghiền Độc Ma)',
      passiveName: 'Hủ Hóa Kim Loại',
      passiveDesc: 'Ăn mòn vỏ giáp và bánh răng, khiến mục tiêu nhận thêm 20% sát thương từ đòn đánh kế tiếp.',
      onHit(attacker, defender, battleLog) {
        defender.vulnerabilityDebuff = (defender.vulnerabilityDebuff || 0) + 20;
        battleLog.push(`• [Hemlock & Chày Nghiền]: Hủ hóa kim loại, khiến đối phương nhận thêm +20% sát thương đòn kế tiếp!`);
      },
    },
    // Summon S
    cerastes: {
      name: 'Cerastes — Huyết Tích Vạn Mắt',
      category: 'linhToc',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_petrification_gaze_flute',
      weaponName: 'Petrification Gaze Flute (Sáo Hóa Đá)',
      passiveName: 'Hóa Thạch Tinh Thần',
      passiveDesc: 'Tiếng sáo hóa đá khớp máy; tích lũy đủ 3 tầng hóa đá sẽ biến mục tiêu thành tượng và xử thua.',
      onHit(attacker, defender, battleLog) {
        defender.stoneStacks = (defender.stoneStacks || 0) + 1;
        battleLog.push(`• [Cerastes & Sáo Hóa Đá]: Gieo 1 tầng [Hóa Thạch] (Hiện có: ${defender.stoneStacks}/3 tầng)!`);
        if (defender.stoneStacks >= 3) {
          defender.hp = 0;
          battleLog.push(`• [HÓA THẠCH TOÀN PHẦN]: Đủ 3 tầng Hóa Thạch, đối thủ biến thành tượng đá và XỬ THUA NGAY LẬP TỨC!`);
        }
      },
    },
    banshee: {
      name: 'Banshee — Vong Hồn Bạch Y',
      category: 'nguyenThe',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_screaming_veil',
      weaponName: 'Screaming Veil (Khăn Tang Ai Oán)',
      passiveName: 'Sóng Âm Oán Khí',
      passiveDesc: 'Tiếng thét xé toạc tinh thần, thanh tẩy toàn bộ bùa lợi và khiên chắn phòng thủ của đối phương.',
      onHit(attacker, defender, battleLog) {
        defender.tempResistDebuff = (defender.tempResistDebuff || 0) + 15;
        battleLog.push(`• [Banshee & Khăn Tang]: Sóng Âm Oán Khí xé toạc tinh thần, thanh tẩy bùa lợi và làm vỡ rào chắn của đối thủ!`);
      },
    },
    ouroboros_witch: {
      name: 'Ouroboros — Vòng Lặp Vô Tận',
      category: 'camKhi',
      tier: 4,
      rankLetter: 'S',
      weaponId: 'wep_infinity_mirror',
      weaponName: 'Infinity Mirror (Gương Kính Phản Chiếu)',
      passiveName: 'Gương Hư Ảo',
      passiveDesc: 'Thế thân ảo ảnh; né tránh 1 đòn chí tử và phản chiếu lại bản sao đòn đánh đó về phía đối thủ.',
      onLethal(self, battleLog) {
        if (!self.hasMirrored) {
          self.hasMirrored = true;
          self.hp = 15;
          battleLog.push(`• [Ouroboros & Gương Hư Ảo]: Kích hoạt thế thân ảo ảnh, né tránh đòn chí mạng và phục hồi 15% Kháng Cự!`);
          return true;
        }
        return false;
      },
    },
    // Summon SS
    lilith: {
      name: 'Lilith — Huyết Mẫu Cổ Xưa',
      category: 'nguyenThe',
      tier: 5,
      rankLetter: 'SS',
      weaponId: 'wep_genesis_blood_chalice',
      weaponName: 'Genesis Blood Chalice (Chén Thánh Huyết Nguyện)',
      passiveName: 'Huyết Nguyện Tối Thượng',
      passiveDesc: 'Rút cạn sinh mệnh đối phương; hút 15% thanh kháng cự của địch hồi phục cho bản thân.',
      onHit(attacker, defender, battleLog) {
        const drain = 15;
        defender.hp = Math.max(0, defender.hp - drain);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + drain);
        battleLog.push(`• [Lilith & Chén Thánh]: Huyết Nguyện Tối Thượng rút cạn 15% Kháng Cự của địch nạp ngược cho bản thân!`);
      },
    },
    tiamat: {
      name: 'Tiamat — Thủy Tổ Long Mẫu',
      category: 'linhToc',
      tier: 5,
      rankLetter: 'SS',
      weaponId: 'wep_calamity_dragon_horn',
      weaponName: 'Calamity Dragon Horn (Tù Và Tai Ương)',
      passiveName: 'Hồng Thủy Nguyên Thủy',
      passiveDesc: 'Thổi bùng cơn triều hỗn mang, phá hủy hoàn toàn kết giới và kích nổ lõi cơ giới đối phương.',
      onHit(attacker, defender, battleLog) {
        defender.hp = Math.max(0, defender.hp - 22);
        battleLog.push(`• [Tiamat & Tù Và Tai Ương]: Hồng Thủy Nguyên Thủy ập tới, phá hủy kết giới gây thêm 22% sát thương bộc phá!`);
      },
    },
  };

  // ────────────────────────────────────────────────────────────
  // 2. KHỞI TẠO & ĐỒNG BỘ DỮ LIỆU TRỤ TỔNG (MONOLITH)
  // ────────────────────────────────────────────────────────────
  static async getMonolithData() {
    if (this.monolithCache) return this.monolithCache;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      let data = await getFromDb('temp:witch_hunter:monolith_data').catch(() => null);

      if (!data && fs.existsSync(MONOLITH_JSON_PATH)) {
        try {
          const raw = fs.readFileSync(MONOLITH_JSON_PATH, 'utf-8');
          data = JSON.parse(raw);
        } catch {}
      }

      if (!data || typeof data !== 'object') {
        data = {
          hunterHp: 100,
          witchHp: 100,
          hunterDefends: 0,
          witchDefends: 0,
          logs: [
            {
              time: Date.now(),
              text: 'Chiến tuyến Huyết Thệ vừa được Hội Đồng thiết lập! Cả 2 Trụ Tổng đạt 100% sinh lực.',
            },
          ],
          messageId: null,
          channelId: WITCH_HUNTER_CONFIG.channels.monolithChannelId,
        };
      }

      this.monolithCache = data;
      return data;
    } catch (err) {
      logger.error('❌ [WitchHunterDuel] Lỗi nạp dữ liệu Monolith:', err);
      return {
        hunterHp: 100,
        witchHp: 100,
        hunterDefends: 0,
        witchDefends: 0,
        logs: [],
        messageId: null,
        channelId: WITCH_HUNTER_CONFIG.channels.monolithChannelId,
      };
    }
  }

  static async saveMonolithData(data) {
    try {
      this.monolithCache = data;
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(MONOLITH_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
      await setInDb('temp:witch_hunter:monolith_data', data).catch(() => null);
    } catch (e) {
      logger.error('❌ [WitchHunterDuel] Lỗi lưu dữ liệu Monolith:', e);
    }
  }

  /**
   * Trừ máu Trụ Tổng của một phe và cập nhật tin nhắn cố định
   */
  static async deductTowerHp(guild, faction, percent, reasonText) {
    try {
      const data = await this.getMonolithData();
      const isHunter = faction === 'hunter';

      if (isHunter) {
        data.hunterHp = Math.max(0, data.hunterHp - percent);
      } else {
        data.witchHp = Math.max(0, data.witchHp - percent);
      }

      data.logs = Array.isArray(data.logs) ? data.logs : [];
      data.logs.unshift({
        time: Date.now(),
        text: reasonText,
      });
      if (data.logs.length > 10) {
        data.logs = data.logs.slice(0, 10);
      }

      await this.saveMonolithData(data);

      // Cập nhật Embed Trụ Tổng trên kênh cố định
      if (guild) {
        await this.updateMonolithMessage(guild).catch(() => null);
      }

      logger.info(`🏰 [Monolith] Trụ ${faction} bị trừ -${percent}% HP (${reasonText}).`);
      return data;
    } catch (err) {
      logger.error('❌ [WitchHunterDuel] Lỗi deductTowerHp:', err);
    }
  }

  /**
   * Reset 100% HP Trụ Tổng cả 2 phe (Đầu mùa giải mới)
   */
  static async resetMonolith(guild) {
    const data = await this.getMonolithData();
    data.hunterHp = 100;
    data.witchHp = 100;
    data.logs.unshift({
      time: Date.now(),
      text: 'Hội Đồng Tối Cao đã phục hồi 100% HP cho cả 2 Trụ Tổng khởi động mùa giải mới!',
    });
    await this.saveMonolithData(data);
    if (guild) {
      await this.updateMonolithMessage(guild).catch(() => null);
    }
    return data;
  }

  /**
   * Cập nhật tin nhắn Embed Trụ Tổng tại kênh cố định
   */
  static async updateMonolithMessage(guild) {
    if (!guild) return;
    try {
      const data = await this.getMonolithData();
      const channelId = data.channelId || WITCH_HUNTER_CONFIG.channels.monolithChannelId;
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased()) return;

      const embed = this.buildMonolithEmbed(data);

      if (data.messageId) {
        const msg = await channel.messages.fetch(data.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed] }).catch(() => null);
          return;
        }
      }

      // Nếu chưa có tin nhắn, gửi mới
      const newMsg = await channel.send({ embeds: [embed] });
      data.messageId = newMsg.id;
      await this.saveMonolithData(data);
    } catch (e) {
      logger.error('❌ [WitchHunterDuel] Lỗi updateMonolithMessage:', e);
    }
  }

  /**
   * Khởi tạo bảng cố định Trụ Tổng tại kênh cố định (#✦・🏰・thành-trì-huyết-thệ)
   */
  static async setupMonolithDashboard(channel) {
    const data = await this.getMonolithData();
    data.channelId = channel.id;
    const embed = this.buildMonolithEmbed(data);
    const msg = await channel.send({ embeds: [embed] });
    data.messageId = msg.id;
    await this.saveMonolithData(data);
    return msg;
  }

  /**
   * Tạo ASCII progress bar cho máu
   */
  static buildBar(percent, length = 10) {
    const safeP = Math.max(0, Math.min(100, percent));
    const filled = Math.round((safeP / 100) * length);
    const empty = length - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Xây dựng Embed Trụ Tổng Pháo Đài
   */
  static buildMonolithEmbed(data) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;

    const hunterBar = this.buildBar(data.hunterHp, 10);
    const witchBar = this.buildBar(data.witchHp, 10);

    const hunterStatusText = data.hunterHp <= 0 ? '❌ *(ĐÃ BỊ PHONG ẤN MA LỰC)*' : '';
    const witchStatusText = data.witchHp <= 0 ? '❌ *(ĐÃ BỊ PHONG ẤN MA LỰC)*' : '';

    const recentLogs = (data.logs || []).slice(0, 5).map((l) => `> • ${l.text}`).join('\n') || '> *(Chưa có biến động chấn động nào gần đây)*';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`<a:heartg3:1546047728314884226> ─── ✦ ⟨ **TRỤ TỔNG PHÁO ĐÀI: CHIẾN TUYẾN TRANH PHÂN** ⟩ ✦ ─── <a:heartg3:1546047728314884226>`)
      .setDescription(
        `Trạng thái toàn cảnh của hai phe trên lãnh địa. Khi Trụ của phe nào rớt về **0%**, toàn bộ cư dân phe đó sẽ rơi vào trạng thái *"Phong Ấn Ma Lực"* cho đến đợt làm mới tiếp theo!\n\n` +
        `<a:trangtrig36:1563065680922808340> **TRỤ TỔNG THỢ SĂN (W.H. Core Fortress)**\n` +
        `• Trạng thái: \`${hunterBar} ${data.hunterHp}%\` ${hunterStatusText}\n` +
        `• Tổng số lần tử thủ thành công: **${data.hunterDefends || 0}** trận\n\n` +
        `                          ⚔️ **VS** ⚔️\n\n` +
        `<a:trangtrig32:1546906170994856026> **TRỤ TỔNG PHÙ THỦY (Coven Ancient Obelisk)**\n` +
        `• Trạng thái: \`${witchBar} ${data.witchHp}%\` ${witchStatusText}\n` +
        `• Tổng số lần tử thủ thành công: **${data.witchDefends || 0}** trận\n\n` +
        `────────────────────────────────────────────────────────────\n` +
        `<a:trangtrig1:1546040442548654140> **NHẬT KÝ CHẤN ĐỘNG GẦN NHẤT:**\n` +
        `${recentLogs}\n\n` +
        `*(Thanh máu sẽ được Hội Đồng reset lại 100% vào mỗi đầu tháng / mùa giải mới).*`
      )
      .setFooter({ text: 'Witch Hunter Monolith System • Chiến Tuyến Tranh Phân' })
      .setTimestamp();
  }

  // ────────────────────────────────────────────────────────────
  // 3. THÔNG TIN ĐẤU SĨ & PROFILE CHIẾN ĐẤU
  // ────────────────────────────────────────────────────────────
  static getFighterCombatProfile(userId) {
    const userData = WitchHunterService.getUser(userId);
    if (!userData || !userData.faction) return null;

    const faction = userData.faction;
    const currentRank = userData.current_rank || 1;
    const tier = WitchHunterService.rankToTier(currentRank);
    const rankInfo = WitchHunterService.getRankInfo(faction, currentRank);

    const equippedSupp = WitchHunterService.getEquippedSupporter(userId);
    const equippedWep = WitchHunterService.getEquippedWeapon(userId);

    const suppId = equippedSupp?.id;
    const profile = this.COMBAT_PROFILES[suppId] || null;

    // Kiểm tra Cộng Hưởng Đồng Bộ (Resonance): Trang bị đúng vũ khí liên kết gốc
    let isResonance = false;
    if (profile && equippedWep) {
      if (profile.weaponId === equippedWep.id) {
        isResonance = true;
      }
    }

    return {
      userId,
      faction,
      currentRank,
      tier,
      rankName: rankInfo?.name || `Bậc ${currentRank}`,
      rankLetter: WitchHunterService.tierToLetter(tier),
      equippedSupporter: equippedSupp,
      equippedWeapon: equippedWep,
      profile,
      isResonance,
      categoryKey: profile?.category || equippedSupp?.categoryKey || 'linhToc',
    };
  }

  // ────────────────────────────────────────────────────────────
  // 4. KHỞI TẠO LỜI KHIÊU CHIẾN (/duel challenge)
  // ────────────────────────────────────────────────────────────
  static async startChallenge({ interaction, challengerUser, targetUser = null, isBotTest = false }) {
    const guild = interaction.guild;
    const challengerProfile = this.getFighterCombatProfile(challengerUser.id);

    if (!challengerProfile && !isBotTest) {
      return {
        success: false,
        message: 'Lữ khách chưa ký khế ước gia nhập phe phái nên không thể phát động khiêu chiến!',
      };
    }

    // Kiểm tra nếu guild đang có trận đấu diễn ra
    const existingDuel = this.activeDuels.get(guild.id);
    if (existingDuel && existingDuel.status !== 'ENDED') {
      return {
        success: false,
        message: 'Hiện tại đang có một trận chiến Huyết Thệ diễn ra trên đấu trường! Vui lòng chờ trận đấu kết thúc.',
      };
    }

    // Nếu thách đấu đích danh
    let targetProfile = null;
    if (targetUser) {
      if (targetUser.id === challengerUser.id) {
        return { success: false, message: 'Lữ khách không thể tự khiêu chiến chính mình!' };
      }
      targetProfile = this.getFighterCombatProfile(targetUser.id);
      if (!targetProfile) {
        return { success: false, message: `Đối thủ <@${targetUser.id}> chưa ký khế ước chọn phe!` };
      }
      if (targetProfile.faction === challengerProfile.faction) {
        return { success: false, message: 'Lữ khách không thể khiêu chiến thành viên cùng phe phái với mình!' };
      }
    }

    const duelState = {
      guildId: guild.id,
      channelId: interaction.channelId,
      status: 'CHALLENGING', // CHALLENGING -> BETTING -> ROUND_CHOICE -> ROUND_RESOLUTION -> ENDED
      challenger: {
        id: challengerUser.id,
        user: challengerUser,
        profile: challengerProfile,
        faction: challengerProfile?.faction || 'hunter',
        hp: 100,
        maxHp: 100,
        choice: null,
      },
      defender: null, // Sẽ được gán khi có người bấm nhận hoặc targetUser nhận
      targetUserId: targetUser ? targetUser.id : null,
      targetUserObj: targetUser,
      bets: [], // [ { userId, userTag, faction, amount } ]
      currentRound: 1,
      roundHistory: [],
      isBotTest,
      createdAt: Date.now(),
      expiresAt: Date.now() + 180000, // 3 phút
    };

    this.activeDuels.set(guild.id, duelState);

    // Xử lý đếm ngược 180s né chiến
    duelState.timeoutTimer = setTimeout(async () => {
      await this.handleChallengeTimeout(guild.id);
    }, 180000);

    // Nếu là trận test với bot, tự động kích hoạt bot nhận sau 3 giây
    if (isBotTest) {
      setTimeout(async () => {
        await this.setupBotOpponent(guild.id);
      }, 3000);
    }

    const embed = this.buildChallengeEmbed(duelState);
    const components = this.createChallengeComponents(duelState);

    return {
      success: true,
      embed,
      components,
      duelState,
    };
  }

  /**
   * Tạo đối thủ bot giả lập khi Admin gõ /duel test
   */
  static async setupBotOpponent(guildId) {
    const duel = this.activeDuels.get(guildId);
    if (!duel || duel.status !== 'CHALLENGING') return;

    clearTimeout(duel.timeoutTimer);

    const opponentFaction = duel.challenger.faction === 'hunter' ? 'witch' : 'hunter';
    const isWitch = opponentFaction === 'witch';

    // Tạo bot với Supporter & Vũ khí đối địch xịn
    const botSuppId = isWitch ? 'cerastes' : 'bailong';
    const botProfile = this.COMBAT_PROFILES[botSuppId];

    duel.defender = {
      id: 'bot_mock_id',
      user: {
        id: 'bot_mock_id',
        username: isWitch ? 'Archwitch Morrigan (Bot Giả Lập)' : 'Kaelen Thợ Săn (Bot Giả Lập)',
        tag: isWitch ? 'Archwitch Morrigan#0001' : 'Kaelen Thợ Săn#0001',
        displayAvatarURL: () => 'https://cdn.discordapp.com/emojis/1546906170994856026.webp',
      },
      profile: {
        userId: 'bot_mock_id',
        faction: opponentFaction,
        currentRank: 4,
        tier: 4,
        rankName: isWitch ? 'Archwitch (Bậc 4)' : 'S-Rank Hunter (Bậc 4)',
        rankLetter: 'S',
        profile: botProfile,
        isResonance: true,
        categoryKey: botProfile.category,
      },
      faction: opponentFaction,
      hp: 100,
      maxHp: 100,
      choice: null,
      isBot: true,
    };

    duel.status = 'BETTING';
    duel.bettingEndsAt = Date.now() + 45000; // 45 giây sòng cược

    // Thêm một vài lượt cược giả lập cho sinh động
    duel.bets.push(
      { userId: 'fan1', userTag: 'Alice', faction: 'hunter', amount: 150 },
      { userId: 'fan2', userTag: 'Bob', faction: 'witch', amount: 200 }
    );

    const channel = await duel.mainMessage?.channel || null;
    if (duel.mainMessage) {
      const betEmbed = this.buildBettingEmbed(duel);
      const betComponents = this.createBettingComponents(duel);
      await duel.mainMessage.edit({ embeds: [betEmbed], components: betComponents }).catch(() => null);
    }

    duel.betTimer = setTimeout(async () => {
      await this.startFirstRound(guildId);
    }, 45000);
  }

  /**
   * Xử lý quá hạn 180s khiêu chiến mà không ai nhận
   */
  static async handleChallengeTimeout(guildId) {
    const duel = this.activeDuels.get(guildId);
    if (!duel || duel.status !== 'CHALLENGING') return;

    this.activeDuels.delete(guildId);

    const targetFaction = duel.challenger.faction === 'hunter' ? 'witch' : 'hunter';
    const factionName = targetFaction === 'witch' ? 'Phe Phù Thủy' : 'Phe Thợ Săn';

    const reason = `${factionName} né tránh khiêu chiến từ ${duel.challenger.user.username} ➔ Trừ -5% HP Trụ Tổng!`;
    const guild = duel.mainMessage?.guild;
    await this.deductTowerHp(guild, targetFaction, 5, reason);

    if (duel.mainMessage) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle(`<a:bang2:1546891483250954290> ─── ✦ ⟨ **KHIÊU CHIẾN HẾT HẠN: NÉ TRÁNH CHIẾN ĐẤU** ⟩ ✦ ───`)
        .setDescription(
          `Đã hết **180 giây** tiếp chiến nhưng không có bất kỳ đấu sĩ nào thuộc **${factionName}** dám bước lên đài phong ấn!\n\n` +
          `> <a:bang2:1546891483250954290> **HÌNH PHẠT HÈN NHÁT:** Trụ Tổng của **${factionName}** bị đánh phạt trừ thẳng **-5% HP**!\n\n` +
          `*Cổng khiêu chiến đã đóng lại. Hãy rèn luyện thêm dũng khí cho lần sau!*`
        )
        .setTimestamp();

      await duel.mainMessage.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => null);
    }
  }

  /**
   * Tiếp nhận huyết chiến khi một thành viên bấm nút
   */
  static async acceptChallenge(interaction) {
    const guildId = interaction.guildId;
    const duel = this.activeDuels.get(guildId);

    if (!duel || duel.status !== 'CHALLENGING') {
      return interaction.reply({
        content: '❌ Lời khiêu chiến này đã hết hạn hoặc trận đấu đã bắt đầu!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;
    if (userId === duel.challenger.id) {
      return interaction.reply({
        content: '❌ Bạn là người phát động khiêu chiến, không thể tự tiếp nhận!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (duel.targetUserId && duel.targetUserId !== userId) {
      return interaction.reply({
        content: `❌ Lời khiêu chiến này được gửi đích danh cho <@${duel.targetUserId}>!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const defenderProfile = this.getFighterCombatProfile(userId);
    if (!defenderProfile) {
      return interaction.reply({
        content: '❌ Bạn chưa ký khế ước chọn phe phái nên không thể xuất chiến!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (defenderProfile.faction === duel.challenger.faction) {
      return interaction.reply({
        content: '❌ Bạn cùng phe với người phát động khiêu chiến! Chỉ có phe đối địch mới có thể tiếp chiến.',
        flags: MessageFlags.Ephemeral,
      });
    }

    clearTimeout(duel.timeoutTimer);

    duel.defender = {
      id: userId,
      user: interaction.user,
      profile: defenderProfile,
      faction: defenderProfile.faction,
      hp: 100,
      maxHp: 100,
      choice: null,
    };

    duel.status = 'BETTING';
    duel.bettingEndsAt = Date.now() + 45000; // 45 giây mở cược

    duel.betTimer = setTimeout(async () => {
      await this.startFirstRound(guildId);
    }, 45000);

    const betEmbed = this.buildBettingEmbed(duel);
    const betComponents = this.createBettingComponents(duel);

    await interaction.update({
      embeds: [betEmbed],
      components: betComponents,
    });
  }

  /**
   * Từ chối khiêu chiến (bị trừ -5% Trụ Tổng)
   */
  static async declineChallenge(interaction) {
    const guildId = interaction.guildId;
    const duel = this.activeDuels.get(guildId);

    if (!duel || duel.status !== 'CHALLENGING') {
      return interaction.reply({
        content: '❌ Lời khiêu chiến này không còn khả dụng!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userProfile = this.getFighterCombatProfile(interaction.user.id);
    if (!userProfile || userProfile.faction === duel.challenger.faction) {
      return interaction.reply({
        content: '❌ Chỉ thành viên thuộc phe đối địch mới có quyền từ chối thay cho phe mình!',
        flags: MessageFlags.Ephemeral,
      });
    }

    clearTimeout(duel.timeoutTimer);
    this.activeDuels.delete(guildId);

    const targetFaction = userProfile.faction;
    const factionName = targetFaction === 'witch' ? 'Phe Phù Thủy' : 'Phe Thợ Săn';

    const reason = `${interaction.user.username} (${factionName}) chủ động từ chối khiêu chiến ➔ Trừ -5% HP Trụ Tổng!`;
    await this.deductTowerHp(interaction.guild, targetFaction, 5, reason);

    const declineEmbed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle(`<a:whg1:1564145184965525504> ─── ✦ ⟨ **TỪ CHỐI TIẾP CHIẾN: TRỤ TỔNG BỊ THỦNG** ⟩ ✦ ───`)
      .setDescription(
        `Đại diện <@${interaction.user.id}> thuộc **${factionName}** đã chủ động bấm nút **Từ Chối**!\n\n` +
        `> <a:bang2:1546891483250954290> **HÌNH PHẠT TỪ CHỐI:** Trụ Tổng của **${factionName}** bị đánh phạt trừ thẳng **-5% HP**!\n\n` +
        `*Trận đấu bị hủy bỏ. Trụ phe thách thức bảo toàn nguyên vẹn.*`
      )
      .setTimestamp();

    await interaction.update({
      embeds: [declineEmbed],
      components: [],
    });
  }

  // ────────────────────────────────────────────────────────────
  // 5. SÒNG CƯỢC HUYẾT THỆ (PARI-MUTUEL POOL)
  // ────────────────────────────────────────────────────────────
  static calculateBetOdds(duel) {
    let hunterTotal = 0;
    let witchTotal = 0;

    for (const b of duel.bets) {
      if (b.faction === 'hunter') hunterTotal += b.amount;
      if (b.faction === 'witch') witchTotal += b.amount;
    }

    const totalPool = hunterTotal + witchTotal;
    const netPool = totalPool * 0.95; // Trừ 5% thuế

    // Tỷ lệ ăn cược (Pari-mutuel)
    const hunterOdds = hunterTotal > 0 ? (netPool / hunterTotal).toFixed(2) : '2.00';
    const witchOdds = witchTotal > 0 ? (netPool / witchTotal).toFixed(2) : '2.00';

    return {
      hunterTotal,
      witchTotal,
      totalPool,
      netPool,
      hunterOdds,
      witchOdds,
      hunterCount: duel.bets.filter((b) => b.faction === 'hunter').length,
      witchCount: duel.bets.filter((b) => b.faction === 'witch').length,
    };
  }

  /**
   * Đặt cược Bí Ngô vào một phe
   */
  static async placeBet({ interaction, userId, faction, amount }) {
    const guildId = interaction.guildId;
    const duel = this.activeDuels.get(guildId);

    if (!duel || duel.status !== 'BETTING') {
      return { success: false, message: 'Sòng cược hiện không mở cửa hoặc trận đấu đã bắt đầu!' };
    }

    if (amount <= 0) {
      return { success: false, message: 'Số lượng Bí Ngô cược phải lớn hơn 0!' };
    }

    const userData = WitchHunterService.getUser(userId);
    const userPumpkins = userData?.pumpkins || 0;

    if (userPumpkins < amount) {
      return {
        success: false,
        message: `Bạn không đủ Bí Ngô để cược! Hiện tại bạn chỉ có **${userPumpkins} Bí Ngô** <a:bingo:1563061901800243253>.`,
      };
    }

    // Trừ Bí Ngô cược
    await WitchHunterService.revokePumpkins(interaction.guild, userId, amount, {
      reason: `Đặt cược Sòng Cược Huyết Thệ (${faction === 'hunter' ? 'Phe Thợ Săn' : 'Phe Phù Thủy'})`,
      executor: null,
      notifyDM: false,
      notifyAdminLog: false,
    });

    duel.bets.push({
      userId,
      userTag: interaction.user.username,
      faction,
      amount,
    });

    // Cập nhật Embed sòng cược thời gian thực
    if (duel.mainMessage) {
      const betEmbed = this.buildBettingEmbed(duel);
      const betComponents = this.createBettingComponents(duel);
      await duel.mainMessage.edit({ embeds: [betEmbed], components: betComponents }).catch(() => null);
    }

    return {
      success: true,
      message: `Đã đặt cược thành công **${amount} Bí Ngô** vào **${faction === 'hunter' ? 'Hiệp Hội Thợ Săn' : 'Hội Phù Thủy'}**!`,
    };
  }

  // ────────────────────────────────────────────────────────────
  // 6. VÒNG LẶP GIAO ĐẤU (COMBAT LOOP & ROUNDS)
  // ────────────────────────────────────────────────────────────
  static async startFirstRound(guildId) {
    const duel = this.activeDuels.get(guildId);
    if (!duel) return;

    clearTimeout(duel.betTimer);
    duel.status = 'ROUND_CHOICE';
    duel.currentRound = 1;
    duel.challenger.choice = null;
    duel.defender.choice = null;

    await this.renderRound(duel);
  }

  static async renderRound(duel) {
    duel.status = 'ROUND_CHOICE';
    duel.roundEndsAt = Date.now() + 30000; // 30s ra quyết định

    // Nếu defender là Bot, tự động random nước đi
    if (duel.defender.isBot) {
      const choices = ['ATTACK', 'DEFEND', 'RELEASE'];
      duel.defender.choice = choices[Math.floor(Math.random() * choices.length)];
    }

    const roundEmbed = this.buildRoundEmbed(duel);
    const roundComponents = this.createRoundActionComponents(duel);

    if (duel.mainMessage) {
      await duel.mainMessage.edit({
        embeds: [roundEmbed],
        components: roundComponents,
      }).catch(() => null);
    }

    // Đặt timer 30s tự động chốt hiệp nếu người chơi không bấm
    clearTimeout(duel.roundTimer);
    duel.roundTimer = setTimeout(async () => {
      await this.resolveRoundTimeout(duel.guildId);
    }, 30000);
  }

  /**
   * Xử lý nước đi người chơi chọn
   */
  static async handlePlayerChoice(interaction, choiceKey) {
    const guildId = interaction.guildId;
    const duel = this.activeDuels.get(guildId);

    if (!duel || duel.status !== 'ROUND_CHOICE') {
      return interaction.reply({
        content: 'Hiệp đấu này đã kết thúc hoặc đang chờ xử lý!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const userId = interaction.user.id;
    const isChallenger = userId === duel.challenger.id;
    const isDefender = duel.defender && userId === duel.defender.id;

    if (!isChallenger && !isDefender) {
      return interaction.reply({
        content: 'Bạn không phải là đấu sĩ trong trận chiến này!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const fighter = isChallenger ? duel.challenger : duel.defender;
    if (fighter.choice) {
      return interaction.reply({
        content: `Bạn đã chọn nước đi của hiệp này rồi! Đang chờ đối thủ ra quyết định...`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let actualChoice = choiceKey;
    // Kiểm tra hiệu ứng [Rối Loạn Giác Quan] của Morpheus
    if (fighter.isConfused) {
      fighter.isConfused = false;
      const mapping = { ATTACK: 'RELEASE', DEFEND: 'ATTACK', RELEASE: 'DEFEND' };
      actualChoice = mapping[choiceKey] || choiceKey;
    }

    fighter.choice = actualChoice;

    await interaction.reply({
      content: `✅ Bạn đã bí mật lựa chọn: **${this.getChoiceName(actualChoice)}**! Hãy sẵn sàng xem đụng độ...`,
      flags: MessageFlags.Ephemeral,
    });

    // Nếu cả 2 bên đã chọn (hoặc đối thủ là bot đã chọn)
    if (duel.challenger.choice && duel.defender.choice) {
      clearTimeout(duel.roundTimer);
      await this.resolveRound(duel);
    }
  }

  static async resolveRoundTimeout(guildId) {
    const duel = this.activeDuels.get(guildId);
    if (!duel || duel.status !== 'ROUND_CHOICE') return;

    // Tự động random nước đi cho bên nào chưa chọn
    const choices = ['ATTACK', 'DEFEND', 'RELEASE'];
    if (!duel.challenger.choice) {
      duel.challenger.choice = choices[Math.floor(Math.random() * choices.length)];
    }
    if (!duel.defender.choice) {
      duel.defender.choice = choices[Math.floor(Math.random() * choices.length)];
    }

    await this.resolveRound(duel);
  }

  static getChoiceName(choice) {
    switch (choice) {
      case 'ATTACK':
        return '<a:trangtrig29:1546385117478527016> Tấn Công Trực Diện';
      case 'DEFEND':
        return '<a:trangtrig46:1547240249761996812> Phòng Thủ Phản Đòn';
      case 'RELEASE':
        return '<a:linhtocg:1563399670351536310> Giải Phóng Khế Ước';
      default:
        return 'Nước đi không xác định';
    }
  }

  /**
   * Xử lý giải quyết kết quả hiệp đấu (Damage, RPS, Passives)
   */
  static async resolveRound(duel) {
    duel.status = 'ROUND_RESOLUTION';
    const c = duel.challenger;
    const d = duel.defender;
    const battleLog = [];

    // 1. Kiểm tra Tốc độ & Khắc hệ 3 Đại Hệ:
    // Linh Tộc (linhToc) > Nguyền Thể (nguyenThe) > Cấm Khí (camKhi) > Linh Tộc (linhToc)
    const catC = c.profile?.categoryKey || 'linhToc';
    const catD = d.profile?.categoryKey || 'linhToc';

    let firstStriker = c;
    let secondStriker = d;

    const counterMap = {
      linhToc: 'nguyenThe',
      nguyenThe: 'camKhi',
      camKhi: 'linhToc',
    };

    if (counterMap[catC] === catD) {
      firstStriker = c;
      secondStriker = d;
      battleLog.push(`• [Ưu Thế Tốc Độ]: ${c.profile.categoryKey.toUpperCase()} của **${c.user.username}** khắc chế ${d.profile.categoryKey.toUpperCase()} ➔ **${c.user.username}** ra tay trước!`);
    } else if (counterMap[catD] === catC) {
      firstStriker = d;
      secondStriker = c;
      battleLog.push(`• [Ưu Thế Tốc Độ]: ${d.profile.categoryKey.toUpperCase()} của **${d.user.username}** khắc chế ${c.profile.categoryKey.toUpperCase()} ➔ **${d.user.username}** ra tay trước!`);
    } else {
      // Bằng hệ: xét bậc rank
      if (c.profile.tier >= d.profile.tier) {
        firstStriker = c;
        secondStriker = d;
      } else {
        firstStriker = d;
        secondStriker = c;
      }
    }

    // 2. Chênh lệch bậc (ΔRank)
    const deltaRankC = c.profile.tier - d.profile.tier;
    const deltaRankD = d.profile.tier - c.profile.tier;

    if (deltaRankC > 0) {
      battleLog.push(`• [Áp Chế Cảnh Giới]: **${c.user.username}** (Bậc ${c.profile.tier}) vượt bậc đối thủ, nhận hiệu ứng tăng +${deltaRankC * 30}% uy lực!`);
    } else if (deltaRankD > 0) {
      battleLog.push(`• [Áp Chế Cảnh Giới]: **${d.user.username}** (Bậc ${d.profile.tier}) vượt bậc đối thủ, nhận hiệu ứng tăng +${deltaRankD * 30}% uy lực!`);
    }

    // 3. Xử lý Tam giác quyết định ẩn (RPS):
    // ATTACK > RELEASE
    // DEFEND > ATTACK (chặn 100%, phản 50%)
    // RELEASE > DEFEND (xuyên phá)
    battleLog.push(`• [Nước Đi Đối Kháng]:\n  - **${c.user.username}**: [${this.getChoiceName(c.choice)}]\n  - **${d.user.username}**: [${this.getChoiceName(d.choice)}]`);

    // Thực hiện đòn đánh theo thứ tự
    const executeStrike = (att, def) => {
      if (def.hp <= 0 || att.hp <= 0) return;

      if (att.isFrozen) {
        att.isFrozen = false;
        battleLog.push(`• **${att.user.username}** bị đóng băng hoàn toàn nên MẤT LƯỢT ở hiệp này!`);
        return;
      }

      // Base damage: 18 - 25%
      let baseDmg = 20;

      // Áp chế bậc
      const delta = att.profile.tier - def.profile.tier;
      if (delta > 0) baseDmg *= 1 + delta * 0.3;
      if (delta < 0) baseDmg *= Math.max(0.2, 1 + delta * 0.25);

      // Cộng hưởng đồng bộ (Resonance)
      if (att.profile.isResonance) {
        baseDmg *= 1.5;
      }

      // Nước đi thắng/thua
      if (att.choice === 'ATTACK' && def.choice === 'RELEASE') {
        baseDmg *= 1.25;
        battleLog.push(`<a:trangtrig20:1546092997299667055> BẮT BÀI THÀNH CÔNG! Tấn công tốc độ cao đè bẹp tụ lực niệm chú của đối phương!`);
      } else if (att.choice === 'DEFEND' && def.choice === 'ATTACK') {
        // Phòng thủ phản đòn: Chặn 100% và phản 50%
        const reflectDmg = Math.round(baseDmg * 0.5);
        def.hp = Math.max(0, def.hp - reflectDmg);
        battleLog.push(`<a:trangtrig20:1546092997299667055> BẮT BÀI PHÒNG THỦ! **${att.user.username}** chặn đứng đòn đánh và phản chấn -${reflectDmg}% Kháng Cự!`);
        return;
      } else if (att.choice === 'RELEASE' && def.choice === 'DEFEND') {
        baseDmg *= 1.35;
        battleLog.push(`<a:trangtrig20:1546092997299667055> BẮT BÀI THÀNH CÔNG! Tuyệt kỹ khế ước xuyên thủng thế phòng thủ, đập vỡ khiên đối phương!`);
      }

      // Kích hoạt passive của Supporter/Vũ khí
      if (att.profile.profile?.onHit) {
        att.profile.profile.onHit(att, def, battleLog);
      }

      const finalDmg = Math.round(baseDmg);
      def.hp = Math.max(0, def.hp - finalDmg);
      battleLog.push(`💥 **${att.user.username}** gây **-${finalDmg}%** Kháng Cự lên **${def.user.username}** (Còn: ${def.hp}%)!`);

      // Kiểm tra hồi sinh / bất tử nếu chạm 0
      if (def.hp <= 0 && def.profile.profile?.onLethal) {
        def.profile.profile.onLethal(def, battleLog);
      }
    };

    executeStrike(firstStriker, secondStriker);
    executeStrike(secondStriker, firstStriker);

    // Xử lý bleed / burn cuối hiệp
    if (c.burnDuration && c.burnDuration > 0) {
      c.hp = Math.max(0, c.hp - 5);
      c.burnDuration -= 1;
      battleLog.push(`🔥 **${c.user.username}** bị [Hỏa Ngục] thiêu đốt thêm -5% Kháng Cự!`);
    }
    if (d.burnDuration && d.burnDuration > 0) {
      d.hp = Math.max(0, d.hp - 5);
      d.burnDuration -= 1;
      battleLog.push(`🔥 **${d.user.username}** bị [Hỏa Ngục] thiêu đốt thêm -5% Kháng Cự!`);
    }

    duel.roundHistory.push({
      round: duel.currentRound,
      log: battleLog.join('\n'),
    });

    // 4. Kiểm tra điều kiện kết thúc
    if (c.hp <= 0 || d.hp <= 0) {
      const winner = c.hp > 0 ? c : d;
      const loser = c.hp <= 0 ? c : d;
      await this.endDuel(duel, winner, loser);
    } else {
      // Tiếp tục sang hiệp tiếp theo sau 3 giây đọc kết quả
      duel.currentRound += 1;
      duel.challenger.choice = null;
      duel.defender.choice = null;

      setTimeout(async () => {
        await this.renderRound(duel);
      }, 3500);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 7. KẾT THÚC TRẬN ĐẤU & PHÂN PHỐI PHẦN THƯỞNG
  // ────────────────────────────────────────────────────────────
  static async endDuel(duel, winner, loser) {
    duel.status = 'ENDED';
    clearTimeout(duel.roundTimer);
    clearTimeout(duel.betTimer);
    clearTimeout(duel.timeoutTimer);

    this.activeDuels.delete(duel.guildId);

    const guild = duel.mainMessage?.guild;

    // 1. Thưởng Bí Ngô cho Đấu Sĩ Thắng (+10 Bí Ngô)
    if (winner.id !== 'bot_mock_id' && guild) {
      await WitchHunterService.awardPumpkins(guild, winner.id, 10, {
        reason: 'Chiến thắng Đấu Trường Huyết Thệ (+10 Bí Ngô)',
        executor: null,
        notifyDM: true,
        notifyAdminLog: true,
      });
    }

    // 2. Khấu trừ máu Trụ Tổng (-2% HP cho phe thua)
    const loserFaction = loser.faction;
    const loserFactionName = loserFaction === 'witch' ? 'Phe Phù Thủy' : 'Phe Thợ Săn';
    const reasonText = `Đấu sĩ ${loser.user.username} (${loserFactionName}) bị đánh bại ➔ Trừ -2% HP Trụ Tổng!`;
    await this.deductTowerHp(guild, loserFaction, 2, reasonText);

    // 3. Cơ chế Cảm Tử Phá Trận (Nếu Bậc Thấp thua Bậc Cao: Trừ thêm -1% Trụ phe thắng)
    let kamikazeText = '';
    if (loser.profile.tier < winner.profile.tier) {
      const winnerFaction = winner.faction;
      const kamikazeReason = `[Cảm Tử Phá Trận]: ${loser.user.username} (Bậc ${loser.profile.tier}) trước khi ngã xuống đã đục thủng -1% Trụ phe đối phương!`;
      await this.deductTowerHp(guild, winnerFaction, 1, kamikazeReason);
      kamikazeText = `\n• <a:bang2:1546891483250954290> **[CẢM TỬ PHÁ TRẬN]:** Đấu sĩ bậc thấp ${loser.user.username} trước khi ngã xuống đã kích nổ bào mòn thêm **-1% HP Trụ Tổng** đối phương!`;
    }

    // 4. Thanh toán sòng cược (Pari-mutuel Pool)
    const { totalPool, netPool, hunterTotal, witchTotal } = this.calculateBetOdds(duel);
    const winningFaction = winner.faction;
    const winningBets = duel.bets.filter((b) => b.faction === winningFaction);
    const winningPoolTotal = winningFaction === 'hunter' ? hunterTotal : witchTotal;

    const payoutList = [];
    if (winningBets.length > 0 && winningPoolTotal > 0 && guild) {
      for (const bet of winningBets) {
        if (bet.userId === 'fan1' || bet.userId === 'fan2') continue; // Bỏ qua bot cược ảo
        const share = bet.amount / winningPoolTotal;
        const rewardPumpkins = Math.max(1, Math.round(share * netPool));

        await WitchHunterService.awardPumpkins(guild, bet.userId, rewardPumpkins, {
          reason: `Thắng Sòng Cược Huyết Thệ (Nhận thưởng x${(netPool / winningPoolTotal).toFixed(2)})`,
          executor: null,
          notifyDM: true,
          notifyAdminLog: false,
        });

        payoutList.push(`<@${bet.userId}> (+${rewardPumpkins} 🎃)`);
      }
    }

    // 5. Cập nhật Embed Trụ Tổng tại kênh cố định
    await this.updateMonolithMessage(guild).catch(() => null);

    // 6. Gửi Embed Kết Quả Hoàn Tất
    const resultEmbed = this.buildDuelResultEmbed(duel, winner, loser, netPool, kamikazeText);

    if (duel.mainMessage) {
      await duel.mainMessage.edit({
        embeds: [resultEmbed],
        components: [],
      }).catch(() => null);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 8. TẠO GIAO DIỆN EMBEDS & COMPONENTS
  // ────────────────────────────────────────────────────────────

  /**
   * Embed 1: Bảng Khiêu Khích Chiến Tranh
   */
  static buildChallengeEmbed(duel) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isHunter = duel.challenger.faction === 'hunter';

    const factionTag = isHunter
      ? `${emojis.hunterBadge} **Hiệp Hội Thợ Săn**`
      : `${emojis.witchBadge} **Hội Phù Thủy**`;

    const quote = isHunter
      ? `"Hỡi lũ Phù Thủy trốn chui trốn nhủi trong rừng cấm, kẻ nào dám bước ra đài phong ấn?"`
      : `"Hỡi lũ Thợ Săn cơ giới tầm thường, ai dám bước vào kết giới ma thuật của ta?"`;

    const targetText = duel.targetUserId
      ? `\n> 🎯 **Mục tiêu chỉ định:** <@${duel.targetUserId}>`
      : `\n> 🌐 **Phạm vi khiêu chiến:** Toàn thể chiến binh đối địch`;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`<a:trangtrig29:1546385117478527016> ─── ✦ ⟨ **LỜI KHIÊU CHIẾN HUYẾT THỆ** ⟩ ✦ ─── <a:trangtrig29:1546385117478527016>`)
      .setDescription(
        `Đấu sĩ <@${duel.challenger.id}> thuộc [${factionTag}] đã cắm chiến kỳ khiêu chiến!\n\n` +
        `*${quote}*\n` +
        `${targetText}\n\n` +
        `<:wh2:1563431832546967624> **THỜI GIAN TIẾP CHIẾN:** Còn lại **180 giây**!\n\n` +
        `<a:bang2:1546891483250954290> **NGUYÊN TẮC CHIẾN TUYẾN:**\n` +
        `• Bất kỳ thành viên nào của ${isHunter ? '**Hội Phù Thủy**' : '**Hiệp Hội Thợ Săn**'} đều có thể bấm nút tiếp nhận (không phân biệt bậc).\n` +
        `• Nếu hết thời gian mà **KHÔNG** có ai tiếp chiến: Trụ Tổng phe né sẽ bị phạt **-5% HP**!\n` +
        `• Người đầu tiên bấm nút sẽ đại diện phe xuất chiến, người bấm sau sẽ bị khóa!`
      )
      .setFooter({ text: 'Witch Hunter Duel System • Kênh Khiêu Chiến Huyết Thệ' })
      .setTimestamp();
  }

  static createChallengeComponents(duel) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_duel_accept')
          .setLabel('Tiếp Nhận Huyết Chiến')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('<a:trangtrig36:1563065680922808340>'),
        new ButtonBuilder()
          .setCustomId('btn_duel_decline')
          .setLabel('Từ Chối (Mất 5% Trụ)')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('<a:whg1:1564145184965525504>')
      ),
    ];
  }

  /**
   * Embed 2: Bảng Sòng Cược Huyết Thệ (Pari-mutuel)
   */
  static buildBettingEmbed(duel) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const { hunterTotal, witchTotal, hunterOdds, witchOdds, hunterCount, witchCount } = this.calculateBetOdds(duel);

    const c = duel.challenger;
    const d = duel.defender;

    const hunterFighter = c.faction === 'hunter' ? c : d;
    const witchFighter = c.faction === 'witch' ? c : d;

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`${emojis.titleLeft} ─── ✦ ⟨ **SÒNG CƯỢC HUYẾT THỆ: ĐANG MỞ CỬA** ⟩ ✦ ─── ${emojis.titleRight}`)
      .setDescription(
        `*(Khóa cược sau: **00:45s** | Trận đấu sắp bắt đầu!)*\n\n` +
        `<a:trangtrig36:1563065680922808340> **Đấu Sĩ Thợ Săn:** <@${hunterFighter.id}> (${hunterFighter.profile?.rankName || 'Tập Sự'})\n` +
        `• Tổng cược: **${hunterTotal.toLocaleString('vi-VN')}** <a:bingo:1563061901800243253> (${hunterCount} lượt)\n` +
        `• Tỷ lệ ăn dự kiến: **x${hunterOdds}**\n\n` +
        `<a:trangtrig32:1546906170994856026> **Đấu Sĩ Phù Thủy:** <@${witchFighter.id}> (${witchFighter.profile?.rankName || 'Tập Sự'})\n` +
        `• Tổng cược: **${witchTotal.toLocaleString('vi-VN')}** <a:bingo:1563061901800243253> (${witchCount} lượt)\n` +
        `• Tỷ lệ ăn dự kiến: **x${witchOdds}**\n\n` +
        `────────────────────────────────────────────────────────────\n` +
        `*Trích 5% thuế chiến tranh sung quỹ server. 95% còn lại chia theo tỷ lệ đóng góp của người cược bên thắng.*`
      )
      .setFooter({ text: 'Witch Hunter Pari-mutuel Betting' })
      .setTimestamp();
  }

  static createBettingComponents(duel) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_bet_hunter_10')
          .setLabel('Cược Thợ Săn (10 🎃)')
          .setStyle(ButtonStyle.Success)
          .setEmoji('<a:bingo:1563061901800243253>'),
        new ButtonBuilder()
          .setCustomId('btn_bet_witch_10')
          .setLabel('Cược Phù Thủy (10 🎃)')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('<a:bingo:1563061901800243253>'),
        new ButtonBuilder()
          .setCustomId('btn_bet_custom')
          .setLabel('Cược Tùy Chọn')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('<a:bingo:1563061901800243253>')
      ),
    ];
  }

  /**
   * Embed 3: Bản Tin Chiến Sự Từng Hiệp
   */
  static buildRoundEmbed(duel) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const monolith = this.monolithCache || { hunterHp: 100, witchHp: 100 };

    const c = duel.challenger;
    const d = duel.defender;

    const hunter = c.faction === 'hunter' ? c : d;
    const witch = c.faction === 'witch' ? c : d;

    const hunterBar = this.buildBar(hunter.hp, 10);
    const witchBar = this.buildBar(witch.hp, 10);

    const lastRoundHistory = duel.roundHistory[duel.roundHistory.length - 1]?.log || 'Trận chiến bắt đầu! Hai đấu sĩ đang chuẩn bị thi triển thế võ...';

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`⚔️ ─── ✦ ⟨ **ĐẠI CHIẾN HUYẾT THỆ: CHIẾN SỰ HIỆP ${duel.currentRound}** ⟩ ✦ ─── ⚔️`)
      .setDescription(
        `<a:heartg3:1546047728314884226> **TRỤ PHÙ THỦY:** ${monolith.witchHp}%                     <a:heartg3:1546047728314884226> **TRỤ THỢ SĂN:** ${monolith.hunterHp}%\n\n` +
        `<a:trangtrig36:1563065680922808340> **[Thợ Săn]** <@${hunter.id}> (${hunter.profile?.rankName})\n` +
        `   • Supporter: **${hunter.profile?.profile?.name || 'Garmr'}** [${hunter.profile?.categoryKey?.toUpperCase()}] | Vũ khí: **${hunter.profile?.profile?.weaponName || 'Đoản Đao'}**\n` +
        `   • Kết Giới Kháng Cự: \`${hunterBar} ${hunter.hp}%\`\n` +
        (hunter.profile?.isResonance ? `   • <a:trangtrig14:1546047912969113622> **Cộng Hưởng Đồng Bộ Khế Ước** *(x1.5 Bạo Kích)*\n\n` : '\n') +
        `                          ⚔️ **VS** ⚔️\n\n` +
        `<a:trangtrig32:1546906170994856026> **[Phù Thủy]** <@${witch.id}> (${witch.profile?.rankName})\n` +
        `   • Supporter: **${witch.profile?.profile?.name || 'Malice'}** [${witch.profile?.categoryKey?.toUpperCase()}] | Vũ khí: **${witch.profile?.profile?.weaponName || 'Hắc Châm'}**\n` +
        `   • Kết Giới Kháng Cự: \`${witchBar} ${witch.hp}%\`\n` +
        (witch.profile?.isResonance ? `   • <a:trangtrig14:1546047912969113622> **Cộng Hưởng Đồng Bộ Khế Ước** *(x1.5 Bạo Kích)*\n\n` : '\n') +
        `────────────────────────────────────────────────────────────\n` +
        `<a:trangtrig30:1546905942476464178> **BẢN TIN CHIẾN SỰ VỪA QUA:**\n` +
        `${lastRoundHistory}\n\n` +
        `<:wh2:1563431832546967624> **ĐANG MỞ BẢNG CHỌN NƯỚC ĐI CHO HIỆP ${duel.currentRound}...** *(Còn 30s để ra quyết định)*\n` +
        `*Hai đấu sĩ hãy bấm các nút chiến thuật bên dưới để tung chiêu!*`
      )
      .setFooter({ text: 'Witch Hunter Tactical Combat' })
      .setTimestamp();
  }

  static createRoundActionComponents(duel) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_combat_attack')
          .setLabel('Tấn Công Trực Diện')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('<a:trangtrig29:1546385117478527016>'),
        new ButtonBuilder()
          .setCustomId('btn_combat_defend')
          .setLabel('Phòng Thủ Phản Đòn')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('<a:trangtrig46:1547240249761996812>'),
        new ButtonBuilder()
          .setCustomId('btn_combat_release')
          .setLabel('Giải Phóng Khế Ước')
          .setStyle(ButtonStyle.Success)
          .setEmoji('<a:linhtocg:1563399670351536310>')
      ),
    ];
  }

  /**
   * Embed 4: Kết Quả Định Đoạt
   */
  static buildDuelResultEmbed(duel, winner, loser, netPool, kamikazeText) {
    const { emojis, colors } = WITCH_HUNTER_CONFIG;
    const isWitchWon = winner.faction === 'witch';
    const factionTitle = isWitchWon ? 'PHÙ THỦY' : 'THỢ SĂN';
    const monolith = this.monolithCache || { hunterHp: 100, witchHp: 100 };

    return new EmbedBuilder()
      .setColor(colors.pastelPurple)
      .setTitle(`<a:trangtrig14:1546047912969113622> ─── ✦ ⟨ **KẾT QUẢ ĐỊNH ĐOẠT: ${factionTitle} GIÀNH CHIẾN THẮNG!** ⟩ ✦ ─── <a:trangtrig14:1546047912969113622>`)
      .setDescription(
        `Sau **${duel.currentRound} hiệp** kịch chiến đầy mưu lược, Đấu sĩ <@${winner.id}> (${winner.faction === 'witch' ? 'Phù Thủy' : 'Thợ Săn'}) đã đánh sập hoàn toàn Kết Giới Kháng Cự của <@${loser.id}> (${loser.faction === 'witch' ? 'Phù Thủy' : 'Thợ Săn'})!\n\n` +
        `<a:giftg1:1543150714732412948> **PHẦN THƯỞNG ĐẤU SĨ:**\n` +
        `• 👑 **Kẻ Thắng (<@${winner.id}>):** Nhận thưởng vinh quang **+10 Bí Ngô** <a:bingo:1563061901800243253>!\n` +
        `• 🛡️ **Kẻ Bại (<@${loser.id}>):** Thất trận nhưng bảo toàn nguyên vẹn số dư Bí Ngô!\n\n` +
        `<a:trangtrig45:1547239010190237819> **BIẾN ĐỘNG TRỤ TỔNG TẠI CHIẾN TUYẾN:**\n` +
        `• Trụ Tổng Phe ${loser.faction === 'witch' ? 'Phù Thủy' : 'Thợ Săn'}: Bị đánh thủng **-2% HP**!\n` +
        `• Trụ Tổng Phe ${winner.faction === 'witch' ? 'Phù Thủy' : 'Thợ Săn'}: Bảo toàn nguyên vẹn!` +
        kamikazeText + `\n\n` +
        `<a:heartg2:1546031808364413019> **THANH TOÁN SÒNG CƯỢC:**\n` +
        `• Tổng quỹ thưởng (đã trừ 5% thuế): **${Math.round(netPool).toLocaleString('vi-VN')}** <a:bingo:1563061901800243253>\n` +
        `• Toàn bộ cư dân đặt cược vào <@${winner.id}> đã được cộng thưởng tự động theo tỷ lệ vào tài khoản!\n\n` +
        `*(Cổng khiêu chiến đã làm mới, hai phe có thể tiếp tục phát động hiệp đấu tiếp theo!)*`
      )
      .setFooter({ text: 'Witch Hunter Duel Victory' })
      .setTimestamp();
  }
}
