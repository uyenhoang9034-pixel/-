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

export default WITCH_HUNTER_CONFIG;

