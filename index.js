// ====================================================
// بوت تليجرام آمن للدخول إلى ألعاب Roblox - تعليمي فقط
// يستخدم تشفير AES-256-CBC من Node.js الأصلي
// جميع الكوكيز في الذاكرة فقط، لا تُحفظ على القرص
// ====================================================

const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

// ---------- التحقق من المتغيرات الأساسية ----------
if (!process.env.TELEGRAM_TOKEN) {
    console.error('❌ خطأ: TELEGRAM_TOKEN غير موجود في Railway Variables');
    process.exit(1);
}

const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_USER_ID || null;
const ENCRYPTION_KEY = crypto.createHash('sha256')
    .update(process.env.ENCRYPTION_KEY || 'change-this-key-now-1234')
    .digest();

const ALGORITHM = 'aes-256-cbc';
const bot = new TelegramBot(TOKEN, { polling: true });
// استخدام قاعدة بيانات في الذاكرة فقط – تختفي مع إعادة التشغيل
const db = new sqlite3.Database(':memory:');

// ---------- إنشاء الجدول ----------
db.serialize(() => {
    db.run(`CREATE TABLE sessions (
        user_id INTEGER PRIMARY KEY,
        cookie_encrypted TEXT NOT NULL,
        username TEXT,
        roblox_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME
    )`);
});

// ---------- دوال التشفير ----------
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

// ---------- أمر /start ----------
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        `🔐 *بوت Roblox التعليمي*\n\n` +
        `⚠️ *للإثبات التقني فقط*\n` +
        `• استخدم حساباً وهمياً لا تملك فيه شيئاً.\n` +
        `• الكوكيز يُشفر ويُحفظ في الذاكرة المؤقتة.\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز Roblox\n` +
        `/joingame [رقم] - الدخول إلى لعبة\n` +
        `/status - حالة حسابك\n` +
        `/cleardata - حذف بياناتك\n\n` +
        `👤 *أرسل /setcookie للبدء*`,
        { parse_mode: 'Markdown' }
    );
});

// ---------- أمر /setcookie ----------
bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ هذا البوت مخصص للإدمن فقط.');
    }

    bot.sendMessage(chatId,
        `🔑 *إدخال كوكيز Roblox*\n\n` +
        `1. سجل الدخول إلى Roblox.com بحسابك الوهمي.\n` +
        `2. افتح أدوات المطور (F12) ← Application ← Cookies.\n` +
        `3. انسخ القيمة الكاملة لـ \`.ROBLOSECURITY\`.\n` +
        `4. أرسلها الآن في رسالة واحدة.\n\n` +
        `⏳ لديك 5 دقائق.`,
        { parse_mode: 'Markdown' }
    );

    // الاستماع للرسالة التالية فقط
    const listener = async (cookieMsg) => {
        if (cookieMsg.chat.id !== chatId || cookieMsg.text?.startsWith('/')) return;

        const cookie = cookieMsg.text.trim();
        if (!cookie.includes('_|WARNING:-DO-NOT-SHARE-THIS')) {
            bot.sendMessage(chatId, '❌ هذا ليس كوكيز .ROBLOSECURITY صالحاً.');
            return;
        }

        bot.sendMessage(chatId, '🔄 جاري التحقق من الكوكيز...');

        try {
            const noblox = require('noblox.js');
            const user = await noblox.setCookie(cookie);

            const encrypted = encrypt(cookie);
            db.run(
                `INSERT OR REPLACE INTO sessions (user_id, cookie_encrypted, username, roblox_id, last_used)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [userId, encrypted, user.UserName, user.UserID],
                function (err) {
                    if (err) {
                        bot.sendMessage(chatId, `❌ خطأ في الحفظ: ${err.message}`);
                    } else {
                        bot.sendMessage(chatId,
                            `✅ *تم حفظ الكوكيز بنجاح!*\n\n` +
                            `👤 *الحساب:* ${user.UserName} (${user.UserID})\n` +
                            `🔒 *التشفير:* AES-256-CBC\n` +
                            `💾 *التخزين:* الذاكرة فقط (يُحذف بإعادة التشغيل)\n\n` +
                            `🎮 للدخول إلى لعبة: /joingame [رقم]`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                }
            );
        } catch (e) {
            bot.sendMessage(chatId, `❌ *الكوكيز غير صالح*\n${e.message}`);
        }

        bot.removeListener('message', listener);
    };

    bot.on('message', listener);
    setTimeout(() => bot.removeListener('message', listener), 5 * 60 * 1000);
});

// ---------- أمر /joingame ----------
bot.onText(/\/joingame (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = match[1];

    db.get(`SELECT cookie_encrypted, username FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (err || !row) {
            return bot.sendMessage(chatId, '❌ لا يوجد كوكيز مخزن. استخدم /setcookie أولاً.');
        }

        bot.sendMessage(chatId, `🔄 محاولة الدخول إلى اللعبة ${placeId}...`);

        try {
            const noblox = require('noblox.js');
            const cookie = decrypt(row.cookie_encrypted);
            await noblox.setCookie(cookie);
            const joinData = await noblox.joinGame(parseInt(placeId));

            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);

            bot.sendMessage(chatId,
                `✅ *تم إرسال طلب الدخول*\n\n` +
                `🎮 *اللعبة:* ${placeId}\n` +
                `👤 *الحساب:* ${row.username}\n` +
                `🆔 *Job ID:* ${joinData.jobId || 'غير متوفر'}\n\n` +
                `⚠️ هذا يعمل فقط إذا كانت اللعبة عامة أو لديك صلاحية الدخول.`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            let errorMsg = `❌ فشل الدخول: ${e.message}`;
            if (e.message.includes('Cookie')) errorMsg += '\n\n🔑 الكوكيز منتهي – جدد عبر /setcookie';
            if (e.message.includes('429')) errorMsg += '\n\n⏳ تم تجاوز الحد المسموح، انتظر قليلاً.';
            bot.sendMessage(chatId, errorMsg);
        }
    });
});

// ---------- أمر /status ----------
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.get(`SELECT username, roblox_id, created_at, last_used FROM sessions WHERE user_id = ?`, [userId], (err, row) => {
        if (!row) {
            return bot.sendMessage(chatId, '📭 لا يوجد حساب مسجل.');
        }
        bot.sendMessage(chatId,
            `📊 *حالة حسابك*\n\n` +
            `👤 *المستخدم:* ${row.username}\n` +
            `🆔 *الرقم:* ${row.roblox_id}\n` +
            `📅 *تاريخ الإضافة:* ${new Date(row.created_at).toLocaleString('ar-SA')}\n` +
            `⏰ *آخر استخدام:* ${row.last_used ? new Date(row.last_used).toLocaleString('ar-SA') : 'لم يُستخدم'}\n\n` +
            `🔐 *التشفير:* AES-256-CBC نشط`,
            { parse_mode: 'Markdown' }
        );
    });
});

// ---------- أمر /cleardata ----------
bot.onText(/\/cleardata/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId], function (err) {
        if (this.changes > 0) {
            bot.sendMessage(chatId, '🗑️ تم حذف جميع بياناتك من الذاكرة.');
        } else {
            bot.sendMessage(chatId, 'ℹ️ لا توجد بيانات للحذف.');
        }
    });
});

// ---------- معالجة الأخطاء ----------
bot.on('polling_error', (err) => console.error('Polling error:', err.code));
process.on('SIGINT', () => { db.close(); process.exit(); });
process.on('SIGTERM', () => { db.close(); process.exit(); });

console.log('✅ البوت يعمل وباتصال آمن');
