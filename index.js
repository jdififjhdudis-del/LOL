// ============================================
// ⚠️ تحذير: هذا الكود للإثبات التقني والتعليم فقط
// استخدامه قد يؤدي إلى حظر حسابك في Roblox
// ============================================

console.log('🔧 بدء تشغيل بوت التعليم التقني...');

const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

// ============ التحقق من المتغيرات ============
const requiredEnvVars = ['TELEGRAM_TOKEN', 'ADMIN_USER_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ خطأ: المتغيرات المطلوبة غير موجودة:', missingVars);
    console.error('⚙️ يرجى إضافتها في Railway → Variables');
    process.exit(1);
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE || '';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const db = new sqlite3.Database('database.db');

// ============ إعداد قاعدة البيانات ============
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT UNIQUE,
        cookie TEXT,
        username TEXT,
        user_id INTEGER,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS join_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        place_id INTEGER,
        success BOOLEAN,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
    )`);
});

console.log('✅ قاعدة البيانات جاهزة');

// ============ أوامر البوت ============

// أمر /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const warningMessage = `
⚠️ *بوت تجريبي - للإثبات التقني فقط*

🔒 *تحذيرات أمنية:*
• هذا المشروع يتعارض مع شروط خدمة Roblox
• قد يؤدي إلى حظر الحساب المستخدم
• للتعليم التقني فقط

📋 *الأوامر المتاحة:*
/setup - إعداد الحساب من متغيرات Railway
/join [رقم_الخريطة] - الدخول إلى خريطة
/status - حالة الحساب
/gameinfo [رقم] - معلومات عن لعبة (API عام)
/cleanup - حذف جميع البيانات

🎯 *مثال:* \`/join 123456789\`
    `;
    
    bot.sendMessage(chatId, warningMessage, { parse_mode: 'Markdown' });
});

// أمر /setup
bot.onText(/\/setup/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // التحقق من الأدمن
    if (userId !== ADMIN_USER_ID) {
        return bot.sendMessage(chatId, '❌ صلاحية غير كافية. هذا البوت للإدمن فقط.');
    }
    
    if (!ROBLOX_COOKIE) {
        return bot.sendMessage(chatId, '❌ لم يتم تعيين ROBLOX_COOKIE في متغيرات Railway.');
    }
    
    try {
        // محاولة استيراد noblox.js فقط عند الحاجة
        const noblox = require('noblox.js');
        
        bot.sendMessage(chatId, '🔄 جاري التحقق من الكوكي...');
        
        // التحقق من صحة الكوكي
        const currentUser = await noblox.setCookie(ROBLOX_COOKIE);
        
        // تخزين في قاعدة البيانات
        db.run(
            `INSERT OR REPLACE INTO accounts (nickname, cookie, username, user_id, last_used) 
             VALUES (?, ?, ?, ?, datetime('now'))`,
            ['demo_account', ROBLOX_COOKIE, currentUser.UserName, currentUser.UserID],
            function(err) {
                if (err) {
                    bot.sendMessage(chatId, `❌ خطأ في قاعدة البيانات: ${err.message}`);
                } else {
                    const successMsg = `
✅ *تم إعداد الحساب بنجاح!*

📛 *الاسم:* ${currentUser.DisplayName}
👤 *المستخدم:* @${currentUser.UserName}
🆔 *الرقم:* ${currentUser.UserID}
📅 *تاريخ الإنشاء:* ${new Date(currentUser.Created).toLocaleDateString('ar-SA')}

⚠️ *تذكير:* هذا للحظة تعليمية فقط.
                    `;
                    bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
                }
            }
        );
    } catch (error) {
        bot.sendMessage(chatId, `❌ فشل الإعداد: ${error.message}\n\n⚠️ قد يكون الكوكي غير صالح أو منتهي الصلاحية.`);
    }
});

// أمر /join
bot.onText(/\/join (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const placeId = parseInt(match[1]);
    const userId = msg.from.id.toString();
    
    if (userId !== ADMIN_USER_ID) {
        return bot.sendMessage(chatId, '❌ صلاحية غير كافية.');
    }
    
    bot.sendMessage(chatId, `🔄 محاولة الدخول إلى الخريطة ${placeId}...`);
    
    // جلب معلومات الحساب
    db.get(`SELECT * FROM accounts WHERE nickname = 'demo_account'`, async (err, account) => {
        if (err || !account) {
            return bot.sendMessage(chatId, '❌ لم يتم إعداد أي حساب. استخدم /setup أولاً.');
        }
        
        try {
            const noblox = require('noblox.js');
            await noblox.setCookie(account.cookie);
            
            // محاولة الانضمام للعبة
            const joinRequest = await noblox.joinGame(placeId);
            
            // تسجيل النجاح
            db.run(
                `INSERT INTO join_logs (account_id, place_id, success) VALUES (?, ?, ?)`,
                [account.id, placeId, 1]
            );
            
            db.run(`UPDATE accounts SET last_used = datetime('now') WHERE id = ?`, [account.id]);
            
            const successMsg = `
✅ *تم طلب الدخول بنجاح!*

🎮 *رقم الخريطة:* ${placeId}
🆔 *معرف الجلسة:* ${joinRequest.jobId || 'غير متوفر'}
⏰ *الوقت:* ${new Date().toLocaleTimeString('ar-SA')}

*ملاحظة:* هذا إثبات تقني فقط. الوظيفة الكاملة تتطلب خادم لعبة نشط.
            `;
            
            bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
            
        } catch (error) {
            // تسجيل الفشل
            db.run(
                `INSERT INTO join_logs (account_id, place_id, success) VALUES (?, ?, ?)`,
                [account.id, placeId, 0]
            );
            
            let errorMsg = `❌ فشل الدخول: ${error.message}`;
            
            if (error.message.includes('429')) {
                errorMsg += '\n\n⚠️ تم تجاوز الحد المسموح. Roblox يحد من الطلبات.';
            } else if (error.message.includes('403')) {
                errorMsg += '\n\n🔒 قد يكون الكوكي منتهي الصلاحية أو الحساب محظوراً.';
            }
            
            bot.sendMessage(chatId, errorMsg);
        }
    });
});

// أمر /gameinfo (بديل آمن باستخدام API العام)
bot.onText(/\/gameinfo (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const placeId = match[1];
    
    try {
        const axios = require('axios');
        
        // استخدام Roblox API العام (لا يحتاج كوكي)
        const response = await axios.get(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`, {
            timeout: 10000
        });
        
        const gameData = response.data[0];
        
        if (gameData && gameData.name) {
            const infoMsg = `
🎮 *معلومات اللعبة (API عام)*

*الاسم:* ${gameData.name}
*الوصف:* ${gameData.description || 'بدون وصف'}
*النوع:* ${gameData.gameGenre || 'غير معروف'}
*حجم الخادم:* ${gameData.maxPlayers || 'غير معروف'} لاعبين
*تاريخ الإنشاء:* ${gameData.created ? new Date(gameData.created).toLocaleDateString('ar-SA') : 'غير معروف'}
            `;
            bot.sendMessage(chatId, infoMsg, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ لم أتمكن من العثور على معلومات لهذه الخريطة.');
        }
    } catch (error) {
        bot.sendMessage(chatId, `❌ خطأ في جلب المعلومات: ${error.message}`);
    }
});

// أمر /status
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    
    db.get(`SELECT a.username, a.last_used, COUNT(l.id) as total_joins,
            SUM(CASE WHEN l.success = 1 THEN 1 ELSE 0 END) as successful_joins
            FROM accounts a
            LEFT JOIN join_logs l ON a.id = l.account_id
            WHERE a.nickname = 'demo_account'
            GROUP BY a.id`, (err, data) => {
        
        if (err || !data) {
            return bot.sendMessage(chatId, '📭 لم يتم إعداد أي حساب بعد.');
        }
        
        const statusMsg = `
📊 *حالة النظام*

👤 *الحساب:* ${data.username || 'غير معروف'}
🕒 *آخر استخدام:* ${data.last_used ? new Date(data.last_used).toLocaleString('ar-SA') : 'أبداً'}
🎯 *محاولات الدخول:* ${data.total_joins || 0}
✅ *الناجحة:* ${data.successful_joins || 0}
❌ *الفاشلة:* ${(data.total_joins || 0) - (data.successful_joins || 0)}

💾 *تخزين الكوكي:* ${ROBLOX_COOKIE ? '⚪️ مشفر في المتغيرات' : '❌ غير موجود'}
        `;
        
        bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
    });
});

// أمر /cleanup (حذف كل البيانات)
bot.onText(/\/cleanup/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    if (userId !== ADMIN_USER_ID) {
        return bot.sendMessage(chatId, '❌ صلاحية غير كافية.');
    }
    
    db.serialize(() => {
        db.run('DELETE FROM join_logs');
        db.run('DELETE FROM accounts');
        
        bot.sendMessage(chatId, '🧹 تم حذف جميع البيانات. استخدم /setup لإعادة الإعداد.');
    });
});

// معالجة الأخطاء
bot.on('polling_error', (error) => {
    console.error('❌ خطأ في البوت:', error.code);
});

bot.on('webhook_error', (error) => {
    console.error('❌ خطأ في الويب هوك:', error.message);
});

console.log('✅ بوت تليجرام جاهز للإستخدام');
console.log('📱 أرسل /start إلى بوتك على تليجرام');

// معالجة إغلاق التطبيق
process.on('SIGINT', () => {
    console.log('\n🛑 إغلاق البوت...');
    db.close();
    process.exit(0);
});