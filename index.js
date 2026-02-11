const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// ------------------- إعداد Axios -------------------
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

db.run(`CREATE TABLE IF NOT EXISTS sessions (
    user_id INTEGER PRIMARY KEY,
    cookie_encrypted TEXT NOT NULL,
    username TEXT,
    roblox_id INTEGER,
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
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ================= التحقق من الكوكيز فقط =================
async function verifyCookie(cookie) {
    const res = await axiosInstance.get('https://users.roblox.com/v1/users/authenticated', {
        headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
    });
    return { name: res.data.name, id: res.data.id };
}

// ================= الدخول المباشر (الأقوى) =================
async function directJoin(cookie, placeId) {
    // 1. جلب XSRF token
    let xsrf = '';
    try {
        const home = await axiosInstance.get('https://www.roblox.com/home', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
        });
        xsrf = home.headers['x-csrf-token'] || '';
    } catch {}

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`
    };
    if (xsrf) headers['X-CSRF-TOKEN'] = xsrf;

    // المحاولة الأولى
    try {
        const res = await axiosInstance.post('https://www.roblox.com/game/join',
            new URLSearchParams({ placeId: placeId.toString() }).toString(),
            { headers }
        );
        if (res.data?.includes('OK')) return { success: true };
    } catch (err) {
        // إذا كان الخطأ 403، نجرب XSRF الجديد
        if (err.response?.status === 403) {
            const newXsrf = err.response.headers['x-csrf-token'];
            if (newXsrf) {
                headers['X-CSRF-TOKEN'] = newXsrf;
                try {
                    const retry = await axiosInstance.post('https://www.roblox.com/game/join',
                        new URLSearchParams({ placeId: placeId.toString() }).toString(),
                        { headers }
                    );
                    if (retry.data?.includes('OK')) return { success: true };
                } catch {}
            }
        }
    }
    throw new Error('فشل الدخول المباشر');
}

// ================= أوامر البوت =================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🔥 *بوت Roblox – الإصدار المبسّط* 🔥\n\n` +
        `✅ *دخول مباشر فقط* (لا يحتاج universeId)\n` +
        `✅ *يعمل مع الحسابات الجديدة بعد تفعيل البريد*\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز حساب وهمي\n` +
        `/joingame [رقم] - دخول لعبة عامة\n` +
        `/status - حالة الحساب\n` +
        `/cleardata - حذف بياناتك\n\n` +
        `🎮 *أرقام مضمونة:*\n` +
        `• Jailbreak: \`4483381587\`\n` +
        `• Adopt Me!: \`60646162\`\n` +
        `• Brookhaven: \`4924922222\`\n\n` +
        `⚠️ *شرط النجاح:* الحساب يجب أن يكون فعّل البريد الإلكتروني ولعب مرة واحدة يدوياً.`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (ADMIN_ID && userId.toString() !== ADMIN_ID)
        return bot.sendMessage(chatId, '❌ غير مصرح.');

    bot.sendMessage(chatId,
        `📨 *أرسل الكوكيز كاملاً الآن*\n` +
        `يبدأ بـ: \`_|WARNING:-DO-NOT-SHARE-THIS\`\n` +
        `⏳ لديك 5 دقائق.`,
        { parse_mode: 'Markdown' }
    );

    const listener = async (cookieMsg) => {
        if (cookieMsg.chat.id !== chatId || cookieMsg.text?.startsWith('/')) return;
        const cookie = cookieMsg.text.trim();
        if (!cookie.includes('_|WARNING'))
            return bot.sendMessage(chatId, '❌ هذا ليس كوكيز صالحاً');

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

bot.onText(/\/joingame (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = parseInt(match[1]);

    db.get(`SELECT cookie_encrypted, username FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (!row) return bot.sendMessage(chatId, '❌ لا يوجد كوكيز. استخدم /setcookie أولاً.');

        bot.sendMessage(chatId, `🔄 محاولة دخول ${placeId}...`);
        try {
            const cookie = decrypt(row.cookie_encrypted);
            await directJoin(cookie, placeId);
            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);
            bot.sendMessage(chatId,
                `✅ *تم إرسال طلب الدخول بنجاح!*\n` +
                `🎮 اللعبة: ${placeId}\n` +
                `👤 الحساب: ${row.username}`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            let errMsg = `❌ *فشل*\n${e.message}`;
            if (e.message.includes('403')) errMsg += '\n🛡️ الكوكيز منتهي أو الحساب غير مفعل.';
            if (e.message.includes('401')) errMsg += '\n🔑 الكوكيز منتهي.';
            bot.sendMessage(chatId, errMsg, { parse_mode: 'Markdown' });
        }
    });
});

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    db.get(`SELECT username, roblox_id, last_used FROM sessions WHERE user_id = ?`, [userId], (err, row) => {
        if (!row) return bot.sendMessage(chatId, '📭 لا يوجد حساب.');
        bot.sendMessage(chatId,
            `📊 *الحالة*\n👤 ${row.username} (${row.roblox_id})\n` +
            `⏰ آخر استخدام: ${row.last_used ? new Date(row.last_used).toLocaleString('ar-SA') : 'لم يستخدم'}`,
            { parse_mode: 'Markdown' }
        );
    });
});

bot.onText(/\/cleardata/, (msg) => {
    db.run(`DELETE FROM sessions WHERE user_id = ?`, [msg.from.id], function(err) {
        bot.sendMessage(msg.chat.id, this.changes > 0 ? '🗑️ تم حذف بياناتك.' : 'ℹ️ لا بيانات.');
    });
});

bot.onText(/\/admin_clear_all/, (msg) => {
    if (ADMIN_ID && msg.from.id.toString() === ADMIN_ID) {
        db.run(`DELETE FROM sessions`, () => bot.sendMessage(msg.chat.id, '✅ حذف الكل'));
    }
});

bot.on('polling_error', console.error);
console.log('✅ البوت المبسّط جاهز – دخول مباشر فقط');
