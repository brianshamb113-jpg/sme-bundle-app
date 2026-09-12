// lang.js - Language translations
const translations = {
    sw: {
        title: 'SME Bundles Tanzania',
        hero_title: 'Nunua SME Bundles',
        hero_subtitle: 'Papara na Moja kwa Moja',
        hero_desc: 'Pata SME data bundles za Halotel kwa punguzo la hadi 50%. Hakuna mawakala, hakuna kuchelewa — utumaji wa papara.',
        get_started: 'Anza Sasa',
        view_bundles: 'Tazama Bundles',
        bundles: 'Bundles Zilizopo',
        buy_now: 'Nunua Sasa',
        original: 'Bei Halisi',
        save: 'Unaokoa',
        login: 'Ingia',
        register: 'Jisajili',
        dashboard: 'Dashibodi',
        logout: 'Toka',
        footer: 'Imetengenezwa kwa ❤️ Tanzania',
        language: 'Lugha'
    },
    en: {
        title: 'SME Bundles Tanzania',
        hero_title: 'Buy SME Bundles',
        hero_subtitle: 'Instantly & Automatically',
        hero_desc: 'Get Halotel SME data bundles at up to 50% discount. No agents, no delays — instant delivery.',
        get_started: 'Get Started',
        view_bundles: 'View Bundles',
        bundles: 'Available Bundles',
        buy_now: 'Buy Now',
        original: 'Original Price',
        save: 'You Save',
        login: 'Login',
        register: 'Register',
        dashboard: 'Dashboard',
        logout: 'Logout',
        footer: 'Made with ❤️ in Tanzania',
        language: 'Language'
    }
};

module.exports = (lang) => {
    return translations[lang] || translations['sw'];
};
