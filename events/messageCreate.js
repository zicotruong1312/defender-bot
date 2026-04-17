const { checkLink } = require('../linkDetector');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Bỏ qua tin nhắn từ Bot khác và tin nhắn ngoài server (DMs)
        if (message.author.bot || !message.guild) return;

        // Bỏ qua kiểm tra nếu user có quyền Administrator (Whitelist theo lệnh của sếp)
        if (message.member && message.member.permissions.has('Administrator')) return;

        const userId = message.author.id;
        const now = Date.now();
        const config = client.config;

        const linkStatus = checkLink(message.content);

        // --- 1. KIỂM TRA MÃ ĐỘC, LINK PHISHING (GẶP LÀ CHÉM NGAY) ---
        if (linkStatus.isMalicious) {
            try {
                await message.delete().catch(() => {});
                await message.guild.members.ban(userId, {
                    deleteMessageSeconds: 604800, // API mới: xoá tin trong 7 ngày
                    reason: `[Auto-Ban Security] Gửi link lừa đảo/mã độc giả mạo (${linkStatus.domain || 'N/A'})`
                });
                console.log(`[BANNED - SECURITY] Đã tiêu diệt ${message.author.tag} (${userId}) vì gửi link Phishing.`);
                client.messageCache.delete(userId);
                client.suspiciousUsers.delete(userId);
            } catch (error) {
                console.error(`[Lỗi] Không thể ban user rải mã độc ${userId}:`, error.message);
            }
            return; 
        }

        // --- 2. THEO DÕI NÉM LINK HIT-AND-RUN ---
        if (linkStatus.hasLink) {
            client.suspiciousUsers.set(userId, now);
        }

        // --- 3. ANTI-SPAM ĐA KÊNH ---
        if (!client.messageCache.has(userId)) {
            client.messageCache.set(userId, []);
        }

        const userMessages = client.messageCache.get(userId);
        userMessages.push({
            channelId: message.channel.id,
            timestamp: now
        });

        // Xoá tin nhắn cũ ngoài cửa sổ 10 giây
        const recentMessages = userMessages.filter(msg => now - msg.timestamp <= config.SPAM_TIMEFRAME);
        client.messageCache.set(userId, recentMessages);

        // Tính số kênh duy nhất
        const uniqueChannels = new Set(recentMessages.map(msg => msg.channelId)).size;

        if (uniqueChannels >= config.SPAM_CHANNELS_THRESHOLD) {
            try {
                await message.guild.members.ban(userId, {
                    deleteMessageSeconds: 604800,
                    reason: `[Auto-Ban] Lỗi Spam: Gửi tin nhắn qua ${uniqueChannels} kênh khác nhau trong vòng ${config.SPAM_TIMEFRAME/1000}s.`
                });
                console.log(`[BANNED] Đã ban và xoá sạch tin nhắn của ${message.author.tag} (${userId}) vì spam đa kênh.`);
                client.messageCache.delete(userId);
                client.suspiciousUsers.delete(userId);
            } catch (error) {
                console.error(`[Lỗi Anti-Spam] Không thể ban user ${userId}:`, error.message);
            }
        }
    },
};
