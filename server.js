// ========== IMPORTS ==========
require('dotenv').config();
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
    mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected successfully');
        seedNetworkPrices();   // ← Add this line
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
    });

// ========== DATABASE SCHEMAS ==========
const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    totalPurchases: { type: Number, default: 0 },
    lastPurchaseDate: { type: Date },
    lastBonusDate: { type: Date, default: null },
    totalBonusGb: { type: Number, default: 0 },
    bonusUnlockedAt: { type: Date, default: null },
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    referralRewarded: { type: Boolean, default: false },
    referralRewards: { type: Number, default: 0 },
    savedNumbers: [{
        nickname: { type: String, required: true },
        phone: { type: String, required: true },
        addedAt: { type: Date, default: Date.now }
    }]
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
const bonusLogSchema = new mongoose.Schema({
    phone: { type: String, required: true, index: true },
    fullname: { type: String },
    bundleName: { type: String, required: true },
    bundleGb: { type: Number, required: true },
    reason: { type: String, default: 'weekly_loyalty' },
    sentBy: { type: String, default: 'admin' },  // 'admin' or 'system'
    autoSent: { type: Boolean, default: false },  // NEW
    date: { type: Date, default: Date.now }
});

const referralLogSchema = new mongoose.Schema({
    referrerPhone: { type: String, required: true, index: true },
    referrerName: { type: String },
    newUserPhone: { type: String, required: true },
    newUserName: { type: String },
    rewardMb: { type: Number, default: 100 },
    date: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'info' }, // info, success, warning
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});    

const flashSaleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    discountPercent: { type: Number, required: true, min: 1, max: 90 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    active: { type: Boolean, default: true },
    // Optional: target only certain plans
    targetBundleType: { type: String, default: 'all' }, // 'all', 'small', 'big', 'combo'
    createdAt: { type: Date, default: Date.now },
    // Track performance
    transactionCount: { type: Number, default: 0 },
    revenueGenerated: { type: Number, default: 0 }
});
// ========== NETWORK PRICES (Admin-Editable) ==========
const networkPriceSchema = new mongoose.Schema({
    networkId: { type: String, required: true, unique: true },
    networkName: String,
    logo: String,
    paymentMethod: String,
    smallPlans: [{
        gb: Number,
        price: Number,      // selling price
        cost: { type: Number, default: 0 },  // wholesale cost (for profit calc)
        note: String
    }],
    dataPlans: [{
        gb: Number,
        price: Number,
        cost: { type: Number, default: 0 },
        note: String
    }],
    updatedAt: { type: Date, default: Date.now }
});

// Seed default prices if none exist
async function seedNetworkPrices() {
    try {
        const count = await NetworkPrice.countDocuments();
        if (count > 0) return; // Already seeded

        const defaults = [
            {
                networkId: 'yas',
                networkName: 'Yas (Tigo)',
                logo: '/images/Yas.png',
                paymentMethod: 'Tigo Pesa',
                smallPlans: [
                    { gb: 1, price: 1200, cost: 1000, note: '1GB' },
                    { gb: 2, price: 2400, cost: 2000, note: '2GB' },
                    { gb: 3, price: 3600, cost: 3000, note: '3GB' },
                    { gb: 5, price: 6000, cost: 5000, note: '5GB' },
                    { gb: 10, price: 12000, cost: 10000, note: '10GB' }
                ],
                dataPlans: [
                    { gb: 15, price: 15000, cost: 13000, note: 'Kila Mwezi' },
                    { gb: 35, price: 30000, cost: 26000, note: 'Kila Mwezi' },
                    { gb: 48, price: 40000, cost: 35000, note: 'Kila Mwezi' }
                ]
            },
            {
                networkId: 'halotel',
                networkName: 'Halotel',
                logo: '/images/Halotel.png',
                paymentMethod: 'Halopesa',
                smallPlans: [
                    { gb: 1, price: 1200, cost: 1000, note: '1GB' },
                    { gb: 2, price: 2400, cost: 2000, note: '2GB' },
                    { gb: 3, price: 3600, cost: 3000, note: '3GB' },
                    { gb: 5, price: 6000, cost: 5000, note: '5GB' },
                    { gb: 10, price: 12000, cost: 10000, note: '10GB' }
                ],
                dataPlans: [
                    { gb: 5,  price: 6000,  cost: 5500, note: 'Internet Bundle' },
                    { gb: 6,  price: 7000,  cost: 6400, note: 'Internet Bundle' },
                    { gb: 7,  price: 8000,  cost: 7300, note: 'Internet Bundle' },
                    { gb: 8,  price: 9000,  cost: 8200, note: 'Internet Bundle' },
                    { gb: 9,  price: 10000, cost: 9100, note: 'Internet Bundle' },
                    { gb: 10, price: 11000, cost: 10000, note: 'Internet Bundle' },
                    { gb: 15, price: 15000, cost: 13700, note: 'Internet Bundle' },
                    { gb: 20, price: 20000, cost: 18300, note: 'Internet Bundle' },
                    { gb: 25, price: 25000, cost: 22900, note: 'Internet Bundle' },
                    { gb: 30, price: 30000, cost: 27500, note: 'Internet Bundle' }
                ]
            },
            {
                networkId: 'airtel',
                networkName: 'Airtel',
                logo: '/images/Airtel.png',
                paymentMethod: 'AirtelMoney',
                smallPlans: [
                    { gb: 1, price: 1200, cost: 1000, note: '1GB' },
                    { gb: 2, price: 2400, cost: 2000, note: '2GB' },
                    { gb: 3, price: 3600, cost: 3000, note: '3GB' },
                    { gb: 5, price: 6000, cost: 5000, note: '5GB' },
                    { gb: 10, price: 12000, cost: 10000, note: '10GB' }
                ],
                dataPlans: [
                    { gb: 5,  price: 5000,  cost: 4500, note: 'Data Bundle' },
                    { gb: 10, price: 10000, cost: 9000, note: 'Data Bundle' },
                    { gb: 20, price: 20000, cost: 18000, note: 'Data Bundle' },
                    { gb: 30, price: 30000, cost: 27000, note: 'Data Bundle' }
                ]
            },
            {
                networkId: 'vodacom',
                networkName: 'Vodacom',
                logo: '/images/Vodacom.png',
                paymentMethod: 'M-Pesa',
                smallPlans: [
                    { gb: 1, price: 1200, cost: 1000, note: '1GB' },
                    { gb: 2, price: 2400, cost: 2000, note: '2GB' },
                    { gb: 3, price: 3600, cost: 3000, note: '3GB' },
                    { gb: 5, price: 6000, cost: 5000, note: '5GB' },
                    { gb: 10, price: 12000, cost: 10000, note: '10GB' }
                ],
                dataPlans: [
                    { gb: 10,  price: 15000,  cost: 13500, note: 'Siku 30' },
                    { gb: 15,  price: 20000,  cost: 18000, note: 'Siku 30' },
                    { gb: 30,  price: 30000,  cost: 27000, note: 'Siku 30' },
                    { gb: 60,  price: 50000,  cost: 45000, note: 'Siku 30' },
                    { gb: 75,  price: 60000,  cost: 54000, note: 'Siku 30' },
                    { gb: 100, price: 75000,  cost: 67500, note: 'Siku 30' },
                    { gb: 150, price: 100000, cost: 90000, note: 'Siku 30' }
                ]
            }
        ];

        await NetworkPrice.insertMany(defaults);
        console.log('✅ Seeded network prices');
    } catch (error) {
        console.error('Seed prices error:', error);
    }
}

const NetworkPrice = mongoose.model('NetworkPrice', networkPriceSchema);
const BonusLog = mongoose.model('BonusLog', bonusLogSchema);
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const ReferralLog = mongoose.model('ReferralLog', referralLogSchema);
const FlashSale = mongoose.model('FlashSale', flashSaleSchema);

// ========== BONUS HELPER FUNCTIONS ==========
async function checkBonusUnlock(user) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const count = await Transaction.countDocuments({
        phone: user.phone,
        date: { $gt: weekAgo },
        status: 'completed'
    });

    if (count < 5) return { unlocked: false, count: count };

    // Check if user already got bonus in last 7 days
    const recentBonus = await BonusLog.findOne({
        phone: user.phone,
        date: { $gt: weekAgo }
    });

    if (recentBonus) return { unlocked: false, count: count, alreadySent: true };

    // Eligible but not sent — unlock if not already unlocked
    if (!user.bonusUnlockedAt) {
        const now = new Date();
        await User.updateOne(
            { phone: user.phone },
            { $set: { bonusUnlockedAt: now } }
        );
        return { unlocked: true, unlockedAt: now, count: count };
    }

    return { unlocked: true, unlockedAt: user.bonusUnlockedAt, count: count };
}
// Helper: get currently active flash sale
async function getActiveFlashSale() {
    const now = new Date();
    return await FlashSale.findOne({
        active: true,
        startTime: { $lte: now },
        endTime: { $gte: now }
    });
}
// Auto-send bonuses older than 24 hours
async function autoSendPendingBonuses() {
    try {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const pendingUsers = await User.find({
            bonusUnlockedAt: { $lt: twentyFourHoursAgo, $ne: null }
        });

        for (const user of pendingUsers) {
            // Double-check no bonus was sent since unlock
            const recentBonus = await BonusLog.findOne({
                phone: user.phone,
                date: { $gt: user.bonusUnlockedAt }
            });

            if (!recentBonus) {
                await BonusLog.create({
                    phone: user.phone,
                    fullname: user.fullname,
                    bundleName: '2GB Loyalty Bonus (Auto)',
                    bundleGb: 2,
                    reason: 'auto_send_after_24h',
                    sentBy: 'system',
                    autoSent: true
                });

                await User.updateOne(
                    { phone: user.phone },
                    {
                        $set: {
                            lastBonusDate: new Date(),
                            bonusUnlockedAt: null
                        },
                        $inc: { totalBonusGb: 2 }
                    }
                );

                console.log(`🤖 Auto-sent 2GB bonus to ${user.phone} (${user.fullname})`);
            }
        }
    } catch (error) {
        console.error('Auto-send bonus error:', error);
    }
}

// Run auto-send every hour
setInterval(autoSendPendingBonuses, 60 * 60 * 1000);

// ========== REFERRAL CODE GENERATOR ==========
function generateReferralCode(fullname, phone) {
    const namePart = fullname
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 3)
        .toUpperCase() || 'SME';
    const phonePart = phone.slice(-4);
    return `${namePart}${phonePart}`;
}

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
    req.session.save(() => {
        res.json({ success: true, lang: req.session.lang });
    });
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
    res.render('register', { 
        error: null, 
        refCode: req.query.ref || '' 
    });
});
app.post('/register', async (req, res) => {
    try {
        const { fullname, phone, password, refCode } = req.body;

        const existingUser = await User.findOne({ phone: phone });
        if (existingUser) {
            return res.render('register', { 
    error: 'Phone number already registered!',
    refCode: refCode || ''
     });
        }

        // Generate unique referral code
        let referralCode = generateReferralCode(fullname, phone);
        let codeExists = await User.findOne({ referralCode });
        let attempts = 0;
        while (codeExists && attempts < 5) {
            referralCode = generateReferralCode(fullname, phone) + Math.floor(Math.random() * 10);
            codeExists = await User.findOne({ referralCode });
            attempts++;
        }

        // Check if referred by someone
        let referredBy = null;
        let referrerName = null;
        if (refCode && refCode.trim()) {
            const referrer = await User.findOne({ referralCode: refCode.trim().toUpperCase() });
            if (referrer && referrer.phone !== phone) {
                referredBy = referrer.phone;
                referrerName = referrer.fullname;
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            fullname,
            phone,
            password: hashedPassword,
            referralCode: referralCode,
            referredBy: referredBy,
            totalPurchases: 0
        });

        // Log the referral (but don't reward yet — only after first purchase)
        if (referredBy) {
            console.log(`🔗 ${fullname} (${phone}) was referred by ${referrerName} (${referredBy})`);
        }

        req.session.user = { fullname: newUser.fullname, phone: newUser.phone };
        req.session.save((err) => {
        if (err) {
        console.error('Session save error:', err);
        return res.render('register', { error: 'Session error. Please try again.', refCode: refCode || '' });
    }
    res.redirect('/dashboard');
});
    } catch (error) {
        console.error('Register error:', error);
        res.render('register', {
    error: 'Registration failed. Please try again.',
    refCode: refCode || ''
         });
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
req.session.save((err) => {
    if (err) {
        console.error('Session save error:', err);
        return res.render('login', { error: 'Session error. Please try again.' });
    }
    res.redirect('/dashboard');
});
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
        // 1. Get flash sale FIRST (before using it)
        const flashSale = await getActiveFlashSale();

        // 2. Build bundles with flash sale discount applied
        const allBundles = PLANS.map((plan, index) => {
            let price = plan.price;
            let isOnSale = false;

            if (flashSale) {
                price = Math.round(plan.price * (1 - flashSale.discountPercent / 100) / 50) * 50;
                isOnSale = true;
            }

            return {
                id: index + 1,
                name: plan.gb + 'GB SME Bundle',
                price: price,
                originalPrice: plan.originalPrice,
                data: plan.gb + 'GB',
                isOnSale: isOnSale,
                saleOriginalPrice: plan.price,
                discountPercent: flashSale ? flashSale.discountPercent : 0
            };
        });

        // 3. Get user transactions
        const userTransactions = await Transaction.find({ phone: req.session.user.phone }).sort({ date: -1 });
        const user = await User.findOne({ phone: req.session.user.phone });

        // 4. Check bonus unlock
        let bonusStatus = { unlocked: false };
        if (user) {
            bonusStatus = await checkBonusUnlock(user);
        }

        // 5. Get active announcements
        const announcements = await Announcement.find({ active: true }).sort({ createdAt: -1 }).limit(5);

        // 6. Get referral stats
        const referralStats = {
            code: user ? user.referralCode : null,
            count: user ? user.referralCount : 0,
            progress: user ? user.referralProgress : 0,
            rewarded: user ? user.referralRewarded100MB : false
        };

        // 7. Render
        res.render('dashboard', {
            user: req.session.user,
            bundles: allBundles,
            transactions: userTransactions.slice(0, 10),
            bonusStatus: bonusStatus,
            announcements: announcements,
            referralStats: referralStats,
            flashSale: flashSale
        });

    } catch (error) {
        console.error('Dashboard error:', error);

        // Fallback: build bundles without flash sale
        const fallbackBundles = PLANS.map((plan, index) => ({
            id: index + 1,
            name: plan.gb + 'GB SME Bundle',
            price: plan.price,
            originalPrice: plan.originalPrice,
            data: plan.gb + 'GB',
            isOnSale: false,
            saleOriginalPrice: plan.price,
            discountPercent: 0
        }));

        res.render('dashboard', {
            user: req.session.user,
            bundles: fallbackBundles,
            transactions: [],
            bonusStatus: { unlocked: false },
            announcements: [],
            referralStats: { code: null, count: 0, progress: 0, rewarded: false },
            flashSale: null
        });
    }
});

// BUY BUNDLE
app.post('/buy', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const bundleId = parseInt(req.body.bundleId);
        const plan = PLANS[bundleId - 1] || PLANS[0];
        const transactionId = uuidv4().substring(0, 8).toUpperCase();

        // Load network prices from DB
        const networkPrices = await NetworkPrice.find();
        const user = await User.findOne({ phone: req.session.user.phone });

        // Build the network plan object
        const networkPlansData = {};
        networkPrices.forEach(n => {
            networkPlansData[n.networkId] = {
                name: n.networkName,
                smallPlans: n.smallPlans,
                dataPlans: n.dataPlans
            };
        });

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
            networkPlansData: networkPlansData,
            transactionId: transactionId,
            savedNumbers: user ? user.savedNumbers : [],
            userPhone: req.session.user.phone,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Buy route error:', error);
        res.redirect('/dashboard');
    }
});

// PROCESS PAYMENT
app.post('/process-payment', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const { planGb, planPrice, planType, planLabel, paymentMethod, phoneNumber, providerName, saveRecipient, recipientNickname } = req.body;

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

        // 1. Create transaction
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

        // 2. Update user's purchase count
        await User.updateOne(
            { phone: req.session.user.phone },
            { $inc: { totalPurchases: 1 }, $set: { lastPurchaseDate: new Date() } }
        );

        // 3. Referral reward logic
        const purchaser = await User.findOne({ phone: req.session.user.phone });

        if (purchaser && purchaser.referredBy && !purchaser.referralRewarded) {
            const referrer = await User.findOne({ phone: purchaser.referredBy });
            if (referrer) {
                await ReferralLog.create({
                    referrerPhone: referrer.phone,
                    referrerName: referrer.fullname,
                    newUserPhone: purchaser.phone,
                    newUserName: purchaser.fullname,
                    rewardMb: 100
                });

                await User.updateOne(
                    { phone: referrer.phone },
                    { $inc: { referralCount: 1, referralRewards: 1 } }
                );

                await User.updateOne(
                    { phone: purchaser.phone },
                    { $set: { referralRewarded: true } }
                );

                console.log(`🎁 Referral reward: 100MB to ${referrer.fullname} and ${purchaser.fullname}`);
            }
        }

        // 4. Save recipient if requested (DATA GIFTING) — MOVED INSIDE
        if (saveRecipient === 'yes' && recipientNickname && recipientNickname.trim()) {
            const buyer = await User.findOne({ phone: req.session.user.phone });
            if (buyer && buyer.savedNumbers.length < 15) {
                const isDuplicate = buyer.savedNumbers.some(n => n.phone === phoneNumber);
                if (!isDuplicate && phoneNumber !== req.session.user.phone) {
                    buyer.savedNumbers.push({
                        nickname: recipientNickname.trim(),
                        phone: phoneNumber
                    });
                    await buyer.save();
                    console.log(`💾 Saved recipient: ${recipientNickname} (${phoneNumber})`);
                }
            }
        }

        // 5. Render success page
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

// ========== SAVED NUMBERS (DATA GIFTING) ==========
app.post('/settings/saved-numbers/add', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const { nickname, phone } = req.body;

        if (!nickname || !phone || phone.length < 10) {
            return res.redirect('/settings?error=invalidnumber');
        }

        const user = await User.findOne({ phone: req.session.user.phone });
        if (!user) return res.redirect('/login');

            if (user.savedNumbers.length >= 15) {
        return res.redirect('/settings?error=maxnumbers');
    }

        user.savedNumbers.push({
            nickname: nickname.trim(),
            phone: phone.trim()
        });

        await user.save();
        res.redirect('/settings?success=numberadded');
    } catch (error) {
        console.error('Add number error:', error);
        res.redirect('/settings?error=addfailed');
    }
});

app.post('/settings/saved-numbers/delete/:index', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    try {
        const index = parseInt(req.params.index);
        const user = await User.findOne({ phone: req.session.user.phone });
        if (!user) return res.redirect('/login');

        if (index >= 0 && index < user.savedNumbers.length) {
            user.savedNumbers.splice(index, 1);
            await user.save();
        }

        res.redirect('/settings?success=numberdeleted');
    } catch (error) {
        console.error('Delete number error:', error);
        res.redirect('/settings?error=deletefailed');
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
// ========== ADMIN BONUS MANAGEMENT ==========
app.get('/admin/bonuses', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }

    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // 1. Get users with 5+ completed transactions this week
        const weeklyStats = await Transaction.aggregate([
            { $match: { date: { $gt: weekAgo }, status: 'completed' } },
            { $group: { _id: '$phone', count: { $sum: 1 }, totalSpent: { $sum: '$amount' } } },
            { $match: { count: { $gte: 5 } } },
            { $sort: { count: -1 } }
        ]);

        // 2. Get phones of users who already got bonus this week
        const recentBonuses = await BonusLog.find({ date: { $gt: weekAgo } }).select('phone');
        const alreadyGot = new Set(recentBonuses.map(b => b.phone));

        // 3. Get user details for eligible ones
        const eligiblePhones = weeklyStats.filter(s => !alreadyGot.has(s._id)).map(s => s._id);
        const users = await User.find({ phone: { $in: eligiblePhones } });

        const eligible = weeklyStats
            .filter(s => !alreadyGot.has(s._id))
            .map(s => {
                const u = users.find(x => x.phone === s._id);
                return {
                    phone: s._id,
                    fullname: u ? u.fullname : 'Unknown',
                    transactionCount: s.count,
                    totalSpent: s.totalSpent,
                    lastBonusDate: u ? u.lastBonusDate : null
                };
            });

        // 4. Get recent bonus history
        const bonusHistory = await BonusLog.find().sort({ date: -1 }).limit(50);

        res.render('admin-bonuses', {
            eligible: eligible,
            bonusHistory: bonusHistory,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Admin bonus error:', error);
        res.render('admin-bonuses', {
            eligible: [],
            bonusHistory: [],
            success: null,
            error: 'Failed to load bonus data'
        });
    }
});

// Send 2GB bonus
app.post('/admin/send-bonus', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }

    try {
        const { phone, fullname } = req.body;

        const user = await User.findOne({ phone: phone });
        if (!user) {
            return res.redirect('/admin/bonuses?error=UserNotFound');
        }

        // Record bonus
        await BonusLog.create({
            phone: phone,
            fullname: fullname || user.fullname,
            bundleName: '2GB Loyalty Bonus',
            bundleGb: 2,
            reason: 'weekly_loyalty',
            sentBy: 'admin'
        });

        // Update user record
        await User.updateOne(
            { phone: phone },
            { $set: { lastBonusDate: new Date() }, $inc: { totalBonusGb: 2 } }
        );

        console.log(`🎁 Bonus 2GB sent to ${phone} (${fullname || user.fullname})`);

        // TODO: Trigger SIM automation to actually send the bundle
        // For now, this is just logged

        res.redirect('/admin/bonuses?success=BonusSent');
    } catch (error) {
        console.error('Send bonus error:', error);
        res.redirect('/admin/bonuses?error=SendFailed');
    }
});
// ========== ADMIN ANNOUNCEMENTS ==========
app.get('/admin/announcements', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }

    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 });
        res.render('admin-announcements', {
            announcements: announcements,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Announcements error:', error);
        res.render('admin-announcements', {
            announcements: [],
            success: null,
            error: 'Failed to load announcements'
        });
    }
});

app.post('/admin/announcements/create', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin');

    try {
        const { title, message, type } = req.body;

        if (!title || !message) {
            return res.redirect('/admin/announcements?error=MissingFields');
        }

        await Announcement.create({
            title: title.trim(),
            message: message.trim(),
            type: type || 'info',
            active: true
        });

        res.redirect('/admin/announcements?success=Created');
    } catch (error) {
        console.error('Create announcement error:', error);
        res.redirect('/admin/announcements?error=CreateFailed');
    }
});

app.post('/admin/announcements/toggle/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin');

    try {
        const announcement = await Announcement.findById(req.params.id);
        if (announcement) {
            announcement.active = !announcement.active;
            await announcement.save();
        }
        res.redirect('/admin/announcements?success=Toggled');
    } catch (error) {
        console.error('Toggle error:', error);
        res.redirect('/admin/announcements?error=ToggleFailed');
    }
});

app.post('/admin/announcements/delete/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin');

    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.redirect('/admin/announcements?success=Deleted');
    } catch (error) {
        console.error('Delete error:', error);
        res.redirect('/admin/announcements?error=DeleteFailed');
    }
});
// ========== ADMIN FLASH SALES ==========
app.get('/admin/flash-sales', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }

    try {
        const sales = await FlashSale.find().sort({ createdAt: -1 });
        const activeSale = await getActiveFlashSale();

        res.render('admin-flash-sales', {
            sales: sales,
            activeSale: activeSale,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error('Flash sales error:', error);
        res.render('admin-flash-sales', {
            sales: [],
            activeSale: null,
            success: null,
            error: 'Failed to load flash sales'
        });
    }
});

app.post('/admin/flash-sales/create', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin');

    try {
        const { name, discountPercent, durationHours } = req.body;

        if (!name || !discountPercent || !durationHours) {
            return res.redirect('/admin/flash-sales?error=MissingFields');
        }

        // Deactivate any existing active sale
        await FlashSale.updateMany(
            { active: true },
            { $set: { active: false } }
        );

        const startTime = new Date();
        const endTime = new Date();
        endTime.setHours(endTime.getHours() + parseInt(durationHours));

        await FlashSale.create({
            name: name.trim(),
            discountPercent: parseInt(discountPercent),
            startTime: startTime,
            endTime: endTime,
            active: true
        });

        res.redirect('/admin/flash-sales?success=Created');
    } catch (error) {
        console.error('Create flash sale error:', error);
        res.redirect('/admin/flash-sales?error=CreateFailed');
    }
});

app.post('/admin/flash-sales/stop/:id', async (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin');

    try {
        await FlashSale.updateOne(
            { _id: req.params.id },
            { $set: { active: false, endTime: new Date() } }
        );
        res.redirect('/admin/flash-sales?success=Stopped');
    } catch (error) {
        console.error('Stop flash sale error:', error);
        res.redirect('/admin/flash-sales?error=StopFailed');
    }
});
// ========== ADMIN PRICES ==========
app.get('/admin/prices', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }

    try {
        const networks = await NetworkPrice.find().sort({ networkId: 1 });
        res.render('admin-prices', {
            networks: networks,
            success: req.query.success || null
        });
    } catch (error) {
        console.error('Prices page error:', error);
        res.redirect('/admin');
    }
});

app.post('/admin/prices/save', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }

    try {
        const networks = await NetworkPrice.find().sort({ networkId: 1 });

        for (let netIndex = 0; netIndex < networks.length; netIndex++) {
            const network = networks[netIndex];

            // Update small plans
            for (let planIndex = 0; planIndex < network.smallPlans.length; planIndex++) {
                const priceKey = `network_${netIndex}_small_${planIndex}_price`;
                const costKey = `network_${netIndex}_small_${planIndex}_cost`;
                if (req.body[priceKey]) network.smallPlans[planIndex].price = parseInt(req.body[priceKey]);
                if (req.body[costKey]) network.smallPlans[planIndex].cost = parseInt(req.body[costKey]);
            }

            // Update data plans
            for (let planIndex = 0; planIndex < network.dataPlans.length; planIndex++) {
                const priceKey = `network_${netIndex}_data_${planIndex}_price`;
                const costKey = `network_${netIndex}_data_${planIndex}_cost`;
                if (req.body[priceKey]) network.dataPlans[planIndex].price = parseInt(req.body[priceKey]);
                if (req.body[costKey]) network.dataPlans[planIndex].cost = parseInt(req.body[costKey]);
            }

            network.updatedAt = new Date();
            network.markModified('smallPlans');
            network.markModified('dataPlans');
            await network.save();
        }

        res.redirect('/admin/prices?success=1');
    } catch (error) {
        console.error('Save prices error:', error);
        res.redirect('/admin/prices');
    }
});
 //=============ADMIN REFERRALS===============//
app.get('/admin/referrals', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }

    try {
        const topReferrers = await User.find({ referralCount: { $gt: 0 } })
            .sort({ referralCount: -1 })
            .limit(20);
        
        const recentReferrals = await ReferralLog.find()
            .sort({ date: -1 })
            .limit(50);

        const totalReferrals = await ReferralLog.countDocuments();

        res.render('admin-referrals', {
            topReferrers: topReferrers,
            recentReferrals: recentReferrals,
            totalReferrals: totalReferrals
        });
    } catch (error) {
        console.error('Admin referrals error:', error);
        res.render('admin-referrals', {
            topReferrers: [],
            recentReferrals: [],
            totalReferrals: 0
        });
    }
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