const nodemailer = require('nodemailer');
const cron = require('node-cron');
const Habit = require('../models/Habit');
const User = require('../models/User');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'livelyfbeautiful@gmail.com',
        pass: 'yrya flxl dtbx snob'
    }
});

cron.schedule('* * * * *', async () => {
    const now = new Date();

    // 1. Get current time in HH:mm format (e.g., "13:30" or "09:05")
    // padStart ensures that 9:05 becomes "09:05" to match the database exactly
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    console.log(`--- Cron Check at ${currentTime} ---`);

    try {
        // 2. Direct Database Query (Much faster and more professional than filtering all habits)
        // We trim the reminderTime in case there are accidental spaces
        const habitsToRemind = await Habit.find({
            reminderTime: currentTime
        }).populate('user');

        if (habitsToRemind.length === 0) {
            console.log(`No habits scheduled for ${currentTime}.`);
            return;
        }

        habitsToRemind.forEach(habit => {
            // Safety check: Ensure user exists and has an email
            if (habit.user && habit.user.email) {
                console.log(`🎯 MATCH! Sending: ${habit.name} to ${habit.user.email}`);

                const mailOptions = {
                    from: '"MindTrack" <livelyfbeautiful@gmail.com>',
                    to: habit.user.email,
                    subject: `⏰ MindTrack Reminder: ${habit.name}`,
                    html: `
                        <div style="font-family: sans-serif; color: #333;">
                            <h2>Hello ${habit.user.username || 'there'}!</h2>
                            <p>It's <b>${currentTime}</b>, time for your ritual: <strong>${habit.name}</strong>.</p>
                            <p>Taking this small step helps build your consistency. Keep going!</p>
                            <br>
                            <p style="color: #6b7280; font-size: 0.8em;">Sent with ❤️ from MindTrack</p>
                        </div>
                    `
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) console.log("❌ Mail Error:", error.message);
                    else console.log(`✅ Email sent for ${habit.name}`);
                });
            } else {
                console.log(`⚠️ Habit "${habit.name}" matched but is missing a valid user email.`);
            }
        });
    } catch (err) {
        console.error("❌ Database/Cron Error:", err);
    }
});

console.log("🚀 Notification Service is active and monitoring reminders...");