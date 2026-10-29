// ============================================
// 1. GENERIC PLANS (Used for Dashboard 1GB-10GB)
// ============================================
const PLANS = [
    { gb: 1,  price: 1500,  originalPrice: 2100  },
    { gb: 2,  price: 2800,  originalPrice: 4000  },
    { gb: 3,  price: 4000,  originalPrice: 6000  },
    { gb: 4,  price: 5200,  originalPrice: 8000  },
    { gb: 5,  price: 6500,  originalPrice: 9000  },
    { gb: 6,  price: 7800,  originalPrice: 11000 },
    { gb: 7,  price: 9100,  originalPrice: 13000 },
    { gb: 8,  price: 10400, originalPrice: 15000 },
    { gb: 9,  price: 11700, originalPrice: 17000 },
    { gb: 10, price: 13000, originalPrice: 19000 }
];

// ============================================
// 2. PROVIDERS
// ============================================
const PROVIDERS = [
    { id: 'yas',     name: 'Yas (Tigo)',  logo: '/images/Yas.png',     paymentMethod: 'Tigo Pesa' },
    { id: 'halotel', name: 'Halotel',     logo: '/images/Halotel.png', paymentMethod: 'Halopesa' },
    { id: 'airtel',  name: 'Airtel',      logo: '/images/Airtel.png',  paymentMethod: 'AirtelMoney' },
    { id: 'vodacom', name: 'Vodacom',     logo: '/images/Vodacom.png', paymentMethod: 'M-Pesa' }
];

// ============================================
// 3. NETWORK PLANS (NO COMBO PLANS)
// ============================================
const NETWORK_PLANS = {
    yas: {
        displayName: 'Yas (Tigo)',
        smallPlans: PLANS,
        dataPlans: [
            { gb: 15, price: 15000, note: 'Kila Mwezi' },
            { gb: 35, price: 30000, note: 'Kila Mwezi' },
            { gb: 48, price: 40000, note: 'Kila Mwezi' }
        ]
    },
    halotel: {
        displayName: 'Halotel',
        smallPlans: PLANS,
        dataPlans: [
            { gb: 5,  price: 6000,  note: 'Internet Bundle' },
            { gb: 10, price: 11000, note: 'Internet Bundle' },
            { gb: 15, price: 15000, note: 'Internet Bundle' },
            { gb: 20, price: 20000, note: 'Internet Bundle' },
            { gb: 25, price: 25000, note: 'Internet Bundle' },
            { gb: 30, price: 30000, note: 'Internet Bundle' }
        ]
    },
    airtel: {
        displayName: 'Airtel',
        smallPlans: PLANS,
        dataPlans: [
            { gb: 5,  price: 5000,  note: 'Data Bundle' },
            { gb: 10, price: 10000, note: 'Data Bundle' },
            { gb: 20, price: 20000, note: 'Data Bundle' },
            { gb: 30, price: 30000, note: 'Data Bundle' }
        ]
    },
    vodacom: {
        displayName: 'Vodacom',
        smallPlans: PLANS,
        dataPlans: [
            { gb: 10,  price: 15000,  note: 'Siku 30' },
            { gb: 15,  price: 20000,  note: 'Siku 30' },
            { gb: 30,  price: 30000,  note: 'Siku 30' },
            { gb: 60,  price: 50000,  note: 'Siku 30' },
            { gb: 75,  price: 60000,  note: 'Siku 30' },
            { gb: 100, price: 75000,  note: 'Siku 30' },
            { gb: 150, price: 100000, note: 'Siku 30' }
        ]
    }
};

module.exports = { PLANS, PROVIDERS, NETWORK_PLANS };