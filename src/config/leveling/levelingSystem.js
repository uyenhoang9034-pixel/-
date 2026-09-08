/**
 * =========================================================
 * USAGI LEVELING SYSTEM
 * =========================================================
 */

export const LEVELING_MAX_LEVEL = 999;

export const LEVEL_ANNOUNCEMENT_CHANNEL_ID =
    '1542209852569427999';

export const PRISON_ROLE_ID =
    '1541818610639446066';

/**
 * 30 phút voice = 1 level.
 */
export const VOICE_LEVEL_INTERVAL_MS =
    30 * 60 * 1000;

/**
 * =========================================================
 * EMOJIS
 * =========================================================
 */

export const LEVEL_EMOJIS = {
    left:
        '<a:trangtrig2:1546040703375904801>',

    right:
        '<a:trangtrig3:1546040818261954610>',

    title:
        '<a:trangtrig10:1546047240265797682>',

    line:
        '<a:trangtrig6:1546043036390260756>',
};

/**
 * =========================================================
 * IMAGES
 * =========================================================
 *
 * Lv.1 / 10 / 20 / 40 / 70
 * -> early
 *
 * Lv.100 / 200 / 300
 * -> level100
 *
 * Lv.500
 * -> level500
 *
 * Lv.999
 * -> level999
 */

export const LEVEL_IMAGES = {
    early:
        'https://cdn.discordapp.com/attachments/1541787923358289981/1546924659767910400/500c1a45-cd84-4644-8012-93108d674068.png?ex=6aa18d5b&is=6aa03bdb&hm=6633a518aa8a71a2a7bb44135d8ed97eca5a060ead565a5465fa66080d863516&',

    level100:
        'https://cdn.discordapp.com/attachments/1541787923358289981/1546924686624030781/574073d4-0433-4b24-9959-5406d7ca3d67.png?ex=6aa18d61&is=6aa03be1&hm=6ec85d785367f8b0f5e741ca851e44f4261ef37101b59642de315a178c52d162&',

    level500:
        'https://cdn.discordapp.com/attachments/1541787923358289981/1546927938060951722/7b9d3984-5d3b-4da7-a0f0-04643c35b4a6.png?ex=6aa19068&is=6aa03ee8&hm=5ee06d7a2592fed8bf24dbb15cb025124c9e3e0add527355ae046b28e03cef3b&',

    level999:
        'https://cdn.discordapp.com/attachments/1541787923358289981/1546928002242314240/c1f921f3-722c-4457-8b3b-9c5c60a86be1.png?ex=6aa19078&is=6aa03ef8&hm=3b5e9e285d217f4f13af92da772165e65fe899bb5e26f0186a796469fc645686&',
};

/**
 * =========================================================
 * REALM MILESTONES
 * =========================================================
 *
 * Chỉ giữ ROLE cảnh giới CAO NHẤT.
 */

export const LEVEL_MILESTONES = {
    1: {
        realm:
            'Luyện Khí Kỳ',

        roleId:
            '1542093887726813234',

        heading:
            'TIÊN ĐỒ SƠ KHỞI',

        intro:
            '*Linh khí nhập thể, tiên duyên sơ hiện.*',

        body:
            'đã cảm ứng thiên địa linh khí, chính thức bước lên con đường tu hành!',

        ending:
            'Tiên lộ vạn dặm, hôm nay mới chỉ là bước đầu tiên.',

        image:
            LEVEL_IMAGES.early,
    },

    10: {
        realm:
            'Trúc Cơ Kỳ',

        roleId:
            '1542094012448645202',

        heading:
            'ĐẠO CƠ SƠ THÀNH',

        intro:
            '*Linh khí quy nguyên, đạo cơ sơ thành.*',

        body:
            'đã phá tan bình cảnh, tẩy luyện kinh mạch, chính thức bước vào Trúc Cơ!',

        ending:
            'Đạo cơ đã lập, tiên lộ từ đây mới thực sự khai mở.',

        image:
            LEVEL_IMAGES.early,
    },

    20: {
        realm:
            'Kim Đan Kỳ',

        roleId:
            '1542094188290510958',

        heading:
            'KIM ĐAN SƠ THÀNH',

        intro:
            '*Linh lực hội tụ, nhất đan ngưng thành.*',

        body:
            'đã vượt qua bình cảnh, linh lực kết đan, tu vi bước sang một đại cảnh giới!',

        ending:
            'Kim đan đã kết, đạo đồ rộng mở — từ đây mới thực sự bước vào hàng ngũ tu sĩ.',

        image:
            LEVEL_IMAGES.early,
    },

    40: {
        realm:
            'Nguyên Anh Kỳ',

        roleId:
            '1542094413361184779',

        heading:
            'NGUYÊN ANH XUẤT THẾ',

        intro:
            '*Kim đan phá kén, Nguyên Anh sơ sinh.*',

        body:
            'đã phá vỡ đại bình cảnh, thần hồn lột xác, Nguyên Anh từ trong Kim Đan mà thành!',

        ending:
            'Nguyên Anh xuất thế, thọ nguyên đại tăng — tiên đồ từ đây lại mở một phương trời mới.',

        image:
            LEVEL_IMAGES.early,
    },

    70: {
        realm:
            'Hóa Thần Kỳ',

        roleId:
            '1542094665484992522',

        heading:
            'HÓA THẦN NHẬP ĐẠO',

        intro:
            '*Nguyên Anh hóa thần, thần niệm thông thiên.*',

        body:
            'đã vượt qua tầng tầng đạo chướng, thần thức đại thành, một niệm đã có thể cảm ứng thiên địa!',

        ending:
            'Thần niệm vừa động, phong vân đã khởi — con đường cầu đạo từ đây càng gần với trời xanh.',

        image:
            LEVEL_IMAGES.early,
    },

    100: {
        realm:
            'Luyện Hư Kỳ',

        roleId:
            '1542236910028718160',

        heading:
            'PHÁ HƯ NHẬP ĐẠO',

        intro:
            '*Thần niệm nhập hư, đạo ý dung thiên.*',

        body:
            'đã phá vỡ gông xiềng Hóa Thần, chạm tới hư không, bước vào cảnh giới mà phàm nhân khó lòng vọng tới!',

        ending:
            'Hư thực chẳng còn ranh giới — một bước hôm nay, đã hơn trăm năm khổ tu.',

        image:
            LEVEL_IMAGES.level100,
    },

    200: {
        realm:
            'Hợp Thể Kỳ',

        roleId:
            '1546920260400324659',

        heading:
            'THÂN ĐẠO HỢP NHẤT',

        intro:
            '*Thần hồn quy nhất, thân dung đại đạo.*',

        body:
            'đã trải qua trăm tầng tôi luyện, dung hợp tinh — khí — thần, thân cùng đạo pháp hòa làm một thể!',

        ending:
            'Thân là đạo, ý là pháp — từ đây nhất niệm sinh, vạn pháp tùy hành.',

        image:
            LEVEL_IMAGES.level100,
    },

    300: {
        realm:
            'Đại Thừa Kỳ',

        roleId:
            '1546920850656198766',

        heading:
            'ĐẠI ĐẠO VIÊN MÃN',

        intro:
            '*Vạn pháp quy tâm, phàm đạo viên mãn.*',

        body:
            'đã vượt qua vô số bình cảnh, đạo tâm đại thành, tu vi tiến tới cực hạn của phàm cảnh!',

        ending:
            'Đại đạo đã thành, phàm lộ sắp tận — phía trên trời cao, kiếp vân đã bắt đầu hội tụ.',

        image:
            LEVEL_IMAGES.level100,
    },

    500: {
        realm:
            'Độ Kiếp Kỳ',

        roleId:
            '1546921205825536130',

        heading:
            'CỬU THIÊN GIÁNG KIẾP',

        intro:
            '*Kiếp vân vạn dặm, cửu thiên lôi động.*',

        body:
            'đã bước tới cực hạn phàm đạo, kinh động thiên uy — Thiên Kiếp từ cửu thiên chính thức giáng lâm!',

        ending:
            'Một bước sinh, một bước diệt — vượt qua thiên kiếp, tiên môn sẽ mở; thất bại, vạn năm tu hành hóa tro bụi.',

        image:
            LEVEL_IMAGES.level500,
    },

    999: {
        realm:
            'Phi Thăng · Chân Tiên',

        roleId:
            '1542215415109783642',

        heading:
            'VŨ HÓA ĐĂNG TIÊN',

        intro:
            '*Cửu cửu quy nhất, Thiên Môn khai mở.*',

        body:
            'đã vượt qua Cửu Thiên Đại Kiếp, phá bỏ phàm thai, bước qua Thiên Môn — từ đây thoát khỏi phàm trần, **vũ hóa thành tiên!**',

        ending:
            'Chín trăm chín mươi chín tầng vấn đạo, một bước vượt Thiên Môn — từ nay tiên danh lưu thế, trường sinh giữa thiên địa.',

        image:
            LEVEL_IMAGES.level999,
    },
};

/**
 * =========================================================
 * ALL LEVEL REWARD ROLE IDS
 * =========================================================
 */

export const LEVEL_REWARD_ROLE_IDS =
    Object.values(
        LEVEL_MILESTONES,
    )
        .map(
            milestone =>
                milestone.roleId,
        )
        .filter(
            Boolean,
        );

/**
 * =========================================================
 * EXACT MILESTONE
 * =========================================================
 */

export function getExactMilestone(
    level,
) {
    return (
        LEVEL_MILESTONES[
            Number(
                level,
            )
        ] ||
        null
    );
}

/**
 * =========================================================
 * HIGHEST MILESTONE
 * =========================================================
 */

export function getHighestMilestone(
    level,
) {
    const numericLevel =
        Number(
            level,
        ) || 0;

    const levels =
        Object.keys(
            LEVEL_MILESTONES,
        )
            .map(
                Number,
            )
            .filter(
                requiredLevel =>
                    requiredLevel <=
                    numericLevel,
            )
            .sort(
                (
                    a,
                    b,
                ) =>
                    b - a,
            );

    if (
        levels.length ===
        0
    ) {
        return null;
    }

    const milestoneLevel =
        levels[0];

    return {
        level:
            milestoneLevel,

        ...LEVEL_MILESTONES[
            milestoneLevel
        ],
    };
}
