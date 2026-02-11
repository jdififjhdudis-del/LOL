const Guild = require('../models/Guild');
const User = require('../models/User');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Get or Create Guild Settings
        let guildSettings = await Guild.findOne({ guildId: message.guild.id });
        if (!guildSettings) {
            guildSettings = await Guild.create({ guildId: message.guild.id });
        }

        // XP System
        if (guildSettings.xpSystem) {
            let userData = await User.findOne({ guildId: message.guild.id, userId: message.author.id });
            if (!userData) {
                userData = await User.create({ guildId: message.guild.id, userId: message.author.id });
            }

            const now = Date.now();
            if (now - userData.lastXpMessage.getTime() > 60000) { // 1 minute cooldown
                const xpAdd = Math.floor(Math.random() * 10) + 15;
                userData.xp += xpAdd;
                userData.lastXpMessage = now;

                const nextLevelXp = userData.level * userData.level * 100;
                if (userData.xp >= nextLevelXp) {
                    userData.level++;
                    message.channel.send(`Congratulations ${message.author}, you leveled up to level **${userData.level}**!`);
                }
                await userData.save();
            }
        }

        // Command Handler
        const prefix = guildSettings.prefix;
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(message, args, client, guildSettings);
        } catch (error) {
            console.error(error);
            message.reply('There was an error executing that command!');
        }
    }
};
