const { PermissionFlagsBits } = require('discord.js');
const User = require('../models/User');

module.exports = {
    name: 'warn',
    description: 'Warn a member',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply("You don't have permission to use this command!");
        }

        const target = message.mentions.users.first();
        if (!target) return message.reply('Please mention a user to warn.');

        const reason = args.slice(1).join(' ') || 'No reason provided';

        let userData = await User.findOne({ guildId: message.guild.id, userId: target.id });
        if (!userData) {
            userData = await User.create({ guildId: message.guild.id, userId: target.id });
        }

        userData.warnings.push({
            reason: reason,
            moderatorId: message.author.id,
            timestamp: new Date()
        });

        await userData.save();

        message.channel.send(`⚠️ **${target.tag}** has been warned. Reason: ${reason}\nTotal warnings: ${userData.warnings.length}`);
    }
};
