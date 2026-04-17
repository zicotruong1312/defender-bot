module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        const userId = member.id;
        const now = Date.now();
        const config = client.config;

        // Kiểm tra xem người vừa thoát server có đang bị theo dõi vì ném link không (Hit-and-Run)
        if (client.suspiciousUsers.has(userId)) {
            const lastLinkTime = client.suspiciousUsers.get(userId);

            if (now - lastLinkTime <= config.HIT_AND_RUN_WINDOW) {
                // Ném link & thoát trong cửa sổ ngắn => Hit-and-Run xác định
                try {
                    await member.guild.members.ban(userId, {
                        deleteMessageSeconds: 604800,
                        reason: '[Auto-Ban] Lỗi Hit-And-Run: Vào server ném link rồi thoát nhằm trốn xoá tin nhắn.'
                    });
                    console.log(`[HIT-AND-RUN] Đã truy ban thành công tài khoản ${member.user?.tag || userId}.`);
                } catch (error) {
                    console.error(`[Lỗi] Không thể truy ban user ${userId}:`, error.message);
                }
            }

            // Dọn Cache
            client.suspiciousUsers.delete(userId);
        }
    },
};
