module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const config = client.config;
        const guild = member.guild;
        const now = Date.now();

        // --- 1. CHỐNG TÀI KHOẢN CLONE (Alt Account / Botnet) ---
        // Tài khoản Discord mới tạo dưới ngưỡng MIN_ACCOUNT_AGE thì kick ngay để ngăn botnet
        const accountAge = now - member.user.createdTimestamp;
        if (accountAge < config.MIN_ACCOUNT_AGE) {
            try {
                // DM trước khi kick để thân thiện với người dùng thực sự mới
                await member.send(
                    `👋 Chào mừng đến **${guild.name}**!\n\n` +
                    `⚠️ Rất tiếc, hệ thống bảo mật của server yêu cầu tài khoản Discord của bạn phải **ít nhất 3 ngày tuổi** để tham gia.\n\n` +
                    `Tài khoản của bạn hiện tại còn quá mới (**${Math.floor(accountAge / (1000 * 60 * 60 * 24))} ngày tuổi**). Vui lòng quay lại sau!`
                ).catch(() => {}); // Nếu DM bị chặn thì bỏ qua
                await member.kick('[Auto-Kick] Tài khoản quá mới (< 3 ngày tuổi). Nghi ngờ Bot/Clone.');
                console.log(`[ANTI-RAID] Kicked acc clone: ${member.user.tag} (${member.user.id}) - Tuổi tài khoản: ${Math.floor(accountAge / 86400000)} ngày.`);
            } catch (error) {
                console.error(`[Lỗi Anti-Raid] Không thể kick tài khoản clone ${member.user.id}:`, error.message);
            }
            return; // Không cần xử lý tiếp
        }

        // --- 2. CHỐNG RAID (MASS JOIN - BOTNET TRÀN VÀO) ---
        const guildId = guild.id;

        if (!client.joinTracker.has(guildId)) {
            client.joinTracker.set(guildId, []);
        }

        const joinList = client.joinTracker.get(guildId);
        joinList.push({ userId: member.user.id, timestamp: now });

        // Giữ lại chỉ những join trong khoảng thời gian theo dõi
        const recentJoins = joinList.filter(j => now - j.timestamp <= config.MASS_JOIN_TIMEFRAME);
        client.joinTracker.set(guildId, recentJoins);

        if (recentJoins.length >= config.MASS_JOIN_THRESHOLD) {
            // Cảnh báo vào kênh Log (nếu có) hoặc gửi DM cho Server Owner
            console.warn(`[RAID ALERT] ⚠️ Server ${guild.name} có ${recentJoins.length} user join trong ${config.MASS_JOIN_TIMEFRAME/1000} giây! Khả năng đang bị Raid!`);

            try {
                const owner = await guild.fetchOwner();
                await owner.send(
                    `🚨 **CẢNH BÁO RAID** - Server **${guild.name}**\n\n` +
                    `Hệ thống phát hiện **${recentJoins.length} tài khoản** join server trong vòng **${config.MASS_JOIN_TIMEFRAME/1000} giây**.\n\n` +
                    `> **Khuyến nghị:** Tạm thời bật chế độ **Membership Screening** hoặc tăng mức xác minh của server lên cao nhất.\n\n` +
                    `⏰ Thời gian phát hiện: <t:${Math.floor(now / 1000)}:F>`
                ).catch(() => {});
            } catch {
                // Nếu không DM được Owner thì bỏ qua, log đã có ở console
            }
        }
    },
};
