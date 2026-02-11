const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'kick',
    description: 'Kick a member from the server',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply("You don't have permission to use this command!");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Please mention a member to kick.');

        if (!target.kickable) return message.reply('I cannot kick this member!');

        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        await target.kick(reason);
        message.channel.send(`✅ **${target.user.tag}** has been kicked. Reason: ${reason}`);
    }
};
