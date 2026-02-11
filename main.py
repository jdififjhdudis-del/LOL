import telebot
import requests
import json
import time
import os
from datetime import datetime
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

BOT_TOKEN = os.getenv("BOT_TOKEN")
GAMEPASS_ID = 1708536288

bot = telebot.TeleBot(BOT_TOKEN)
HEADERS = {"User-Agent": "RBXEliteScannerV3"}

DATA_FILE = "premium_users.json"

# تحميل بيانات المشتركين
try:
    with open(DATA_FILE, "r") as f:
        premium_users = json.load(f)
except:
    premium_users = {}

def save_data():
    with open(DATA_FILE, "w") as f:
        json.dump(premium_users, f)

def get_user_id(username):
    url = "https://users.roblox.com/v1/usernames/users"
    data = {"usernames": [username], "excludeBannedUsers": False}
    r = requests.post(url, json=data, headers=HEADERS)
    if r.status_code != 200:
        return None
    js = r.json()
    if not js.get("data"):
        return None
    return js["data"][0]["id"]

def check_gamepass(user_id):
    url = f"https://inventory.roblox.com/v1/users/{user_id}/items/GamePass/{GAMEPASS_ID}"
    r = requests.get(url, headers=HEADERS)
    data = r.json()
    return len(data.get("data", [])) > 0

def is_premium(chat_id):
    chat_id = str(chat_id)
    if chat_id in premium_users:
        if time.time() < premium_users[chat_id]:
            return True
        else:
            del premium_users[chat_id]
            save_data()
    return False

@bot.message_handler(commands=["start"])
def start(message):
    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton("💎 شراء Premium",
            url=f"https://www.roblox.com/game-pass/{GAMEPASS_ID}/"),
        InlineKeyboardButton("🔓 تحقق", callback_data="verify")
    )

    bot.send_message(
        message.chat.id,
        "👑 RBX Elite Scanner\n\n"
        "💰 الاشتراك: 100 Robux / شهر\n"
        "⏳ مدة التفعيل: 30 يوم\n\n"
        "اشتري الجيم باس ثم اضغط تحقق",
        reply_markup=markup
    )

@bot.callback_query_handler(func=lambda call: call.data == "verify")
def verify(call):
    bot.send_message(call.message.chat.id,
                     "🔎 ارسل يوزر روبلوكس للتحقق")
    bot.register_next_step_handler(call.message, process_verification)

def process_verification(message):
    username = message.text.strip()
    user_id = get_user_id(username)

    if not user_id:
        bot.reply_to(message, "❌ الحساب غير موجود")
        return

    if check_gamepass(user_id):
        expire_time = time.time() + (30 * 24 * 60 * 60)
        premium_users[str(message.chat.id)] = expire_time
        save_data()
        bot.reply_to(message, "✅ تم تفعيل Premium لمدة 30 يوم 👑")
    else:
        bot.reply_to(message, "❌ الجيم باس غير موجود في الحساب")

@bot.message_handler(func=lambda m: True)
def lookup(message):
    username = message.text.strip()
    user_id = get_user_id(username)

    if not user_id:
        bot.reply_to(message, "❌ الحساب غير موجود")
        return

    info = requests.get(
        f"https://users.roblox.com/v1/users/{user_id}",
        headers=HEADERS
    ).json()

    created = info.get("created", "N/A")
    age_days = "غير متوفر"

    if created != "N/A":
        created_date = datetime.strptime(created[:10], "%Y-%m-%d")
        age_days = (datetime.utcnow() - created_date).days

    text = (
        f"👤 Username: {info.get('name','N/A')}\n"
        f"🆔 ID: {user_id}\n"
        f"📅 Created: {created[:10] if created!='N/A' else 'N/A'}\n"
    )

    if is_premium(message.chat.id):
        friends = requests.get(
            f"https://friends.roblox.com/v1/users/{user_id}/friends/count",
            headers=HEADERS
        ).json().get("count", 0)

        followers = requests.get(
            f"https://friends.roblox.com/v1/users/{user_id}/followers/count",
            headers=HEADERS
        ).json().get("count", 0)

        text += (
            f"\n💎 Premium Data:\n"
            f"👥 Friends: {friends}\n"
            f"👀 Followers: {followers}\n"
            f"📆 عمر الحساب: {age_days} يوم\n"
            f"🚫 Banned: {info.get('isBanned','غير معروف')}\n"
        )
    else:
        text += "\n🔒 المعلومات المتقدمة للمشتركين فقط"

    bot.reply_to(message, text)

print("Bot Running...")
bot.infinity_polling()
