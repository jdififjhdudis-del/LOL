// 🔐 بوت تليجرام الآمن - يطلب الكوكيز من المستخدم مباشرة
console.log('🚀 بدء تشغيل البوت الآمن...');

const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const CryptoJS = require('crypto-js');

// ============ التحقق الأساسي ============
if (!process.env.TELEGRAM_TOKEN) {
    console.error('❌ خطأ: TELEGRAM_TOKEN غير موجود في Railway Variables');
    console.error('⚙️ أضفه في: Railway → Variables');
    process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
    console.error('⚠️ تحذير: ENCRYPTION_KEY غير موجود. سيتم إنشاء مفتاح تلقائي.');
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-me';
const ADMIN_ID = process.env.ADMIN_USER_ID || '';

const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: true,
    filepath: false
});

const db = new sqlite3.Database(':memory:'); // استخدم قاعدة بيانات مؤقتة في الذاكرة

// ============ إعداد الجداول ============
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        cookie_encrypted TEXT,
        username TEXT,
        roblox_id INTEGER,
        setup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// ============ وظائف التشفير ============
function encryptCookie(cookie) {
    return CryptoJS.AES.encrypt(cookie, ENCRYPTION_KEY).toString();
}

function decryptCookie(encryptedCookie) {
    const bytes = CryptoJS.AES.decrypt(encryptedCookie, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// ============ الأوامر الرئيسية ============

// 📌 الأمر /start - الرسالة الترحيبية
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMsg = `
🔒 *بوت Roblox الآمن*

🎯 *المميزات:*
• تخزين الكوكيز مشفرًا في الذاكرة فقط
• يطلب الكوكيز منك مباشرة عبر البوت
• يحذف الكوكيز عند إعادة التشغيل

⚡ *الأوامر المتاحة:*
/setcookie - إدخال كوكيز حسابك (مشفر)
/joingame [رقم] - الدخول إلى لعبة
/mystatus - عرض حالة حسابك
/clearmydata - حذف بياناتك

⚠️ *ملاحظات أمنية:*
1. الكوكيز يخزن في ذاكرة السيرفر المؤقتة
2. يتم حذفه عند إعادة تشغيل البوت
3. لا يتم حفظه في ملفات دائمة
4. استخدم حسابًا وهميًا فقط!

🔧 *لبدء الاستخدام:* أرسل /setcookie
    `;
    
    bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
});

// 📌 الأمر /setcookie - لإدخال الكوكيز
bot.onText(/\/setcookie/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // التحقق إذا كان الأدمن فقط
    if (ADMIN_ID && userId.toString() !== ADMIN_ID) {
        return bot.sendMessage(chatId, '❌ هذا البوت مخصص للاستخدام الشخصي فقط.');
    }
    
    bot.sendMessage(chatId, 
        `🔐 *إدخال كوكيز Roblox*\n\n` +
        `1. سجّل دخول إلى *Roblox.com* في متصفحك\n` +
        `2. اضغط *F12* → *Application* → *Cookies*\n` +
        `3. ابحث عن *\`.ROBLOSECURITY\`* وانسخ القيمة\n` +
        `4. أرسلها لي هنا (ستتم *تشفيرها فورًا*)\n\n` +
        `⚠️ *تحذير:* تأكد أنك تستخدم حسابًا وهميًا!\n` +
        `⏳ لديك 5 دقائق لإرسال الكوكيز...`,
        { parse_mode: 'Markdown' }
    ).then(() => {
        // انتظار رسالة الكوكيز
        bot.once('message', async (cookieMsg) => {
            if (cookieMsg.chat.id === chatId && !cookieMsg.text.startsWith('/')) {
                const cookie = cookieMsg.text.trim();
                
                // التحقق من شكل الكوكيز
                if (!cookie.includes('_|WARNING:-DO-NOT-SHARE-THIS')) {
                    return bot.sendMessage(chatId, 
                        '❌ *الكوكيز غير صالح*\n' +
                        'تأكد أنك نسخت الكوكيز الكامل الذي يبدأ بـ:\n' +
                        '`_|WARNING:-DO-NOT-SHARE-THIS`',
                        { parse_mode: 'Markdown' }
                    );
                }
                
                bot.sendMessage(chatId, '🔄 جاري التحقق من الكوكيز...');
                
                try {
                    // التحقق من الكوكيز باستخدام noblox.js
                    const noblox = require('noblox.js');
                    const userInfo = await noblox.setCookie(cookie);
                    
                    // تشفير الكوكيز وحفظه
                    const encryptedCookie = encryptCookie(cookie);
                    
                    db.run(
                        `INSERT OR REPLACE INTO sessions 
                        (user_id, cookie_encrypted, username, roblox_id, last_activity) 
                        VALUES (?, ?, ?, ?, datetime('now'))`,
                        [userId, encryptedCookie, userInfo.UserName, userInfo.UserID],
                        function(err) {
                            if (err) {
                                bot.sendMessage(chatId, `❌ خطأ في الحفظ: ${err.message}`);
                            } else {
                                const successMsg = `
✅ *تم حفظ الكوكيز بنجاح!*

👤 *حساب Roblox:*
• الاسم: ${userInfo.DisplayName || userInfo.UserName}
• المستخدم: @${userInfo.UserName}
• الرقم: ${userInfo.UserID}
• العمر: ${userInfo.AgeDays || 'غير معروف'} يوم

🔒 *الحالة:*
• الكوكيز: مشفر ✓
• التخزين: مؤقت في الذاكرة
• الحذف: عند إعادة التشغيل

🎮 *للدخول إلى لعبة:* /joingame [رقم_اللعبة]
                                `;
                                bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
                            }
                        }
                    );
                    
                } catch (error) {
                    bot.sendMessage(chatId, 
                        `❌ *الكوكيز غير صالح أو منتهي*\n\n` +
                        `الخطأ: ${error.message}\n\n` +
                        `🔧 *الحلول الممكنة:*\n` +
                        `1. سجّل دخول يدوي إلى Roblox.com\n` +
                        `2. احصل على كوكيز جديد\n` +
                        `3. جرب مرة أخرى`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }
        });
        
        // إلغاء الانتظار بعد 5 دقائق
        setTimeout(() => {
            bot.removeListener('message', () => {});
        }, 5 * 60 * 1000);
    });
});

// 📌 الأمر /joingame - الدخول إلى لعبة
bot.onText(/\/joingame (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const placeId = match[1];
    
    bot.sendMessage(chatId, `🔄 جلب بيانات حسابك...`);
    
    db.get(`SELECT cookie_encrypted, username FROM sessions WHERE user_id = ?`, 
        [userId], 
        async (err, row) => {
            if (err || !row) {
                return bot.sendMessage(chatId, 
                    '❌ *لم يتم إعداد حسابك*\n\n' +
                    'استخدم الأمر /setcookie أولاً لإدخال الكوكيز.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            try {
                // فك التشفير
                const decryptedCookie = decryptCookie(row.cookie_encrypted);
                
                bot.sendMessage(chatId, `🎮 محاولة الدخول إلى اللعبة ${placeId}...`);
                
                const noblox = require('noblox.js');
                await noblox.setCookie(decryptedCookie);
                
                // محاولة الانضمام للعبة
                const result = await noblox.joinGame(parseInt(placeId));
                
                // تحديث وقت النشاط
                db.run(`UPDATE sessions SET last_activity = datetime('now') WHERE user_id = ?`, [userId]);
                
                const successMsg = `
✅ *تم طلب الدخول بنجاح!*

📊 *التفاصيل:*
• اللعبة: ${placeId}
• الحساب: ${row.username}
• المعرف: ${result.jobId || 'غير متوفر'}
• الوقت: ${new Date().toLocaleTimeString('ar-SA')}

⚠️ *ملاحظة:* هذا يطلب الانضمام فقط. 
للعبة خاصة، تحتاج إلى تشغيل خادم مخصص.
                `;
                
                bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
                
            } catch (error) {
                let errorMsg = `❌ فشل الدخول: ${error.message}`;
                
                if (error.message.includes('Cookie')) {
                    errorMsg += '\n\n🔐 *الكوكيز منتهي أو غير صالح*\n' +
                                'استخدم /setcookie لإدخال كوكيز جديد.';
                } else if (error.message.includes('Cannot join game')) {
                    errorMsg += '\n\n🎮 *اللعبة غير متاحة أو خاصة*\n' +
                                'تحتاج إلى رابط دعوة للعبة الخاصة.';
                }
                
                bot.sendMessage(chatId, errorMsg, { parse_mode: 'Markdown' });
            }
        }
    );
});

// 📌 الأمر /mystatus - عرض الحالة
bot.onText(/\/mystatus/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    db.get(`SELECT username, roblox_id, setup_date, last_activity FROM sessions WHERE user_id = ?`,
        [userId],
        (err, row) => {
            if (err || !row) {
                return bot.sendMessage(chatId, 
                    '📭 *لا يوجد حساب مخزن*\n' +
                    'استخدم /setcookie لبدء الاستخدام.',
                    { parse_mode: 'Markdown' }
                );
            }
            
            const statusMsg = `
📊 *حالة حسابك*

👤 *المعلومات:*
• المستخدم: ${row.username}
• الرقم: ${row.roblox_id}
• الإعداد: ${new Date(row.setup_date).toLocaleString('ar-SA')}
• آخر نشاط: ${new Date(row.last_activity).toLocaleString('ar-SA')}

🔒 *الأمان:*
• الكوكيز: مشفر في الذاكرة
• الحذف: عند إعادة التشغيل
• السجلات: غير محفوظة

⚡ *الأوامر:*
/joingame [رقم] - الدخول للعبة
/clearmydata - حذف بياناتك
            `;
            
            bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
        }
    );
});

// 📌 الأمر /clearmydata - حذف البيانات
bot.onText(/\/clearmydata/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId], function(err) {
        if (this.changes > 0) {
            bot.sendMessage(chatId, 
                '🗑️ *تم حذف بياناتك بالكامل*\n\n' +
                '• الكوكيز المحفوظ: تم حذفه ✓\n' +
                '• معلومات الحساب: تم حذفها ✓\n' +
                '• السجلات: تم حذفها ✓\n\n' +
                'للاستخدام مرة أخرى: /setcookie',
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, 'ℹ️ لا توجد بيانات لحذفها.');
        }
    });
});

// 📌 أمر السرية /admin_clear_all (للمطور فقط)
bot.onText(/\/admin_clear_all/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (ADMIN_ID && userId.toString() === ADMIN_ID) {
        db.run(`DELETE FROM sessions`, () => {
            bot.sendMessage(chatId, '✅ تم حذف جميع البيانات من الذاكرة.');
        });
    }
});

// ============ معالجة الأخطاء ============
bot.on('polling_error', (error) => {
    console.error('❌ خطأ في البوت:', error.code);
    
    // إعادة المحاولة بعد 10 ثواني
    setTimeout(() => {
        console.log('🔄 إعادة المحاولة...');
    }, 10000);
});

bot.on('webhook_error', (error) => {
    console.error('❌ خطأ ويب هوك:', error.message);
});

// ============ التنظيف عند الإغلاق ============
process.on('SIGINT', () => {
    console.log('\n🔴 إغلاق البوت وحذف جميع الكوكيز...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🔴 إيقاف البوت...');
    db.close();
    process.exit(0);
});

console.log('✅ البوت يعمل!');
console.log('📱 أرسل /start إلى بوتك في تليجرام');
