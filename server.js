// ========== IMPORTS ==========
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const FileStore = require('session-file-store')(session);
const app = express();
const port = process.env.PORT || 3000;
const bundleService = require('./services/bundleService');
const { PLANS, PROVIDERS, NETWORK_PLANS } = require('./config/plans');

// ========== MONGODB CONNECTION ==========
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smebundles';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected successfully');
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('⚠️  App will still run but data will NOT persist!');
    });

// ========== DATABASE SCHEMAS ==========
const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    totalPurchases: { type: Number, default: 0 },
    lastPurchaseDate: { type: Date }
});

const transactionSchema = new mongoose.Schema({
    id: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    bundleName: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String },
    provider: { type: String },
    planType: { type: String },
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'completed' },
    confirmationCode: { type: String },
    delivered: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// ========== VIEW ENGINE ==========
app.set('view engine', 'ejs');

// ========== MIDDLEWARE ==========
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// ========== SESSION (MUST COME BEFORE LANGUAGE MIDDLEWARE) ==========
app.use(session({
    store: new FileStore({
        path: './sessions',
        ttl: 24 * 60 * 60,
        retries: 0
    }),
    secret: process.env.SESSION_SECRET || 'sme-bundle-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ========== LANGUAGE + GLOBAL DATA MIDDLEWARE ==========
app.use((req, res, next) => {
    if (!req.session.lang) {
        req.session.lang = 'sw';
    }
    res.locals.lang = req.session.lang;
    res.locals.plans = PLANS;
    res.locals.providers = PROVIDERS;
    res.locals.networkPlans = NETWORK_PLANS;
    next();
});

// ========== LANGUAGE TOGGLE ==========
app.get('/toggle-language', (req, res) => {
    req.session.lang = req.session.lang === 'sw' ? 'en' : 'sw';
    res.json({ success: true, lang: req.session.lang });
});

// ========== ROUTES ==========

// HOMEPAGE
app.get('/', async (req, res) => {
    try {
        const bundles = await bundleService.getBundles();
        res.render('index', {
            bundles: bundles,
            user: req.session.user || null
        });
    } catch (error) {
        console.error('Error fetching bundles:', error);
        res.render('index', { bundles: [], user: req.session.user || null });
    }
});

// REGISTER
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    try {
        const { fullname, phone, password } = req.body;

        const existingUser = await User.findOne({ phone: phone });
        if (existingUser) {
            return res.render('register', { error: 'Phone number already registered!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            fullname,
            phone,
            password: hashedPassword,
            totalPurchases: 0
        });

        req.session.user = { fullname: newUser.fullname, phone: newUser.phone };
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Register error:', error);
        res.render('register', { error: 'Registration failed. Please try again.' });
    }
});

// LOGIN
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;

        const user = await User.findOne({ phone: phone });
        if (!user) {
            return res.render('login', { error: 'Phone number not found!' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.render('login', { error: 'Incorrect password!' });
        }

        req.session.user = { fullname: user.fullname, phone: user.phone };
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { error: 'Login failed. Please try again.' });
    }
});

// DASHBOARD
app.get('/dashboard', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const allBundles = PLANS.map((plan, index) => ({
            id: index + 1,
            name: plan.gb + 'GB SME Bundle',
            price: plan.price,
            originalPrice: plan.originalPrice,
            data: plan.gb + 'GB'
        }));

        const userTransactions = await Transaction.find({ phone: req.session.user.phone }).sort({ date: -1 });
        const user = await User.findOne({ phone: req.session.user.phone });

        let bonusEligible = false;
        let bonusMessage = '';

        if (user) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weeklyPurchases = await Transaction.countDocuments({
                phone: user.phone,
                date: { $gt: weekAgo },
                status: 'completed'
            });

            if (weeklyPurchases >= 3) {
                bonusEligible = true;
                bonusMessage = req.session.lang === 'sw'
                    ? '🎉 Umefanya manunuzi ' + weeklyPurchases + ' wiki hii! Unastahili bonasi ya 2000 TZS!'
                    : '🎉 You\'ve made ' + weeklyPurchases + ' purchases this week! You qualify for a 2000 TZS bonus!';
            } else {
                bonusMessage = req.session.lang === 'sw'
                    ? '💪 Fanya manunuzi ' + (3 - weeklyPurchases) + ' zaidi wiki hii kupata bonasi ya 2000 TZS!'
                    : '💪 Make ' + (3 - weeklyPurchases) + ' more purchase(s) this week to earn 2000 TZS bonus!';
            }
        }

        res.render('dashboard', {
            user: req.session.user,
            bundles: allBundles,
            transactions: userTransactions.slice(0, 10),
            bonusEligible: bonusEligible,
            bonusMessage: bonusMessage
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('dashboard', {
            user: req.session.user,
            bundles: [],
            transactions: [],
            bonusEligible: false,
            bonusMessage: ''
        });
    }
});

// BUY BUNDLE
app.post('/buy', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const bundleId = parseInt(req.body.bundleId);
    const plan = PLANS[bundleId - 1] || PLANS[0];
    const transactionId = uuidv4().substring(0, 8).toUpperCase();

    res.render('payment', {
        user: req.session.user,
        bundle: {
            id: bundleId,
            gb: plan.gb,
            name: plan.gb + 'GB SME Bundle',
            price: plan.price,
            originalPrice: plan.originalPrice,
            data: plan.gb + 'GB'
        },
        providers: PROVIDERS,
        transactionId: transactionId,
        error: null,
        success: null
    });
});

// PROCESS PAYMENT
app.post('/process-payment', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { planGb, planPrice, planType, planLabel, paymentMethod, phoneNumber, providerName } = req.body;

    if (!planGb || !planPrice) {
        return res.redirect('/dashboard');
    }

    const transactionId = uuidv4().substring(0, 8).toUpperCase();

    const bundle = {
        id: parseInt(planGb),
        name: planLabel || (planGb + 'GB Bundle'),
        price: parseInt(planPrice),
        originalPrice: parseInt(planPrice),
        data: planGb + 'GB',
        type: planType,
        provider: providerName
    };

    if (!phoneNumber || phoneNumber.length < 10) {
        return res.render('payment', {
            user: req.session.user,
            bundle: bundle,
            providers: PROVIDERS,
            transactionId: transactionId,
            error: 'Please enter a valid phone number',
            success: null
        });
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const confirmationCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        const transaction = await Transaction.create({
            id: transactionId,
            phone: req.session.user.phone,
            bundleName: bundle.name,
            amount: bundle.price,
            paymentMethod: paymentMethod,
            provider: providerName,
            planType: planType,
            status: 'completed',
            confirmationCode: confirmationCode,
            delivered: true
        });

        await User.updateOne(
            { phone: req.session.user.phone },
            { $inc: { totalPurchases: 1 }, $set: { lastPurchaseDate: new Date() } }
        );

        res.render('payment-success', {
            user: req.session.user,
            bundle: bundle,
            transaction: transaction,
            phoneNumber: phoneNumber
        });

    } catch (error) {
        console.error('Payment error:', error);
        res.render('payment', {
            user: req.session.user,
            bundle: bundle,
            providers: PROVIDERS,
            transactionId: transactionId,
            error: 'Payment failed. Please try again.',
            success: null
        });
    }
});

// TRANSACTIONS HISTORY
app.get('/transactions', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const userTransactions = await Transaction.find({ phone: req.session.user.phone }).sort({ date: -1 });
        res.render('transactions', {
            user: req.session.user,
            transactions: userTransactions
        });
    } catch (error) {
        console.error('Transactions error:', error);
        res.render('transactions', {
            user: req.session.user,
            transactions: []
        });
    }
});

// ========== SETTINGS ==========
app.get('/settings', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findOne({ phone: req.session.user.phone });
        if (!user) return res.redirect('/login');

        const userTransactions = await Transaction.find({ phone: user.phone });
        const totalSpent = userTransactions
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + t.amount, 0);

        res.render('settings', {
            user: req.session.user,
            userDetails: user,
            totalSpent: totalSpent,
            totalPurchases: userTransactions.filter(t => t.status === 'completed').length,
            memberSince: user.createdAt,
            error: req.query.error || null,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Settings error:', error);
        res.redirect('/dashboard');
    }
});

app.post('/settings/profile', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const { fullname } = req.body;

        if (!fullname || fullname.trim().length < 3) {
            return res.redirect('/settings?error=invalidname');
        }

        await User.updateOne(
            { phone: req.session.user.phone },
            { $set: { fullname: fullname.trim() } }
        );

        req.session.user.fullname = fullname.trim();
        res.redirect('/settings?success=profile');
    } catch (error) {
        console.error('Profile update error:', error);
        res.redirect('/settings?error=updatefail');
    }
});

app.post('/settings/password', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findOne({ phone: req.session.user.phone });

        if (!user) return res.redirect('/login');

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.redirect('/settings?error=wrongpassword');
        }

        if (!newPassword || newPassword.length < 6) {
            return res.redirect('/settings?error=shortpassword');
        }

        if (newPassword !== confirmPassword) {
            return res.redirect('/settings?error=mismatch');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.redirect('/settings?success=password');
    } catch (error) {
        console.error('Password change error:', error);
        res.redirect('/settings?error=updatefail');
    }
});

// ========== ADMIN PORTAL ==========
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Shamba@2026#Admin';

app.get('/admin', async (req, res) => {
    if (req.session.isAdmin) {
        try {
            const allTransactions = await Transaction.find().sort({ date: -1 });
            const totalRevenue = allTransactions
                .filter(t => t.status === 'completed')
                .reduce((sum, t) => sum + t.amount, 0);
            const totalUsers = await User.countDocuments();
            const totalSales = allTransactions.filter(t => t.status === 'completed').length;

            return res.render('admin', {
                transactions: allTransactions,
                totalRevenue: totalRevenue,
                totalUsers: totalUsers,
                totalSales: totalSales
            });
        } catch (error) {
            console.error('Admin error:', error);
            return res.render('admin', {
                transactions: [],
                totalRevenue: 0,
                totalUsers: 0,
                totalSales: 0
            });
        }
    }
    res.render('admin-login', { error: null });
});

app.post('/admin-login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('admin-login', {
            error: req.session.lang === 'sw' ? 'Nenosiri lisilo sahihi!' : 'Incorrect password!'
        });
    }
});

app.get('/admin-logout', (req, res) => {
    req.session.isAdmin = false;
    res.redirect('/');
});

// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// DEBUG
app.get('/debug-lang', (req, res) => {
    res.json({
        sessionLang: req.session.lang,
        localsLang: res.locals.lang,
        mongoConnected: mongoose.connection.readyState === 1,
        user: req.session.user ? req.session.user.phone : 'not logged in'
    });
});

// ========== START SERVER ==========
app.listen(port, () => {
    console.log('🚀 SME Bundle App running at http://localhost:' + port);
    console.log('📱 Made in Tanzania! 🇹🇿');
    console.log('💳 Payment system ready');
});