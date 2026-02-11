const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

if (!process.env.TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN غير موجود');
    process.exit(1);
}

const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_USER_ID || null;
const ENCRYPTION_KEY = crypto.createHash('sha256')
    .update(process.env.ENCRYPTION_KEY || 'change-this-key-now')
    .digest();
const ALGORITHM = 'aes-256-cbc';

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database(':memory:');

db.run(`CREATE TABLE sessions (
    user_id INTEGER PRIMARY KEY,
    cookie_encrypted TEXT NOT NULL,
    username TEXT,
    roblox_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
)`);

// ------------------- التشفير -------------------
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

// ------------------- Roblox API -------------------
async function verifyRobloxCookie(cookie) {
    const res = await fetch('https://users.roblox.com/v1/users/authenticated', {
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie};`,
            'User-Agent': 'Mozilla/5.0'
        }
    });
    if (!res.ok) throw new Error(`فشل التحقق (${res.status})`);
    const data = await res.json();
    return { UserName: data.name, UserID: data.id, DisplayName: data.displayName };
}

async function joinRobloxGame(cookie, placeId) {
    const res = await fetch('https://www.roblox.com/game/join.ashx', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': `.ROBLOSECURITY=${cookie};`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: new URLSearchParams({ placeId: placeId.toString() })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
    }

    const text = await res.text();
    if (text.includes('OK')) return { success: true };
    throw new Error('Roblox رفض الانضمام: ' + text.substring(0, 100));
}

// ------------------- أوامر البوت -------------------
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🔐 *بوت Roblox – الإصدار المباشر*\n\n` +
        `✅ يعمل بدون noblox.js وبدون جلب الخوادم.\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز حساب وهمي\n` +
        `/joingame [رقم] - دخول لعبة عامة\n` +
        `/status - حالة الحساب\n` +
        `/cleardata - حذف البيانات\n\n` +
        `🎮 *أرقام ألعاب عامة:*\n` +
        `Jailbreak: \`4483381587\`\n` +
        `Adopt Me!: \`60646162\`\n` +
        `Brookhaven: \`4924922222\``,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (ADMIN_ID && userId.toString() !== ADMIN_ID)
        return bot.sendMessage(chatId, '❌ غير مصرح.');

    bot.sendMessage(chatId, '📩 أرسل الكوكيز كاملاً (يبدأ بـ `_|WARNING...`)', { parse_mode: 'Markdown' });

    const listener = async (cookieMsg) => {
        if (cookieMsg.chat.id !== chatId || cookieMsg.text?.startsWith('/')) return;
        const cookie = cookieMsg.text.trim();
        if (!cookie.includes('_|WARNING')) 
            return bot.sendMessage(chatId, '❌ ليس كوكيز .ROBLOSECURITY');

        bot.sendMessage(chatId, '🔄 جاري التحقق...');
        try {
            const user = await verifyRobloxCookie(cookie);
            const encrypted = encrypt(cookie);
            db.run(
                `INSERT OR REPLACE INTO sessions (user_id, cookie_encrypted, username, roblox_id, last_used)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [userId, encrypted, user.UserName, user.UserID],
                (err) => {
                    if (err) bot.sendMessage(chatId, `❌ خطأ: ${err.message}`);
                    else bot.sendMessage(chatId, 
                        `✅ *تم الحفظ!*\n👤 ${user.UserName} (${user.UserID})\n🎮 جرب /joingame 4483381587`,
                        { parse_mode: 'Markdown' }
                    );
                }
            );
        } catch (e) {
            bot.sendMessage(chatId, `❌ الكوكيز غير صالح: ${e.message}`);
        }
        bot.removeListener('message', listener);
    };
    bot.on('message', listener);
    setTimeout(() => bot.removeListener('message', listener), 5 * 60 * 1000);
});

bot.onText(/\/joingame (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = parseInt(match[1]);

    db.get(`SELECT cookie_encrypted, username FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (!row) return bot.sendMessage(chatId, '❌ لا يوجد كوكيز. استخدم /setcookie أولاً.');

        bot.sendMessage(chatId, `🔄 جاري محاولة الدخول إلى اللعبة ${placeId}...`);
        try {
            const cookie = decrypt(row.cookie_encrypted);
            await joinRobloxGame(cookie, placeId);
            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);
            bot.sendMessage(chatId, `✅ *تم إرسال طلب الدخول!*\n🎮 اللعبة: ${placeId}\n👤 الحساب: ${row.username}`, { parse_mode: 'Markdown' });
        } catch (e) {
            let errorMsg = `❌ *فشل الدخول*\n\n${e.message}`;
            if (e.message.includes('401') || e.message.includes('Cookie')) 
                errorMsg += '\n🔑 *الكوكيز منتهي*. استخدم /setcookie مجدداً.';
            if (e.message.includes('429')) 
                errorMsg += '\n⏳ *تم تجاوز الحد*. انتظر دقيقة.';
            if (e.message.includes('403')) 
                errorMsg += '\n🚫 *الحساب محظور* من هذه اللعبة أو الكوكيز غير صالح.';
            bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
        }
    });
});

bot.onText(/\/status/, (msg) => {
    const userId = msg.from.id;
    db.get(`SELECT username, roblox_id, created_at, last_used FROM sessions WHERE user_id = ?`, [userId], (err, row) => {
        if (!row) return bot.sendMessage(msg.chat.id, '📭 لا يوجد حساب.');
        bot.sendMessage(msg.chat.id,
            `📊 *الحالة*\n👤 ${row.username} (${row.roblox_id})\n📅 ${new Date(row.created_at).toLocaleString('ar-SA')}\n⏰ آخر استخدام: ${row.last_used || 'لم يُستخدم'}`,
            { parse_mode: 'Markdown' }
        );
    });
});

bot.onText(/\/cleardata/, (msg) => {
    db.run(`DELETE FROM sessions WHERE user_id = ?`, [msg.from.id], function() {
        bot.sendMessage(msg.chat.id, this.changes > 0 ? '🗑️ تم الحذف.' : 'ℹ️ لا بيانات.');
    });
});

bot.on('polling_error', console.error);
console.log('✅ البوت يعمل بطريقة join.ashx المباشرة');
