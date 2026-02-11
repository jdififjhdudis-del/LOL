const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'ban',
    description: 'Ban a member from the server',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply("You don't have permission to use this command!");
        }

        const target = message.mentions.members.first();
        if (!target) return message.reply('Please mention a member to ban.');

        if (!target.bannable) return message.reply('I cannot ban this member!');

        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        await target.ban({ reason });
        message.channel.send(`✅ **${target.user.tag}** has been banned. Reason: ${reason}`);
    }
};
