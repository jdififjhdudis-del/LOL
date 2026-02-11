const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
    name: 'level',
    description: 'Check your current level and XP',
    async execute(message, args, client) {
        const target = message.mentions.users.first() || message.author;
        const userData = await User.findOne({ guildId: message.guild.id, userId: target.id });

        if (!userData) {
            return message.reply(target.id === message.author.id ? "You don't have any XP yet!" : "This user doesn't have any XP yet!");
        }

        const nextLevelXp = userData.level * userData.level * 100;
        
        const embed = new EmbedBuilder()
            .setTitle(`${target.username}'s Rank`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: 'Level', value: `\`${userData.level}\``, inline: true },
                { name: 'XP', value: `\`${userData.xp} / ${nextLevelXp}\``, inline: true }
            )
            .setColor('#0099ff')
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
};
