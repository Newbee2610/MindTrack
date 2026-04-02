const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Habit = require("./models/Habit");
const Mood = require("./models/Mood");
const User = require("./models/User");

const app = express();
const port = process.env.PORT || 3000;

const nodemailer = require('nodemailer');
// ==========================
// DATABASE & CONFIG
// ==========================
require("./config/db");
require('./utils/notify');

// ==========================
// MIDDLEWARE
// ==========================
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: "mindtrack-secret",
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect("/login");
};

const calculateStreak = (habits) => {
    let streak = 0;
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);

    while (true) {
        const completedThatDay = habits.some(habit =>
            habit.completedDates.some(date => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === checkDate.getTime();
            })
        );

        if (completedThatDay) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
};

// ==========================
// AUTH ROUTES
// ==========================

// FIX 1: Changed from plain text to Redirect or Render
app.get("/", (req, res) => {
    if (req.session.userId) {
        res.redirect("/dashboard");
    } else {
        res.render("index", { user: null }); // Renders your landing page
    }
});

app.get("/signup", (req, res) => {
    res.render("signup", { error: null, user: null });
});

app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        return res.redirect('/login');
    } catch (err) {
        let errorMsg = "Something went wrong.";
        if (err.code === 11000) errorMsg = "Email already exists.";
        res.render("signup", { error: errorMsg, user: null });
    }
});

app.get("/login", (req, res) => {
    res.render("login", { error: null, user: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("login", { error: "User not found.", user: null });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.userId = user._id;
            return res.redirect('/dashboard');
        } else {
            return res.render("login", { error: "Incorrect password.", user: null });
        }
    } catch (err) {
        res.render("login", { error: "An error occurred. Please try again.", user: null });
    }
});

app.get("/logout-success", (req, res) => {
    res.render("logout-success", { user: null });
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Logout error:", err);
            return res.redirect("/dashboard");
        }
        res.clearCookie('connect.sid');
        res.redirect("/logout-success");
    });
});

// ==========================
// HABIT ACTIONS
// ==========================

app.post('/add-longterm-habit', isAuthenticated, async (req, res) => {
    try {
        const { name, frequency, reminderTime, category, color } = req.body;

        // FIX 2: Added Capitalization for Long-term habits
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

        const newHabit = new Habit({
            name: formattedName,
            type: "longterm",
            frequency: frequency,
            reminderTime: reminderTime,
            category: category,
            color: color || "sage-dark",
            user: req.session.userId,
            completedDates: []
        });

        await newHabit.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Error saving long-term habit:", err);
        res.status(500).send("Server Error");
    }
});

app.post("/add-habit", isAuthenticated, async (req, res) => {
    try {
        // FIX 3: Added Capitalization for Daily habits
        const name = req.body.habitName;
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

        const newHabit = new Habit({
            name: formattedName,
            type: "daily",
            completedDates: [],
            user: req.session.userId
        });
        await newHabit.save();
        res.redirect("/dashboard");
    } catch (err) {
        res.status(500).send("Error adding habit.");
    }
});

app.post("/complete-habit/:id", isAuthenticated, async (req, res) => {
    try {
        const habit = await Habit.findOne({ _id: req.params.id, user: req.session.userId });

        if (!habit) {
            return res.redirect("/dashboard");
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alreadyDone = habit.completedDates.some(date => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === today.getTime();
        });

        if (!alreadyDone) {
            habit.completedDates.push(today);
            await habit.save();
        }

        res.redirect("/dashboard");
    } catch (err) {
        console.error("Completion Error:", err);
        res.status(500).send("Error completing habit.");
    }
});

app.post("/delete-habit/:id", isAuthenticated, async (req, res) => {
    try {
        await Habit.findOneAndDelete({ _id: req.params.id, user: req.session.userId });
        res.redirect("/dashboard");
    } catch (err) {
        res.status(500).send("Error deleting habit.");
    }
});

// ==========================
// SECURE DATA ROUTES
// ==========================

app.get("/dashboard", isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const habits = await Habit.find({ user: req.session.userId });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        let completedToday = 0;
        let weeklyCompleted = 0;
        let totalCompletions = 0;

        habits.forEach(habit => {
            habit.completedDates.forEach(date => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                totalCompletions++;
                if (d.getTime() === today.getTime()) completedToday++;
                if (d >= weekStart) weeklyCompleted++;
            });
        });

        const weeklyTarget = habits.length * 7;
        const weeklyProgress = weeklyTarget === 0 ? 0 : Math.round((weeklyCompleted / weeklyTarget) * 100);
        const overallProgress = habits.length === 0 ? 0 : Math.round((totalCompletions / (habits.length * 30)) * 100);

        const currentStreak = calculateStreak(habits);

        res.render("dashboard", {
            user,
            habits,
            completedToday,
            weeklyProgress,
            overallProgress,
            currentStreak
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading dashboard.");
    }
});

app.get("/habits", isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const habits = await Habit.find({ user: req.session.userId });
        res.render("habits", { user, habits });
    } catch (err) {
        res.status(500).send("Error loading habits page.");
    }
});

app.get("/mood", isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render("mood", { user });
});

app.post('/add-mood', isAuthenticated, async (req, res) => {
    try {
        let factors = req.body.factors || [];
        if (factors && !Array.isArray(factors)) {
            factors = [factors];
        }

        const newMood = new Mood({
            mood: req.body.mood,
            note: req.body.note,
            energyLevel: parseInt(req.body.energyLevel) || 3,
            factors: factors,
            user: req.session.userId,
            date: new Date()
        });

        await newMood.save();
        res.redirect('/history');
    } catch (err) {
        res.status(500).send("Error saving mood: " + err.message);
    }
});

app.get('/history', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const moods = await Mood.find({ user: req.session.userId }).sort({ date: -1 });

        const totalEntries = moods.length;
        let moodCount = {};
        let totalEnergy = 0;

        moods.forEach(entry => {
            moodCount[entry.mood] = (moodCount[entry.mood] || 0) + 1;
            totalEnergy += (entry.energyLevel || 0);
        });

        const mostCommon = Object.keys(moodCount).reduce((a, b) => moodCount[a] > moodCount[b] ? a : b, "-");
        const avgEnergy = totalEntries > 0 ? (totalEnergy / totalEntries).toFixed(1) : 0;

        res.render('history', {
            user: user,
            moods: moods,
            totalEntries: totalEntries,
            streak: 0,
            mostCommon: mostCommon,
            avgEnergy: avgEnergy,
            moodCount: moodCount
        });
    } catch (err) {
        res.status(500).send("Error loading history");
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`MindTrack is live on port ${port}`);
});