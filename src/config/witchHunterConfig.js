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
    // Kênh gửi Embed vinh danh chốt BXH tháng
    announcementChannelId: process.env.WITCH_HUNTER_ANNOUNCEMENT_CHANNEL_ID || '1563069218214121513',
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
    hunterBadge: '⚔️',
    witchBadge: '🔮',
    sparkles: '✨',
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
      `Kết giới rung chuyển: Phù thủy <@${userId}> đã giải phóng cấm thuật thành công và chính thức bước vào hàng ngũ! Chiếc mũ chóp và quyền năng bóng tối của ngươi đã sẵn sàng reo rắc nỗi khiếp sợ mới.`,
    welcomeHunter: (userId) =>
      `Hiệp Hội xác nhận: Thợ săn <@${userId}> đã lập đủ chiến công và chính thức bước vào hàng ngũ! Khẩu súng của ngươi đã sẵn sàng cho những mục tiêu nguy hiểm hơn.`,
    alreadyChosen: 'Khế ước đã được ký kết, bạn không thể phản bội phe của mình!',

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
};

export default WITCH_HUNTER_CONFIG;
