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
    return decrypted; // لا نضيف trim() هنا، نتركه كما هو
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🔐 *بوت Roblox*\n` +
        `/setcookie - إدخال الكوكيز\n` +
        `/joingame [رقم] - دخول لعبة\n` +
        `/status - حالة الحساب\n` +
        `/cleardata - حذف البيانات`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ غير مصرح.');
    }

    bot.sendMessage(chatId, '📩 أرسل الكوكيز كاملاً (يبدأ بـ _|WARNING...)');

    const listener = async (cookieMsg) => {
        if (cookieMsg.chat.id !== chatId || cookieMsg.text?.startsWith('/')) return;

        const cookie = cookieMsg.text.trim();
        if (!cookie.includes('_|WARNING:-DO-NOT-SHARE-THIS')) {
            return bot.sendMessage(chatId, '❌ هذا ليس كوكيز .ROBLOSECURITY');
        }

        bot.sendMessage(chatId, '🔄 جاري التحقق...');

        try {
            const noblox = require('noblox.js');
            const user = await noblox.setCookie(cookie);

            const encrypted = encrypt(cookie);
            db.run(
                `INSERT OR REPLACE INTO sessions (user_id, cookie_encrypted, username, roblox_id, last_used)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [userId, encrypted, user.UserName, user.UserID],
                (err) => {
                    if (err) bot.sendMessage(chatId, '❌ خطأ في الحفظ');
                    else bot.sendMessage(chatId, `✅ تم الحفظ! الحساب: ${user.UserName}`);
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
    const placeId = match[1];

    db.get(`SELECT cookie_encrypted, username FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (!row) return bot.sendMessage(chatId, '❌ لا يوجد كوكيز، استخدم /setcookie أولاً.');

        try {
            const noblox = require('noblox.js');
            const cookie = decrypt(row.cookie_encrypted);
            await noblox.setCookie(cookie);
            await noblox.joinGame(parseInt(placeId));
            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);
            bot.sendMessage(chatId, `✅ تم إرسال طلب دخول للعبة ${placeId}`);
        } catch (e) {
            let errorMsg = `❌ فشل: ${e.message}`;
            if (e.message.includes('Cookie')) errorMsg += '\n🔑 الكوكيز منتهي، استخدم /setcookie مجدداً.';
            if (e.message.includes('429')) errorMsg += '\n⏳ تم تجاوز الحد، انتظر.';
            bot.sendMessage(chatId, errorMsg);
        }
    });
});

bot.onText(/\/status/, (msg) => {
    const userId = msg.from.id;
    db.get(`SELECT username, roblox_id, created_at, last_used FROM sessions WHERE user_id = ?`, [userId], (err, row) => {
        if (!row) return bot.sendMessage(msg.chat.id, '📭 لا يوجد حساب.');
        bot.sendMessage(msg.chat.id,
            `📊 *الحالة*\n` +
            `المستخدم: ${row.username}\n` +
            `الرقم: ${row.roblox_id}\n` +
            `آخر استخدام: ${row.last_used || 'لم يُستخدم'}`,
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
console.log('✅ البوت شغال');
