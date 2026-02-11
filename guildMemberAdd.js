const { EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        const guildSettings = await Guild.findOne({ guildId: member.guild.id });
        if (!guildSettings || !guildSettings.welcomeChannel) return;

        const channel = member.guild.channels.cache.get(guildSettings.welcomeChannel);
        if (!channel) return;

        const welcomeMessage = guildSettings.welcomeMessage.replace('{user}', `<@${member.id}>`);

        const embed = new EmbedBuilder()
            .setTitle('Welcome!')
            .setDescription(welcomeMessage)
            .setThumbnail(member.user.displayAvatarURL())
            .setColor('#5865F2')
            .setTimestamp();

        channel.send({ embeds: [embed] });

        // Autorole
        if (guildSettings.autorole) {
            const role = member.guild.roles.cache.get(guildSettings.autorole);
            if (role) member.roles.add(role).catch(console.error);
        }
    }
};
