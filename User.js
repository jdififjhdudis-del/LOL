const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    warnings: [{
        reason: String,
        moderatorId: String,
        timestamp: { type: Date, default: Date.now }
    }],
    lastXpMessage: { type: Date, default: Date.now }
});

userSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
