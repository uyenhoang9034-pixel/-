import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { WITCH_HUNTER_CONFIG } from '../../config/witchHunterConfig.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('diengiaicoche')
    .setDescription('Diễn giải toàn tập cơ chế giao tranh, khắc hệ, trụ tổng & sòng cược Witch Hunter'),

  category: 'Leveling',

  async execute(interaction) {
    try {
      const { emojis, colors } = WITCH_HUNTER_CONFIG;

      const embed1 = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} ─── ✦ ⟨ **ĐẠI BẢN DOANH: CỐT TRUYỆN & CƠ CHẾ GIAO TRANH** ⟩ ✦ ─── ${emojis.titleRight}`)
        .setDescription(
          `**Chào Lữ Khách! Dưới đây là toàn văn quy tắc chiến trường giữa Hiệp Hội Thợ Săn và Hội Phù Thủy:**\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig29:1546385117478527016> **I. BẢN CHẤT ĐỐI KHÁNG: CƠ KHÍ CỰC HẠN vs MA PHÁP CỔ ĐẠI**\n` +
          `• **Phe Phù Thủy (Bẻ cong quy luật tự nhiên):**\n` +
          `  - Thao túng vật chất, thời không, thiêu đốt, hóa đá, bào mòn tinh thần bằng nguyền rủa. Đòn đánh có tính hủy diệt diện rộng, thẩm thấu sâu vào sinh mệnh đối thủ.\n` +
          `  - *Điểm yếu:* Đòi hỏi thời gian tụ lực niệm chú điều hướng ma năng, để lộ sơ hở trước đòn tấn công tốc độ cao.\n` +
          `• **Phe Thợ Săn (Xuyên thấu, Ngắt chiêu & Cơ học tốc độ cao):**\n` +
          `  - Tối ưu hóa vũ khí hợp kim bạc, đạn dược triệt tiêu ma thuật và các bộ cấm khí cơ giới tùy biến cực hạn.\n` +
          `  - *Cơ chế Phá Vỡ Cấu Trúc Ma Năng:* Đạn bạc và lưỡi cắt cơ giới khi va chạm vào kết giới sẽ phát ra sóng xung kích làm phân rã dòng chảy mana, ngắt đứt chuỗi niệm chú và khóa hồi phục.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:bang2:1546891483250954290> **II. NGUYÊN TẮC PHÂN TẦNG: BẬC CAO LUÔN THẮNG (ΔRank)**\n` +
          `Trong truyện, chênh lệch cảnh giới là hố sâu ngăn cách về mật độ ma năng. Bậc cao luôn có ưu thế áp chế tuyệt đối khi đối đầu trực diện:\n` +
          `> \`ΔRank = Bậc Tấn Công - Bậc Phòng Thủ\` *(Bậc 1 = C, Bậc 2 = B, Bậc 3 = A, Bậc 4 = S, Bậc 5 = SS)*\n` +
          `• **Khi Bậc Cao đánh Bậc Thấp (ΔRank > 0):** Sát thương cơ bản tăng thêm **+30%** cho mỗi bậc chênh lệch. Hiệu ứng khống chế từ thần khí bậc cao xuyên thấu 100% kết giới bậc thấp.\n` +
          `• **Khi Bậc Thấp đánh Bậc Cao (ΔRank < 0):** Bị Kết Giới Tự Nhiên triệt tiêu: Giảm **-25%** sát thương mỗi bậc chênh lệch. Khống chế cứng tự động bị giải trừ một nửa.\n` +
          `• **Cơ Chế Cảm Tử Phá Trận:** Bậc thấp dù ngã xuống trước bậc cao vẫn kích nổ bào mòn thêm **-1% HP Trụ Tổng** đối phương trước khi tan biến!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig14:1546047912969113622> **III. CỘNG HƯỞNG ĐỒNG BỘ KHẾ ƯỚC (COMBO RESONANCE)**\n` +
          `• **Soul Link (Khế Ước Tương Hỗ):** Chủ nhân và Supporter liên kết sinh mệnh mật thiết.\n` +
          `• **Cộng Hưởng Đồng Bộ:** Khi người chơi mang đúng cặp **Supporter + Thần Binh Vũ Khí Liên Kết gốc** (Ví dụ: Fenris + Song Nanh Hàn Băng), đòn đánh lập tức kích hoạt **Bạo Kích Khế Ước x1.5 Sát Thương** và phát huy 100% thuộc tính trạng thái đặc thù!`
        );

      const embed2 = new EmbedBuilder()
        .setColor(colors.pastelPurple)
        .setTitle(`${emojis.titleLeft} ─── ✦ ⟨ **TAM GIÁC CHIẾN THUẬT, SÒNG CƯỢC & TRỤ TỔNG** ⟩ ✦ ─── ${emojis.titleRight}`)
        .setDescription(
          `<a:linhtocg:1563399670351536310> **IV. VÒNG TRÒN KHẮC HỆ 3 ĐẠI HỆ (ƯU THẾ TỐC ĐỘ)**\n` +
          `> <a:linhtocg:1563399670351536310> **Linh Tộc** ➔ khắc ➔ <a:nguyentheg:1563399515732443177> **Nguyền Thể** ➔ khắc ➔ <a:camkhig:1563399321125134346> **Cấm Khí** ➔ khắc ➔ <a:linhtocg:1563399670351536310> **Linh Tộc**\n` +
          `• Bên nào sở hữu Supporter mang hệ khắc chế đối phương sẽ giành quyền **Đánh Trước (Priority Strike)** trong hiệp đấu đó!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:trangtrig30:1546905942476464178> **V. TAM GIÁC QUYẾT ĐỊNH ẨN (MIND GAME TRONG HIỆP ĐẤU)**\n` +
          `Mỗi hiệp, hai đấu sĩ nhận tin nhắn bảng chọn ẩn gồm 3 thế võ đối kháng:\n` +
          `• <a:trangtrig29:1546385117478527016> **Tấn Công Trực Diện:** Đòn tốc độ cao phá giáp. Đè bẹp thế tụ lực niệm chú của **Giải Phóng Khế Ước**.\n` +
          `• <a:trangtrig46:1547240249761996812> **Phòng Thủ Phản Đòn:** Dựng khiên cơ giới/kết giới. Chặn đứng hoàn toàn **Tấn Công** và phản lại **50% sát thương** về kẻ tấn công.\n` +
          `• <a:linhtocg:1563399670351536310> **Giải Phóng Khế Ước:** Kích hoạt năng lực Thần Khí + Supporter. Xuyên thủng thế **Phòng Thủ** và gieo rắc hiệu ứng thuộc tính sâu.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:bingo:1563061901800243253> **VI. SÒNG CƯỢC HUYẾT THỆ (PARI-MUTUEL POOL)**\n` +
          `• Mở cược trong **45s - 90s** trước khi Hiệp 1 bắt đầu. Khóa hoàn toàn khi giao tranh.\n` +
          `• **Thuật toán trả thưởng:** Trích **5% thuế** sung quỹ máy chủ. 95% còn lại chia theo tỷ lệ đóng góp của người cược bên thắng:\n` +
          `  > \`Quỹ Trả Thưởng = Tổng Cược * 95%\`\n` +
          `  > \`Bí Ngô Nhận Về = (Bí Ngô Đã Cược / Tổng Cược Bên Thắng) * Quỹ Trả Thưởng\`\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<a:heartg3:1546047728314884226> **VII. CƠ CHẾ KHẤU TRỪ TRỤ TỔNG CHIẾN TUYẾN (<#1564210315812667412>)**\n` +
          `• **Né Chiến / Quá hạn:** Khiêu chiến sau 3 phút không có ai nhận hoặc bấm Từ Chối ➔ Trụ Tổng phe né bị phạt trừ **-5% HP**.\n` +
          `• **Thất Trận:** Đấu sĩ phe nào bị đánh bại ➔ Trụ Tổng phe đó bị trừ **-2% HP**.\n` +
          `• **Bậc Thấp Cảm Tử:** Nếu Bậc Thấp bại trận trước Bậc Cao ➔ Trụ phe thắng bị trừ thêm **-1% HP**.\n` +
          `• **Phong Ấn:** Khi Trụ của một phe rơi về **0%**, toàn bộ cư dân phe đó sẽ bị phong ấn ma lực cho đến khi reset đầu mùa!`
        )
        .setFooter({ text: 'Witch Hunter Game Mechanics • Tra cứu cơ chế chiến đấu' })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed1, embed2],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('❌ [DienGiaiCoChe] Lỗi lệnh diengiaicoche:', error);
      return interaction.reply({
        content: `Đã có lỗi xảy ra: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  },
};
