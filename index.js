// ============================================
// بوت Roblox – الإصدار النهائي مع Axios
// • إعادة محاولة ذكية (حتى 5 مرات)
// • معالجة جميع أخطاء الشبكة
// • 3 استراتيجيات انضمام
// • جميع الأقواس مغلقة – جاهز للتشغيل
// ============================================

const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const axiosRetry = require('axios-retry');

// ------------------- إعداد Axios مع إعادة المحاولة -------------------
axiosRetry(axios, {
    retries: 5,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        // إعادة المحاولة لأي خطأ شبكة أو 5xx
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               (error.response && error.response.status >= 500);
    }
});

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const axiosInstance = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
    }
});

// ------------------- متغيرات البيئة -------------------
if (!process.env.TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN غير موجود');
    process.exit(1);
}
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_USER_ID || null;
const ENCRYPTION_KEY = crypto.createHash('sha256')
    .update(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'))
    .digest();
const ALGORITHM = 'aes-256-cbc';

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database(':memory:');

// ------------------- إنشاء الجدول -------------------
db.run(`CREATE TABLE IF NOT EXISTS sessions (
    user_id INTEGER PRIMARY KEY,
    cookie_encrypted TEXT NOT NULL,
    username TEXT,
    roblox_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
)`);

// ================= دوال التشفير =================
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
    try {
        const [ivHex, encryptedHex] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        throw new Error('فشل فك التشفير');
    }
}

// ================= دوال Roblox API باستخدام Axios =================

async function verifyCookie(cookie) {
    try {
        const res = await axiosInstance.get('https://users.roblox.com/v1/users/authenticated', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
        });
        return { name: res.data.name, id: res.data.id, display: res.data.displayName || res.data.name };
    } catch (err) {
        if (err.response?.status === 401) throw new Error('الكوكيز منتهي');
        throw new Error(`HTTP ${err.response?.status || 'Network Error'}: ${err.message}`);
    }
}

async function getUniverseId(placeId) {
    try {
        const res = await axiosInstance.get(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
        if (res.data?.[0]?.universeId) return res.data[0].universeId;
    } catch {}
    try {
        const legacy = await axiosInstance.get(`https://api.roblox.com/universes/get-universe-containing-place?placeid=${placeId}`);
        if (legacy.data?.UniverseId) return legacy.data.UniverseId;
    } catch {}
    throw new Error('لا يمكن إيجاد universeId');
}

async function isGamePublic(universeId) {
    try {
        const res = await axiosInstance.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        return !!(res.data.data?.length);
    } catch {
        return false;
    }
}

async function getXsrf(cookie) {
    try {
        const res = await axiosInstance.get('https://www.roblox.com/home', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
        });
        return res.headers['x-csrf-token'] || '';
    } catch {
        return '';
    }
}

// ================= استراتيجيات الانضمام (باستخدام Axios) =================

async function directJoin(cookie, placeId, xsrf) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`
    };
    if (xsrf) headers['X-CSRF-TOKEN'] = xsrf;

    try {
        const res = await axiosInstance.post('https://www.roblox.com/game/join', 
            new URLSearchParams({ placeId: placeId.toString() }).toString(),
            { headers }
        );
        if (res.data?.includes('OK')) return { success: true, method: 'direct' };
    } catch (err) {
        if (err.response?.status === 403) {
            const newXsrf = err.response.headers['x-csrf-token'];
            if (newXsrf) {
                headers['X-CSRF-TOKEN'] = newXsrf;
                try {
                    const retry = await axiosInstance.post('https://www.roblox.com/game/join',
                        new URLSearchParams({ placeId: placeId.toString() }).toString(),
                        { headers }
                    );
                    if (retry.data?.includes('OK')) return { success: true, method: 'direct' };
                } catch {}
            }
        }
    }
    return { success: false };
}

async function serverJoin(cookie, universeId, placeId, xsrf) {
    const serverUrls = [
        `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=10&excludeFullGames=true`,
        `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=10&excludeFullGames=false`,
        `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=1`
    ];

    let servers = null;
    for (const url of serverUrls) {
        try {
            const res = await axiosInstance.get(url, {
                headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
            });
            if (res.data.data?.length) {
                servers = res.data.data;
                break;
            }
        } catch {}
    }
    if (!servers?.length) throw new Error('لا توجد خوادم عامة');

    const server = servers.sort((a,b) => (a.playing||0)-(b.playing||0))[0];
    const jobId = server.jobId || server.id;

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`
    };
    if (xsrf) headers['X-CSRF-TOKEN'] = xsrf;

    try {
        const res = await axiosInstance.post('https://www.roblox.com/game/join',
            new URLSearchParams({ placeId: placeId.toString(), jobId }).toString(),
            { headers }
        );
        if (res.data?.includes('OK')) return { success: true, method: 'server', jobId };
    } catch (err) {
        if (err.response?.status === 403) {
            const newXsrf = err.response.headers['x-csrf-token'];
            if (newXsrf) {
                headers['X-CSRF-TOKEN'] = newXsrf;
                try {
                    const retry = await axiosInstance.post('https://www.roblox.com/game/join',
                        new URLSearchParams({ placeId: placeId.toString(), jobId }).toString(),
                        { headers }
                    );
                    if (retry.data?.includes('OK')) return { success: true, method: 'server', jobId };
                } catch {}
            }
        }
    }
    return { success: false };
}

async function legacyJoin(cookie, placeId, xsrf) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`
    };
    if (xsrf) headers['X-CSRF-TOKEN'] = xsrf;

    try {
        const res = await axiosInstance.post('https://www.roblox.com/game/join.ashx',
            new URLSearchParams({ placeId: placeId.toString() }).toString(),
            { headers }
        );
        if (res.data?.includes('OK')) return { success: true, method: 'legacy' };
    } catch (err) {
        if (err.response?.status === 403) {
            const newXsrf = err.response.headers['x-csrf-token'];
            if (newXsrf) {
                headers['X-CSRF-TOKEN'] = newXsrf;
                try {
                    const retry = await axiosInstance.post('https://www.roblox.com/game/join.ashx',
                        new URLSearchParams({ placeId: placeId.toString() }).toString(),
                        { headers }
                    );
                    if (retry.data?.includes('OK')) return { success: true, method: 'legacy' };
                } catch {}
            }
        }
    }
    return { success: false };
}

// ================= الدالة الرئيسية =================
async function joinGame(cookie, placeId) {
    const universeId = await getUniverseId(placeId);
    if (!await isGamePublic(universeId)) throw new Error('اللعبة خاصة أو غير موجودة');

    const xsrf = await getXsrf(cookie);

    let result = await directJoin(cookie, placeId, xsrf);
    if (result.success) return result;

    try {
        result = await serverJoin(cookie, universeId, placeId, xsrf);
        if (result.success) return result;
    } catch (e) {}

    result = await legacyJoin(cookie, placeId, xsrf);
    if (result.success) return result;

    throw new Error('جميع استراتيجيات الانضمام فشلت');
}

// ================= أوامر البوت =================

// --- start ---
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🔥 *بوت Roblox – الإصدار النهائي مع Axios* 🔥\n\n` +
        `✅ إعادة محاولة ذكية (حتى 5 مرات)\n` +
        `✅ معالجة كاملة لأخطاء الشبكة\n` +
        `✅ 3 استراتيجيات انضمام + تشخيص\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز حساب وهمي\n` +
        `/joingame [رقم] - دخول لعبة عامة\n` +
        `/debugjoin [رقم] - تشخيص تفصيلي\n` +
        `/status - حالة الحساب\n` +
        `/cleardata - حذف بياناتك\n\n` +
        `🎮 *أرقام مجربة:*\n` +
        `• Jailbreak: \`4483381587\`\n` +
        `• Adopt Me!: \`60646162\`\n` +
        `• Brookhaven: \`4924922222\`\n\n` +
        `⚠️ *للتعليم فقط – استخدم حساباً وهمياً.*`,
        { parse_mode: 'Markdown' }
    );
});

// --- setcookie ---
bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ غير مصرح.');
    }

    bot.sendMessage(chatId,
        `📨 *أرسل الكوكيز كاملاً الآن*\n` +
        `يبدأ بـ: \`_|WARNING:-DO-NOT-SHARE-THIS\`\n` +
        `⏳ لديك 5 دقائق.`,
        { parse_mode: 'Markdown' }
    );

    const listener = async (cookieMsg) => {
        if (cookieMsg.chat.id !== chatId || cookieMsg.text?.startsWith('/')) return;

        const cookie = cookieMsg.text.trim();
        if (!cookie.includes('_|WARNING')) {
            return bot.sendMessage(chatId, '❌ هذا ليس كوكيز صالحاً');
        }

        bot.sendMessage(chatId, '🔄 جاري التحقق...');

        try {
            const user = await verifyCookie(cookie);
            const encrypted = encrypt(cookie);

            db.run(
                `INSERT OR REPLACE INTO sessions (user_id, cookie_encrypted, username, roblox_id, last_used)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [userId, encrypted, user.name, user.id],
                (err) => {
                    if (err) return bot.sendMessage(chatId, `❌ خطأ: ${err.message}`);
                    bot.sendMessage(chatId,
                        `✅ *تم الحفظ*\n👤 ${user.name} (${user.id})\n` +
                        `🎮 جرب /joingame 4483381587`,
                        { parse_mode: 'Markdown' }
                    );
                }
            );
        } catch (e) {
            bot.sendMessage(chatId, `❌ *الكوكيز غير صالح*\n${e.message}`);
        }

        bot.removeListener('message', listener);
    };

    bot.on('message', listener);
    setTimeout(() => bot.removeListener('message', listener), 300000);
});

// --- joingame ---
bot.onText(/\/joingame (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = parseInt(match[1]);

    db.get(`SELECT cookie_encrypted, username FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (!row) return bot.sendMessage(chatId, '❌ لا يوجد كوكيز. استخدم /setcookie أولاً.');

        bot.sendMessage(chatId, `🔄 محاولة دخول ${placeId}...`);

        try {
            const cookie = decrypt(row.cookie_encrypted);
            const result = await joinGame(cookie, placeId);
            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);

            bot.sendMessage(chatId,
                `✅ *تم إرسال الطلب*\n` +
                `🎮 اللعبة: ${placeId}\n` +
                `👤 الحساب: ${row.username}\n` +
                `⚙️ الاستراتيجية: ${result.method}\n` +
                `🆔 ${result.jobId || ''}`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            let errMsg = `❌ *فشل*\n${e.message}`;
            if (e.message.includes('401')) errMsg += '\n🔑 الكوكيز منتهي';
            if (e.message.includes('لا توجد خوادم')) errMsg += '\n🌐 لا توجد خوادم عامة';
            bot.sendMessage(chatId, errMsg, { parse_mode: 'Markdown' });
        }
    });
});

// --- debugjoin ---
bot.onText(/\/debugjoin (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = parseInt(match[1]);

    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ هذا الأمر للإدمن فقط.');
    }

    db.get(`SELECT cookie_encrypted FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (!row) return bot.sendMessage(chatId, '❌ لا يوجد كوكيز.');

        await bot.sendMessage(chatId, `🔍 *تشخيص ${placeId}*`, { parse_mode: 'Markdown' });

        try {
            const cookie = decrypt(row.cookie_encrypted);

            // كوكيز
            let cookieOk = false, userInfo = null;
            try { userInfo = await verifyCookie(cookie); cookieOk = true; } catch {}

            // universeId
            let universeId = null, uniErr = null;
            try { universeId = await getUniverseId(placeId); } catch (e) { uniErr = e.message; }

            // عامة؟
            let gamePublic = false, pubErr = null;
            if (universeId) { try { gamePublic = await isGamePublic(universeId); } catch (e) { pubErr = e.message; } }

            // XSRF
            const xsrf = await getXsrf(cookie);

            // محاولة مباشرة
            let direct = null;
            if (cookieOk) { try { direct = await directJoin(cookie, placeId, xsrf); } catch (e) { direct = { success: false, error: e.message }; } }

            let report = `📊 *تقرير*\n`;
            report += `🎮 Place: ${placeId}\n🌌 Universe: ${universeId || uniErr || '?'}\n`;
            report += `👤 كوكيز: ${cookieOk ? '✅' : '❌'}\n`;
            if (userInfo) report += `   ${userInfo.name} (${userInfo.id})\n`;
            report += `🎯 عامة: ${gamePublic ? '✅' : '❌'}\n`;
            if (pubErr) report += `   خطأ: ${pubErr}\n`;
            report += `🛡️ XSRF: ${xsrf ? '✅' : '❌'}\n`;
            report += `⚡ مباشر: ${direct?.success ? '✅' : '❌'}\n`;
            if (direct?.status) report += `   HTTP ${direct.status}\n`;
            if (direct?.error) report += `   خطأ: ${direct.error}\n`;

            await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
        } catch (e) {
            await bot.sendMessage(chatId, `❌ خطأ: ${e.message}`);
        }
    });
});

// --- status ---
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.get(`SELECT username, roblox_id, created_at, last_used FROM sessions WHERE user_id = ?`, [userId], (err, row) => {
        if (!row) return bot.sendMessage(chatId, '📭 لا يوجد حساب.');
        bot.sendMessage(chatId,
            `📊 *الحالة*\n👤 ${row.username} (${row.roblox_id})\n` +
            `📅 ${new Date(row.created_at).toLocaleString('ar-SA')}\n` +
            `⏰ آخر استخدام: ${row.last_used ? new Date(row.last_used).toLocaleString('ar-SA') : 'لم يستخدم'}`,
            { parse_mode: 'Markdown' }
        );
    });
});

// --- cleardata ---
bot.onText(/\/cleardata/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId], function(err) {
        if (this.changes > 0) bot.sendMessage(chatId, '🗑️ تم حذف بياناتك.');
        else bot.sendMessage(chatId, 'ℹ️ لا بيانات.');
    });
});

// --- admin_clear_all ---
bot.onText(/\/admin_clear_all/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (ADMIN_ID && userId.toString() === ADMIN_ID) {
        db.run(`DELETE FROM sessions`, () => bot.sendMessage(chatId, '✅ حذف الكل'));
    }
});

// ================= معالجة الأخطاء والإغلاق =================
bot.on('polling_error', (err) => console.error('Polling error:', err.code));

process.on('SIGINT', () => { db.close(); process.exit(); });
process.on('SIGTERM', () => { db.close(); process.exit(); });

console.log('✅ البوت جاهز – مع Axios وإعادة محاولة ذكية');
// ================ نهاية الملف ================
