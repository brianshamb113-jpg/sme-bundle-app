// config/plans.js

// ============================================
// GENERIC PLANS (used on Dashboard & Homepage)
// ============================================
const PLANS = [
    { gb: 1,  price: 1200,  originalPrice: 2100  },
    { gb: 2,  price: 2400,  originalPrice: 4000  },
    { gb: 3,  price: 3600,  originalPrice: 6000  },
    { gb: 4,  price: 4800,  originalPrice: 8000  },
    { gb: 5,  price: 6000,  originalPrice: 9000  },
    { gb: 6,  price: 7200,  originalPrice: 11000 },
    { gb: 7,  price: 8400,  originalPrice: 13000 },
    { gb: 8,  price: 9600,  originalPrice: 15000 },
    { gb: 9,  price: 10800, originalPrice: 17000 },
    { gb: 10, price: 12000, originalPrice: 19000 }
];

// ============================================
// PROVIDERS (network logos for payment page)
// ============================================
const PROVIDERS = [
    { id: 'yas',     name: 'Yas (Tigo)',  logo: '/images/Yas.png',     paymentMethod: 'Tigo Pesa' },
    { id: 'halotel', name: 'Halotel',     logo: '/images/Halotel.png', paymentMethod: 'Halopesa' },
    { id: 'airtel',  name: 'Airtel',      logo: '/images/Airtel.png',  paymentMethod: 'AirtelMoney' },
    { id: 'vodacom', name: 'Vodacom',     logo: '/images/Vodacom.png', paymentMethod: 'M-Pesa' }
];

// ============================================
// NETWORK-SPECIFIC PLANS (payment page only)
// ============================================
// Edit prices here anytime. Each network has:
//   dataPlans:  data-only bundles
//   comboPlans: data + voice + SMS bundles
// ============================================
const NETWORK_PLANS = {
    yas: {
        displayName: 'Yas (Tigo)',
        dataPlans: [
            { gb: 15, price: 15000, note: 'Kila Mwezi' },
            { gb: 35, price: 30000, note: 'Kila Mwezi' },
            { gb: 48, price: 40000, note: 'Kila Mwezi' }
        ],
        comboPlans: [
            { gb: 10, price: 15000, note: 'Kila Mwezi', extra: 'GB 10 + DK 400' },
            { gb: 25, price: 30000, note: 'Kila Mwezi', extra: 'GB 25 + DK 1000' },
            { gb: 35, price: 40000, note: 'Kila Mwezi', extra: 'GB 35 + DK 2000' }
        ]
    },
    vodacom: {
        displayName: 'Vodacom',
        dataPlans: [
            { gb: 10,  price: 15000,  note: 'Siku 30' },
            { gb: 15,  price: 20000,  note: 'Siku 30' },
            { gb: 30,  price: 30000,  note: 'Siku 30' },
            { gb: 60,  price: 50000,  note: 'Siku 30' },
            { gb: 75,  price: 60000,  note: 'Siku 30' },
            { gb: 100, price: 75000,  note: 'Siku 30' },
            { gb: 150, price: 100000, note: 'Siku 30' }
        ],
        comboPlans: [
            { gb: 7,   price: 15000,  note: 'Siku 30', extra: 'GB 7 + DKK 500 + SMS 100' },
            { gb: 10,  price: 20000,  note: 'Siku 30', extra: 'GB 10 + DKK 1000 + SMS 100' },
            { gb: 20,  price: 30000,  note: 'Siku 30', extra: 'GB 20 + DKK 1500 + SMS 100' },
            { gb: 50,  price: 50000,  note: 'Siku 30', extra: 'GB 50 + DKK 2000 + SMS 100' },
            { gb: 60,  price: 60000,  note: 'Siku 30', extra: 'GB 60 + DKK 3000 + SMS 100' },
            { gb: 80,  price: 75000,  note: 'Siku 30', extra: 'GB 80 + DKK 5000 + SMS 100' },
            { gb: 120, price: 100000, note: 'Siku 30', extra: 'GB 120 + DKK 8000 + SMS 100' }
        ]
    },
    halotel: {
        displayName: 'Halotel',
        dataPlans: [
            { gb: 5,  price: 6000,  note: 'Internet Bundle' },
            { gb: 6,  price: 7000,  note: 'Internet Bundle' },
            { gb: 7,  price: 8000,  note: 'Internet Bundle' },
            { gb: 8,  price: 9000,  note: 'Internet Bundle' },
            { gb: 9,  price: 10000, note: 'Internet Bundle' },
            { gb: 10, price: 11000, note: 'Internet Bundle' },
            { gb: 11, price: 12000, note: 'Internet Bundle' },
            { gb: 12, price: 13000, note: 'Internet Bundle' },
            { gb: 13, price: 14000, note: 'Internet Bundle' },
            { gb: 14, price: 15000, note: 'Internet Bundle' },
            { gb: 15, price: 15000, note: 'Internet Bundle' },
            { gb: 16, price: 16000, note: 'Internet Bundle' },
            { gb: 17, price: 17000, note: 'Internet Bundle' },
            { gb: 18, price: 18000, note: 'Internet Bundle' },
            { gb: 19, price: 19000, note: 'Internet Bundle' },
            { gb: 20, price: 20000, note: 'Internet Bundle' },
            { gb: 25, price: 25000, note: 'Internet Bundle' },
            { gb: 30, price: 30000, note: 'Internet Bundle' }
        ],
        comboPlans: [] // Halotel has no combo plans
    },
    airtel: {
        displayName: 'Airtel',
        dataPlans: [
            { gb: 5,  price: 5000,  note: 'Data Bundle' },
            { gb: 10, price: 10000, note: 'Data Bundle' },
            { gb: 20, price: 20000, note: 'Data Bundle' },
            { gb: 30, price: 30000, note: 'Data Bundle' }
        ],
        comboPlans: [] // Add Airtel combo plans here when you get them
    }
};

module.exports = { PLANS, PROVIDERS, NETWORK_PLANS };