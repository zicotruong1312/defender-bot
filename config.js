/**
 * ==========================================================
 *        CẤU HÌNH BOT DEFEND - TẤT CẢ NGƯỠNG GIỚI HẠN
 * ==========================================================
 * Mọi thay đổi ngưỡng phòng thủ đều được chỉnh tại đây.
 * Không cần đụng vào code logic của các module events.
 */
module.exports = {

    // ==========================================================
    // MODULE 1: ANTI-SPAM TIN NHẮN (messageCreate.js)
    // ==========================================================

    /**
     * SPAM ĐA KÊNH - Ngăn kẻ tấn công spam cùng lúc nhiều kênh.
     * Logic: Nếu user gửi >= SPAM_CHANNELS_THRESHOLD kênh khác nhau
     *        trong SPAM_TIMEFRAME milliseconds => BAN.
     * 
     * Lưu ý cân bằng: User bình thường hiếm khi chat cùng lúc 3+ kênh
     * trong vòng 10 giây, nên ngưỡng này KHÔNG ảnh hưởng sinh hoạt thường.
     */
    SPAM_TIMEFRAME: 10 * 1000,           // Cửa sổ theo dõi: 10 giây
    SPAM_CHANNELS_THRESHOLD: 3,          // Ban nếu spam qua >= 3 kênh khác nhau trong 10s

    // ==========================================================
    // MODULE 2: HIT-AND-RUN DETECTION (guildMemberRemove.js)
    // ==========================================================

    /**
     * Kẻ tấn công ném link phishing vào server rồi nhanh chóng thoát
     * để tránh bị xoá tin nhắn. Bot sẽ tiến hành truy ban.
     */
    LINK_TRACKING_TIME: 15 * 60 * 1000,  // Giữ bộ nhớ theo dõi link trong 15 phút
    HIT_AND_RUN_WINDOW: 5 * 60 * 1000,   // Thoát trong 5 phút sau khi ném link => Truy ban

    // ==========================================================
    // MODULE 3: ANTI-RAID & BOTNET (guildMemberAdd.js)
    // ==========================================================

    /**
     * CHỐNG TÀI KHOẢN CLONE (Alt/Botnet) - Kick acc mới tạo.
     * Logic: Tài khoản Discord được tạo < MIN_ACCOUNT_AGE ms trước => Kick.
     * 
     * Lưu ý cân bằng: Đây là ngưỡng quan trọng nhất cần chú ý.
     * - 3 ngày (72h): Chặn gần như toàn bộ botnet nhưng có thể kick một số
     *   người dùng mới thực sự (hiếm, vì họ thường đăng ký vài ngày trước khi join server).
     * - Nếu server có tuyển mem từ quảng cáo nhiều => Hạ xuống 1 ngày (24h).
     */
    MIN_ACCOUNT_AGE: 3 * 24 * 60 * 60 * 1000, // Tuổi tài khoản tối thiểu: 3 ngày

    /**
     * MASS JOIN (RAID) - Phát hiện botnet tràn vào.
     * Logic: Nếu >= MASS_JOIN_THRESHOLD người join trong MASS_JOIN_TIMEFRAME => DM cảnh báo Owner.
     * 
     * Lưu ý: Bot chỉ gửi cảnh báo cho Owner chứ không tự Lockdown server
     * để tránh ảnh hưởng user bình thường trong các đợt server growth tự nhiên.
     */
    MASS_JOIN_TIMEFRAME: 10 * 1000,      // Cửa sổ theo dõi: 10 giây
    MASS_JOIN_THRESHOLD: 10,             // Cảnh báo nếu >= 10 người join trong 10s

    // ==========================================================
    // MODULE 4: ANTI-NUKE (guildAuditLogEntryCreate.js)
    // ==========================================================

    /**
     * CHỐNG PHÁ HOẠI SERVER (Nuke) - Bảo vệ khỏi kẻ tấn công phá kênh/role hàng loạt.
     * Logic: Nếu 1 người không có quyền Admin thực hiện >= NUKE_ACTION_THRESHOLD
     *        hành động phá hoại trong NUKE_TIMEFRAME ms => BAN ngay.
     * 
     * CÁC HÀNH ĐỘNG BỊ THEO DÕI:
     *   - Xoá kênh (ChannelDelete)
     *   - Xoá Role (RoleDelete)
     *   - Tạo kênh hàng loạt (ChannelCreate)
     *   - Tạo Role rác (RoleCreate)
     *   - Ban thành viên (MemberBanAdd)
     *   - Kick thành viên (MemberKick)
     *   - Webhook mới lạ (WebhookCreate/Delete)
     *   - Thay đổi cài đặt server (GuildUpdate)
     * 
     * Lưu ý cân bằng: Admin hợp lệ có quyền Administrator => HOÀN TOÀN MIỄN TRỪ.
     * Chỉ những ai KHÔNG có quyền này mới bị giám sát bởi bộ đếm này.
     * Ngưỡng 3 actions / 10s sẽ không bao giờ bị kích hoạt bởi hoạt động bình thường.
     */
    NUKE_TIMEFRAME: 10 * 1000,           // Cửa sổ theo dõi: 10 giây
    NUKE_ACTION_THRESHOLD: 3,            // Ban nếu thực hiện >= 3 hành động phá hoại liên tiếp
};
