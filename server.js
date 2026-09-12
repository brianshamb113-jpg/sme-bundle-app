const { PLANS, PROVIDERS } = require('./config/plans');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = process.env.PORT || 3000;
const bundleService = require('./services/bundleService');

// DEBUG - Remove these two lines later
console.log('🔍 PLANS loaded:', PLANS ? PLANS.length + ' plans' : 'UNDEFINED!');
console.log('🔍 PROVIDERS loaded:', PROVIDERS ? PROVIDERS.length + ' providers' : 'UNDEFINED!');

// Set up view engine
app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// ========== SESSION SETUP ==========
app.use(session({
    secret: 'sme-bundle-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ========== LANGUAGE MIDDLEWARE ==========
app.use((req, res, next) => {
    // If no language is set, default to Swahili
    if (!req.session.lang) {
        req.session.lang = 'sw';
    }
    // Make language available in all views
    res.locals.lang = req.session.lang;
    res.locals.plans = PLANS;          // <-- NEW: Available everywhere
    res.locals.providers = PROVIDERS;  // <-- NEW: Available everywhere
    next();
});

// ========== LANGUAGE TOGGLE ROUTE (BULLETPROOF) ==========
app.get('/toggle-language', (req, res) => {
    // Toggle language
    req.session.lang = req.session.lang === 'sw' ? 'en' : 'sw';
    res.locals.lang = req.session.lang;
    
    // If there's a referer, go back to it, otherwise go home
    const referer = req.headers.referer || '/';
    
    // If referer is the toggle route itself (shouldn't happen), go home
    if (referer.includes('/toggle-language')) {
        return res.redirect('/');
    }
    
    res.redirect(referer);
});

// ========== TEMPORARY IN-MEMORY DATABASE ==========
const users = [];
const transactions = [];
const bundles = [
    { id: 1, name: '1GB SME Bundle', price: 1200, originalPrice: 2100, data: '1GB' },
    { id: 2, name: '2GB SME Bundle', price: 2200, originalPrice: 4000, data: '2GB' },
    { id: 3, name: '5GB SME Bundle', price: 5000, originalPrice: 9000, data: '5GB' }
];

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
        res.render('index', { 
            bundles: [],
            user: req.session.user || null
        });
    }
});

// REGISTER
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    const { fullname, phone, password } = req.body;
    
    const existingUser = users.find(u => u.phone === phone);
    if (existingUser) {
        return res.render('register', { error: 'Phone number already registered!' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    users.push({
        fullname,
        phone,
        password: hashedPassword,
        createdAt: new Date(),
        totalPurchases: 0,
        weeklyPurchases: 0,
        lastPurchaseDate: new Date()
    });
    
    req.session.user = { fullname, phone };
    res.redirect('/dashboard');
});

// LOGIN
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    
    const user = users.find(u => u.phone === phone);
    if (!user) {
        return res.render('login', { error: 'Phone number not found!' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.render('login', { error: 'Incorrect password!' });
    }
    
    req.session.user = { fullname: user.fullname, phone: user.phone };
    res.redirect('/dashboard');
});

// DASHBOARD (ONLY ONCE!)
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    // Build bundles from PLANS
    const allBundles = PLANS.map((plan, index) => ({
        id: index + 1,
        name: `${plan.gb}GB SME Bundle`,
        price: plan.price,
        originalPrice: plan.originalPrice,
        data: `${plan.gb}GB`
    }));
    
    const userTransactions = transactions.filter(t => t.phone === req.session.user.phone);
    const user = users.find(u => u.phone === req.session.user.phone);
    let bonusEligible = false;
    let bonusMessage = '';
    
    if (user) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weeklyPurchases = transactions.filter(t => 
            t.phone === user.phone && 
            new Date(t.date) > weekAgo &&
            t.status === 'completed'
        );
        
        if (weeklyPurchases.length >= 3) {
            bonusEligible = true;
            bonusMessage = req.session.lang === 'sw' ? 
                `🎉 Umefanya manunuzi ${weeklyPurchases.length} wiki hii! Unastahili bonasi ya 2000 TZS!` :
                `🎉 You've made ${weeklyPurchases.length} purchases this week! You qualify for a 2000 TZS bonus!`;
        } else {
            bonusMessage = req.session.lang === 'sw' ?
                `💪 Fanya manunuzi ${3 - weeklyPurchases.length} zaidi wiki hii kupata bonasi ya 2000 TZS!` :
                `💪 Make ${3 - weeklyPurchases.length} more purchase(s) this week to earn 2000 TZS bonus!`;
        }
    }
    
    res.render('dashboard', { 
        user: req.session.user,
        bundles: allBundles,
        transactions: userTransactions.slice(-10),
        bonusEligible: bonusEligible,
        bonusMessage: bonusMessage
    });
});

// ========== PAYMENT ROUTES ==========
// BUY BUNDLE - Show payment page
app.post('/buy', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const bundleId = parseInt(req.body.bundleId);
    const bundle = PLANS.find((p, i) => (i + 1) === bundleId) || PLANS[0];
    const transactionId = uuidv4().substring(0, 8).toUpperCase();
    
    console.log('🔍 DEBUG - Buy Now clicked. PLANS:', PLANS.length, 'PROVIDERS:', PROVIDERS.length);
    
    res.render('payment', {
        user: req.session.user,
        bundle: {
            id: bundle.gb,
            name: bundle.gb + 'GB SME Bundle',
            price: bundle.price,
            originalPrice: bundle.originalPrice,
            data: bundle.gb + 'GB'
        },
        plans: PLANS,
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
    
    const { planGb, paymentMethod, phoneNumber, providerName } = req.body;
    const selectedPlan = PLANS.find(p => p.gb === parseInt(planGb));
    
    if (!selectedPlan) {
        return res.redirect('/dashboard');
    }
    
    const bundle = {
        id: selectedPlan.gb,
        name: `${selectedPlan.gb}GB SME Bundle`,
        price: selectedPlan.price,
        originalPrice: selectedPlan.originalPrice,
        data: `${selectedPlan.gb}GB`
    };
    
    const transactionId = uuidv4().substring(0, 8).toUpperCase();
    
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const confirmationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        const transaction = {
            id: transactionId,
            phone: req.session.user.phone,
            bundleName: bundle.name,
            amount: bundle.price,
            paymentMethod: paymentMethod,
            provider: providerName || paymentMethod,
            date: new Date(),
            status: 'completed',
            confirmationCode: confirmationCode,
            delivered: true
        };
        transactions.push(transaction);
        
        const user = users.find(u => u.phone === req.session.user.phone);
        if (user) {
            user.totalPurchases += 1;
            user.lastPurchaseDate = new Date();
        }
        
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
            plans: PLANS,
            providers: PROVIDERS,
            transactionId: transactionId,
            error: 'Payment failed. Please try again.',
            success: null
        });
    }
});
// TRANSACTION HISTORY
app.get('/transactions', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const userTransactions = transactions.filter(t => t.phone === req.session.user.phone);
    
    res.render('transactions', {
        user: req.session.user,
        transactions: userTransactions.reverse()
    });
});

// ========== ADMIN PORTAL ==========
const ADMIN_PASSWORD = 'admin123';

app.get('/admin', (req, res) => {
    if (req.session.isAdmin) {
        const allTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        const totalRevenue = allTransactions.reduce((sum, t) => sum + (t.status === 'completed' ? t.amount : 0), 0);
        const totalUsers = users.length;
        const totalSales = allTransactions.filter(t => t.status === 'completed').length;
        
        return res.render('admin', {
            transactions: allTransactions,
            totalRevenue: totalRevenue,
            totalUsers: totalUsers,
            totalSales: totalSales
        });
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
// ========== SETTINGS ==========
app.get('/settings', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const user = users.find(u => u.phone === req.session.user.phone);
    if (!user) {
        return res.redirect('/login');
    }
    
    const userTransactions = transactions.filter(t => t.phone === user.phone);
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
});

// Update profile
app.post('/settings/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const { fullname } = req.body;
    const user = users.find(u => u.phone === req.session.user.phone);
    
    if (!user) {
        return res.redirect('/login');
    }
    
    if (!fullname || fullname.trim().length < 3) {
        return res.render('settings', {
            user: req.session.user,
            userDetails: user,
            totalSpent: 0,
            totalPurchases: 0,
            memberSince: user.createdAt,
            error: req.session.lang === 'sw' ? 'Jina si sahihi!' : 'Invalid name!',
            success: null
        });
    }
    
    user.fullname = fullname.trim();
    req.session.user.fullname = fullname.trim();
    
    res.redirect('/settings?success=profile');
});

// Change password
app.post('/settings/password', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = users.find(u => u.phone === req.session.user.phone);
    
    if (!user) {
        return res.redirect('/login');
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
        return res.redirect('/settings?error=wrongpassword');
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 6) {
        return res.redirect('/settings?error=shortpassword');
    }
    
    if (newPassword !== confirmPassword) {
        return res.redirect('/settings?error=mismatch');
    }
    
    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    
    res.redirect('/settings?success=password');
});
// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ========== DEBUG ROUTE (for testing) ==========
app.get('/debug-lang', (req, res) => {
    res.json({
        sessionLang: req.session.lang,
        localsLang: res.locals.lang,
        user: req.session.user ? req.session.user.phone : 'not logged in'
    });
});

// ========== START SERVER ==========
app.listen(port, () => {
    console.log(`🚀 SME Bundle App running at http://localhost:${port}`);
    console.log(`📱 Made in Tanzania! 🇹🇿`);
    console.log(`💳 Payment system ready (simulation mode)`);
});