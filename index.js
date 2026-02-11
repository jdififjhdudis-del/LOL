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

/**
 * دالة الانضمام – تدعم الرابط الجديد وتلقائي جلب الخوادم
 */
async function joinRobloxGame(cookie, placeId) {
    // 1. جلب رمز XSRF
    let xsrfToken = '';
    try {
        const xsrfRes = await fetch('https://www.roblox.com/home', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie};`, 'User-Agent': 'Mozilla/5.0' }
        });
        xsrfToken = xsrfRes.headers.get('x-csrf-token') || '';
    } catch (e) {}

    // الهيدرات الأساسية
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (xsrfToken) headers['X-CSRF-TOKEN'] = xsrfToken;

    // المحاولة الأولى – الرابط الجديد بدون .ashx
    let res = await fetch('https://www.roblox.com/game/join', {
        method: 'POST',
        headers: headers,
        body: new URLSearchParams({ placeId: placeId.toString() })
    });

    // معالجة XSRF إن لزم
    if (res.status === 403) {
        const newXsrf = res.headers.get('x-csrf-token');
        if (newXsrf) {
            headers['X-CSRF-TOKEN'] = newXsrf;
            res = await fetch('https://www.roblox.com/game/join', {
                method: 'POST',
                headers: headers,
                body: new URLSearchParams({ placeId: placeId.toString() })
            });
        }
    }

    // إذا نجحنا – رجعنا
    if (res.ok) {
        const text = await res.text();
        if (text.includes('OK')) return { success: true };
    }

    // إذا فشل (404 أو غيره) – نجرب جلب خادم ونستخدم jobId
    if (res.status === 404 || !res.ok) {
        // جلب خادم عام
        const serverRes = await fetch(
            `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=1`,
            { headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` } }
        );
        if (!serverRes.ok) throw new Error(`فشل جلب الخوادم (${serverRes.status})`);
        const serverData = await serverRes.json();
        if (!serverData.data || serverData.data.length === 0)
            throw new Error('لا توجد خوادم عامة متاحة حالياً.');

        const server = serverData.data[0];
        const jobId = server.jobId || server.id;

        // محاولة الانضمام مع jobId
        const joinWithJobRes = await fetch('https://www.roblox.com/game/join', {
            method: 'POST',
            headers: headers,
            body: new URLSearchParams({
                placeId: placeId.toString(),
                jobId: jobId
            })
        });

        if (!joinWithJobRes.ok) {
            const text = await joinWithJobRes.text();
            throw new Error(`فشل الانضمام مع jobId: ${joinWithJobRes.status} ${text.substring(0, 100)}`);
        }

        const text = await joinWithJobRes.text();
        if (text.includes('OK')) return { success: true, jobId: jobId };
        throw new Error('Roblox رفض الانضمام حتى مع jobId');
    }

    // كل شيء فشل
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 200)}`);
}

// ------------------- أوامر البوت -------------------
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🔐 *بوت Roblox – النسخة النهائية*\n\n` +
        `✅ *يدعم رابط Roblox الجديد (مارس 2026)*\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز حساب وهمي\n` +
        `/joingame [رقم] - دخول لعبة عامة\n` +
        `/status - حالة الحساب\n` +
        `/cleardata - حذف البيانات\n\n` +
        `🎮 *أرقام ألعاب عامة:*\n` +
        `• Jailbreak: \`4483381587\`\n` +
        `• Adopt Me!: \`60646162\`\n` +
        `• Brookhaven: \`4924922222\`\n` +
        `• Murder Mystery 2: \`142823291\`\n\n` +
        `⚠️ *للتعليم فقط – استخدم حساباً وهمياً.*`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ غير مصرح.');
    }

    bot.sendMessage(chatId,
        `📨 *أرسل الكوكيز كاملاً الآن*\n\n` +
        `يبدأ بـ: \`_|WARNING:-DO-NOT-SHARE-THIS\`\n` +
        `⏳ لديك 5 دقائق.`,
        { parse_mode: 'Markdown' }
    );

    const listener = async (cookieMsg) => {
        if (cookieMsg.chat.id !== chatId || cookieMsg.text?.startsWith('/')) return;

        const cookie = cookieMsg.text.trim();
        if (!cookie.includes('_|WARNING')) {
            return bot.sendMessage(chatId, '❌ هذا ليس كوكيز .ROBLOSECURITY');
        }

        bot.sendMessage(chatId, '🔄 جاري التحقق من الكوكيز...');

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
                            `✅ *تم الحفظ بنجاح!*\n\n` +
                            `👤 *المستخدم:* ${user.UserName}\n` +
                            `🆔 *الرقم:* ${user.UserID}\n` +
                            `📛 *الاسم:* ${user.DisplayName || 'غير متوفر'}\n\n` +
                            `🎮 جرب الآن:\n/joingame 4483381587`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                }
            );
        } catch (e) {
            bot.sendMessage(chatId, `❌ *الكوكيز غير صالح*\n\n${e.message}`);
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
        if (!row) {
            return bot.sendMessage(chatId, '❌ لا يوجد كوكيز مخزن. استخدم /setcookie أولاً.');
        }

        bot.sendMessage(chatId, `🔄 جاري محاولة الدخول إلى اللعبة ${placeId}...`);

        try {
            const cookie = decrypt(row.cookie_encrypted);
            await joinRobloxGame(cookie, placeId);

            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);

            bot.sendMessage(chatId,
                `✅ *تم إرسال طلب الدخول بنجاح!*\n\n` +
                `🎮 *اللعبة:* ${placeId}\n` +
                `👤 *الحساب:* ${row.username}\n\n` +
                `🔗 افتح Roblox وسيدخلك تلقائياً.`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            let errorMsg = `❌ *فشل الدخول*\n\n${e.message}`;

            if (e.message.includes('401') || e.message.includes('Cookie')) {
                errorMsg += '\n\n🔑 *الكوكيز منتهي*. استخدم /setcookie لتجديده.';
            } else if (e.message.includes('429')) {
                errorMsg += '\n\n⏳ *تم تجاوز الحد المسموح*. انتظر دقيقة ثم حاول مجدداً.';
            } else if (e.message.includes('403')) {
                errorMsg += '\n\n🛡️ *مشكلة XSRF تم حلها تلقائياً* – إذا استمرت، جرب تحديث الكوكيز.';
            } else if (e.message.includes('404')) {
                errorMsg += '\n\n🌐 *رابط الانضمام تغير – البوت يستخدم الرابط الجديد تلقائياً*. إذا استمرت، أبلغ المطور.';
            } else if (e.message.includes('لا توجد خوادم')) {
                errorMsg += '\n\n🎮 *اللعبة ليس لديها خوادم عامة الآن*. جرب لعبة أخرى.';
            }

            bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
        }
    });
});

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

// أمر سري للإدمن فقط
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

console.log('✅ البوت جاهز – مع دعم الرابط الجديد وجلب الخوادم');
