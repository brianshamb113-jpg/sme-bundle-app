// config/plans.js
// ============================================
// EASY PRICE EDITOR - CHANGE PRICES HERE!
// ============================================
// This is where you set all your bundle prices.
// When you want to change prices, just edit the numbers here.
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

// Network providers with their logos
const PROVIDERS = [
    { id: 'yas',     name: 'Yas (Tigo)',  logo: '/images/Yas.png',     paymentMethod: 'Tigo Pesa' },
    { id: 'halotel', name: 'Halotel',     logo: '/images/Halotel.png', paymentMethod: 'Halopesa' },
    { id: 'airtel',  name: 'Airtel',      logo: '/images/Airtel.png',  paymentMethod: 'AirtelMoney' },
    { id: 'vodacom', name: 'Vodacom',     logo: '/images/Vodacom.png', paymentMethod: 'M-Pesa' }
];

module.exports = { PLANS, PROVIDERS };