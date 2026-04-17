require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { checkLink } = require('./linkDetector');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel],
});

// Cache for tracking message spam across channels
// userId => [ { channelId, timestamp } ]
const messageCache = new Collection();
const SPAM_TIMEFRAME = 10000; // Cửa sổ theo dõi: 10 giây
const SPAM_CHANNELS_THRESHOLD = 3; // Ngưỡng ban: từ 3 kênh trở lên

// Cache for hit-and-run link detection
// userId => lastLinkTimestamp
const suspiciousUsers = new Collection();

client.once('ready', () => {
    console.log(`[AntiSpam Bot] Đã đăng nhập vào ${client.user.tag} thành công!`);
});

client.on('messageCreate', async (message) => {
    // Bỏ qua tin nhắn từ Bot khác và tin nhắn ngoài server
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const now = Date.now();
    const linkStatus = checkLink(message.content);

    // Bỏ qua nếu user có quyền Administrator (tránh ban nhầm Admin)
    if (message.member && message.member.permissions.has('Administrator')) return;

    // --- 0. BẢO VỆ TUYỆT ĐỐI (GẶP MÃ ĐỘC LÀ CHÉM) ---
    if (linkStatus.isMalicious) {
        try {
            await message.delete().catch(() => {}); // Cố gắng xoá tin nhắn đó ngay tức thì (nếu chưa bị clear)
            await message.guild.members.ban(userId, {
                deleteMessageSeconds: 604800, // Xoá sạch tin nhắn
                reason: `[Auto-Ban Security] Gửi link lừa đảo/mã độc giả mạo (${linkStatus.domain || 'N/A'})`
            });
            console.log(`[BANNED - SECURITY] Đã tiêu diệt ${message.author.tag} (${userId}) vì gửi link Phishing.`);
            messageCache.delete(userId);
            suspiciousUsers.delete(userId);
        } catch (error) {
            console.error(`[Lỗi] Không thể ban user rải mã độc ${userId}:`, error.message);
        }
        return; // Kết thúc hành động
    }

    // --- 1. THEO DÕI NÉM LINK HIT-AND-RUN ---
    if (linkStatus.hasLink) {
        suspiciousUsers.set(userId, now);
    }

    // --- 2. LOGIC SPAM NHIỀU CHANNEL TỐC ĐỘ CAO ---
    if (!messageCache.has(userId)) {
        messageCache.set(userId, []);
    }

    const userMessages = messageCache.get(userId);
    userMessages.push({
        channelId: message.channel.id,
        timestamp: now
    });

    // Xoá các tin nhắn lưu trữ ngoài 10 giây (SPAM_TIMEFRAME)
    // Giữ lại các tin nằm trong khoảng 10 giây trở lại
    const recentMessages = userMessages.filter(msg => now - msg.timestamp <= SPAM_TIMEFRAME);
    messageCache.set(userId, recentMessages);

    // Tính số lượng kênh duy nhất mà user này đã chat trong 10 giây qua
    const uniqueChannels = new Set(recentMessages.map(msg => msg.channelId)).size;

    // Kích hoạt Ban & Xoá tận gốc nếu số lượng kênh từ 3 trở lên
    if (uniqueChannels >= SPAM_CHANNELS_THRESHOLD) {
        try {
            await message.guild.members.ban(userId, {
                deleteMessageSeconds: 604800, // API của Discord: Xoá sạch toàn bộ tin nhắn trong 7 ngày gần đây (604800 giây)
                reason: `[Auto-Ban] Lỗi Spam: Gửi tin nhắn qua ${uniqueChannels} kênh khác nhau trong vòng 10 giây.`
            });
            console.log(`[BANNED] Đã ban và xoá sạch tin nhắn của ${message.author.tag} (${userId}) vì spam đa kênh.`);
            
            // Xoá dữ liệu từ bộ nhớ đệm
            messageCache.delete(userId);
            suspiciousUsers.delete(userId);
        } catch (error) {
            console.error(`[Lỗi] Không thể ban user ${userId} (có thể do Role của bot đang thấp hơn role user):`, error.message);
        }
    }
});

// Sự kiện chạy khi có người thoát (Rời Server)
client.on('guildMemberRemove', async (member) => {
    const userId = member.id;
    const now = Date.now();

    // Kiểm tra xem người dùng vừa thoát có lịch sử gửi link trong vòng 5 phút (300,000 ms) qua hay không
    if (suspiciousUsers.has(userId)) {
        const lastLinkTime = suspiciousUsers.get(userId);

        if (now - lastLinkTime <= 5 * 60 * 1000) {
            // Có gửi báo cáo (link) sau đó thoát ra -> Thuộc loại Hit-and-Run.
            // Tiến hành Ban ID (kể cả khi họ đã thoát) để bot có quyền xoá sạch tin nhắn họ vứt lại
            try {
                await member.guild.members.ban(userId, {
                    deleteMessageSeconds: 604800, // Xoá sạch tin nhắn của ID này trong 7 ngày
                    reason: '[Auto-Ban] Lỗi Hit-And-Run: Vào server ném link rồi thoát nhằm trốn xoá tin nhắn.'
                });
                console.log(`[HIT-AND-RUN] Đã tự động truy ban và vớt rác (xoá link) tài khoản ${member.user?.tag || userId}.`);
            } catch (error) {
                console.error(`[Lỗi] Không thể truy ban user ${userId}:`, error.message);
            }
        }
        
        // Xoá dữ liệu ID khỏi cache
        suspiciousUsers.delete(userId);
    }
});

// Dọn dẹp RAM (Garbage Collection) định kỳ mỗi 60 giây để chống tràn Memory
setInterval(() => {
    const now = Date.now();
    for (const [userId, userMessages] of messageCache.entries()) {
        const recentMessages = userMessages.filter(msg => now - msg.timestamp <= SPAM_TIMEFRAME);
        if (recentMessages.length === 0) {
            messageCache.delete(userId);
        } else {
            messageCache.set(userId, recentMessages);
        }
    }

    for (const [userId, lastLinkTime] of suspiciousUsers.entries()) {
        if (now - lastLinkTime > 15 * 60 * 1000) { // Xoá những ai vứt link cách đây quá 15 phút mà chưa out
            suspiciousUsers.delete(userId);
        }
    }
}, 60000);

if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === 'your_discord_bot_token_here') {
    console.error('[Lỗi Khởi Động] Vui lòng cập nhật DISCORD_TOKEN vào trong file .env !!');
    process.exit(1);
}

// Chạy bot
client.login(process.env.DISCORD_TOKEN);
