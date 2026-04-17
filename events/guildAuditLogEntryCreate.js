const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');

// Danh sách các loại phá hoại được theo dõi từ Audit Log
const TRACKED_ACTIONS = [
    AuditLogEvent.ChannelCreate,
    AuditLogEvent.ChannelDelete,
    AuditLogEvent.RoleCreate,
    AuditLogEvent.RoleDelete,
    AuditLogEvent.MemberBanAdd,
    AuditLogEvent.MemberKick,
    AuditLogEvent.WebhookCreate,
    AuditLogEvent.WebhookDelete,
    AuditLogEvent.GuildUpdate,
];

module.exports = {
    name: 'guildAuditLogEntryCreate',
    async execute(auditLog, guild, client) {
        const config = client.config;

        // Bỏ qua nếu không có thông tin người thực hiện
        if (!auditLog.executorId) return;

        const executorId = auditLog.executorId;
        const now = Date.now();

        // Bỏ qua hành động của bot chính nó (tránh vòng lặp vô tận)
        if (executorId === client.user.id) return;

        // ============================================================
        //  WHITELIST: Nếu người thực hiện có quyền Administrator thì bỏ qua
        // ============================================================
        try {
            const executor = await guild.members.fetch(executorId).catch(() => null);
            if (executor && executor.permissions.has(PermissionFlagsBits.Administrator)) {
                // Admin hợp lệ => Không phải kẻ tấn công, bỏ qua
                return;
            }
        } catch {
            // Không fetch được member (có thể đã thoát) => vẫn tiến hành kiểm tra
        }

        // Kiểm tra xem action này có nằm trong danh sách theo dõi phá hoại không
        if (!TRACKED_ACTIONS.includes(auditLog.action)) return;

        // ============================================================
        //  RATE-LIMITING: Đếm số hành động phá hoại trong cửa sổ thời gian
        // ============================================================
        if (!client.nukeTracker.has(executorId)) {
            client.nukeTracker.set(executorId, []);
        }

        const actions = client.nukeTracker.get(executorId);
        actions.push({ type: auditLog.action, timestamp: now });

        // Lọc bỏ các hành động ngoài cửa sổ theo dõi
        const recentActions = actions.filter(a => now - a.timestamp <= config.NUKE_TIMEFRAME);
        client.nukeTracker.set(executorId, recentActions);

        console.log(`[AUDIT] ${executorId} thực hiện action Type=${auditLog.action}. Tổng trong ${config.NUKE_TIMEFRAME/1000}s: ${recentActions.length}/${config.NUKE_ACTION_THRESHOLD}`);

        // Vẫn chưa chạm ngưỡng, không cần làm gì thêm
        if (recentActions.length < config.NUKE_ACTION_THRESHOLD) return;

        // ============================================================
        //  PHÁT HIỆN NUKE! => BAN NGAY LẬP TỨC
        // ============================================================
        console.error(`[NUKE DETECTED] ⚠️ ${executorId} đã thực hiện ${recentActions.length} hành động phá hoại trong ${config.NUKE_TIMEFRAME/1000}s. ĐANG TIẾN HÀNH BAN...`);

        // Xoá khỏi tracker ngay để bot không kích hoạt lặp lại
        client.nukeTracker.delete(executorId);

        try {
            // Thử fetch member để kiểm tra lần cuối (nếu họ vẫn còn trong server)
            const target = await guild.members.fetch(executorId).catch(() => null);

            if (target) {
                // Thực hiện BAN kèm xóa tin nhắn 7 ngày
                await guild.members.ban(executorId, {
                    deleteMessageSeconds: 604800,
                    reason: `[Anti-Nuke] Tự động BAN: Thực hiện ${recentActions.length} hành động phá hoại (loại: ${auditLog.actionType}) trong ${config.NUKE_TIMEFRAME/1000}s.`
                });
                console.log(`[NUKE] ✅ Đã ban thành công kẻ tấn công server: ${executorId}`);
            } else {
                // Đã thoát server nhưng vẫn ban để ngăn quay lại
                await guild.bans.create(executorId, {
                    deleteMessageSeconds: 604800,
                    reason: `[Anti-Nuke] Auto-Ban: Phá hoại server (${recentActions.length} actions) rồi thoát.`
                });
                console.log(`[NUKE] ✅ Đã truy ban kẻ tấn công server (đã thoát): ${executorId}`);
            }

            // Thông báo cảnh báo cho Server Owner
            try {
                const owner = await guild.fetchOwner();
                await owner.send(
                    `🚨 **BÁO ĐỘNG NUKE - Server ${guild.name}**\n\n` +
                    `Hệ thống phát hiện một tài khoản (<@${executorId}>) đã thực hiện **${recentActions.length} hành động phá hoại** trong vòng **${config.NUKE_TIMEFRAME/1000} giây**.\n\n` +
                    `**Hành động cuối cùng phát hiện:** \`${auditLog.actionType}\`\n\n` +
                    `✅ **Đã tự động BAN kẻ tấn công.** Kiểm tra lại server để đảm bảo mọi thứ ổn định!`
                ).catch(() => {});
            } catch {
                // Không DM được owner thì thôi, log console là đủ
            }

        } catch (error) {
            console.error(`[Lỗi Anti-Nuke] Không thể ban kẻ tấn công ${executorId}:`, error.message);
        }
    },
};
