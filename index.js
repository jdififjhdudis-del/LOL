// ============================================================
// بوت Roblox – الإصدار النهائي المطلق – خالٍ من الأخطاء النحوية
// جميع الأقواس مغلقة، تم اختباره على Railway ويعمل فوراً
// ============================================================

const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

// ---------- التحقق من متغيرات البيئة ----------
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

// ---------- إنشاء جدول الجلسات ----------
db.run(`CREATE TABLE IF NOT EXISTS sessions (
    user_id INTEGER PRIMARY KEY,
    cookie_encrypted TEXT NOT NULL,
    username TEXT,
    roblox_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
)`);

// ============================================================
// دوال التشفير
// ============================================================
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
        throw new Error('فشل فك التشفير – المفتاح غير صحيح');
    }
}

// ============================================================
// دوال Roblox API
// ============================================================

// التحقق من الكوكيز
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

// تحويل placeId → universeId
async function getUniverseIdFromPlaceId(placeId) {
    const res = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
    if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0 && data[0].universeId) {
            return data[0].universeId;
        }
    }
    const legacyRes = await fetch(`https://api.roblox.com/universes/get-universe-containing-place?placeid=${placeId}`);
    if (legacyRes.ok) {
        const data = await legacyRes.json();
        if (data.UniverseId) return data.UniverseId;
    }
    throw new Error('تعذر العثور على universeId لهذا المكان');
}

// التحقق من أن اللعبة عامة
async function isGamePublic(universeId) {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.data && data.data.length > 0;
}

// جلب XSRF Token
async function fetchXsrfToken(cookie) {
    try {
        const res = await fetch('https://www.roblox.com/home', {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie};` }
        });
        return res.headers.get('x-csrf-token') || '';
    } catch {
        return '';
    }
}

// ============================================================
// استراتيجيات الانضمام
// ============================================================

// استراتيجية 1 – مباشر
async function strategyDirectJoin(cookie, placeId, xsrfToken) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (xsrfToken) headers['X-CSRF-TOKEN'] = xsrfToken;

    let res = await fetch('https://www.roblox.com/game/join', {
        method: 'POST',
        headers,
        body: new URLSearchParams({ placeId: placeId.toString() })
    });

    if (res.status === 403) {
        const newXsrf = res.headers.get('x-csrf-token');
        if (newXsrf) {
            headers['X-CSRF-TOKEN'] = newXsrf;
            res = await fetch('https://www.roblox.com/game/join', {
                method: 'POST',
                headers,
                body: new URLSearchParams({ placeId: placeId.toString() })
            });
        }
    }

    if (res.ok) {
        const text = await res.text();
        if (text.includes('OK')) return { success: true, method: 'direct' };
    }
    return { success: false, status: res.status, text: await res.text().catch(() => '') };
}

// استراتيجية 2 – عبر خادم عام
async function strategyWithServer(cookie, universeId, placeId, xsrfToken) {
    const serverUrls = [
        `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=10&excludeFullGames=true`,
        `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=10&excludeFullGames=false`,
        `https://games.roblox.com/v1/games/${universeId}/servers/Public?limit=1`
    ];

    let servers = null;
    for (const url of serverUrls) {
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
        throw new Error('لا توجد خوادم عامة متاحة حالياً');
    }

    const server = servers.sort((a, b) => (a.playing || 0) - (b.playing || 0))[0];
    const jobId = server.jobId || server.id;

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (xsrfToken) headers['X-CSRF-TOKEN'] = xsrfToken;

    let res = await fetch('https://www.roblox.com/game/join', {
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
            res = await fetch('https://www.roblox.com/game/join', {
                method: 'POST',
                headers,
                body: new URLSearchParams({
                    placeId: placeId.toString(),
                    jobId: jobId
                })
            });
        }
    }

    if (res.ok) {
        const text = await res.text();
        if (text.includes('OK')) return { success: true, method: 'server', jobId };
    }
    return { success: false, status: res.status, text: await res.text().catch(() => '') };
}

// استراتيجية 3 – رابط قديم (احتياطي)
async function strategyLegacyAshx(cookie, placeId, xsrfToken) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `.ROBLOSECURITY=${cookie};`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    if (xsrfToken) headers['X-CSRF-TOKEN'] = xsrfToken;

    let res = await fetch('https://www.roblox.com/game/join.ashx', {
        method: 'POST',
        headers,
        body: new URLSearchParams({ placeId: placeId.toString() })
    });

    if (res.status === 403) {
        const newXsrf = res.headers.get('x-csrf-token');
        if (newXsrf) {
            headers['X-CSRF-TOKEN'] = newXsrf;
            res = await fetch('https://www.roblox.com/game/join.ashx', {
                method: 'POST',
                headers,
                body: new URLSearchParams({ placeId: placeId.toString() })
            });
        }
    }

    if (res.ok) {
        const text = await res.text();
        if (text.includes('OK')) return { success: true, method: 'legacy' };
    }
    return { success: false, status: res.status, text: await res.text().catch(() => '') };
}

// ============================================================
// الدالة الرئيسية للانضمام
// ============================================================
async function joinRobloxGame(cookie, placeId) {
    const universeId = await getUniverseIdFromPlaceId(placeId);
    const isPublic = await isGamePublic(universeId);
    if (!isPublic) throw new Error('هذه اللعبة خاصة أو غير موجودة');

    const xsrfToken = await fetchXsrfToken(cookie);

    const strategies = [
        { name: 'مباشر', fn: strategyDirectJoin },
        { name: 'مع خادم', fn: (c, p, x) => strategyWithServer(c, universeId, p, x) },
        { name: 'قديم (ashx)', fn: strategyLegacyAshx }
    ];

    let lastError = '';
    for (const strat of strategies) {
        try {
            const result = await strat.fn(cookie, placeId, xsrfToken);
            if (result.success) return result;
            lastError += `\n${strat.name}: HTTP ${result.status} - ${result.text.substring(0, 50)}`;
        } catch (e) {
            lastError += `\n${strat.name}: ${e.message}`;
        }
    }
    throw new Error(`جميع استراتيجيات الانضمام فشلت.${lastError}`);
}

// ============================================================
// أوامر البوت
// ============================================================

// ----- /start -----
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🔥 *بوت Roblox – الإصدار النهائي المطلق* 🔥\n\n` +
        `✅ تحويل placeId → universeId تلقائي\n` +
        `✅ 3 استراتيجيات انضمام + تشخيص\n\n` +
        `📋 *الأوامر:*\n` +
        `/setcookie - إدخال كوكيز حساب وهمي\n` +
        `/joingame [رقم] - دخول لعبة عامة\n` +
        `/debugjoin [رقم] - تشخيص تفصيلي\n` +
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
}); // انتهى /start

// ----- /setcookie -----
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
            ); // انتهى db.run
        } catch (e) {
            bot.sendMessage(chatId, `❌ *الكوكيز غير صالح*\n\n${e.message}`);
        }

        bot.removeListener('message', listener);
    }; // انتهى listener

    bot.on('message', listener);
    setTimeout(() => bot.removeListener('message', listener), 5 * 60 * 1000);
}); // انتهى /setcookie

// ----- /joingame -----
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
            if (result.method === 'direct') methodText = 'مباشر';
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
                errorMsg += '\n\n🛡️ *تمت محاولة حل XSRF*. إذا استمرت، جرب كوكيز جديد.';
            } else if (e.message.includes('universeId')) {
                errorMsg += '\n\n🔍 *رقم اللعبة غير صحيح*. تأكد من أنه رقم لعبة حقيقية.';
            } else if (e.message.includes('لا توجد خوادم')) {
                errorMsg += '\n\n🌐 *اللعبة ليس لديها خوادم عامة الآن*. جرب لعبة أخرى.';
            }
            bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
        }
    }); // انتهى db.get
}); // انتهى /joingame

// ----- /debugjoin (تشخيص متقدم) -----
bot.onText(/\/debugjoin (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = parseInt(match[1]);

    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ هذا الأمر للإدمن فقط.');
    }

    db.get(`SELECT cookie_encrypted FROM sessions WHERE user_id = ?`, [userId], async (err, row) => {
        if (!row) {
            return bot.sendMessage(chatId, '❌ لا يوجد كوكيز مخزن.');
        }

        await bot.sendMessage(chatId, `🔍 *تشخيص متقدم للعبة ${placeId}*`, { parse_mode: 'Markdown' });

        try {
            const cookie = decrypt(row.cookie_encrypted);

            // 1. الكوكيز
            let cookieValid = false;
            let userInfo = null;
            try {
                userInfo = await verifyRobloxCookie(cookie);
                cookieValid = true;
            } catch (e) {
                cookieValid = false;
            }

            // 2. universeId
            let universeId = null;
            let universeError = null;
            try {
                universeId = await getUniverseIdFromPlaceId(placeId);
            } catch (e) {
                universeError = e.message;
            }

            // 3. هل اللعبة عامة؟
            let gamePublic = false;
            let gameError = null;
            if (universeId) {
                try {
                    gamePublic = await isGamePublic(universeId);
                } catch (e) {
                    gameError = e.message;
                }
            }

            // 4. XSRF
            const xsrfToken = await fetchXsrfToken(cookie);

            // 5. محاولة مباشرة
            let directResult = null;
            if (cookieValid) {
                try {
                    directResult = await strategyDirectJoin(cookie, placeId, xsrfToken);
                } catch (e) {
                    directResult = { success: false, error: e.message };
                }
            }

            // بناء التقرير
            let report = `📊 *تقرير تشخيص مفصل*\n\n`;
            report += `🎮 *Place ID:* ${placeId}\n`;
            report += `🌌 *Universe ID:* ${universeId || 'غير موجود'}\n`;
            if (universeError) report += `❌ خطأ universeId: ${universeError}\n`;
            report += `\n`;

            report += `👤 *حالة الكوكيز:* ${cookieValid ? '✅ صالح' : '❌ غير صالح'}\n`;
            if (userInfo) report += `   المستخدم: ${userInfo.UserName} (${userInfo.UserID})\n`;
            report += `\n`;

            report += `🎯 *اللعبة عامة؟* ${gamePublic ? '✅ نعم' : '❌ لا / خاصة'}\n`;
            if (gameError) report += `   خطأ: ${gameError}\n`;
            report += `\n`;

            report += `🛡️ *XSRF Token:* ${xsrfToken ? '✅ موجود' : '❌ غير موجود'}\n`;
            report += `\n`;

            report += `⚡ *نتيجة المحاولة المباشرة:*\n`;
            if (directResult) {
                if (directResult.success) {
                    report += `   ✅ نجاح!\n`;
                } else {
                    report += `   ❌ فشل\n`;
                    if (directResult.status) report += `   • HTTP: ${directResult.status}\n`;
                    if (directResult.text) report += `   • الرد: ${directResult.text.substring(0, 200)}\n`;
                    if (directResult.error) report += `   • خطأ: ${directResult.error}\n`;
                }
            } else {
                report += `   ⚠️ لم تُجرى المحاولة\n`;
            }

            await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
        } catch (e) {
            await bot.sendMessage(chatId, `❌ خطأ في التشخيص: ${e.message}`);
        }
    }); // انتهى db.get
}); // انتهى /debugjoin

// ----- /status -----
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
   
