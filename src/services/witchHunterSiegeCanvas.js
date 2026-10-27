import { AttachmentBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';

// Bảng màu chuẩn phong cách Gothic Tím Pastel & Witch Hunter
const COLORS = {
  bgMain: '#0B0914',
  cardBg: '#130F21',
  cardBorder: '#2B2042',
  cardBorderHighlight: '#D8B4F8',
  hunterNeon: '#60A5FA',
  hunterLight: '#93C5FD',
  witchNeon: '#C084FC',
  witchLight: '#E879F9',
  gold: '#FDE047',
  textLight: '#F5F3FF',
  textMuted: '#A78BFA',
  textDim: '#7C6F99',
  divider: '#231A36',
  barHunter: '#3B82F6',
  barWitch: '#A855F7',
};

/**
 * Tự động tạo ảnh Canvas Chiến Trường 3 Cổ Tháp Phong Ấn
 * @param {Object} state - Dữ liệu trạng thái chiến trường
 * @returns {Promise<AttachmentBuilder|null>}
 */
export async function generateTowerBattlefield(state) {
  try {
    let canvasLib;
    try {
      canvasLib = await import('@napi-rs/canvas');
    } catch {
      logger.warn('⚠️ [@napi-rs/canvas] Chưa được cài đặt. Bỏ qua render Canvas live.');
      return null;
    }

    const { createCanvas, loadImage } = canvasLib;
    const width = 1200;
    const height = 675;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. NỀN CHÍNH & GRADIENT GOTHIC TÍM HUYỀN BÍ
    ctx.fillStyle = COLORS.bgMain;
    ctx.fillRect(0, 0, width, height);

    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, 720);
    bgGrad.addColorStop(0, '#1E1535');
    bgGrad.addColorStop(0.6, '#110C1E');
    bgGrad.addColorStop(1, '#090710');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. HEADER: TIÊU ĐỀ & ĐỒNG HỒ ĐẾM NGƯỢC
    ctx.fillStyle = COLORS.textLight;
    ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚔️ CHIẾN TRƯỜNG PHE: CỔ THÁP PHONG ẤN', 40, 56);

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Hội Phù Thủy (Coven) vs Hiệp Hội Thợ Săn (W.H.A)', 40, 82);

    // Khung đếm ngược (Timer Badge)
    const timeStr = state.timeRemaining || '00:00';
    const timerText = `⏳ CÒN LẠI: ${timeStr}`;
    ctx.font = 'bold 15px "Consolas", monospace';
    const timerWidth = ctx.measureText(timerText).width + 36;

    ctx.fillStyle = '#181226';
    ctx.strokeStyle = COLORS.cardBorderHighlight;
    ctx.lineWidth = 1.5;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(width - timerWidth - 40, 36, timerWidth, 44, 8);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(width - timerWidth - 40, 36, timerWidth, 44);
      ctx.strokeRect(width - timerWidth - 40, 36, timerWidth, 44);
    }

    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = 'right';
    ctx.fillText(timerText, width - 58, 64);

    // Đường kẻ phân cách Header
    ctx.strokeStyle = COLORS.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 102);
    ctx.lineTo(width - 40, 102);
    ctx.stroke();

    // 3. RENDER 3 CỘT TRỤ THÁP
    const colW = 350;
    const gap = 35;
    const startX = 40;
    const cardY = 120;
    const cardH = 465;

    let hunterWins = 0;
    let witchWins = 0;
    let disputeCount = 0;

    for (let i = 0; i < 3; i++) {
      const t = state.towers[i] || {
        name: `THÁP ${i + 1}`,
        subtitle: 'Khu vực phong ấn trung lập',
        hunterPts: 0,
        witchPts: 0,
        hunterTroops: 0,
        witchTroops: 0,
        mvpName: 'Tranh Chấp',
        mvpTitle: 'Tranh Chấp',
        mvpStreak: 0,
      };

      const x = startX + i * (colW + gap);

      // Tính tỷ lệ điểm
      const totalPts = (Number(t.hunterPts) || 0) + (Number(t.witchPts) || 0);
      const hunterPct = totalPts === 0 ? 50 : Math.round((t.hunterPts / totalPts) * 100);
      const witchPct = 100 - hunterPct;

      if (hunterPct > 53) hunterWins++;
      else if (witchPct > 53) witchWins++;
      else disputeCount++;

      // Thẻ bao quanh tháp (Card Container)
      ctx.fillStyle = COLORS.cardBg;
      ctx.strokeStyle = (hunterPct >= 70 || witchPct >= 70) ? COLORS.cardBorderHighlight : COLORS.cardBorder;
      ctx.lineWidth = 1.5;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, cardY, colW, cardH, 16);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(x, cardY, colW, cardH);
        ctx.strokeRect(x, cardY, colW, cardH);
      }

      // Hào quang đỉnh tháp nếu có phe chiếm giữ >= 70%
      if (hunterPct >= 70 || witchPct >= 70) {
        const glowColor = hunterPct >= 70 ? 'rgba(96, 165, 250, 0.22)' : 'rgba(192, 132, 252, 0.25)';
        ctx.fillStyle = glowColor;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(x, cardY, colW, 80, [16, 16, 0, 0]);
          ctx.fill();
        } else {
          ctx.fillRect(x, cardY, colW, 80);
        }
      }

      // Tên Tháp & Phụ đề
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textLight;
      ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
      ctx.fillText(t.name, x + 20, cardY + 36);

      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '13px "Segoe UI", Arial, sans-serif';
      ctx.fillText(t.subtitle, x + 20, cardY + 60);

      // Huy hiệu trạng thái chiếm giữ (Badge)
      let badgeText = '⚖️ TRANH CHẤP';
      let badgeColor = COLORS.textMuted;
      if (hunterPct > 53) {
        badgeText = `🏹 THẦN KHÍ SĨ ÁP ĐẢO (${hunterPct}%)`;
        badgeColor = COLORS.hunterLight;
      } else if (witchPct > 53) {
        badgeText = `🔮 CỔ THUẬT SĨ ÁP ĐẢO (${witchPct}%)`;
        badgeColor = COLORS.witchLight;
      }

      ctx.fillStyle = '#0B0914';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x + 20, cardY + 76, colW - 40, 32, 6);
        ctx.fill();
      } else {
        ctx.fillRect(x + 20, cardY + 76, colW - 40, 32);
      }

      ctx.fillStyle = badgeColor;
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, x + colW / 2, cardY + 97);

      // SỐ LIỆU ĐIỂM SỐ
      ctx.textAlign = 'left';
      ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = COLORS.hunterLight;
      ctx.fillText(`${(t.hunterPts || 0).toLocaleString('vi-VN')} pts`, x + 20, cardY + 140);

      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.witchLight;
      ctx.fillText(`${(t.witchPts || 0).toLocaleString('vi-VN')} pts`, x + colW - 20, cardY + 140);

      // THANH GIẰNG CO (TUG-OF-WAR BAR)
      const barX = x + 20;
      const barY = cardY + 152;
      const barW = colW - 40;
      const barH = 20;
      const splitW = Math.max(8, Math.min(barW - 8, (barW * hunterPct) / 100));

      // Nửa Thợ Săn (Bên trái)
      ctx.fillStyle = COLORS.barHunter;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(barX, barY, splitW, barH, [6, 0, 0, 6]);
        ctx.fill();
      } else {
        ctx.fillRect(barX, barY, splitW, barH);
      }

      // Nửa Phù Thủy (Bên phải)
      ctx.fillStyle = COLORS.barWitch;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(barX + splitW, barY, barW - splitW, barH, [0, 6, 6, 0]);
        ctx.fill();
      } else {
        ctx.fillRect(barX + splitW, barY, barW - splitW, barH);
      }

      // Vạch trung tâm phân cách
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(barX + splitW - 2, barY - 2, 4, barH + 4);

      // Quân số đồn trú
      ctx.font = '13px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`Quân số: ${t.hunterTroops || 0} 🏹`, barX, barY + 40);

      ctx.textAlign = 'right';
      ctx.fillText(`${t.witchTroops || 0} 🔮 :Quân số`, barX + barW, barY + 40);

      // KHUNG MVP CHIẾN TRƯỜNG
      const mvpBoxY = cardY + 228;
      const mvpBoxH = 210;
      ctx.fillStyle = '#0B0914';
      ctx.strokeStyle = COLORS.cardBorder;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(barX, mvpBoxY, barW, mvpBoxH, 12);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(barX, mvpBoxY, barW, mvpBoxH);
        ctx.strokeRect(barX, mvpBoxY, barW, mvpBoxH);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillText('★ CHIẾN BINH TIÊN PHONG ★', x + colW / 2, mvpBoxY + 30);

      // Avatar MVP (Hình tròn)
      const avatarCenterX = x + colW / 2;
      const avatarCenterY = mvpBoxY + 86;
      const avatarRadius = 36;

      let avatarLoaded = false;
      if (t.mvpAvatarUrl) {
        try {
          const img = await loadImage(t.mvpAvatarUrl);
          ctx.save();
          ctx.beginPath();
          ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
          ctx.restore();
          avatarLoaded = true;
        } catch {
          avatarLoaded = false;
        }
      }

      if (!avatarLoaded) {
        ctx.fillStyle = '#1D172E';
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.textLight;
        ctx.font = 'bold 22px sans-serif';
        const icon = t.mvpTitle === 'Thần Khí Sĩ' ? '🏹' : t.mvpTitle === 'Cổ Thuật Sĩ' ? '🔮' : '⚔️';
        ctx.fillText(icon, avatarCenterX, avatarCenterY + 8);
      }

      // Viền avatar theo phe
      ctx.strokeStyle =
        t.mvpTitle === 'Thần Khí Sĩ'
          ? COLORS.hunterLight
          : t.mvpTitle === 'Cổ Thuật Sĩ'
          ? COLORS.witchLight
          : COLORS.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Tên MVP & Chuỗi Thắng
      ctx.fillStyle = COLORS.textLight;
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      const cleanMvpName = (t.mvpName || 'Tranh Chấp').slice(0, 18);
      ctx.fillText(`[${t.mvpTitle || 'Tranh Chấp'}] ${cleanMvpName}`, avatarCenterX, mvpBoxY + 156);

      ctx.fillStyle = COLORS.gold;
      ctx.font = '13px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`Chuỗi thắng: ${t.mvpStreak || 0} 🔥`, avatarCenterX, mvpBoxY + 182);
    }

    // 4. FOOTER: TỔNG KẾT TỶ SỐ
    ctx.strokeStyle = COLORS.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 605);
    ctx.lineTo(width - 40, 605);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = COLORS.textLight;

    const scoreText =
      `TỶ SỐ TOÀN CỤC: 🏹 THỢ SĂN ${hunterWins} - ${witchWins} PHÙ THỦY 🔮` +
      (disputeCount > 0 ? ` (${disputeCount} ĐANG TRANH CHẤP)` : '');
    ctx.fillText(scoreText, width / 2, 642);

    // 5. XUẤT BUFFER & ATTACHMENTBUILDER
    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'tower_battlefield_live.png' });
  } catch (error) {
    logger.error('❌ [WitchHunterSiegeCanvas] Lỗi khi tạo ảnh Canvas:', error);
    return null;
  }
}
