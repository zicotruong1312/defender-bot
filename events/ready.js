module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        console.log(`[Khởi Động] Robot phòng thủ đã online dưới tên ${client.user.tag}!`);

        // Dọn dẹp RAM (Garbage Collection) định kỳ mỗi 60 giây để chống tràn Memory
        setInterval(() => {
            const now = Date.now();
            const config = client.config;

            // Dọn rác messageCache
            for (const [userId, userMessages] of client.messageCache.entries()) {
                const recentMessages = userMessages.filter(msg => now - msg.timestamp <= config.SPAM_TIMEFRAME);
                if (recentMessages.length === 0) {
                    client.messageCache.delete(userId);
                } else {
                    client.messageCache.set(userId, recentMessages);
                }
            }

            // Dọn rác suspiciousUsers (Hit and Run)
            for (const [userId, lastLinkTime] of client.suspiciousUsers.entries()) {
                if (now - lastLinkTime > config.LINK_TRACKING_TIME) { 
                    client.suspiciousUsers.delete(userId);
                }
            }

            // Dọn rác trình theo dõi Nuke
            for (const [userId, actions] of client.nukeTracker.entries()) {
                const recentActions = actions.filter(action => now - action.timestamp <= config.NUKE_TIMEFRAME);
                if (recentActions.length === 0) {
                    client.nukeTracker.delete(userId);
                } else {
                    client.nukeTracker.set(userId, recentActions);
                }
            }

            // Dọn rác trình theo dõi Raid Join
            for (const [guildId, joins] of client.joinTracker.entries()) {
                const recentJoins = joins.filter(j => now - j.timestamp <= config.MASS_JOIN_TIMEFRAME);
                if (recentJoins.length === 0) {
                    client.joinTracker.delete(guildId);
                } else {
                    client.joinTracker.set(guildId, recentJoins);
                }
            }
        }, 60000); // 60 giây dọn 1 lần
    },
};
