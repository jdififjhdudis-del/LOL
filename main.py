import os
import telebot
import requests
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

# 🔹 التوكن من متغير البيئة
TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("⚠️ لم يتم العثور على BOT_TOKEN في Environment Variables!")

bot = telebot.TeleBot(TOKEN)
HEADERS = {"User-Agent": "RobloxLookupBot"}

# 🔹 دالة للحصول على UserID من اسم الحساب
def get_user_id(username):
    url = "https://users.roblox.com/v1/usernames/users"
    data = {"usernames": [username], "excludeBannedUsers": False}
    r = requests.post(url, json=data, headers=HEADERS)
    if r.status_code != 200 or not r.json().get("data"):
        return None
    return r.json()["data"][0]["id"]

# 🔹 أمر /start
@bot.message_handler(commands=["start"])
def start(message):
    bot.reply_to(
        message,
        "👋 أهلاً!\n\n"
        "🔍 أرسل اسم حساب روبلوكس فقط\n"
        "وسأعطيك كل معلوماته العامة + أزرار"
    )

# 🔹 البحث عن الحساب
@bot.message_handler(func=lambda m: True)
def lookup(message):
    username = message.text.strip()
    user_id = get_user_id(username)

    if not user_id:
        bot.reply_to(message, "❌ الحساب غير موجود")
        return

    # معلومات الحساب
    info = requests.get(
        f"https://users.roblox.com/v1/users/{user_id}",
        headers=HEADERS
    ).json()

    # أرقام الأصدقاء والمتابعين
    friends = requests.get(f"https://friends.roblox.com/v1/users/{user_id}/friends/count", headers=HEADERS).json().get("count", 0)
    followers = requests.get(f"https://friends.roblox.com/v1/users/{user_id}/followers/count", headers=HEADERS).json().get("count", 0)
    following = requests.get(f"https://friends.roblox.com/v1/users/{user_id}/followings/count", headers=HEADERS).json().get("count", 0)

    # مجموعات وبادجات وألعاب
    groups = requests.get(f"https://groups.roblox.com/v1/users/{user_id}/groups/roles", headers=HEADERS).json().get("data", [])
    badges = requests.get(f"https://badges.roblox.com/v1/users/{user_id}/badges?limit=100", headers=HEADERS).json().get("data", [])
    games = requests.get(f"https://games.roblox.com/v2/users/{user_id}/games?limit=10", headers=HEADERS).json().get("data", [])

    last_game_name = "غير متوفر"
    last_game_url = f"https://www.roblox.com/users/{user_id}/profile"
    if games:
        last_game_name = games[0].get("name", "غير متوفر")
        last_game_url = f"https://www.roblox.com/games/{games[0].get('rootPlaceId')}"

    # صورة الحساب
    avatar = requests.get(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot",
        params={"userIds": user_id, "size": "420x420", "format": "Png", "isCircular": "false"},
        headers=HEADERS
    ).json()["data"][0]["imageUrl"]

    # النص الذي سيظهر
    text = (
        f"🔍 Roblox Account Info\n\n"
        f"👤 Username: {info.get('name', 'N/A')}\n"
        f"📛 Display Name: {info.get('displayName', 'N/A')}\n"
        f"🆔 User ID: {user_id}\n"
        f"📅 Created: {info.get('created', 'N/A')[:10]}\n"
        f"📝 Bio: {info.get('description') or 'لا يوجد'}\n"
        f"🤖 Banned: {info.get('isBanned', 'غير معروف')}\n"
        f"👶 Under 13: {info.get('isUnder13', 'غير متوفر')}\n\n"
        f"👥 Friends: {friends}\n"
        f"👀 Followers: {followers}\n"
        f"👣 Following: {following}\n"
        f"🏘 Groups: {len(groups)}\n"
        f"🏅 Badges: {len(badges)}\n"
        f"🧱 Games Created: {len(games)}\n"
        f"🎮 Last Game: {last_game_name}"
    )

    # الأزرار
    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton("👤 Profile", url=f"https://www.roblox.com/users/{user_id}/profile"),
        InlineKeyboardButton("🎮 Open Game", url=last_game_url)
    )

    # إرسال الصورة مع النص والأزرار
    bot.send_photo(
        message.chat.id,
        avatar,
        caption=text,
        reply_markup=keyboard
    )

# 🔹 تشغيل البوت 24/7
bot.infinity_polling()
