// =====================================================
// بوت تليجرام – دخول Roblox
// الإصدار النهائي الخارق
// • 3 استراتيجيات انضمام
// • معالجة أخطاء احترافية
// • دعم كامل لتغييرات Roblox API
// • جلب الخوادم بذكاء مع إعادة المحاولة
// • تخزين مؤقت ومشفر للكوكيز
// =====================================================

const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

// ---------- التحقق من المتغيرات الأساسية ----------
if (!process.env.TELEGRAM_TOKEN) {
    console.error('❌ خطأ فادح: TELEGRAM_TOKEN غير موجود في متغيرات Railway');
    process.exit(1);
}

const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_USER_ID || null;
const ENCRYPTION_KEY = crypto.createHash('sha256')
    .update(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'))
    .digest();
const ALGORITHM = 'aes-256-cbc';

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new sqlite3.Database(':memory:'); // بيانات مؤقتة

// ---------- إنشاء جدول الجلسات ----------
db.run(`CREATE TABLE IF NOT EXISTS sessions (
    user_id INTEGER PRIMARY KEY,
    cookie_encrypted TEXT NOT NULL,
    username TEXT,
    roblox_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
)`);

// ---------- دوال التشفير المتطورة ----------
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
    } catch (e) {
        throw new Error('فشل فك التشفير – قد يكون المفتاح غير صحيح');
    }
}

// ---------- التحقق من صحة الكوكيز ----------
async function verifyRobloxCookie(cookie) {
    const res = await fetch('https://users.roblox.com/v1/users/authenticated', {
        headers: {
            'Cookie': `.ROBLOSECURITY=${cookie};`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    if (!res.ok) {
        if (res.status === 401) throw new Error('الكوكيز منتهي أو غير صالح');
        throw new Error(`فشل التحقق: HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
        UserName: data.name,
        UserID: data.id,
        DisplayName: data.displayName || data.name
    };
}

// ---------- التحقق من وجود اللعبة (placeId) ----------
async function validatePlaceId(placeId) {
    try {
        const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.data && data.data.length > 0;
    } catch {
        return false;
    }
}

// ---------- استراتيجية 1: الانضمام المباشر ----------
async function strategyDirectJoin(cookie, placeId, xsrfToken = '') {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (xsrfToken) headers['X-CSRF-TOKEN'] = xsrfToken;

    const res = await fetch('https://www.roblox.com/game/join', {
        method: 'POST',
        headers,
        body: new URLSearchParams({ placeId: placeId.toString() })
    });

    if (res.status === 403) {
        const newXsrf = res.headers.get('x-csrf-token');
        if (newXsrf) {
            headers['X-CSRF-TOKEN'] = newXsrf;
            const retryRes = await fetch('https://www.roblox.com/game/join', {
                method: 'POST',
                headers,
                body: new URLSearchParams({ placeId: placeId.toString() })
            });
            if (retryRes.ok) {
                const text = await retryRes.text();
                if (text.includes('OK')) return { success: true, method: 'direct' };
            }
        }
    }

    if (res.ok) {
        const text = await res.text();
        if (text.includes('OK')) return { success: true, method: 'direct' };
    }

    return { success: false };
}

// ---------- استراتيجية 2: جلب خادم عام والانضمام إليه ----------
async function strategyWithServer(cookie, placeId, xsrfToken = '') {
    // محاولة جلب خادم عام – تجربة خيارات مختلفة
    let servers = null;
    const serverAttempts = [
        `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=10&excludeFullGames=true&sortOrder=Asc`,
        `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=10&excludeFullGames=false`,
        `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=1`
    ];

    for (const url of serverAttempts) {
        try {
            const res = await fetch(url, {
                headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.data && data.data.length > 0) {
                    servers = data.data;
                    break;
                }
            }
        } catch {}
    }

    if (!servers || servers.length === 0) {
        throw new Error('لا توجد خوادم عامة متاحة حالياً لهذه اللعبة.');
    }

    // اختيار أفضل خادم (الأقل امتلاءً)
    const server = servers.sort((a, b) => (a.playing || 0) - (b.playing || 0))[0];
    const jobId = server.jobId || server.id;

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (xsrfToken) headers['X-CSRF-TOKEN'] = xsrfToken;

    const res = await fetch('https://www.roblox.com/game/join', {
        method: 'POST',
        headers,
        body: new URLSearchParams({
            placeId: placeId.toString(),
            jobId: jobId
        })
    });

    if (res.status === 403) {
        const newXsrf = res.headers.get('x-csrf-token');
        if (newXsrf) {
            headers['X-CSRF-TOKEN'] = newXsrf;
            const retryRes = await fetch('https://www.roblox.com/game/join', {
                method: 'POST',
                headers,
                body: new URLSearchParams({
                    placeId: placeId.toString(),
                    jobId: jobId
                })
            });
            if (retryRes.ok) {
                const text = await retryRes.text();
                if (text.includes('OK')) return { success: true, method: 'server', jobId };
            }
        }
    }

    if (res.ok) {
        const text = await res.text();
        if (text.includes('OK')) return { success: true, method: 'server', jobId };
    }

    return { success: false };
}

// ---------- استراتيجية 3: محاولة الرابط القديم (ashx) كاحتياطي ----------
async function strategyLegacyAshx(cookie, placeId, xsrfToken = '') {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (xsrfToken) headers['X-CSRF-TOKEN'] = xsrfToken;

    const res = await fetch('https://www.roblox.com/game/join.ashx', {
        method: 'POST',
        headers,
        body: new URLSearchParams({ placeId: placeId.toString() })
    });

    if (res.status === 403) {
        const newXsrf = res.headers.get('x-csrf-token');
        if (newXsrf) {
            headers['X-CSRF-TOKEN'] = newXsrf;
            const retryRes = await fetch('https://www.roblox.com/game/join.ashx', {
                method: 'POST',
                headers,
                body: new URLSearchParams({ placeId: placeId.toString() })
            });
            if (retryRes.ok) {
                const text = await retryRes.text();
                if (text.includes('OK')) return { success: true, method: 'legacy' };
            }
        }
    }

    if (res.ok) {
        const text = await res.text();
        if (text.includes('OK')) return { success: true, method: 'legacy' };
    }

    return { success: false };
}

// ---------- الدالة الرئيسية للانضمام – تجمع كل الاستراتيجيات ----------
async function joinRobloxGame(cookie, placeId) {
    // التحقق من أن placeId صالح
    const isValid = await validatePlaceId(placeId);
    if (!isValid) {
        throw new Error('رقم اللعبة غير صالح أو غير موجود.');
    }

    // جلب XSRF token
    let xsrfToken = '';
    try {
        const xsrfRes = await fetch('https://www.roblox.com/home', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
        });
        xsrfToken = xsrfRes.headers.get('x-csrf-token') || '';
    } catch {}

    // تنفيذ الاستراتيجيات بالترتيب
    const strategies = [
        { name: 'مباشر', fn: strategyDirectJoin },
        { name: 'مع خادم', fn: strategyWithServer },
        { name: 'قديم (ashx)', fn: strategyLegacyAshx }
    ];

    for (const strat of strategies) {
        try {
            const result = await strat.fn(cookie, placeId, xsrfToken);
            if (result.success) {
                return result;
            }
        } catch (e) {
            console.log(`استراتيجية ${strat.name} فشلت:`, e.message);
        }
    }

    throw new Error('جميع استراتيجيات الانضمام فشلت. قد تكون اللعبة خاصة أو الكوكيز منتهي.');
}

// ---------- أوامر البوت ----------
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `🔥 *بوت Roblox – الإصدار الخارق* 🔥\n\n` +
        `✅ *3 استراتيجيات انضمام متتالية*\n` +
        `✅ *معالجة أخطاء احترافية*\n` +
        `✅ *يدعم جميع ألعاب Roblox العامة*\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز حساب وهمي\n` +
        `/joingame [رقم] - دخول لعبة عامة\n` +
        `/status - حالة الحساب\n` +
        `/cleardata - حذف بياناتك\n\n` +
        `🎮 *أرقام ألعاب مجربة:*\n` +
        `• Jailbreak: \`4483381587\`\n` +
        `• Adopt Me!: \`60646162\`\n` +
        `• Brookhaven: \`4924922222\`\n` +
        `• Fisch: \`16732694052\`\n\n` +
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
                            `📛 *الاسم:* ${user.DisplayName}\n\n` +
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
            const result = await joinRobloxGame(cookie, placeId);

            db.run(`UPDATE sessions SET last_used = datetime('now') WHERE user_id = ?`, [userId]);

            let methodText = '';
            if (result.method === 'direct') methodText = 'انضمام مباشر';
            else if (result.method === 'server') methodText = 'عبر خادم عام';
            else if (result.method === 'legacy') methodText = 'رابط قديم';

            bot.sendMessage(chatId,
                `✅ *تم إرسال طلب الدخول بنجاح!*\n\n` +
                `🎮 *اللعبة:* ${placeId}\n` +
                `👤 *الحساب:* ${row.username}\n` +
                `⚙️ *الاستراتيجية:* ${methodText}\n` +
                `🆔 *Job ID:* ${result.jobId || 'غير متوفر'}\n\n` +
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
                errorMsg += '\n\n🛡️ *تمت محاولة حل XSRF تلقائياً*. إذا استمرت، جرب كوكيز جديد.';
            } else if (e.message.includes('404')) {
                errorMsg += '\n\n🌐 *رابط الانضمام غير موجود – البوت يستخدم بدائل*. قد يكون Roblox غير متاح حالياً.';
            } else if (e.message.includes('لا توجد خوادم')) {
                errorMsg += '\n\n🎮 *اللعبة ليس لديها خوادم عامة الآن*. جرب لعبة أخرى.';
            } else if (e.message.includes('غير صالح')) {
                errorMsg += '\n\n🔍 *تأكد من أن رقم اللعبة صحيح*.';
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

// أمر سري للإدمن – مسح الكل
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

console.log('🚀 البوت الخارق جاهز – 3 استراتيجيات انضمام');
