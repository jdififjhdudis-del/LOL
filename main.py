import telebot
import requests
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

TOKEN = "8332969740:AAEU2XSdpyUWvtsjWVD5rJZ0btLpThpcaEQ"
bot = telebot.TeleBot(TOKEN)

HEADERS = {"User-Agent": "RobloxLookupBot"}

def get_user_id(username):
    url = "https://users.roblox.com/v1/usernames/users"
    data = {"usernames": [username], "excludeBannedUsers": False}
    r = requests.post(url, json=data, headers=HEADERS)
    if r.status_code != 200 or not r.json().get("data"):
        return None
    return r.json()["data"][0]["id"]

@bot.message_handler(commands=["start"])
def start(message):
    bot.reply_to(
        message,
        "👋 أهلاً!\n\n"
        "🔍 أرسل اسم حساب روبلوكس فقط\n"
        "وسأعطيك كل معلوماته العامة + أزرار"
    )

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

    friends = requests.get(
        f"https://friends.roblox.com/v1/users/{user_id}/friends/count",
        headers=HEADERS
    ).json().get("count", 0)

    followers = requests.get(
        f"https://friends.roblox.com/v1/users/{user_id}/followers/count",
        headers=HEADERS
    ).json().get("count", 0)

    following = requests.get(
        f"https://friends.roblox.com/v1/users/{user_id}/followings/count",
        headers=HEADERS
    ).json().get("count", 0)

    groups = requests.get(
        f"https://groups.roblox.com/v1/users/{user_id}/groups/roles",
        headers=HEADERS
    ).json().get("data", [])

    badges = requests.get(
        f"https://badges.roblox.com/v1/users/{user_id}/badges?limit=100",
        headers=HEADERS
    ).json().get("data", [])

    games = requests.get(
        f"https://games.roblox.com/v2/users/{user_id}/games?limit=10",
        headers=HEADERS
    ).json().get("data", [])

    last_game_name = "غير متوفر"
    last_game_url = f"https://www.roblox.com/users/{user_id}/profile"

    if games:
        last_game_name = games[0].get("name", "غير متوفر")
        last_game_url = f"https://www.roblox.com/games/{games[0].get('rootPlaceId')}"

    avatar = requests.get(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot",
        params={
            "userIds": user_id,
            "size": "420x420",
            "format": "Png",
            "isCircular": "false"
        },
        headers=HEADERS
    ).json()["data"][0]["imageUrl"]

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

    keyboard = InlineKeyboardMarkup()
    keyboard.add(
        InlineKeyboardButton("👤 Profile", url=f"https://www.roblox.com/users/{user_id}/profile"),
        InlineKeyboardButton("🎮 Open Game", url=last_game_url)
    )

    bot.send_photo(
        message.chat.id,
        avatar,
        caption=text,
        reply_markup=keyboard
    )

bot.infinity_polling()