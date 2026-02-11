// ============================================
// بوت تليجرام – دخول Roblox عبر fetch المباشر
// لا يحتاج noblox.js – يعمل على أي Node.js 18+
// ============================================

const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

// ---------- متغيرات البيئة ----------
if (!process.env.TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN غير موجود في Railway Variables');
    process.exit(1);
}

const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_USER_ID || null;
const ENCRYPTION_KEY = crypto.createHash('sha256')
    .update(process.env.ENCRYPTION_KEY || 'change-this-key-now')
    .digest();
const ALGORITHM = 'aes-256-cbc';

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database(':memory:'); // قاعدة بيانات في الذاكرة فقط

// ---------- إنشاء جدول الجلسات ----------
db.run(`CREATE TABLE sessions (
    user_id INTEGER PRIMARY KEY,
    cookie_encrypted TEXT NOT NULL,
    username TEXT,
    roblox_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
)`);

// ============ دوال التشفير ============
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

// ============ دوال Roblox API ============

/**
 * التحقق من صحة الكوكيز وجلب معلومات الحساب
 * @param {string} cookie - .ROBLOSECURITY كامل
 * @returns {Promise<{UserName: string, UserID: number, DisplayName: string}>}
 */
async function verifyRobloxCookie(cookie) {
    const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie};`
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Roblox API: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
        UserName: data.name,
        UserID: data.id,
        DisplayName: data.displayName
    };
}

/**
 * إرسال طلب دخول إلى خريطة معينة
 * @param {string} cookie - .ROBLOSECURITY
 * @param {number} placeId - رقم المكان
 * @returns {Promise<object>}
 */
async function joinRobloxGame(cookie, placeId) {
    // أولاً: نحتاج معرف خادم عام (Server ID)
    // نطلب قائمة بالخوادم العامة لهذه اللعبة
    const serversResponse = await fetch(
        `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=1`,
        {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie};`
            }
        }
    );

    if (!serversResponse.ok) {
        throw new Error(`فشل جلب الخوادم: ${serversResponse.status}`);
    }

    const serversData = await serversResponse.json();
    if (!serversData.data || serversData.data.length === 0) {
        throw new Error('لا توجد خوادم عامة متاحة لهذه اللعبة حالياً.');
    }

    const server = serversData.data[0];
    const serverId = server.id;
    const jobId = server.jobId; // غالباً jobId هو معرف الجلسة

    // ثانياً: إرسال طلب الانضمام
    const joinResponse = await fetch('https://www.roblox.com/game/join.ashx', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': `.ROBLOSECURITY=${cookie};`
        },
        body: new URLSearchParams({
            placeId: placeId.toString(),
            serverId: serverId || '',
            jobId: jobId || ''
        })
    });

    if (!joinResponse.ok) {
        throw new Error(`فشل الانضمام: ${joinResponse.status}`);
    }

    // الـ response عبارة عن نص عادي، إذا كان "OK" فهذا معناه نجاح
    const result = await joinResponse.text();
    if (result.includes('OK')) {
        return { jobId: jobId || 'غير متوفر', success: true };
    } else {
        throw new Error('الاستجابة غير متوقعة من Roblox.');
    }
}

// ============ أوامر البوت ============

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `🔐 *بوت Roblox – الإصدار المستقر*\n\n` +
        `✅ يعمل بدون noblox.js، باستخدام fetch المباشر.\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز الحساب الوهمي\n` +
        `/joingame [رقم] - الدخول إلى لعبة عامة\n` +
        `/status - عرض حالة حسابك\n` +
        `/cleardata - حذف بياناتك\n\n` +
        `⚠️ *للتعليم فقط – استخدم حساباً وهمياً.*`,
        { parse_mode: 'Markdown' }
    );
});

// 🔑 إدخال الكوكيز
bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ هذا الأمر للإدمن فقط.');
    }

    bot.sendMessage(chatId,
        `📨 *أرسل الكوكيز كاملاً الآن.*\n\n` +
        `يبدأ بـ: \`_|WARNING:-DO-NOT-SHARE-THIS\`\n` +
        `⏳ لديك 5 دقائق.`,
        { parse_mode: 'Markdown' }
    );

    const listener = async (cookieMsg) => {
        if (cookieMsg.chat.id !== chatId || cookieMsg.text?.startsWith('/')) return;

        const cookie = cookieMsg.text.trim();
        if (!cookie.includes('_|WARNING:-DO-NOT-SHARE-THIS')) {
            return bot.sendMessage(chatId, '❌ هذا ليس كوكيز .ROBLOSECURITY صالحاً.');
        }

        bot.sendMessage(chatId, '🔄 جاري التحقق من الكوكيز عبر Roblox API...');

        try {
            const user = await verifyRobloxCookie(cookie);
            const encrypted = encrypt(cookie);

            db.run(
                `INSERT OR REPLACE INTO sessions (user_id, cookie_encrypted, username, roblox_id, last_used)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [userId, encrypted, user.UserName, user.UserID],
                (err) => {
                    if (err) {
                        bot.sendMessage(chatId, `❌ خطأ في قاعدة البيانات: ${err.message}`);
                    } else {
                        bot.sendMessage(chatId,
                            `✅ *تم التحقق وحفظ الكوكيز بنجاح!*\n\n` +
                            `👤 *المستخدم:* ${user.UserName}\n` +
                            `🆔 *الرقم:* ${user.UserID}\n` +
                            `📛 *الاسم المعروض:* ${user.DisplayName || 'غير متوفر'}\n\n` +
                            `🎮 الآن استخدم /joingame [رقم الخريطة]`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                }
            );
        } catch (e) {
            bot.sendMessage(chatId, `❌ *فشل التحقق من الكوكيز*\n\n${e.message}`);
        }

        bot.removeListener('message', listener);
    };

    bot.on('message', listener);
    setTimeout(() => bot.removeListener('message', listener), 5 * 60 * 1000);
});

// 🎮 الدخول إلى لعبة
bot.onText(/\/joingame (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = parseInt(match[1]);

    db.get(`SELECT cookie_encrypted, username FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (!row) {
            return bot.sendMessage(chatId, '❌ لا يوجد كوكيز مخزن. استخدم /setcookie أولاً.');
        }

        bot.sendMessage(chatId, `🔄 جاري محاولة الدخول إلى اللعبة ${placeId}...`);

        try {
            const cookie = decrypt(row.cookie_encrypted);
            const joinResult = await joinRobloxGame(cookie, placeId);

            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);

            bot.sendMessage(chatId,
                `✅ *تم إرسال طلب الدخول بنجاح*\n\n` +
                `🎮 *رقم اللعبة:* ${placeId}\n` +
                `👤 *الحساب:* ${row.username}\n` +
                `🆔 *معرف الخادم:* ${joinResult.jobId}\n\n` +
                `⚠️ إذا لم تدخل، فاللعبة قد تكون خاصة أو لا تقبل لاعبين جدد.`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            let errorMsg = `❌ *فشل الدخول*\n\n${e.message}`;
            if (e.message.includes('Cookie') || e.message.includes('401')) {
                errorMsg += '\n\n🔑 *الكوكيز منتهي أو غير صالح*. استخدم /setcookie لتجديده.';
            }
            if (e.message.includes('429')) {
                errorMsg += '\n\n⏳ *تم تجاوز الحد المسموح*. انتظر دقيقة ثم حاول مجدداً.';
            }
            if (e.message.includes('لا توجد خوادم')) {
                errorMsg += '\n\n🌐 *اللعبة ليس لديها خوادم عامة حالياً*. جرب لعبة أخرى.';
            }
            bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
        }
    });
});

// 📊 حالة الحساب
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.get(`SELECT username, roblox_id, created_at, last_used FROM sessions WHERE user_id = ?`, [userId], (err, row) => {
        if (!row) {
            return bot.sendMessage(chatId, '📭 *لا يوجد حساب مسجل.*\nاستخدم /setcookie أولاً.', { parse_mode: 'Markdown' });
        }

        bot.sendMessage(chatId,
            `📊 *حالة حسابك*\n\n` +
            `👤 *المستخدم:* ${row.username}\n` +
            `🆔 *الرقم:* ${row.roblox_id}\n` +
            `📅 *تاريخ الإضافة:* ${new Date(row.created_at).toLocaleString('ar-SA')}\n` +
            `⏰ *آخر استخدام:* ${row.last_used ? new Date(row.last_used).toLocaleString('ar-SA') : 'لم يُستخدم'}\n\n` +
            `🔒 *التشفير:* AES-256-CBC نشط`,
            { parse_mode: 'Markdown' }
        );
    });
});

// 🗑️ حذف البيانات
bot.onText(/\/cleardata/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId], function(err) {
        if (this.changes > 0) {
            bot.sendMessage(chatId, '🗑️ *تم حذف جميع بياناتك من الذاكرة.*', { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, 'ℹ️ لا توجد بيانات للحذف.');
        }
    });
});

// 🧹 أمر سري للإدمن لحذف كل شيء
bot.onText(/\/admin_clear_all/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (ADMIN_ID && userId.toString() === ADMIN_ID) {
        db.run(`DELETE FROM sessions`, () => {
            bot.sendMessage(chatId, '✅ تم حذف جميع الجلسات.');
        });
    }
});

// معالجة الأخطاء
bot.on('polling_error', (err) => {
    console.error('⚠️ خطأ في polling:', err.code);
});

process.on('SIGINT', () => {
    console.log('🛑 إيقاف البوت...');
    db.close();
    process.exit();
});

process.on('SIGTERM', () => {
    console.log('🛑 إيقاف البوت...');
    db.close();
    process.exit();
});

console.log('✅ البوت يعمل باستخدام fetch المباشر!');
