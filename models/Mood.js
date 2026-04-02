const mongoose = require("mongoose");

const moodSchema = new mongoose.Schema({
    mood: { type: String, required: true },
    energyLevel: { type: Number, default: 3 },
    note: { type: String },
    factors: { type: [String], default: [] }, // This MUST be an array of strings
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Mood", moodSchema);