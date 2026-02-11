const { EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        const guildSettings = await Guild.findOne({ guildId: member.guild.id });
        if (!guildSettings || !guildSettings.welcomeChannel) return;

        const channel = member.guild.channels.cache.get(guildSettings.welcomeChannel);
        if (!channel) return;

        const leaveMessage = guildSettings.leaveMessage.replace('{user}', member.user.tag);

        const embed = new EmbedBuilder()
            .setTitle('Goodbye')
            .setDescription(leaveMessage)
            .setThumbnail(member.user.displayAvatarURL())
            .setColor('#ED4245')
            .setTimestamp();

        channel.send({ embeds: [embed] });
    }
};
