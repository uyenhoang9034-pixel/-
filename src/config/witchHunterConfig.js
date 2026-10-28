/**
 * WITCH HUNTER CONFIGURATION
 * Hệ Thống Phe Phái: Thợ Săn Phù Thủy (W.H. Association) vs Hội Phù Thủy (Witches)
 * Thiết kế chuẩn tối ưu RAM & phân quyền cố định.
 */

export const WITCH_HUNTER_CONFIG = {
  // Role ID Ban Quản Trị / Admin có quyền quản lý hệ thống
  adminRoleId: process.env.WITCH_HUNTER_ADMIN_ROLE_ID || '1541303749916754001',

  // ID Kênh cố định theo yêu cầu
  channels: {
    // Chỉ nhận role và bảng chọn phe xuất hiện ở kênh này
    selectionChannelId: process.env.WITCH_HUNTER_SELECTION_CHANNEL_ID || '1563069959658143894',
    // Kênh gửi Embed vinh danh thăng cấp và chốt BXH tháng
    announcementChannelId: process.env.WITCH_HUNTER_ANNOUNCEMENT_CHANNEL_ID || '1563457814138064916',
    // Kênh báo cáo hoạt động hằng ngày bí mật cho Admin
    dailyReportChannelId: process.env.WITCH_HUNTER_DAILY_REPORT_CHANNEL_ID || '1563168363541176351',
    // Kênh thông báo nội bộ cho Admin khi có người pick role, cấp role thủ công, xóa role thủ công
    adminLogChannelId: process.env.WITCH_HUNTER_ADMIN_LOG_CHANNEL_ID || '1563382678378643487',
    // Kênh cố định cho lệnh /supporter của Phe Thợ Săn
    hunterChannelId: process.env.WITCH_HUNTER_HUNTER_CHANNEL_ID || '1563385216800657479',
    // Kênh cố định cho lệnh /supporter của Phe Phù Thủy
    witchChannelId: process.env.WITCH_HUNTER_WITCH_CHANNEL_ID || '1563385150660808846',
    // Kênh cố định cho Nghi thức Thắp Nến Cầu Nguyện hằng ngày
    candleChannelId: process.env.WITCH_HUNTER_CANDLE_CHANNEL_ID || '1562351868888354816',
    // Kênh cố định cho Sự kiện Giải Mã Cổ Ngữ (nếu có)
    puzzleChannelId: process.env.WITCH_HUNTER_PUZZLE_CHANNEL_ID || '',
    // Kênh Trụ Tổng Pháo Đài độc lập (#✦・🏰・thành-trì-huyết-thệ)
    monolithChannelId: process.env.WITCH_HUNTER_MONOLITH_CHANNEL_ID || '1564210315812667412',
    // Kênh cố định Bảng Khiêu Khích Chiến Tranh
    duelChannelId: process.env.WITCH_HUNTER_DUEL_CHANNEL_ID || '1564210825630195732',
    // Kênh diễn ra sự kiện World Boss Bách Quỷ Dạ Hành (ma nữ tha hóa)
    worldBossChannelId: process.env.WITCH_HUNTER_WORLD_BOSS_CHANNEL_ID || '1564565572098990131',
  },

  // Danh mục Emojis động độc quyền của Server
  emojis: {
    pumpkin: '<a:bingo:1563061901800243253>',
    titleLeft: '<a:trangtrig2:1546040703375904801>',
    titleRight: '<a:trangtrig3:1546040818261954610>',
    hunterButton: '<a:trangtrig36:1563065680922808340>',
    witchButton: '<a:trangtrig32:1546906170994856026>',
    rankUp: '<a:trangtrig45:1547239010190237819>',
    maxRank: '<a:trangtrig14:1546047912969113622>',
    heart: '<a:heartg1:1545307544808071258>',
    hunterBadge: '<a:trangtrig36:1563065680922808340>',
    witchBadge: '<a:trangtrig32:1546906170994856026>',
    sparkles: '✨',
    // Nhiệm Vụ & Giải Mã Cổ Ngữ Emojis
    candle: '<a:trangtrig48:1563552038883958855>',
    streak7: '<a:trangtrig38:1547237720332439574>',
    questBullet: '<a:trangtrig30:1546905942476464178>',
    puzzleButton: '<:trangtri1:1546093044535660644>',
    puzzleHeader: '<a:trangtrig18:1546068102817775626>',
    puzzle10: '<a:heartg1:1545307544808071258>',
    puzzle0: '<a:meongg12:1546092641467506688>',
    puzzlePartial: '<a:trangtrig37:1547237647850807420>',
    giftJackpot: '<a:giftg1:1543150714732412948>',
    // Supporter 3 Đại Hệ Emojis
    camkhi: '<a:camkhig:1563399321125134346>',
    nguyenthe: '<a:nguyentheg:1563399515732443177>',
    linhtoc: '<a:linhtocg:1563399670351536310>',
    // Supporter Decor Emojis
    decor41: '<a:trangtrig41:1547238037832863744>',
    decor15: '<a:trangtrig15:1546047955696488489>',
    decor17: '<a:trangtrig17:1546048098415939655>',
    decor18: '<a:trangtrig18:1546068102817775626>',
    decor30: '<a:trangtrig30:1546905942476464178>',
    decor1: '<a:trangtrig1:1546040442548654140>',
    decor34: '<a:trangtrig34:1547237010572582982>',
    decor21: '<a:trangtrig21:1546093099770716213>',
    decor47: '<a:trangtrig47:1547249293944029308>',
    decor46: '<a:trangtrig46:1547240249761996812>',
    bang2: '<a:bang2:1546891483250954290>',
    // Animated number emojis for BXH (0-9)
    rankDigits: {
      '0': '<a:0_:1563547154507767890>',
      '1': '<a:1_:1563484001765949550>',
      '2': '<a:2_:1563484061111156828>',
      '3': '<a:3_:1563484342779388045>',
      '4': '<a:4_:1563484724725424209>',
      '5': '<a:5_:1563484794623365151>',
      '6': '<a:6_:1563546730979663982>',
      '7': '<a:7_:1563546852928913440>',
      '8': '<a:8_:1563546943471226930>',
      '9': '<a:9_:1563547068948156478>',
    },
  },

  // Mapping Role ID cho 10 Cấp Bậc (5 bậc Thợ Săn & 5 bậc Phù Thủy)
  roles: {
    // Phe Thợ Săn (W.H. Association)
    hunter: {
      1: process.env.ROLE_ID_HUNTER_C || '1563097317509435432', // C-Rank Hunter (0 Bí Ngô)
      2: process.env.ROLE_ID_HUNTER_B || '1563097826970439698', // B-Rank Hunter (100 Bí Ngô)
      3: process.env.ROLE_ID_HUNTER_A || '1563097897271169114', // A-Rank Hunter (500 Bí Ngô)
      4: process.env.ROLE_ID_HUNTER_S || '1563097947850416178', // S-Rank Hunter (3.000 Bí Ngô)
      5: process.env.ROLE_ID_HUNTER_SS || '1563098003005374584', // SS-Rank Hunter (10.000 Bí Ngô)
    },
    // Phe Phù Thủy (Witches)
    witch: {
      1: process.env.ROLE_ID_WITCH_APPRENTICE || '1563098042771570800', // Apprentice Witch (0 Bí Ngô)
      2: process.env.ROLE_ID_WITCH_COVEN || '1563098158240763944', // Coven Witch (100 Bí Ngô)
      3: process.env.ROLE_ID_WITCH_HIGH || '1563098204357009408', // High Witch (500 Bí Ngô)
      4: process.env.ROLE_ID_WITCH_ARCH || '1563098281242918963', // Archwitch (3.000 Bí Ngô)
      5: process.env.ROLE_ID_WITCH_GREAT || '1563098317544493127', // Great Witch (10.000 Bí Ngô)
    },
  },

  // Danh sách chi tiết các bậc và mốc điểm yêu cầu
  ranks: {
    hunter: [
      { rank: 1, name: 'C-Rank Hunter', minPumpkins: 0, title: 'Thợ Săn Tập Sự' },
      { rank: 2, name: 'B-Rank Hunter', minPumpkins: 100, title: 'Thợ Săn Tinh Anh' },
      { rank: 3, name: 'A-Rank Hunter', minPumpkins: 500, title: 'Thợ Săn Cao Cấp' },
      { rank: 4, name: 'S-Rank Hunter', minPumpkins: 3000, title: 'Đại Pháp Thợ Săn' },
      { rank: 5, name: 'SS-Rank Hunter', minPumpkins: 10000, title: 'Huyền Thoại Thợ Săn' },
    ],
    witch: [
      { rank: 1, name: 'Apprentice Witch', minPumpkins: 0, title: 'Phù Thủy Học Việc' },
      { rank: 2, name: 'Coven Witch', minPumpkins: 100, title: 'Phù Thủy Hội Viên' },
      { rank: 3, name: 'High Witch', minPumpkins: 500, title: 'Phù Thủy Thượng Cấp' },
      { rank: 4, name: 'Archwitch', minPumpkins: 3000, title: 'Đại Phù Thủy' },
      { rank: 5, name: 'Great Witch', minPumpkins: 10000, title: 'Tối Cao Ma Nữ' },
    ],
  },

  // Mốc cộng điểm bí ngô theo BXH tháng
  pointsReward: {
    top1_3: 100,
    top4_10: 50,
    top11_20: 25,
  },

  // MÀU SẮC EMBED: Mặc định cố định màu tím pastel nhạt nhạt theo đúng yêu cầu
  colors: {
    pastelPurple: 0xd8b4f8, // Tím pastel nhạt dịu dàng, sang trọng (#D8B4F8)
    softLavender: 0xd1c4e9, // Tím oải hương nhạt (#D1C4E9)
  },

  // Thông điệp vinh danh khi thăng cấp
  messages: {
    welcomeWitch: (userId) =>
      `Kết giới rung chuyển: Phù thủy <@${userId}> đã giải phóng cấm thuật thành công và chính thức bước vào hàng ngũ! Chiếc mũ chóp và quyền năng bóng tối của ngươi đã sẵn sàng gieo rắc nỗi khiếp sợ mới.`,
    welcomeHunter: (userId) =>
      `Hiệp Hội xác nhận: Thợ săn <@${userId}> đã lập đủ chiến công và chính thức bước vào hàng ngũ! Khẩu súng của ngươi đã sẵn sàng cho những mục tiêu nguy hiểm hơn.`,
    alreadyChosen: '<a:trangtrig47:1547249293944029308> Một trong **Tứ Đại Phù Thủy** <@872792190651334707> đã dựa vào mong muốn của Lữ Khách và chọn phe sẵn cho Lữ Khách rồi ạ!\n<a:trangtrig47:1547249293944029308> Nếu Lữ Khách muốn thay đổi phe, xin hãy liên hệ <@872792190651334707> nhé!',

    hunterRankUpQuotes: [
      (userId, rankName) =>
        `<a:trangtrig45:1547239010190237819> Máu của phù thủy đã mở đường. <@${userId}> được phê chuẩn thăng cấp lên ${rankName}!`,
      (userId, rankName) =>
        `<a:trangtrig45:1547239010190237819> Thần chết gọi tên các phù thủy! Thợ săn <@${userId}> đã giải phóng ấn chú thành công, thăng cấp lên ${rankName}.`,
    ],

    witchRankUpQuotes: [
      (userId, rankName) =>
        `<a:trangtrig45:1547239010190237819> Bóng tối trỗi dậy! Ma lực của <@${userId}> vừa vượt ngưỡng giới hạn, chính thức thức tỉnh danh vị ${rankName}!`,
      (userId, rankName) =>
        `<a:trangtrig45:1547239010190237819> Lời nguyền đã ăn sâu vào linh hồn. <@${userId}> đã hoàn tất nghi thức hiến tế bí ngô, thăng hoa thành ${rankName}.`,
    ],

    // Riêng khi đạt bậc cuối (Bậc 5)
    hunterMaxRank: (userId) =>
      `<a:trangtrig14:1546047912969113622> Toàn thể Hiệp Hội kính cẩn nghiêng mình! Huyền thoại sống <@${userId}> đã bước lên đỉnh cao tuyệt đối — SS-Rank Hunter. Không một phù thủy nào có thể trốn thoát khỏi họng súng của ngươi!`,
    witchMaxRank: (userId) =>
      `<a:trangtrig14:1546047912969113622> Kết giới thế giới đã vỡ vụn! <@${userId}> đã đạt đến cảnh giới tối cao — trở thành một trong Tứ Đại Phù Thủy. Hãy run rẩy trước bóng tối vĩnh hằng!`,
  },

  // DANH SÁCH 10 SUPPORTER THEO CỐT TRUYỆN WITCH HUNTER
  supporters: {
    categories: {
      nguyenThe: {
        key: 'nguyenThe',
        name: 'Hệ Nguyền Thể (Cursed Entity)',
        shortName: 'Hệ Nguyền Thể',
        enName: 'Cursed Entity',
        emoji: '<a:nguyentheg:1563399515732443177>',
        desc: 'Thực thể sinh ra từ oán niệm, xác thịt bị nguyền rủa hoặc linh hồn bị phong ấn vào vật thể.',
      },
      camKhi: {
        key: 'camKhi',
        name: 'Hệ Cấm Khí (Forbidden Relic)',
        shortName: 'Hệ Cấm Khí',
        enName: 'Forbidden Relic',
        emoji: '<a:camkhig:1563399321125134346>',
        desc: 'Ma cụ, cơ quan cổ đại hoặc thiết bị không gian do con người rèn tạo để cưỡng chế ma lực.',
      },
      linhToc: {
        key: 'linhToc',
        name: 'Hệ Linh Tộc (Primordial Beast)',
        shortName: 'Hệ Linh Tộc',
        enName: 'Primordial Beast',
        emoji: '<a:linhtocg:1563399670351536310>',
        desc: 'Sinh vật thượng cổ có tri giác độc lập, chỉ cúi đầu hợp tác thông qua khế ước danh dự hoặc máu tương thích.',
      },
    },
    list: [
      {
        id: 'garmr',
        name: 'Garmr — Ngân Khuyển',
        fullName: 'GARMR — NGÂN KHUYỂN',
        titleFancy: '𝓖𝓪𝓻𝓶𝓻 — 𝓝𝓰𝓪̂𝓷 𝓚𝓱𝓾𝔂𝓮̂̉𝓷',
        faction: 'hunter',
        rank: 1,
        rankName: 'C-Rank Hunter (Bậc 1)',
        factionName: 'Hiệp Hội Thợ Săn',
        categoryKey: 'linhToc',
        appearance: 'Con sói tuyết lông ánh bạc, trên trán có vết sẹo chữ thập phát sáng khi đánh hơi thấy tà thuật.',
        lore: 'Huyết mạch sót lại của loài ma khuyển canh cổng địa giới. Khế ước được lập qua nghi thức "Chia Sẻ Mắt": thợ săn nhỏ một giọt máu vào chén nước bạc cho Garmr uống. Từ đó, hai bên chia sẻ khứu giác và tầm nhìn, cho phép thợ săn phát hiện dấu vết phù thủy từ khoảng cách hàng dặm.',
      },
      {
        id: 'malice',
        name: 'Malice — Hắc Thỏ Gỗ',
        fullName: 'MALICE — HẮC THỎ GỖ',
        titleFancy: '𝓜𝓪𝓵𝓲𝓬𝓮 — 𝓗𝓪̆́𝓬 𝓣𝓱𝓸̉ 𝓖𝓸̂̃',
        faction: 'witch',
        rank: 1,
        rankName: 'Tập Sự (Apprentice - Bậc 1)',
        factionName: 'Hội Phù Thủy',
        categoryKey: 'nguyenThe',
        appearance: 'Một con thỏ nhồi bông bằng vải gai vá chằng chịt, một bên mắt đính cúc áo cũ, tay ôm củ cà rốt bằng sắt gỉ.',
        lore: 'Linh hồn của một đứa trẻ bị kết án là phù thủy từ thời trung cổ bị phong ấn vào con thỏ bông. Khế ước được kích hoạt khi phù thủy truyền ma lực hắc ám, Malice sẽ biến những vết khâu trên người thành những sợi chỉ gai trói chặt linh hồn mục tiêu.',
      },
      {
        id: 'zodiac',
        name: 'Zodiac — Đao Phủ Răng Cưa',
        fullName: 'ZODIAC — ĐAO PHỦ RĂNG CƯA',
        titleFancy: '𝓩𝓸𝓭𝓲𝓪𝓬 — Đ𝓪𝓸 𝓟𝓱𝓾̉ 𝓡𝓪̆𝓷𝓰 𝓒𝓾̛𝓪',
        faction: 'hunter',
        rank: 2,
        rankName: 'Bậc 2 (B-Rank Hunter)',
        factionName: 'Hiệp Hội Thợ Săn',
        categoryKey: 'nguyenThe',
        appearance: 'Một cỗ máy đao phủ bằng sắt đen rỉ sét, khuôn mặt là chiếc đồng hồ vỡ kim, cầm lưỡi cưa răng cưa khổng lồ.',
        lore: 'Linh hồn của một tên đồ tể săn phù thủy phát điên vì ma lực, bị giam giữ vĩnh viễn vào cỗ máy hành quyết. Thợ săn phải vặn ngược chiếc chìa khóa cót sau lưng Zodiac để giải phóng lưỡi cưa, đổi lại thợ săn phải chịu những cơn đau đầu nhói buốt mỗi khi cỗ máy gầm rú chém nát kết giới đối phương.',
      },
      {
        id: 'corvus',
        name: 'Corvus — Dạ Quạ Điềm Gở',
        fullName: 'CORVUS — DẠ QUẠ ĐIỀM GỞ',
        titleFancy: '𝓒𝓸𝓻𝓿𝓾𝓼 — 𝓓𝓪̣ 𝓠𝓾𝓪̣ Đ𝓲𝓮̂̀𝓶 𝓖𝓸̛̉',
        faction: 'witch',
        rank: 2,
        rankName: 'Bậc 2 (Coven Witch)',
        factionName: 'Hội Phù Thủy',
        categoryKey: 'linhToc',
        appearance: 'Quạ ba mắt lông đen tuyền lấp lánh ánh tím, đôi mắt thứ ba rực sáng ma nhãn đỏ thẫm.',
        lore: 'Loài chim sứ giả của bóng đêm, hấp thụ oán khí chiến trường. Khế ước cho phép phù thủy phân tán cơ thể thành đàn quạ bóng đêm hoặc nguyền rủa tầm nhìn đối thủ trong sương mù dày đặc.',
      },
      {
        id: 'bastion',
        name: 'Bastion — Trấn Ngục Pháo Đài',
        fullName: 'BASTION — TRẤN NGỤC PHÁO ĐÀI',
        titleFancy: '𝓑𝓪𝓼𝓽𝓲𝓸𝓷 — 𝓣𝓻𝓪̂́𝓷 𝓝𝓰𝓾̣𝓬 𝓟𝓱𝓪́𝓸 Đ𝓪̀𝓲',
        faction: 'hunter',
        rank: 3,
        rankName: 'Bậc 3 (A-Rank Hunter)',
        factionName: 'Hiệp Hội Thợ Săn',
        categoryKey: 'camKhi',
        appearance: 'Cỗ chiến giáp hộ thành khổng lồ đúc bằng hợp kim chống ma thuật, trên ngực gắn lõi phong ma xoay tròn.',
        lore: 'Di vật cấm kỵ từ cuộc đại chiến phù thủy cổ xưa. Khế ước yêu cầu thợ săn cắm thanh kiếm phong ma xuống đất để Bastion phóng thích lồng giam chống pháp thuật tuyệt đối, khóa chặt toàn bộ ma lực trong bán kính xung quanh.',
      },
      {
        id: 'tamamo',
        name: 'Tamamo — Huyễn Hồ Huyết Vực',
        fullName: 'TAMAMO — HUYỄN HỒ HUYẾT VỰC',
        titleFancy: '𝓣𝓪𝓶𝓪𝓶𝓸 — 𝓗𝓾𝔂𝓮̂̃𝓷 𝓗𝓸̂̀ 𝓗𝓾𝔂𝓮̂́𝓽 𝓥𝓾̛̣𝓬',
        faction: 'witch',
        rank: 3,
        rankName: 'Bậc 3 (High Witch)',
        factionName: 'Hội Phù Thủy',
        categoryKey: 'linhToc',
        appearance: 'Yêu hồ chín đuôi sắc trắng tuyết pha viền đỏ son, phát ra ngọn lửa ma trĩu nặng ảo ảnh mê hoặc.',
        lore: 'Hồ ly thượng cổ thông tuệ ảo thuật. Ký khế ước thông qua linh hồn giao kết, Tamamo thi triển kết giới ảo ảnh Huyễn Nguyệt khiến đối thủ tự tàn sát lẫn nhau trong ảo mộng vô tận.',
      },
      {
        id: 'abyssus',
        name: 'Abyssus — Hư Không Ma Khố',
        fullName: 'ABYSSUS — HƯ KHÔNG MA KHỐ',
        titleFancy: '𝓐𝓫𝔂𝓼𝓼𝓾𝓼 — 𝓗𝓾̛ 𝓚𝓱𝓸̂𝓷𝓰 𝓜𝓪 𝓚𝓱𝓸̂́',
        faction: 'hunter',
        rank: 4,
        rankName: 'Bậc 4 (S-Rank Hunter)',
        factionName: 'Hiệp Hội Thợ Săn',
        categoryKey: 'camKhi',
        appearance: 'Một chiếc rương đen trôi nổi lơ lửng, bao bọc bởi những sợi xích không gian ma thuật và các cổ ngữ phong ấn.',
        lore: 'Báu vật cơ giới không gian bậc cao (tương tự như ma trang của Tasha Godspell). Khế ước cho phép thợ săn thò tay vào hư không rút ra vô số vũ khí hạng nặng, đạn bạc diệt ma và đại bác không gian dội hỏa lực hủy diệt.',
      },
      {
        id: 'vermilion',
        name: 'Vermilion — Xích Điểu Bất Tử',
        fullName: 'VERMILION — XÍCH ĐIỂU BẤT TỬ',
        titleFancy: '𝓥𝓮𝓻𝓶𝓲𝓵𝓲𝓸𝓷 — 𝓧𝓲́𝓬𝓱 Đ𝓲𝓮̂̉𝓾 𝓑𝓪̂́𝓽 𝓣𝓾̛̉',
        faction: 'witch',
        rank: 4,
        rankName: 'Bậc 4 (Archwitch)',
        factionName: 'Hội Phù Thủy',
        categoryKey: 'linhToc',
        appearance: 'Phượng hoàng lửa đỏ rực rỡ mang ngọn lửa địa ngục vĩnh cửu, sải cánh bốc cháy ma diễm thiêu đốt màn đêm.',
        lore: 'Linh điểu bất tử sinh ra từ biển dung nham nguyên sơ. Khế ước cộng sinh sinh mệnh: khi phù thủy cạn kiệt ma lực hoặc nguy nan, Vermilion sẽ hiến tế lông vũ niết bàn để tái sinh ma lực và thiêu rụi toàn bộ kẻ thù xung quanh.',
      },
      {
        id: 'oculus',
        name: 'Oculus — Thiên Nhãn Tri Kỷ',
        fullName: 'OCULUS — THIÊN NHÃN TRI KỶ',
        titleFancy: '𝓞𝓬𝓾𝓵𝓾𝓼 — 𝓣𝓱𝓲𝓮̂𝓷 𝓝𝓱𝓪̃𝓷 𝓣𝓻𝓲 𝓚𝔂̉',
        faction: 'hunter',
        rank: 5,
        rankName: 'Bậc 5 (SS-Rank Hunter)',
        factionName: 'Hiệp Hội Thợ Săn',
        categoryKey: 'linhToc',
        appearance: 'Một thiên thể nhãn trần trụi bay lượn bao quanh bởi các vòng tinh thể quang học xoay ngược chiều, tỏa ra hào quang thấu thị đa chiều.',
        lore: 'Thực thể tri giác vũ trụ thấu thị vạn vật. Khế ước Tối Cao: Chia sẻ toàn tri giác, nhìn thấu mọi quỹ đạo ma lực, giải mã điểm yếu tuyệt đối của bất kỳ ma thuật hay phù thủy nào trong nháy mắt.',
      },
      {
        id: 'hallow',
        name: 'Hallow — Vua Đầu Lửa',
        fullName: 'HALLOW — VUA ĐẦU LỬA',
        titleFancy: '𝓗𝓪𝓵𝓵𝓸𝔀 — 𝓥𝓾𝓪 Đ𝓪̂̀𝓾 𝓛𝓾̛̉𝓪',
        faction: 'witch',
        rank: 5,
        rankName: 'Bậc 5 (Great Witch)',
        factionName: 'Hội Phù Thủy',
        categoryKey: 'nguyenThe',
        appearance: 'Ma vương hình hài bí ngô rực lửa (lấy cảm hứng từ Halloween trong bộ truyện Witch Hunter), khoác áo choàng đen rách rưới, miệng cười nhe nanh lửa địa ngục.',
        lore: 'Khế ước Cổ Đại Tối Cao của Đại Phù Thủy! Sự kết hợp giữa linh hồn nguyền rủa và lửa bí ngô ma quái vô tận. Khi giải phóng phong ấn, Hallow phóng thích biển lửa Pumpkin Calamity nuốt chửng toàn bộ chiến trường.',
      },

      // ==========================================
      // II. SUPPORTER TẾ ĐÀN TRIỆU HỒI HUYẾT NGUYỆT
      // ==========================================
      // A. Phe Thợ Săn (A-Rank, S-Rank, SS-Rank)
      {
        id: 'fenris',
        name: 'Fenris — Băng Tật Sói Hoang',
        fullName: 'FENRIS — BĂNG TẬT SÓI HOANG',
        titleFancy: '𝓕𝓮𝓷𝓻𝓲𝓼 — 𝓑𝓪̆𝓷𝓰 𝓣𝓪̣̂𝓽 𝓢𝓸́𝓲 𝓗𝓸𝓪𝓷𝓰',
        faction: 'hunter',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'linhToc',
        isSummon: true,
        appearance: 'Một con bạch lang một mắt khổng lồ, toàn thân phủ lớp lông dày màu khói tuyết, quanh bờm và bốn chân đóng băng vĩnh cửu bốc hơi lạnh ngút ngàn.',
        lore: 'Sinh vật canh giữ đỉnh núi tuyết cấm địa! Fenris chia sẻ khứu giác băng giá với thợ săn để phát hiện kẻ địch tàng hình từ xa, đồng thời gầm rú tạo sóng hàn khí làm chậm nhịp độ niệm chú của phù thủy.',
      },
      {
        id: 'brand',
        name: 'Brand — Tử Tù Lửa Ngục',
        fullName: 'BRAND — TỬ TÙ LỬA NGỤC',
        titleFancy: '𝓑𝓻𝓪𝓷𝓭 — 𝓣𝓾̛̉ 𝓣𝓾̀ 𝓛𝓾̛̉𝓪 𝓝𝓰𝓾̣𝓬',
        faction: 'hunter',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'nguyenThe',
        isSummon: true,
        appearance: 'Oán linh một tử tù mang xiềng xích đỏ rực quấn quanh người, nửa thân trên bốc cháy nghi ngút với đôi mắt rực lửa giận dữ, trôi lơ lửng sát cạnh thợ săn.',
        lore: 'Linh hồn thợ săn sa ngã bị thiêu sống nơi ngục tối! Ký khế ước nợ máu với chủ nhân, Brand sẵn sàng lao mình vào đỡ các đòn đánh chí tử thay cho thợ săn và phát tán ngọn lửa thiêu đốt kết giới xung quanh.',
      },
      {
        id: 'iron_maiden',
        name: 'Iron Maiden — Trinh Nữ Thiết Giáp',
        fullName: 'IRON MAIDEN — TRINH NỮ THIẾT GIÁP',
        titleFancy: '𝓘𝓻𝓸𝓷 𝓜𝓪𝓲𝓭𝓮𝓷 — 𝓣𝓻𝓲𝓷𝓱 𝓝𝓾̛̃ 𝓣𝓱𝓲𝓮̂́𝓽 𝓖𝓲𝓪́𝓹',
        faction: 'hunter',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'camKhi',
        isSummon: true,
        appearance: 'Cỗ quan tài sắt hình thiếu nữ bay lơ lửng, nắp hộp gắn đầy bánh răng cơ học tự xoay và các chông thép nhô ra bên trong khe nứt rỉ sét.',
        lore: 'Công cụ tra tấn tà thuật thời trung cổ được tái thiết kế! Cỗ máy tự động phát hiện quỹ đạo tấn công của kẻ thù để mở nắp chắn trước mặt chủ nhân, giam hãm đòn đánh vào bên trong lõi sắt.',
      },
      {
        id: 'bailong',
        name: 'Bailong — Bạch Lân Dạ Xoa',
        fullName: 'BAILONG — BẠCH LÂN DẠ XOA',
        titleFancy: '𝓑𝓪𝓲𝓵𝓸𝓷𝓰 — 𝓑𝓪̣𝓬𝓱 𝓛𝓪̂𝓷 𝓓𝓪̣ 𝓧𝓸𝓪',
        faction: 'hunter',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'linhToc',
        isSummon: true,
        appearance: 'Chú rồng thu nhỏ toàn thân phủ vảy trắng bạc lấp lánh như ngọc trai, đôi mắt xanh lam phóng điện và hai râu rồng luôn tỏa ra các tia lôi quang tí tách quanh cổ tay thợ săn.',
        lore: 'Long tộc phương Đông ký khế ước thanh trừng! Bailong đồng bộ dòng phản xạ thần kinh với chủ nhân, giúp người sử dụng có tốc độ né tránh cực hạn và phóng ra luồng điện cưỡng chế cắt đứt niệm chú của đối phương.',
      },
      {
        id: 'thanatos',
        name: 'Thanatos — Hắc Giáp Kỵ Sĩ',
        fullName: 'THANATOS — HẮC GIÁP KỴ SĨ',
        titleFancy: '𝓣𝓱𝓪𝓷𝓪𝓽𝓸𝓼 — 𝓗𝓪̆́𝓬 𝓖𝓲𝓪́𝓹 𝓚𝔂̣ 𝓢𝓲̃',
        faction: 'hunter',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'nguyenThe',
        isSummon: true,
        appearance: 'Bộ giáp kỵ sĩ đen tuyền rỗng ruột không đầu, khoác áo choàng rách nát bốc khói đen kịt, bước đi lơ lửng không tạo ra tiếng động nhưng tỏa ra áp lực chết chóc nghẹt thở.',
        lore: 'Hóa thân của lời thề chiến tử! Thanatos hấp thụ nỗi đau đớn và máu của thợ săn để tích lũy uy áp; khi chủ nhân nhận càng nhiều thương tích, bóng ma kỵ sĩ càng trở nên khổng lồ và hung bạo.',
      },
      {
        id: 'astrarium',
        name: 'Astrarium — Tinh Bàn Vô Cực',
        fullName: 'ASTRARIUM — TINH BÀN VÔ CỰC',
        titleFancy: '𝓐𝓼𝓽𝓻𝓪𝓻𝓲𝓾𝓶 — 𝓣𝓲𝓷𝓱 𝓑𝓪̀𝓷 𝓥𝓸̂ 𝓒𝓾̛̣𝓬',
        faction: 'hunter',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'camKhi',
        isSummon: true,
        appearance: 'Cỗ máy thiên văn cơ học bằng đồng thau và đá obsidian, gồm 7 vòng tròn đồng tâm tự xoay ngược chiều nhau, phát ra tiếng tích tắc đều đặn và ánh sáng tinh tú mờ ảo.',
        lore: 'Cỗ máy tính toán quỹ đạo không gian của hội thợ săn cổ! Astrarium tự động đo lường mọi biến dạng ma thuật xung quanh, bẻ cong đường đạn của kẻ thù bay chệch khỏi thợ săn.',
      },
      {
        id: 'deus_ex',
        name: 'Deus Ex — Lõi Thần Cơ Khí',
        fullName: 'DEUS EX — LÕI THẦN CƠ KHÍ',
        titleFancy: '𝓓𝓮𝓾𝓼 𝓔𝔁 — 𝓛𝓸̃𝓲 𝓣𝓱𝓪̂̀𝓷 𝓒𝓸̛ 𝓚𝓱𝓲́',
        faction: 'hunter',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'camKhi',
        isSummon: true,
        appearance: 'Một thiên sứ cơ giới khổng lồ đúc từ thép trắng và vàng ròng, các khớp chuyển động bằng áp suất hơi nước vĩnh cửu, mang 6 cánh bằng lưỡi dao cơ học dang rộng sau lưng thợ săn.',
        lore: 'Tạo tác tối thượng của nền văn minh thợ săn thất truyền! Deus Ex mở ra một vùng "Tuyệt Đối Trật Tự", cưỡng chế vô hiệu hóa và đè bẹp tất cả mọi dạng ma thuật, bùa chú hay lời nguyền trong bán kính chiến trường.',
      },
      {
        id: 'ouroboros_core',
        name: 'Ouroboros Core — Cỗ Máy Khởi Nguyên',
        fullName: 'OUROBOROS CORE — CỖ MÁY KHỞI NGUYÊN',
        titleFancy: '𝓞𝓾𝓻𝓸𝓫𝓸𝓻𝓸𝓼 𝓒𝓸𝓻𝓮 — 𝓒𝓸̂̃ 𝓜𝓪́𝔂 𝓚𝓱𝓸̛̉𝓲 𝓝𝓰𝓾𝔂𝓮̂𝓷',
        faction: 'hunter',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        categoryKey: 'camKhi',
        isSummon: true,
        appearance: 'Cỗ máy lõi năng lượng cổ đại hình quả cầu cơ khí đa tầng bằng thép ròng, lồng ghép hàng trăm vòng bánh răng lơ lửng, liên tục hút cạn và nén chặt các phân tử ma lực tự do xung quanh thợ săn.',
        lore: 'Vũ khí trấn phái tối mật của Thợ Săn Tối Cao! Cỗ máy bẻ cong dòng chảy năng lượng trong không gian, biến toàn bộ ma thuật tầm xa của phù thủy bắn tới thành động năng nạp ngược lại cho hệ thống của thợ săn.',
      },
      // B. Phe Phù Thủy (A-Rank, S-Rank, SS-Rank)
      {
        id: 'sylph',
        name: 'Sylph — Vũ Xà Rừng Cấm',
        fullName: 'SYLPH — VŨ XÀ RỪNG CẤM',
        titleFancy: '𝓢𝔂𝓵𝓹𝓱 — 𝓥𝓾̃ 𝓧𝓪̀ 𝓡𝓾̛̀𝓷𝓰 𝓒𝓪̂́𝓶',
        faction: 'witch',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'linhToc',
        isSummon: true,
        appearance: 'Một loài rắn thần thân phủ lông vũ phát quang óng ánh ngũ sắc, có đôi cánh chuồn chuồn trong suốt lượn lờ quanh đầu phù thủy, phát ra những tiếng rít thanh tao.',
        lore: 'Linh thú bảo hộ các đầm lầy cấm địa! Sylph điều khiển luồng không khí xung quanh để tạo thành bức tường gió độc che giấu tung tích của phù thủy, làm lệch toàn bộ quỹ đạo đạn bạc của thợ săn.',
      },
      {
        id: 'morpheus',
        name: 'Morpheus — Chiêm Mộng Độc Thiềm',
        fullName: 'MORPHEUS — CHIÊM MỘNG ĐỘC THIỀM',
        titleFancy: '𝓜𝓸𝓻𝓹𝓱𝓮𝓾𝓼 — 𝓒𝓱𝓲𝓮̂𝓶 𝓜𝓸̣̂𝓷𝓰 Đ𝓸̣̂𝓬 𝓣𝓱𝓲𝓮̂̀𝓶',
        faction: 'witch',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'nguyenThe',
        isSummon: true,
        appearance: 'Một con cóc khổng lồ da sần sùi màu tím sẫm, lưng cõng một chiếc lư hương đá rêu phong luôn bốc ra những luồng khói ảo mộng đặc quánh, chậm rãi bám sát bước chân chủ nhân.',
        lore: 'Sinh vật sinh ra từ những cơn ác mộng kéo dài của phù thủy già! Morpheus thở ra làn sương ru ngủ làm chậm phản xạ thần kinh của thợ săn, khiến đối phương chìm vào trạng thái nửa tỉnh nửa mê.',
      },
      {
        id: 'hemlock',
        name: 'Hemlock — Cối Xay Huyết Dược',
        fullName: 'HEMLOCK — CỐI XAY HUYẾT DƯỢC',
        titleFancy: '𝓗𝓮𝓶𝓵𝓸𝓬𝓴 — 𝓒𝓸̂́𝓲 𝓧𝓪𝔂 𝓗𝓾𝔂𝓮̂́𝓽 𝓓𝓾̛𝓸̛̣𝓬',
        faction: 'witch',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'camKhi',
        isSummon: true,
        appearance: 'Chiếc cối nghiền bằng đá đen viền đai đồng hoen rỉ tự xoay lơ lửng giữa không trung, miệng cối liên tục nghiền nát tinh thể ma pháp phát ra tiếng rôm rốp rợn người.',
        lore: 'Khí tài chế tác độc dược cổ xưa của các mụ phù thủy đầm lầy! Cối xay tự động thu gom năng lượng dư thừa rơi rớt trên chiến trường, chuyển hóa thành huyết thanh độc tiếp tế mana liên tục cho chủ nhân.',
      },
      {
        id: 'cerastes',
        name: 'Cerastes — Huyết Tích Vạn Mắt',
        fullName: 'CERASTES — HUYẾT TÍCH VẠN MẮT',
        titleFancy: '𝓒𝓮𝓻𝓪𝓼𝓽𝓮𝓼 — 𝓗𝓾𝔂𝓮̂́𝓽 𝓣𝓲́𝓬𝓱 𝓥𝓪̣𝓷 𝓜𝓪̆́𝓽',
        faction: 'witch',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'linhToc',
        isSummon: true,
        appearance: 'Thằn lằn gai bóng đêm với lớp vảy cứng như đá hoa cương, dọc theo sống lưng mọc ra hàng chục con mắt đỏ rực nhấp nháy, quấn chặt trên tà áo choàng của phù thủy.',
        lore: 'Quái thú bóng tối dưới đáy vực sâu! Toàn bộ các con mắt trên lưng Cerastes mở ra để quét sạch điểm mù, phát hiện mọi bẫy rập cơ khí và cảnh báo tức thì khi có sát khí nhắm vào phù thủy.',
      },
      {
        id: 'banshee',
        name: 'Banshee — Vong Hồn Bạch Y',
        fullName: 'BANSHEE — VONG HỒN BẠCH Y',
        titleFancy: '𝓑𝓪𝓷𝓼𝓱𝓮𝓮 — 𝓥𝓸𝓷𝓰 𝓗𝓸̂̀𝓷 𝓑𝓪̣𝓬𝓱 𝓨',
        faction: 'witch',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'nguyenThe',
        isSummon: true,
        appearance: 'Oán linh một cô dâu mặc áo cưới trắng rách bươm nhuốm máu, mặt che khăn tang mỏng lộ đôi mắt trống rỗng rỉ máu, trôi bồng bềnh sau lưng phù thủy như một làn khói lạnh.',
        lore: 'Oán niệm tích tụ từ những cuộc thanh trừng phù thủy thời cổ! Khi phù thủy gặp nguy nan, Banshee há to miệng giải phóng tiếng thét thấu xương xé toạc màng nhĩ và đánh sập ý chí chiến đấu của toàn bộ kẻ địch xung quanh.',
      },
      {
        id: 'ouroboros_witch',
        name: 'Ouroboros — Vòng Lặp Vô Tận',
        fullName: 'OUROBOROS — VÒNG LẶP VÔ TẬN',
        titleFancy: '𝓞𝓾𝓻𝓸𝓫𝓸𝓻𝓸𝓼 — 𝓥𝓸̀𝓷𝓰 𝓛𝓪̣̆𝓹 𝓥𝓸̂ 𝓣𝓪̣̂𝓷',
        faction: 'witch',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'camKhi',
        isSummon: true,
        appearance: 'Một con rắn cơ khí bằng đồng đen cắn chặt đuôi mình thành một vòng tròn hoàn hảo, các khớp vảy kim loại tự chuyển động phát ra âm thanh lách cách quanh cổ phù thủy.',
        lore: 'Bộ máy thao túng nghịch lý thời gian cổ đại! Ouroboros ghi nhớ trạng thái hoàn hảo của phù thủy, khi chủ nhân trúng bùa hại sẽ kích hoạt vòng lặp ngắn để đảo ngược tổn thương về thời điểm trước đó 2 giây.',
      },
      {
        id: 'lilith',
        name: 'Lilith — Huyết Mẫu Cổ Xưa',
        fullName: 'LILITH — HUYẾT MẪU CỔ XƯA',
        titleFancy: '𝓛𝓲𝓵𝓲𝓽𝓱 — 𝓗𝓾𝔂𝓮̂́𝓽 𝓜𝓪̂̃𝓾 𝓒𝓸̂̉ 𝓧𝓾̛𝓪',
        faction: 'witch',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'nguyenThe',
        isSummon: true,
        appearance: 'Nữ vương bóng tối mang đôi cánh dơi gai đen khổng lồ, khoác bộ đầm dài dệt từ huyết dịch tươi liên tục nhỏ giọt, ôm lấy phù thủy từ phía sau như người mẹ bảo vệ con non với ánh nhìn áp đảo vạn vật.',
        lore: 'Khởi nguồn của dòng máu phù thủy nguyên thủy! Sự hiện diện của Lilith tăng cường toàn bộ uy lực bùa chú của phù thủy lên mức tối thượng, đồng thời biến bất kỳ giọt máu nào rơi xuống mặt đất thành một vùng lãnh địa tử thần.',
      },
      {
        id: 'tiamat',
        name: 'Tiamat — Thủy Tổ Long Mẫu',
        fullName: 'TIAMAT — THỦY TỔ LONG MẪU',
        titleFancy: '𝓣𝓲𝓪𝓶𝓪𝓽 — 𝓣𝓱𝓾̉𝔂 𝓣𝓸̂̉ 𝓛𝓸𝓷𝓰 𝓜𝓪̂̃𝓾',
        faction: 'witch',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        factionName: 'Hội Phù Thủy (Witches)',
        categoryKey: 'linhToc',
        isSummon: true,
        appearance: 'Cổ long 7 đầu thu nhỏ bằng hắc ngọc và sương tím, uốn lượn uy nghiêm quanh cơ thể phù thủy, mỗi mắt rồng phát ra ánh hào quang cổ xưa sẵn sàng cắn nuốt trật tự thực tại.',
        lore: 'Rồng mẹ khởi sinh từ biển sâu ma lực nguyên sơ! Sự che chở của Tiamat dựng nên lớp kết giới vảy rồng hư ảnh, triệt tiêu 80% sát thương vật lý và phản vệ lại làn sóng độc nguyên thủy làm mù giác quan thợ săn.',
      },
    ],
  },

  // DANH SÁCH 10 THẦN BINH VŨ KHÍ THẾ GIỚI WITCH HUNTER
  weapons: {
    list: [
      // I. PHE THỢ SĂN (W.H. ASSOCIATION)
      {
        id: 'wep_hunter_1',
        name: 'Silver Fang Dagger (Đoản Đao Răng Bạc)',
        shortName: 'Silver Fang Dagger',
        viName: 'Đoản Đao Răng Bạc',
        titleFancy: '𝓢𝓲𝓵𝓿𝓮𝓻 𝓕𝓪𝓷𝓰 𝓓𝓪𝓰𝓰𝓮𝓻',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 1,
        rankName: 'C-Rank Hunter (Bậc 1)',
        minPumpkins: 0,
        activationMilestone: '0 Bí Ngô (Khởi đầu)',
        supporterLink: 'Đúc từ một chiếc nanh rụng của linh thú Garmr (Ngân Khuyển).',
        energyEmoji: '<:wh3:1563432304179945563>',
        energyAttribute: 'Băng Hàn & Thanh Tẩy (Hàn khí thuần khiết triệt tiêu tà thuật)',
        powerDetail: 'Lưỡi dao tự động rung động và phát ra ánh sáng bạc buốt giá khi tiến vào phạm vi có dấu vết ma thuật. Đòn đâm ở cự ly gần giải phóng luồng khí lạnh cực sâu, làm đông cứng dòng chảy năng lượng và thanh tẩy các ấn chú phòng ngự sơ cấp trên người đối thủ.',
      },
      {
        id: 'wep_hunter_2',
        name: 'Clockwork Saw-Blade (Lưỡi Cưa Cơ Giới)',
        shortName: 'Clockwork Saw-Blade',
        viName: 'Lưỡi Cưa Cơ Giới',
        titleFancy: '𝓒𝓵𝓸𝓬𝓴𝔀𝓸𝓻𝓴 𝓢𝓪𝔀-𝓑𝓵𝓪𝓭𝓮',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 2,
        rankName: 'B-Rank Hunter (Bậc 2)',
        minPumpkins: 100,
        activationMilestone: '100 Bí Ngô',
        supporterLink: 'Nối trực tiếp với trục bánh răng và cót lưng của Zodiac (Đao Phủ Răng Cưa).',
        energyEmoji: '<a:camkhig:1563399321125134346>',
        energyAttribute: 'Kim Cơ & Xung Chấn (Áp suất cơ học nén xung lực hủy diệt)',
        powerDetail: 'Vận hành bằng piston áp suất hơi nước và hệ thống bánh răng ma động lực. Khi kéo chốt, lưỡi cưa xích răng cưa xoay tròn với vận tốc cực hạn, phóng ra các đợt sóng xung chấn kim loại nặng có khả năng nghiền nát vật cản vật lý và cưa đứt các kết giới bùa chú diện hẹp.',
      },
      {
        id: 'wep_hunter_3',
        name: 'Aegis Heavy Tower (Đại Khiên Thành Trì)',
        shortName: 'Aegis Heavy Tower',
        viName: 'Đại Khiên Thành Trì',
        titleFancy: '𝓐𝓮𝓰𝓲𝓼 𝓗𝓮𝓪𝓿𝔂 𝓣𝓸𝔀𝓮𝓻',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 3,
        rankName: 'A-Rank Hunter (Bậc 3)',
        minPumpkins: 500,
        activationMilestone: '500 Bí Ngô',
        supporterLink: 'Tách ra từ một mảng vách thành cơ quan của Bastion (Trấn Ngục Pháo Đài).',
        energyEmoji: '<a:trangtrig46:1547240249761996812>',
        energyAttribute: 'Địa Thạch & Tán Xạ Tinh Thể (Khoáng thạch cổ cưỡng chế hấp thu ma lực)',
        powerDetail: 'Một khối trọng khiên hợp kim bọc tinh thể đen khổng lồ. Khi cắm phập xuống mặt đất, khiên tạo ra một từ trường bảo hộ vững như bàn thạch, chịu được sức công phá cơ học cực lớn đồng thời lõi pha lê lập tức hấp thụ, bẻ gãy và tán xạ ngược lại các tia phép thuật nhắm vào phòng tuyến.',
      },
      {
        id: 'wep_hunter_4',
        name: 'Dimension Breaker (Pháo Kích Không Gian)',
        shortName: 'Dimension Breaker',
        viName: 'Pháo Kích Không Gian',
        titleFancy: '𝓓𝓲𝓶𝓮𝓷𝓼𝓲𝓸𝓷 𝓑𝓻𝓮𝓪𝓴𝓮𝓻',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 4,
        rankName: 'S-Rank Hunter (Bậc 4)',
        minPumpkins: 3000,
        activationMilestone: '3.000 Bí Ngô',
        supporterLink: 'Rút trực tiếp từ khe nứt rương xích của Abyssus (Hư Không Ma Khố).',
        energyEmoji: '<a:whg3:1563432043768189059>',
        energyAttribute: 'Thứ Nguyên & Không Gian (Nén ép thực tại và bẻ cong tọa độ)',
        powerDetail: 'Khẩu trọng pháo mang cấu trúc cơ khí dị giới. Vũ khí này nén ma lực xung quanh thành những khối đạn không gian đặc quánh; khi khai hỏa, viên đạn xé toạc không gian thẳng tới mục tiêu mà không thể bị cản lại bởi khoảng cách vật lý hay giáp chắn thông thường, tạo hố sụp thứ nguyên nghiền nát mọi thứ bên trong.',
      },
      {
        id: 'wep_hunter_5',
        name: 'Chrono-Crossbow (Nỏ Máy Tiên Tri)',
        shortName: 'Chrono-Crossbow',
        viName: 'Nỏ Máy Tiên Tri',
        titleFancy: '𝓒𝓱𝓻𝓸𝓷𝓸-𝓒𝓻𝓸𝓼𝓼𝓫𝓸𝔀',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 5,
        rankName: 'SS-Rank Hunter (Bậc 5 - Tối thượng)',
        minPumpkins: 10000,
        activationMilestone: '10.000 Bí Ngô (Tối thượng)',
        supporterLink: 'Đồng bộ với đôi mắt thiên văn xoay chuyển của thần thú Oculus (Thiên Nhãn Tri Kỷ).',
        energyEmoji: '<:wh2:1563431832546967624>',
        energyAttribute: 'Thời Không & Tinh Tú (Can thiệp dòng thời gian và điểm rơi xác suất)',
        powerDetail: 'Cây nỏ cơ học mang hoa văn các chòm sao cổ đại. Năng lượng thời gian cho phép thấu thị và khóa chặt điểm đáp trong tương lai của mục tiêu trước 3 giây. Mũi tên bắn ra mang năng lượng tinh tú xuyên phá kết giới, tự động bẻ cong quỹ đạo để luôn trúng đích vào khoảnh khắc không thể né tránh.',
      },

      // II. PHE PHÙ THỦY (WITCHES)
      {
        id: 'wep_witch_1',
        name: 'Soul-Stitch Needle (Hắc Châm Khâu Hồn)',
        shortName: 'Soul-Stitch Needle',
        viName: 'Hắc Châm Khâu Hồn',
        titleFancy: '𝓢𝓸𝓾𝓵-𝓢𝓽𝓲𝓽𝓬𝓱 𝓝𝓮𝓮𝓭𝓵𝓮',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 1,
        rankName: 'Apprentice Witch (Bậc 1)',
        minPumpkins: 0,
        activationMilestone: '0 Bí Ngô (Khởi đầu)',
        supporterLink: 'Rút ra từ đường chỉ may sau gáy của thỏ nguyền Malice (Hắc Thỏ Gỗ).',
        energyEmoji: '<a:whg2:1563431096501280819>',
        energyAttribute: 'Oán Độc & Hủ Thực (Tơ hắc ám ăn mòn và khóa mạch thần kinh)',
        powerDetail: 'Cây kim sắt hoen rỉ dẫn theo sợi chỉ đen vô hình dệt từ oán khí. Khi phóng ra, mũi kim đâm xuyên lớp bảo hộ và tự động khâu chằng chịt các đường dẫn ma năng bên trong cơ thể kẻ địch, khiến đối phương tê liệt tạm thời và không thể kích hoạt bùa chú hay súng đạn ma thuật.',
      },
      {
        id: 'wep_witch_2',
        name: 'Raven Glass Blade (Dao Găm Lông Quạ)',
        shortName: 'Raven Glass Blade',
        viName: 'Dao Găm Lông Quạ',
        titleFancy: '𝓡𝓪𝓿𝓮𝓷 𝓖𝓵𝓪𝓼𝓼 𝓑𝓵𝓪𝓭𝓮',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 2,
        rankName: 'Coven Witch (Bậc 2)',
        minPumpkins: 100,
        activationMilestone: '100 Bí Ngô',
        supporterLink: 'Kết tinh từ lớp lông vũ thủy tinh đen của Corvus (Dạ Quạ Điềm Gở).',
        energyEmoji: '<a:whg1:1563430946835931187>',
        energyAttribute: 'U Ám & Hư Ảnh (Nuốt chửng ánh sáng và xóa bỏ tín hiệu âm thanh)',
        powerDetail: 'Lưỡi dao đen mỏng như lá lúa, không phản chiếu ánh sáng và không tạo ra tiếng rẽ gió khi vung chém. Mỗi nhát cắt để lại một vệt rách u ám nuốt chửng mọi âm thanh xung quanh, làm mù giác quan truy vết và để lại vết thương rỉ máu ma lực liên tục không thể tự khép miệng.',
      },
      {
        id: 'wep_witch_3',
        name: 'Kitsune Fox-Lantern (Đèn Lồng Ảo Ảnh)',
        shortName: 'Kitsune Fox-Lantern',
        viName: 'Đèn Lồng Ảo Ảnh',
        titleFancy: '𝓚𝓲𝓽𝓼𝓾𝓷𝓮 𝓕𝓸𝔁-𝓛𝓪𝓷𝓽𝓮𝓻𝓷',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 3,
        rankName: 'High Witch (Bậc 3)',
        minPumpkins: 500,
        activationMilestone: '500 Bí Ngô',
        supporterLink: 'Nhận từ ngọn lửa hồ ly của cổ thú Tamamo (Huyễn Hồ Huyết Vực).',
        energyEmoji: '<:wh1:1563430728564351006>',
        energyAttribute: 'Mê Lôi & Huyễn Khói (Điện tích mê hoặc và ảo ảnh bóp méo thị giác)',
        powerDetail: 'Chiếc đèn giấy bốc ra những luồng khói đỏ sẫm tích điện tích huyễn hoặc. Khi xoay nhẹ cán đèn, khói ma thuật lập tức bao phủ chiến trường, bóp méo hoàn toàn tầm nhìn, âm thanh và phương hướng của đối thủ, biến một đòn tấn công chuẩn xác thành cú bắn vào khoảng không vô định.',
      },
      {
        id: 'wep_witch_4',
        name: 'Cinder Cane (Trượng Tàn Hỏa)',
        shortName: 'Cinder Cane',
        viName: 'Trượng Tàn Hỏa',
        titleFancy: '𝓒𝓲𝓷𝓭𝓮𝓻 𝓒𝓪𝓷𝓮',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 4,
        rankName: 'Archwitch (Bậc 4)',
        minPumpkins: 3000,
        activationMilestone: '3.000 Bí Ngô',
        supporterLink: 'Quấn quanh bởi lông vũ rực lửa của thần điểu Vermilion (Xích Điểu Bất Tử).',
        energyEmoji: '<a:trangtrig29:1546385117478527016>',
        energyAttribute: 'Tàn Hỏa & Trùng Sinh (Lửa tro thiêu đốt rào cản và phục hồi sinh mệnh)',
        powerDetail: 'Quyền trượng gỗ cổ tích tụ ngọn lửa ngún không bao giờ tắt. Vũ khí này giải phóng những làn sóng lửa tro quét sạch các bẫy rập và thiêu rụi rào cản của thợ săn; đồng thời ngọn lửa có tính chất bảo hộ, tự động truyền năng lượng hồi phục sinh mệnh và tái tạo ma lực tức thì cho chủ nhân khi kiệt sức.',
      },
      {
        id: 'wep_witch_5',
        name: 'Soul-Harvest Scythe (Lưỡi Hái Đoạt Hồn)',
        shortName: 'Soul-Harvest Scythe',
        viName: 'Lưỡi Hái Đoạt Hồn',
        titleFancy: '𝓢𝓸𝓾𝓵-𝓗𝓪𝓻𝓿𝓮𝓼𝓽 𝓢𝓬𝔂𝓽𝓱𝓮',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 5,
        rankName: 'Great Witch (Bậc 5 - Tối thượng)',
        minPumpkins: 10000,
        activationMilestone: '10.000 Bí Ngô (Tối thượng)',
        supporterLink: 'Rút trực tiếp từ ngọn lửa địa ngục xanh biếc bên trong đầu Hallow (Vua Đầu Lửa).',
        energyEmoji: '<a:nguyentheg:1563399515732443177>',
        energyAttribute: 'Ma Hỏa & Đoạt Hồn (Ngọn lửa linh hồn tàn sát diện rộng)',
        powerDetail: 'Đại lưỡi hái xương đen rực cháy ma hỏa xanh lục. Mỗi nhát quét lưỡi hái có thể chém đứt mọi kết giới phong ấn vĩ đại nhất, thiêu hủy hoàn toàn sinh lực kẻ thù thành tro bụi và hút cạn linh hồn của đối phương để nuôi dưỡng ngọn lửa ma thuật vĩnh cửu.',
      },

      // ==========================================
      // II. VŨ KHÍ TẾ ĐÀN TRIỆU HỒI HUYẾT NGUYỆT
      // ==========================================
      // A. Phe Thợ Săn (A-Rank, S-Rank, SS-Rank)
      {
        id: 'wep_frostbite_fangs',
        name: 'Frostbite Fangs (Song Nanh Hàn Băng)',
        shortName: 'Frostbite Fangs',
        viName: 'Song Nanh Hàn Băng',
        titleFancy: '𝓕𝓻𝓸𝓼𝓽𝓫𝓲𝓽𝓮 𝓕𝓪𝓷𝓰𝓼',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Fenris — Băng Tật Sói Hoang (Hệ Linh Tộc)',
        energyEmoji: '<:wh3:1563432304179945563>',
        energyAttribute: 'Băng Hàn & Trì Hoãn (Hàn khí cổ xưa làm tê liệt dòng chảy năng lượng)',
        powerDetail: 'Đôi đoản đao rèn từ nanh sói rụng của Fenris; mỗi nhát chém giải phóng sương lạnh cực sâu làm đông cứng các khớp cơ khí và giảm 50% tốc độ di chuyển lẫn tốc độ xuất chiêu của đối thủ.',
      },
      {
        id: 'wep_chain_of_penance',
        name: 'Chain of Penance (Xích Sắt Chuộc Tội)',
        shortName: 'Chain of Penance',
        viName: 'Xích Sắt Chuộc Tội',
        titleFancy: '𝓒𝓱𝓪𝓲𝓷 𝓸𝓯 𝓟𝓮𝓷𝓪𝓷𝓬𝓮',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Brand — Tử Tù Lửa Ngục (Hệ Nguyền Thể)',
        energyEmoji: '<a:trangtrig29:1546385117478527016>',
        energyAttribute: 'Nhiệt Hỏa & Thiêu Đốt (Lửa ngục ăn mòn lớp bảo hộ ma pháp)',
        powerDetail: 'Sợi xích sắt nối trực tiếp từ còng tay của Brand; khi quất ra tạo thành các ngọn roi lửa cuồng nộ trói chặt mục tiêu, liên tục thiêu rụi lớp giáp chắn và làm cạn kiệt nguồn mana dự trữ.',
      },
      {
        id: 'wep_spike_cage_shield',
        name: 'Spike Cage Shield (Khiên Lồng Chông Sắt)',
        shortName: 'Spike Cage Shield',
        viName: 'Khiên Lồng Chông Sắt',
        titleFancy: '𝓢𝓹𝓲𝓴𝓮 𝓒𝓪𝓰𝓮 𝓢𝓱𝓲𝓮𝓵𝓭',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Iron Maiden — Trinh Nữ Thiết Giáp (Hệ Cấm Khí)',
        energyEmoji: '<:wh4:1564143733690204190>',
        energyAttribute: 'Huyết Cương & Phản Chấn (Kim loại cơ quan tán xạ lực công phá)',
        powerDetail: 'Tấm khiên thép tách từ cánh cửa quan tài; khi cắm xuống mặt đất sẽ mở rộng thành rào chắn chông sắt vững chắc, hấp thụ xung lực tầm xa và phản ngược lại 30% sát thương chấn động về phía kẻ tấn công.',
      },
      {
        id: 'wep_thunder_pearl_rapier',
        name: 'Thunder Pearl Rapier (Liễu Kiếm Lôi Châu)',
        shortName: 'Thunder Pearl Rapier',
        viName: 'Liễu Kiếm Lôi Châu',
        titleFancy: '𝓣𝓱𝓾𝓷𝓭𝓮𝓻 𝓟𝓮𝓪𝓻𝓵 𝓡𝓪𝓹𝓲𝓮𝓻',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Bailong — Bạch Lân Dạ Xoa (Hệ Linh Tộc)',
        energyEmoji: '<:wh1:1563430728564351006>',
        energyAttribute: 'Lôi Điện & Xuyên Phá (Dòng điện cao áp xuyên thủng lớp phòng ngự)',
        powerDetail: 'Kiếm liễu thanh mảnh gắn long châu tích điện ở chuôi; mỗi đòn đâm giải phóng một tia chớp xanh biếc xé toạc mọi kết giới phòng hộ và truyền xung điện làm tê liệt toàn bộ hệ thần kinh mục tiêu.',
      },
      {
        id: 'wep_executioners_guise',
        name: 'Executioner’s Guise (Đại Kiếm Tử Vong)',
        shortName: 'Executioner’s Guise',
        viName: 'Đại Kiếm Tử Vong',
        titleFancy: '𝓔𝔁𝓮𝓬𝓾𝓽𝓲𝓸𝓷𝓮𝓻’𝓼 𝓖𝓾𝓲𝓼𝓮',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Thanatos — Hắc Giáp Kỵ Sĩ (Hệ Nguyền Thể)',
        energyEmoji: '<a:whg1:1563430946835931187>',
        energyAttribute: 'Hủ Diệt & Hắc Ám (Chuyển hóa thương tổn thành đòn trừng phạt)',
        powerDetail: 'Cự kiếm khổng lồ sứt mẻ rút từ sau lưng bộ giáp; gom toàn bộ sát thương mà thợ săn đã gánh chịu trong trận chiến để chuyển hóa thành một nhát chém chẻ đôi không gian, kết liễu con mồi ngay lập tức.',
      },
      {
        id: 'wep_singularity_staff',
        name: 'Singularity Staff (Trượng Điểm Kỳ Dị)',
        shortName: 'Singularity Staff',
        viName: 'Trượng Điểm Kỳ Dị',
        titleFancy: '𝓢𝓲𝓷𝓰𝓾𝓵𝓪𝓻𝓲𝓽𝔂 𝓢𝓽𝓪𝓯𝓯',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Astrarium — Tinh Bàn Vô Cực (Hệ Cấm Khí)',
        energyEmoji: '<a:whg3:1563432043768189059>',
        energyAttribute: 'Không Gian & Hút Nén (Bẻ gãy tọa độ thực tại)',
        powerDetail: 'Cây trượng hợp kim mang đầu bánh răng thiên thể; khi gõ xuống tạo ra một hố sụp không gian cực mạnh, cưỡng chế hút chặt toàn bộ kẻ địch xung quanh vào tâm điểm và làm ngưng trệ mọi chuyển động ma pháp.',
      },
      {
        id: 'wep_judgement_cannon',
        name: 'Judgement Cannon (Đại Pháo Thần Phán)',
        shortName: 'Judgement Cannon',
        viName: 'Đại Pháo Thần Phán',
        titleFancy: '𝓙𝓾𝓭𝓰𝓮𝓶𝓮𝓷𝓽 𝓒𝓪𝓷𝓷𝓸𝓷',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Deus Ex — Lõi Thần Cơ Khí (Hệ Cấm Khí)',
        energyEmoji: '<:wh2:1563431832546967624>',
        energyAttribute: 'Thời Không & Phân Rã (Năng lượng hủy diệt thanh trừng vạn vật)',
        powerDetail: 'Khẩu trọng pháo ma động lực khổng lồ tích hợp vào tay phải; bắn ra chùm tia ánh sáng nén ngưng đọng thời gian mục tiêu trong tích tắc trước khi kích nổ phân rã hoàn toàn thực thể và kết giới ma thuật thành tro bụi.',
      },
      {
        id: 'wep_absolute_singularity_lance',
        name: 'Absolute Singularity Lance (Thần Thương Kỳ Dị)',
        shortName: 'Absolute Singularity Lance',
        viName: 'Thần Thương Kỳ Dị',
        titleFancy: '𝓐𝓫𝓼𝓸𝓵𝓾𝓽𝓮 𝓢𝓲𝓷𝓰𝓾𝓵𝓪𝓻𝓲𝓽𝔂 𝓛𝓪𝓷𝓬𝓮',
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Ouroboros Core — Cỗ Máy Khởi Nguyên (Hệ Cấm Khí)',
        energyEmoji: '<a:whg1:1563430946835931187>',
        energyAttribute: 'Vô Cực & Phân Hạch',
        powerDetail: 'Cây đại thương cơ khí dài gần 3 mét giải phóng xung lực hạt nhân ma pháp; mũi thương đâm thẳng tạo ra một điểm chân không cục bộ xé rách mọi rào chắn bảo vệ và nghiền nát mọi kết cấu bùa chú.',
      },

      // B. Phe Phù Thủy (A-Rank, S-Rank, SS-Rank)
      {
        id: 'wep_gale_plume_whip',
        name: 'Gale Plume Whip (Roi Lông Phong Nhận)',
        shortName: 'Gale Plume Whip',
        viName: 'Roi Lông Phong Nhận',
        titleFancy: '𝓖𝓪𝓵𝓮 𝓟𝓵𝓾𝓶𝓮 𝓦𝓱𝓲𝓹',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Sylph — Vũ Xà Rừng Cấm (Hệ Linh Tộc)',
        energyEmoji: '<a:whg1:1564145184965525504>',
        energyAttribute: 'Cuồng Phong & Độc Khí (Gió lốc mang phấn hoa kịch độc)',
        powerDetail: 'Cây roi mềm đan từ lông cánh của Sylph; mỗi cú vung tạo ra những nhát chém bằng áp suất gió độc gây choáng váng diện rộng, ăn mòn thị giác và làm rối loạn khả năng định hướng của kẻ địch.',
      },
      {
        id: 'wep_slumber_mist_censer',
        name: 'Slumber Mist Censer (Lư Hương Mê Giác)',
        shortName: 'Slumber Mist Censer',
        viName: 'Lư Hương Mê Giác',
        titleFancy: '𝓢𝓵𝓾𝓶𝓫𝓮𝓻 𝓜𝓲𝓼𝓽 𝓒𝓮𝓷𝓼𝓮𝓻',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Morpheus — Chiêm Mộng Độc Thiềm (Hệ Nguyền Thể)',
        energyEmoji: '<a:trangtrig10:1546047240265797682>',
        energyAttribute: 'Ảo Mộng & Mê Hương (Khói độc làm sai lệch tri giác)',
        powerDetail: 'Chiếc lư hương cầm tay rút từ lưng cóc; khi lắc nhẹ sẽ phát tán làn khói tím bao trùm không gian, làm méo mó âm thanh và hình ảnh khiến các đòn công kích vật lý của đối thủ đâm vào hư không.',
      },
      {
        id: 'wep_blight_pestle',
        name: 'Blight Pestle (Chày Nghiền Độc Ma)',
        shortName: 'Blight Pestle',
        viName: 'Chày Nghiền Độc Ma',
        titleFancy: '𝓑𝓵𝓲𝓰𝓱𝓽 𝓟𝓮𝓼𝓽𝓵𝓮',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'A',
        rankName: 'A-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Hemlock — Cối Xay Huyết Dược (Hệ Cấm Khí)',
        energyEmoji: '<a:trangtrig44:1547238495494348891>',
        energyAttribute: 'Hủ Thực & Bào Mòn (Độc dịch phân rã giáp kim loại)',
        powerDetail: 'Cây chày kim loại đen nặng trịch; đập mạnh xuống đất phát tán làn sóng độc hủ thực làm rỉ sét trang bị cơ khí của thợ săn và liên tục bào mòn sinh lực mục tiêu theo từng giây.',
      },
      {
        id: 'wep_petrification_gaze_flute',
        name: 'Petrification Gaze Flute (Sáo Hóa Đá)',
        shortName: 'Petrification Gaze Flute',
        viName: 'Sáo Hóa Đá',
        titleFancy: '𝓟𝓮𝓽𝓻𝓲𝓯𝓲𝓬𝓪𝓽𝓲𝓸𝓷 𝓖𝓪𝔃𝓮 𝓕𝓵𝓾𝓽𝓮',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Cerastes — Huyết Tích Vạn Mắt (Hệ Linh Tộc)',
        energyEmoji: '<a:whg2:1564145798537683034>',
        energyAttribute: 'Thao Túng & Hóa Thạch (Sóng âm biến thể chất thành đá)',
        powerDetail: 'Chiếc sáo chế tác từ đốt xương gai của Cerastes; tiếng sáo ma mị phát ra làm đông cứng tế bào sống của kẻ thù, biến các rào chắn phòng thủ và vũ khí kim loại của đối phương thành đá giòn vụn vỡ.',
      },
      {
        id: 'wep_screaming_veil',
        name: 'Screaming Veil (Khăn Tang Ai Oán)',
        shortName: 'Screaming Veil',
        viName: 'Khăn Tang Ai Oán',
        titleFancy: '𝓢𝓬𝓻𝓮𝓪𝓶𝓲𝓷𝓰 𝓥𝓮𝓲𝓵',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Banshee — Vong Hồn Bạch Y (Hệ Nguyền Thể)',
        energyEmoji: '<a:whg3:1564146083372990484>',
        energyAttribute: 'Âm Ba & Đoạt Phách (Tiếng thét xé rách liên kết tinh thần)',
        powerDetail: 'Dải khăn tang dệt từ tơ oán linh; khi vung lên phát ra luồng sóng âm hủy diệt làm rung chuyển không gian, cưỡng chế ngắt toàn bộ kỹ năng đang vận hành của đối thủ và gây choáng cực nặng.',
      },
      {
        id: 'wep_infinity_mirror',
        name: 'Infinity Mirror (Gương Kính Phản Chiếu)',
        shortName: 'Infinity Mirror',
        viName: 'Gương Kính Phản Chiếu',
        titleFancy: '𝓘𝓷𝓯𝓲𝓷𝓲𝓽𝔂 𝓜𝓲𝓻𝓻𝓸𝓻',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'S',
        rankName: 'S-Rank (Triệu Hồi)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Ouroboros — Vòng Lặp Vô Tận (Hệ Cấm Khí)',
        energyEmoji: '<a:whg1:1563430946835931187>',
        energyAttribute: 'Huyễn Ảo & Sao Chép (Bẻ cong đòn đánh sang bản sao)',
        powerDetail: 'Chiếc gương đồng nứt nẻ cầm trong lòng bàn tay; tự động tạo ra một ảo ảnh hoàn hảo của phù thủy để nhận trọn 100% sát thương từ đòn chí mạng đầu tiên của đối thủ rồi biến mất không tỳ vết.',
      },
      {
        id: 'wep_genesis_blood_chalice',
        name: 'Genesis Blood Chalice (Chén Thánh Huyết Nguyện)',
        shortName: 'Genesis Blood Chalice',
        viName: 'Chén Thánh Huyết Nguyện',
        titleFancy: '𝓖𝓮𝓷𝓮𝓼𝓲𝓼 𝓑𝓵𝓸𝓸𝓭 𝓒𝓱𝓪𝓵𝓲𝓬𝓮',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Lilith — Huyết Mẫu Cổ Xưa (Hệ Nguyền Thể)',
        energyEmoji: '<:wh4:1564143733690204190>',
        energyAttribute: 'Huyết Mạch & Tái Sinh Tuyệt Đối (Dòng máu khởi nguyên tái lập sự sống)',
        powerDetail: 'Chiếc chén nạm đá huyết thạch chứa máu khởi nguyên; khi chủ nhân cạn máu sẽ lập tức kích hoạt ma thuật hồi sinh toàn phần, đồng thời biến vũng máu xung quanh thành hàng vạn gai chông huyết sắc phóng lên đâm nát mọi kẻ thù trong phạm vi.',
      },
      {
        id: 'wep_calamity_dragon_horn',
        name: 'Calamity Dragon Horn (Tù Và Tai Ương)',
        shortName: 'Calamity Dragon Horn',
        viName: 'Tù Và Tai Ương',
        titleFancy: '𝓒𝓪𝓵𝓪𝓶𝓲𝓽𝔂 𝓓𝓻𝓪𝓰𝓸𝓷 𝓗𝓸𝓻𝓷',
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: 'SS',
        rankName: 'SS-Rank (Triệu Hồi Đỉnh Phong)',
        isSummon: true,
        activationMilestone: 'Bể Triệu Hồi Huyết Nguyệt',
        supporterLink: 'Tiamat — Thủy Tổ Long Mẫu (Hệ Linh Tộc)',
        energyEmoji: '<a:knifeg1:1546058092016312381>',
        energyAttribute: 'Hỗn Độn & Hủy Diệt',
        powerDetail: 'Chiếc tù và chạm khắc từ sừng rồng tổ; thổi lên âm vang hỗn mang triệu hồi một cơn đại hồng thủy ma thuật tím nuốt trọn cả chiến trường, cưỡng chế vô hiệu hóa mọi trang bị cơ giới của kẻ địch.',
      },
    ],
  },

  // DANH SÁCH 20 CÂU HỎI GIẢI MÃ CỔ NGỮ (QUICK PUZZLE)
  quickPuzzle: {
    title: 'Giải Mã Cổ Ngữ (Quick Puzzle)',
    description: 'Nghi thức giải mã cổ ngữ diễn ra vào mỗi cuối tuần (Thứ 7 & Chủ Nhật)',
    questions: [
      {
        id: 1,
        question: 'Tấm trọng khiên Aegis Heavy Tower (Đại Khiên Thành Trì) của thợ săn Bậc 3 có nguồn gốc xuất xứ từ đâu?',
        options: [
          { key: 'A', text: 'Đúc từ bạc thánh đường của Vatican' },
          { key: 'B', text: 'Tách ra từ một mảng vách thành cơ quan của Bastion' },
          { key: 'C', text: 'Đập vỡ từ tảng đá thiên thạch rơi ngoài không gian' },
          { key: 'D', text: 'Nhặt được dưới hầm mộ của các hiệp sĩ cổ xưa' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 2,
        question: 'Để kích hoạt liên kết khế ước với thỏ nguyền Malice (Hắc Thỏ Gỗ) ở Bậc 1, phù thủy phải thực hiện hành động nào?',
        options: [
          { key: 'A', text: 'Nhỏ một giọt máu vào mắt cúc áo của nó' },
          { key: 'B', text: 'Khâu thêm một chiếc tai giả bằng vải đen' },
          { key: 'C', text: 'Đốt cháy củ cà rốt sắt rỉ' },
          { key: 'D', text: 'Đọc 100 lần bài đồng dao lúc nửa đêm' },
        ],
        correctAnswer: 'A',
      },
      {
        id: 3,
        question: 'Điểm khác biệt mấu chốt giữa hệ Cấm Khí (Forbidden Relic) so với Linh Tộc và Nguyền Thể là gì?',
        options: [
          { key: 'A', text: 'Cấm Khí có linh hồn tự do và không bao giờ phục tùng con người' },
          { key: 'B', text: 'Cấm Khí là khí tài cơ giới do con người chế tác để cưỡng chế ma lực tự nhiên' },
          { key: 'C', text: 'Cấm Khí chỉ xuất hiện khi một phù thủy trút hơi thở cuối cùng' },
          { key: 'D', text: 'Cấm Khí bắt buộc phải nuôi sống bằng máu tươi mỗi ngày' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 4,
        question: 'Ngọn lửa rực cháy bên trong đầu bí ngô của Hallow (Vua Đầu Lửa) có màu sắc gì và mang đặc tính nào?',
        options: [
          { key: 'A', text: 'Lửa đỏ rực – thiêu đốt kim loại thông thường' },
          { key: 'B', text: 'Lửa trắng – làm đông cứng mọi vật thể xung quanh' },
          { key: 'C', text: 'Lửa xanh biếc – thiêu hủy sinh lực và phá vỡ kết giới cấm' },
          { key: 'D', text: 'Lửa đen vô hình – chỉ người chết mới nhìn thấy' },
        ],
        correctAnswer: 'C',
      },
      {
        id: 5,
        question: 'Dấu hiệu nhận biết đặc trưng trên cơ thể Ngân Khuyển Garmr khi đánh hơi thấy tà thuật xuất hiện ở cự ly gần là gì?',
        options: [
          { key: 'A', text: 'Bộ lông chuyển hoàn toàn sang màu đen mực' },
          { key: 'B', text: 'Vết sẹo chữ thập trên trán tự động phát sáng rực rỡ' },
          { key: 'C', text: 'Đôi mắt chảy ra huyết lệ' },
          { key: 'D', text: 'Đuôi biến thành lưỡi kiếm bạc' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 6,
        question: 'Vì sao phát bắn từ khẩu pháo Dimension Breaker của Thợ Săn Bậc 4 không thể bị cản lại bởi giáp trụ hay tường chắn thông thường?',
        options: [
          { key: 'A', text: 'Đạn bay với tốc độ ánh sáng' },
          { key: 'B', text: 'Đạn nén bẻ gãy thực tại, xé toạc không gian thẳng tới tọa độ mục tiêu' },
          { key: 'C', text: 'Đạn làm từ thủy ngân lỏng tự chảy luồn qua khe hở' },
          { key: 'D', text: 'Đạn tự phân rã mục tiêu trước khi chạm tới' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 7,
        question: 'Khế ước giữa Thợ Săn Bậc 5 và Cú Đêm Oculus (Thiên Nhãn Tri Kỷ) được gọi là gì?',
        options: [
          { key: 'A', text: 'Lời Thề Răng Máu' },
          { key: 'B', text: 'Món Nợ Tương Lai' },
          { key: 'C', text: 'Giao Kèo Quỷ Dữ' },
          { key: 'D', text: 'Khế Ước Tro Tàn' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 8,
        question: 'Ngoài việc thiêu đốt chướng ngại vật, Cinder Cane (Trượng Tàn Hỏa) của Phù Thủy Bậc 4 còn có công năng sinh mệnh nào?',
        options: [
          { key: 'A', text: 'Hồi sinh chủ nhân và tái tạo ma lực khi cận kề cái chết' },
          { key: 'B', text: 'Ban cho chủ nhân khả năng tàng hình vĩnh viễn' },
          { key: 'C', text: 'Biến đối thủ thành một bức tượng than đá' },
          { key: 'D', text: 'Hút cạn tuổi thọ của kẻ địch để tăng kích thước trượng' },
        ],
        correctAnswer: 'A',
      },
      {
        id: 9,
        question: 'Khi giải phóng lưỡi cưa cơ giới xé rách kết giới, Thợ Săn sở hữu Zodiac phải gánh chịu phản phệ nào?',
        options: [
          { key: 'A', text: 'Bị giảm 50% tầm nhìn trong đêm' },
          { key: 'B', text: 'Những cơn đau đầu nhói buốt do liên kết cót sắt với linh hồn đao phủ' },
          { key: 'C', text: 'Mất khả năng sử dụng đạn bạc trong 1 giờ' },
          { key: 'D', text: 'Bị cỗ máy hút mất một nửa số Bí Ngô đang có' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 10,
        question: 'Để gửi đi một tin nhắn bí mật hoặc trốn tránh radar dò tìm của Hiệp Hội, Corvus sẽ làm gì?',
        options: [
          { key: 'A', text: 'Độn thổ chui sâu xuống lòng đất' },
          { key: 'B', text: 'Hóa thành một làn khói độc màu xanh lục' },
          { key: 'C', text: 'Phân rã cơ thể thành hàng trăm ảo ảnh lông vũ thủy tinh bay tản ra các hướng' },
          { key: 'D', text: 'Hát lên một khúc ca ru ngủ toàn bộ vùng lân cận' },
        ],
        correctAnswer: 'C',
      },
      {
        id: 11,
        question: 'Một Kẻ Mang Khế Ước xung phong đi săn phù thủy nhưng vào tới rừng cấm lại ngồi một góc bấm điện thoại vì "hết pin giao tiếp xã hội". Đây là biểu hiện của:',
        options: [
          { key: 'A', text: 'Bị dính bùa lú cổ đại' },
          { key: 'B', text: 'Triệu chứng của người hướng nội part-time' },
          { key: 'C', text: 'Bị trúng độc tơ rỉ sét' },
          { key: 'D', text: 'Đang thiền định kết nối vũ trụ' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 12,
        question: 'Khi một tân binh khẳng định dùng dao găm Bậc 1 có thể một đòn chém bay màu đại phù thủy Bậc 5, các tiền bối trong Hiệp Hội sẽ bảo:',
        options: [
          { key: 'A', text: '\"Ngươi thật có chí khí phi thường!\"' },
          { key: 'B', text: '\"Ăn nói xà lơ, sao mà ăn nói xà lơ dữ vậy!\"' },
          { key: 'C', text: '\"Hãy lập tức nhận chức Hội Trưởng!\"' },
          { key: 'D', text: '\"Đúng là thiên tài trăm năm có một!\"' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 13,
        question: 'Nghi thức "pha vạc độc" của một phù thủy thế hệ mới thường bao gồm: 70% đường, 100% đá, trân châu đen và thạch phô mai. Món độc dược này tên là:',
        options: [
          { key: 'A', text: 'Độc dược ngủ ngàn năm' },
          { key: 'B', text: 'Trà sữa full topping' },
          { key: 'C', text: 'Thuốc hồi sinh linh hồn' },
          { key: 'D', text: 'Hắc ám ma tuyền' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 14,
        question: 'Bạn thức trắng đêm treo voice 60 phút nhưng hôm sau bạn thân lại bảo "Do mày nhớ nhầm chứ server làm gì có event voice", hành động này gọi là:',
        options: [
          { key: 'A', text: 'Bùa chú xóa ký ức' },
          { key: 'B', text: 'Thuật thao túng tâm lý (Gaslighting)' },
          { key: 'C', text: 'Đồng đội tốt bụng nhắc nhở' },
          { key: 'D', text: 'Hiện tượng ảo giác không gian' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 15,
        question: 'Trong lúc cả đội đang bí mật bao vây căn cứ phù thủy, một thành viên lỡ tay bấm nhầm nút loa ngoài làm vang tiếng nhạc xổ số. Danh hiệu trao cho người này là:',
        options: [
          { key: 'A', text: 'Dũng sĩ xung kích' },
          { key: 'B', text: 'Chiến thần tình báo' },
          { key: 'C', text: '\"Báo thủ\" của năm' },
          { key: 'D', text: 'Bậc thầy nghi binh' },
        ],
        correctAnswer: 'C',
      },
      {
        id: 16,
        question: 'Đứng trước toàn thể server tuyên bố hôm nay sẽ giải đúng 10/10 câu đố cổ ngữ, kết quả bấm nút sai ngay câu đầu tiên. Cảm xúc lúc này là:',
        options: [
          { key: 'A', text: 'Tự hào ngút ngàn' },
          { key: 'B', text: '\"Mắc cỡ quá 2 ơi!\"' },
          { key: 'C', text: 'Phẫn nộ với vũ trụ' },
          { key: 'D', text: 'Bình thản lạ thường' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 17,
        question: 'Khi một thợ săn thắp nến trượt chuỗi ngày thứ 6, sau đó lại làm rơi vũ khí xuống vực sâu không đáy, cả hội chỉ biết thốt lên:',
        options: [
          { key: 'A', text: '\"Đỉnh nóc kịch trần!\"' },
          { key: 'B', text: '\"Ca này hết cứu!\"' },
          { key: 'C', text: '\"Cố lên sắp thành công rồi!\"' },
          { key: 'D', text: '\"Tuyệt vời ông mặt trời!\"' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 18,
        question: 'Khoảnh khắc nút Thắp Nến Cầu Nguyện nổ trúng tỷ lệ 1% nhận ngay +10 🎃, trạng thái hưng phấn đó được mô tả chuẩn xác nhất là:',
        options: [
          { key: 'A', text: '\"Bình thường như cân đường hộp sữa\"' },
          { key: 'B', text: '\"Đỉnh nóc, kịch trần, bay phấp phới!\"' },
          { key: 'C', text: '\"Không cảm xúc\"' },
          { key: 'D', text: '\"Sợ hãi tột cùng\"' },
        ],
        correctAnswer: 'B',
      },
      {
        id: 19,
        question: 'Một phù thủy khoác lên mình trang phục Bậc 5, vung Lưỡi Hái Đoạt Hồn với thần thái sang chảnh không góc chết. Dân mạng sẽ bình luận từ gì?',
        options: [
          { key: 'A', text: '\"Quá Slay!\"' },
          { key: 'B', text: '\"Xấu đau đớn\"' },
          { key: 'C', text: '\"Tạm được thôi\"' },
          { key: 'D', text: '\"Không hợp phong thủy\"' },
        ],
        correctAnswer: 'A',
      },
      {
        id: 20,
        question: 'Một thành viên mới vào server 3 ngày nhưng đã đứng đầu bảng xếp hạng Bí Ngô nhờ chăm chỉ làm sạch nhiệm vụ. Cả hội trầm trồ:',
        options: [
          { key: 'A', text: '\"Gà mờ may mắn thôi\"' },
          { key: 'B', text: '\"Thế lực mới này đúng là không đùa được đâu!\"' },
          { key: 'C', text: '\"Chắc chắn là hack điểm\"' },
          { key: 'D', text: '\"Bình thường thôi có gì đâu\"' },
        ],
        correctAnswer: 'B',
      },
    ],
  },
};

/**
 * Tra cứu thông tin phe và bậc rank từ Role ID
 * @param {string} roleId
 * @returns {{ faction: 'hunter' | 'witch', factionName: string, rank: number, name: string, title: string, emoji: string, roleId: string } | null}
 */
export function getWitchHunterRoleInfo(roleId) {
  if (!roleId) return null;

  for (const [rankStr, id] of Object.entries(WITCH_HUNTER_CONFIG.roles.hunter)) {
    if (id === roleId) {
      const rankNum = Number(rankStr);
      const rankObj = WITCH_HUNTER_CONFIG.ranks.hunter.find((r) => r.rank === rankNum);
      return {
        faction: 'hunter',
        factionName: 'Hiệp Hội Thợ Săn (W.H. Association)',
        rank: rankNum,
        name: rankObj?.name || `Cấp ${rankNum}`,
        title: rankObj?.title || 'Thợ Săn',
        emoji: WITCH_HUNTER_CONFIG.emojis.hunterBadge,
        roleId,
      };
    }
  }

  for (const [rankStr, id] of Object.entries(WITCH_HUNTER_CONFIG.roles.witch)) {
    if (id === roleId) {
      const rankNum = Number(rankStr);
      const rankObj = WITCH_HUNTER_CONFIG.ranks.witch.find((r) => r.rank === rankNum);
      return {
        faction: 'witch',
        factionName: 'Hội Phù Thủy (Witches)',
        rank: rankNum,
        name: rankObj?.name || `Cấp ${rankNum}`,
        title: rankObj?.title || 'Phù Thủy',
        emoji: WITCH_HUNTER_CONFIG.emojis.witchBadge,
        roleId,
      };
    }
  }

  return null;
}

/**
 * Lấy toàn bộ danh sách Role IDs của cả 2 phe
 * @returns {Set<string>}
 */
export function getAllWitchHunterRoleIds() {
  const set = new Set();
  Object.values(WITCH_HUNTER_CONFIG.roles.hunter).forEach((id) => id && set.add(id));
  Object.values(WITCH_HUNTER_CONFIG.roles.witch).forEach((id) => id && set.add(id));
  return set;
}

/**
 * Tìm Supporter theo ID
 * @param {string} supporterId
 */
export function getSupporterById(supporterId) {
  if (!supporterId) return null;
  return WITCH_HUNTER_CONFIG.supporters.list.find((s) => s.id === supporterId) || null;
}

/**
 * Tìm Supporter theo Phe và Bậc Rank (1-5)
 * @param {'hunter' | 'witch'} faction
 * @param {number} rank
 */
export function getSupporterByRank(faction, rank) {
  if (!faction || !rank) return null;
  return WITCH_HUNTER_CONFIG.supporters.list.find((s) => s.faction === faction && s.rank === Number(rank)) || null;
}

/**
 * Tìm Thần Binh Vũ Khí theo ID
 * @param {string} weaponId
 */
export function getWeaponById(weaponId) {
  if (!weaponId) return null;
  return WITCH_HUNTER_CONFIG.weapons.list.find((w) => w.id === weaponId) || null;
}

/**
 * Tìm Thần Binh Vũ Khí theo Phe và Bậc Rank (1-5)
 * @param {'hunter' | 'witch'} faction
 * @param {number} rank
 */
export function getWeaponByRank(faction, rank) {
  if (!faction || !rank) return null;
  return WITCH_HUNTER_CONFIG.weapons.list.find((w) => w.faction === faction && w.rank === Number(rank)) || null;
}

export const RANK_DIGIT_EMOJIS = WITCH_HUNTER_CONFIG.emojis.rankDigits;

/**
 * Chuyển đổi số thứ hạng (rank) sang chuỗi emoji số động.
 * Ví dụ: 1 -> <a:1_:...>, 10 -> <a:1_:...><a:0_:...>
 * @param {number|string} rank
 * @returns {string}
 */
export function formatRankEmoji(rank) {
  if (rank === null || rank === undefined) return '';
  return String(rank)
    .split('')
    .map((digit) => RANK_DIGIT_EMOJIS[digit] || digit)
    .join('');
}

/**
 * Lấy toàn bộ danh sách 20 câu hỏi Giải Mã Cổ Ngữ
 * @returns {Array}
 */
export function getQuickPuzzleQuestions() {
  return WITCH_HUNTER_CONFIG.quickPuzzle.questions;
}

/**
 * Tìm câu hỏi Giải Mã Cổ Ngữ theo ID
 * @param {number} id
 * @returns {Object|null}
 */
export function getQuickPuzzleById(id) {
  const numId = Number(id);
  return WITCH_HUNTER_CONFIG.quickPuzzle.questions.find((q) => q.id === numId) || null;
}

/**
 * Bảng ánh xạ Cộng Hưởng Đồng Bộ Khế Ước (Resonance Map)
 * Supporter liên kết trực tiếp với Thần Binh Vũ Khí gốc -> Kích hoạt x1.5 Bạo Kích Sát Thương
 */
export const WITCH_HUNTER_RESONANCE_MAP = {
  // --- HIỆP HỘI THỢ SĂN (HUNTERS) ---
  garmr: 'wep_hunter_1',
  zodiac: 'wep_hunter_2',
  bastion: 'wep_hunter_3',
  abyssus: 'wep_hunter_4',
  oculus: 'wep_hunter_5',
  fenris: 'wep_frostbite_fangs',
  brand: 'wep_chain_of_penance',
  iron_maiden: 'wep_spike_cage_shield',
  bailong: 'wep_thunder_pearl_rapier',
  thanatos: 'wep_executioners_guise',
  astrarium: 'wep_singularity_staff',
  deus_ex: 'wep_judgement_cannon',
  ouroboros_core: 'wep_absolute_singularity_lance',

  // --- PHE PHÙ THỦY (WITCHES) ---
  malice: 'wep_witch_1',
  corvus: 'wep_witch_2',
  tamamo: 'wep_witch_3',
  vermilion: 'wep_witch_4',
  hallow: 'wep_witch_5',
  sylph: 'wep_gale_plume_whip',
  morpheus: 'wep_slumber_mist_censer',
  hemlock: 'wep_blight_pestle',
  cerastes: 'wep_petrification_gaze_flute',
  chrysalis: 'wep_void_chrysalis_staff',
  inferna: 'wep_hellfire_crucible',
  leviathan_core: 'wep_abyssal_sovereign_orb',
  ouroboros_eye: 'wep_genesis_ouroboros_eye',
  banshee: 'wep_screaming_veil',
  ouroboros_witch: 'wep_infinity_mirror',
  lilith: 'wep_genesis_blood_chalice',
  tiamat: 'wep_calamity_dragon_horn',
};

export const WITCH_HUNTER_WEAPON_TO_SUPPORTER_MAP = Object.fromEntries(
  Object.entries(WITCH_HUNTER_RESONANCE_MAP).map(([s, w]) => [w, s])
);

export default WITCH_HUNTER_CONFIG;



