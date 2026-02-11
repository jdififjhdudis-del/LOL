module.exports = {
    name: 'ping',
    description: 'Check the bot latency',
    async execute(message, args, client) {
        const msg = await message.reply('Pinging...');
        const latency = msg.createdTimestamp - message.createdTimestamp;
        msg.edit(`🏓 Pong!\nLatency: \`${latency}ms\`\nAPI Latency: \`${Math.round(client.ws.ping)}ms\``);
    }
};
