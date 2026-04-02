const mongoose = require("mongoose");

const habitSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ["daily", "longterm"],
        default: "daily"
    },
    frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "daily"
    },
    reminderTime: String,
    category: String,
    color: { type: String, default: "sage-dark" },
    targetEndDate: Date,
    // CRITICAL: Link to the User model
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    createdAt: { type: Date, default: Date.now },
    completedDates: [{ type: Date }]
});

module.exports = mongoose.model("Habit", habitSchema);