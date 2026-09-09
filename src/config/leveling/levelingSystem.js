/**
 * =========================================================
 * USAGI LEVELING SYSTEM
 * =========================================================
 */

export const LEVELING_MAX_LEVEL =
    9999;

export const LEVEL_ANNOUNCEMENT_CHANNEL_ID =
    '1542209852569427999';

export const PRISON_ROLE_ID =
    '1541818610639446066';

/**
 * 30 phút Voice = +1 Level.
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

    immortalTitle:
        '<a:trangtrig32:1546906170994856026>',

    realm:
        '<a:trangtrig17:1546048098415939655>',

    ending:
        '<a:trangtrig16:1546048002693660722>',
};

/**
 * =========================================================
 * ASSET FILES
 * =========================================================
 *
 * Các file này nằm ở:
 *
 * assets/level/
 *
 * ĐÚNG extension trong repo:
 *
 * lv1-70.webp
 * lv100-300.webp
 * lv500.webp
 * lv999.webp
 *
 * lv1999.png
 * lv3999.png
 * lv6999.png
 * lv9999.gif
 *
 * KHÔNG đổi PNG thành WEBP.
 * KHÔNG đổi GIF Lv.9999 thành ảnh tĩnh.
 */

export const LEVEL_IMAGES = {
    early: {
        path:
            'assets/level/lv1-70.webp',

        name:
            'lv1-70.webp',
    },

    level100: {
        path:
            'assets/level/lv100-300.webp',

        name:
            'lv100-300.webp',
    },

    level500: {
        path:
            'assets/level/lv500.webp',

        name:
            'lv500.webp',
    },

    level999: {
        path:
            'assets/level/lv999.webp',

        name:
            'lv999.webp',
    },

    level1999: {
        path:
            'assets/level/lv1999.png',

        name:
            'lv1999.png',
    },

    level3999: {
        path:
            'assets/level/lv3999.png',

        name:
            'lv3999.png',
    },

    level6999: {
        path:
            'assets/level/lv6999.png',

        name:
            'lv6999.png',
    },

    level9999: {
        path:
            'assets/level/lv9999.gif',

        name:
            'lv9999.gif',
    },
};

/**
 * =========================================================
 * LEVEL DISPLAY
 * =========================================================
 *
 * 999  -> 999
 * 1999 -> 1.999
 * 3999 -> 3.999
 * 6999 -> 6.999
 * 9999 -> 9.999
 */

export function formatLevelNumber(
    level,
) {
    const numericLevel =
        Math.max(
            0,
            Math.floor(
                Number(
                    level,
                ) || 0,
            ),
        );

    return String(
        numericLevel,
    ).replace(
        /\B(?=(\d{3})+(?!\d))/g,
        '.',
    );
}

/**
 * =========================================================
 * REALM MILESTONES
 * =========================================================
 *
 * announcementType:
 *
 * phi_thang
 * -> Phá Cảnh · Phi Thăng
 *
 * tien_lo
 * -> Phá Cảnh · Tiên Lộ
 *
 * cuc_canh
 * -> Phá Cảnh · Cực Cảnh
 *
 * =========================================================
 *
 * ROLE SYSTEM:
 *
 * Chỉ giữ DUY NHẤT role cảnh giới
 * cao nhất phù hợp với level hiện tại.
 */

export const LEVEL_MILESTONES = {
    /**
     * =====================================================
     * Lv.1 · LUYỆN KHÍ
     * =====================================================
     */

    1: {
        level:
            1,

        realm:
            'Luyện Khí Kỳ',

        roleId:
            '1542093887726813234',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.10 · TRÚC CƠ
     * =====================================================
     */

    10: {
        level:
            10,

        realm:
            'Trúc Cơ Kỳ',

        roleId:
            '1542094012448645202',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.20 · KIM ĐAN
     * =====================================================
     */

    20: {
        level:
            20,

        realm:
            'Kim Đan Kỳ',

        roleId:
            '1542094188290510958',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.40 · NGUYÊN ANH
     * =====================================================
     */

    40: {
        level:
            40,

        realm:
            'Nguyên Anh Kỳ',

        roleId:
            '1542094413361184779',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.70 · HÓA THẦN
     * =====================================================
     */

    70: {
        level:
            70,

        realm:
            'Hóa Thần Kỳ',

        roleId:
            '1542094665484992522',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.100 · LUYỆN HƯ
     * =====================================================
     */

    100: {
        level:
            100,

        realm:
            'Luyện Hư Kỳ',

        roleId:
            '1542236910028718160',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.200 · HỢP THỂ
     * =====================================================
     */

    200: {
        level:
            200,

        realm:
            'Hợp Thể Kỳ',

        roleId:
            '1546920260400324659',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.300 · ĐẠI THỪA
     * =====================================================
     */

    300: {
        level:
            300,

        realm:
            'Đại Thừa Kỳ',

        roleId:
            '1546920850656198766',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.500 · ĐỘ KIẾP
     * =====================================================
     */

    500: {
        level:
            500,

        realm:
            'Độ Kiếp Kỳ',

        roleId:
            '1546921205825536130',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.999 · PHI THĂNG · CHÂN TIÊN
     * =====================================================
     */

    999: {
        level:
            999,

        realm:
            'Phi Thăng · Chân Tiên',

        roleId:
            '1542215415109783642',

        announcementType:
            'phi_thang',

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

    /**
     * =====================================================
     * Lv.1.999 · ĐẠI LA KIM TIÊN
     * =====================================================
     */

    1999: {
        level:
            1999,

        realm:
            'Đại La Kim Tiên',

        roleId:
            '1547187622672334918',

        announcementType:
            'tien_lo',

        heading:
            'ĐẠI LA CHỨNG ĐẠO',

        intro:
            '*Tiên nguyên viên mãn, vạn pháp quy tâm.*',

        body:
            'đã vượt khỏi gông xiềng Tiên Đạo, lĩnh ngộ thiên địa pháp tắc, chứng nhập Đại La!',

        ending:
            '*Trường sinh chẳng còn là đích đến — từ đây, kẻ tu hành bắt đầu truy cầu chính Đại Đạo.*',

        image:
            LEVEL_IMAGES.level1999,

        advancedStyle:
            true,
    },

    /**
     * =====================================================
     * Lv.3.999 · TIÊN VƯƠNG
     * =====================================================
     */

    3999: {
        level:
            3999,

        realm:
            'Tiên Vương',

        roleId:
            '1547187688866840636',

        announcementType:
            'tien_lo',

        heading:
            'TIÊN VƯƠNG LÂM THẾ',

        intro:
            '*Vạn pháp thần phục, tiên uy trấn thế.*',

        body:
            'đã vượt qua cực hạn Đại La, đạo quả viên mãn, một bước đăng lâm Vương Cảnh!',

        ending:
            '*Một phương xưng Vương, vạn tiên kính phục — từ đây tiên uy đủ sức chấn động chư thiên.*',

        image:
            LEVEL_IMAGES.level3999,

        advancedStyle:
            true,
    },

    /**
     * =====================================================
     * Lv.6.999 · TIÊN ĐẾ
     * =====================================================
     */

    6999: {
        level:
            6999,

        realm:
            'Tiên Đế',

        roleId:
            '1547187914729984052',

        announcementType:
            'tien_lo',

        heading:
            'ĐẾ CẢNH GIÁNG LÂM',

        intro:
            '*Chư thiên cộng minh, vạn đạo triều bái.*',

        body:
            'đã phá vỡ gông xiềng Vương Cảnh, lấy thân chứng pháp, bước lên Đế vị khiến thiên địa cộng tôn!',

        ending:
            '*Một niệm định càn khôn, một ý trấn vạn giới — Đế uy vừa hiện, chư thiên cúi đầu.*',

        image:
            LEVEL_IMAGES.level6999,

        advancedStyle:
            true,
    },

    /**
     * =====================================================
     * Lv.9.999 · ĐẠO TỔ
     * =====================================================
     */

    9999: {
        level:
            9999,

        realm:
            'Đạo Tổ',

        roleId:
            '1547187483416993792',

        announcementType:
            'cuc_canh',

        heading:
            'ĐẠI ĐẠO CHÍ TÔN',

        intro:
            '*Đạo sinh vạn pháp, vạn pháp quy nhất.*',

        body:
            'đã vượt khỏi cực hạn Đế Cảnh, lĩnh ngộ bản nguyên thiên địa, lấy thân hóa Đạo — chứng vị Đạo Tổ!',

        ending:
            '*Tiên lộ đến đây đã tận — trên vạn đạo không còn cảnh giới, trên chư thiên chỉ còn Đạo.*',

        image:
            LEVEL_IMAGES.level9999,

        advancedStyle:
            true,
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
    const numericLevel =
        Math.floor(
            Number(
                level,
            ) || 0,
        );

    return (
        LEVEL_MILESTONES[
            numericLevel
        ] ||
        null
    );
}

/**
 * =========================================================
 * HIGHEST MILESTONE
 * =========================================================
 *
 * Ví dụ:
 *
 * Lv.1500
 * -> Phi Thăng · Chân Tiên
 *
 * Lv.2500
 * -> Đại La Kim Tiên
 *
 * Lv.5000
 * -> Tiên Vương
 *
 * Lv.8000
 * -> Tiên Đế
 *
 * Lv.9999
 * -> Đạo Tổ
 */

export function getHighestMilestone(
    level,
) {
    const numericLevel =
        Math.max(
            0,
            Math.floor(
                Number(
                    level,
                ) || 0,
            ),
        );

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

/**
 * =========================================================
 * MILESTONE LEVEL LIST
 * =========================================================
 */

export const LEVEL_MILESTONE_LEVELS =
    Object.keys(
        LEVEL_MILESTONES,
    )
        .map(
            Number,
        )
        .sort(
            (
                a,
                b,
            ) =>
                a - b,
        );
