import mongoose from 'mongoose';

const guildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: '!' },
    welcomeChannel: { type: String, default: null },
    logChannel: { type: String, default: null },
    xpSystem: { type: Boolean, default: true },
    welcomeMessage: { type: String, default: 'Welcome {user} to the server!' },
    leaveMessage: { type: String, default: '{user} has left the server.' },
    autorole: { type: String, default: null }
});

export default mongoose.models.Guild || mongoose.model('Guild', guildSchema);
