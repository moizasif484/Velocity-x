/* ============================================================
   Velocity X — config.js
   Application Configuration & Editable Pricing Options
   ============================================================ */

export const CONFIG = {
  appName: 'Velocity X',
  version: '2.4.0',
  apiBaseUrl: window.location.origin.includes('localhost')
    ? 'http://localhost:3000/api'
    : 'https://api.velocityx.game/v1',
  isProduction: !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1'),
  
  // Requirement 7: EDITABLE PRICING CONFIGURATION
  pricing: [
    {
      id: 'basic',
      name: 'BASIC',
      pricePKR: 'Rs. 15,000',
      priceUSD: '$50',
      badge: 'Starter',
      featured: false,
      features: [
        '1 Page Website',
        'Responsive Design',
        'Basic UI',
        'Contact Section',
        'Standard Performance'
      ],
      buttonText: 'Get Started'
    },
    {
      id: 'standard',
      name: 'STANDARD',
      pricePKR: 'Rs. 35,000',
      priceUSD: '$120',
      badge: 'Popular',
      featured: true,
      features: [
        'Multi-page Website',
        'Responsive Design',
        'Modern UI & Animations',
        'Contact Form with Validation',
        'Interactive Image Gallery',
        'Basic Authentication (Nova ID)'
      ],
      buttonText: 'Choose Standard'
    },
    {
      id: 'premium',
      name: 'PREMIUM',
      pricePKR: 'Rs. 60,000+',
      priceUSD: '$220+',
      badge: 'Ultimate',
      featured: false,
      features: [
        'Professional Multi-page Website',
        'Secure Authentication & Hashing',
        'User Profiles & Customization',
        'Real-Time Chat & Messaging',
        'Instagram-Style Social Gallery',
        '3D City Racing Engine',
        'Advanced UI & FX',
        'Performance Optimization',
        'Deployment Ready Build'
      ],
      buttonText: 'Go Premium'
    }
  ],

  // In-Game Currency & Missions Configuration
  game: {
    currencySymbol: 'CR',
    finalChallengeCost: 400000,
    missionRewards: {
      speedTrap: 50000,
      sprintRace: 100000,
      cityExploration: 100000,
      driftMaster: 150000
    }
  }
};

export default CONFIG;
