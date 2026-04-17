// utils/linkDetector.js
// Thư viện phát hiện liên kết mã độc, nhạy cảm, lừa đảo (Phishing) và các liên kết thông thường.

// Danh sách lưu trữ tên miền mã độc được nạp tự động từ nguồn dữ liệu mở.
let scamDomainsCache = new Set();
let isFetching = false;

// 1. Phishing & Typosquatting Regex
// Mẫu bắt các trang cố tình viết sai chính tả, nhưng loại trừ CHÍNH XÁC các tên miền chính thức và subdomain của chúng
const MALICIOUS_REGEX = [
    // Bắt link giả Steam (stean, stearn, steam-fake) trừ steamcommunity.com
    /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?!steamcommunity\.com|steampowered\.com)([a-z0-9-]*st[ea]{1,3}[mn][a-z0-9-]*)(\.[a-z]{2,})+/i,
    // Bắt link giả Riot Games trừ riotgames.com và các subdomain (như support-valorant.riotgames.com)
    /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?!riotgames\.com)([a-z0-9-]*r[i1l]ot[a-z0-9-]*)(\.[a-z]{2,})+/i,
    // Bắt link giả Youtube trừ youtube.com, youtu.be
    /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?!youtube\.com|youtu\.be)([a-z0-9-]*yout[a-z0-9-]*)(\.[a-z]{2,})+/i,
    // Bắt link giả Facebook trừ facebook.com, fb.com
    /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?!facebook\.com|fb\.com|fb\.watch)([a-z0-9-]*faceb[a-z0-9-]*)(\.[a-z]{2,})+/i,
    // Bắt link giả Discord và quà Nitro (Ví dụ: discorcl, dlscord, discordnitrogift, v.v...)
    /https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?!discord\.com|discord\.gg)([a-z0-9-]*d[i1l]sc[a-z0-9-]*|[a-z0-9-]*n[i1l]tr[0o][a-z0-9-]*)(\.[a-z]{2,})+/i,
];

// Hàm lấy dữ liệu tên miền lừa đảo cập nhật mỗi 24 tiếng từ WalshyDev/Discord-Anti-Scam
async function updateScamDomains() {
    if (isFetching) return;
    isFetching = true;
    try {
        // Cộng đồng đóng góp kho dữ liệu này để chặn hàng loạt mã độc trên discord
        const response = await fetch('https://bad-domains.walshy.dev/bad-domains.json');
        if (!response.ok) throw new Error('Không thể fetch dữ liệu bad-domains');
        const data = await response.json();
        
        let newDomains = new Set();
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (typeof item === 'string') newDomains.add(item.toLowerCase());
                else if (item.badDomain) newDomains.add(item.badDomain.toLowerCase());
                else if (item.domain) newDomains.add(item.domain.toLowerCase());
            });
        }
        
        if (newDomains.size > 0) {
            scamDomainsCache = newDomains;
            console.log(`[AntiSpam] Đã nạp thành công ${newDomains.size} tên miền lừa đảo, mã độc (Phishing).`);
        }
    } catch (error) {
        console.error('[AntiSpam - Lỗi] Không thể tải danh sách tên miền lừa đảo:', error.message);
    } finally {
        isFetching = false;
    }
}

// Chạy luôn hàm update lúc nạp file và lặp lại cứ mỗi 24 giờ
updateScamDomains();
setInterval(updateScamDomains, 24 * 60 * 60 * 1000);

/**
 * Trích xuất tên miền chính xác ra khỏi chuỗi nội dung văn bản
 * @param {string} content 
 * @returns {string[]} Danh sách các miền
 */
function extractDomains(content) {
    const domains = [];
    // Biểu thức lấy tên miền
    const urlRegex = /https?:\/\/(?:www\.)?([-a-zA-Z0-9@:%._\+~#=]{1,256}\.([a-zA-Z0-9()]{2,10}))\b/ig;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
        if (match[1]) domains.push(match[1].toLowerCase());
    }
    return domains;
}

/**
 * Kiểm tra xem một đoạn tin nhắn chứa url rác nào hay không
 * @param {string} content Nội dung trò chuyện
 * @returns {object} { hasLink: boolean, isMalicious: boolean, domain: string }
 */
function checkLink(content) {
    if (typeof content !== 'string') {
        return { hasLink: false, isMalicious: false, domain: null };
    }

    const { hasLink, isMalicious, maliciousDomain } = checkDetailed(content);
    return { hasLink, isMalicious, domain: maliciousDomain };
}

function checkDetailed(content) {
    let result = { hasLink: false, isMalicious: false, maliciousDomain: null };
    
    // Kiểm tra xem tin nhắn có chứa http/https không
    const hasAnyLink = /https?:\/\//i.test(content) || /discord\.(gg|com\/invite)\/[a-zA-Z0-9]+/i.test(content);
    if (!hasAnyLink) {
        return result;
    }
    result.hasLink = true;

    // 1. Dò tìm qua RegExp cho các link cố tình giả mạo.
    for (const regex of MALICIOUS_REGEX) {
        if (regex.test(content)) {
            result.isMalicious = true;
            result.maliciousDomain = "Fake / Typosquatting Domain";
            return result;
        }
    }

    // 2. Dò tìm danh sách Bad Domain chính thức
    const domainsFound = extractDomains(content);
    for (const domain of domainsFound) {
        // So khớp trực tiếp hoặc cắt chuỗi con
        if (scamDomainsCache.has(domain)) {
            result.isMalicious = true;
            result.maliciousDomain = domain;
            return result;
        }
    }

    return result;
}

module.exports = {
    checkLink,
    updateScamDomains
};
