// Street Boss game data. All numbers for balance live here.

// Shop types. upBase sets the build-up costs. Partners make combos.
export const TYPES = {
  lemon:   { name: 'Lemonade',  icon: '🍋', price: 5,  appeal: 1.0,  serve: 2.0, build: 150,  upBase: 150, c1: '#ffd23f', c2: '#ff8fab', roof: '#ff5c8a', tag: 'Cheap and fast. Loves hot days.', sig: 'Golden Lemonade' },
  coffee:  { name: 'Coffee',    icon: '☕', price: 6,  appeal: 0.95, serve: 2.3, build: 250,  upBase: 230, c1: '#b07a4f', c2: '#f7e1c4', roof: '#5b3a24', tag: 'Busy in the morning.', sig: 'Cloud Latte' },
  burger:  { name: 'Burgers',   icon: '🍔', price: 8,  appeal: 0.95, serve: 2.7, build: 350,  upBase: 300, c1: '#ff7b54', c2: '#ffe66d', roof: '#c8361c', tag: 'Busy at lunch.', sig: 'Triple Stack' },
  arcade:  { name: 'Arcade',    icon: '🕹️', price: 15, appeal: 0.6,  serve: 3.2, build: 700,  upBase: 450, c1: '#7b5cff', c2: '#3de8ff', roof: '#3a238f', tag: 'Busy in the evening.', sig: 'VR Arena' },
  phone:   { name: 'Phone Fix', icon: '📱', price: 30, appeal: 0.32, serve: 4.2, build: 1000, upBase: 600, c1: '#2ec4b6', c2: '#e8fbff', roof: '#13756c', tag: 'Few customers, big bills.', sig: 'Same-Day Fix' },
  sneaker: { name: 'Sneakers',  icon: '👟', price: 70, appeal: 0.15, serve: 3.8, build: 1600, upBase: 900, c1: '#ef476f', c2: '#ffffff', roof: '#8f1d3b', tag: 'Rare buyers, huge sales.', sig: 'Limited Drop' },
};
export const RIVAL_TYPES = {
  quick: { name: 'QuickStop', short: 'Q',    price: 6, appeal: 1.0,  serve: 2.4, c1: '#2f9e6e', c2: '#ffb020', roof: '#1f6b4a', dark: '#174d36' },
  mega:  { name: 'MegaMart',  short: 'MEGA', price: 8, appeal: 1.15, serve: 2.5, c1: '#5a5f7d', c2: '#ff3b4f', roof: '#30334a', dark: '#30334a' },
};

// Combos: a ring, so every shop type has two partners.
export const COMBOS = [
  ['lemon', 'burger', 'Meal deal'],
  ['burger', 'arcade', 'Game night'],
  ['arcade', 'phone', 'Tech corner'],
  ['phone', 'coffee', 'Fix & sip'],
  ['coffee', 'sneaker', 'Shopping break'],
  ['sneaker', 'lemon', 'Summer style'],
];
export function comboName(a, b) {
  const c = COMBOS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return c ? c[2] : null;
}
export function partners(t) {
  return COMBOS.filter(([x, y]) => x === t || y === t).map(([x, y]) => (x === t ? y : x));
}

export const LV = {
  name: ['Cart', 'Kiosk', 'Shop', 'Store', 'Tower'],
  price: [1, 1.35, 1.75, 2.3, 3],
  appeal: [1, 1.3, 1.65, 2.1, 2.7],
  cap: [3, 4, 6, 8, 10],
  rent: [6, 16, 36, 70, 120],
  up: [1, 2.4, 5, 10],
};
export const PRICE = { name: ['Cheap', 'Fair', 'Premium'], mult: [0.7, 1, 1.45], appeal: [1.4, 1, 0.68], star: [0.5, 0, -0.6] };

// New ideas, shown one at a time with a card.
export const CONCEPTS = {
  staff:     { icon: '🧑‍🍳', title: 'Staff', text: 'When the line is full, people walk away 😠. Staff serve more people at the same time. Each worker gets paid every night.' },
  lots:      { icon: '🏗️', title: 'Buy lots', text: 'The empty lots are now for sale. Build a new shop on each lot you buy. Your rival wants them too, so be quick!' },
  quality:   { icon: '⭐', title: 'Quality and stars', text: 'Better quality gives more stars, and more stars bring more customers. Stars change each night. Cheap prices give a few more stars, Premium a few less.' },
  combos:    { icon: '🔗', title: 'Combos', text: 'Some shops are best friends. Put them side by side and both get more customers, and people often visit both. Look for 🔗 when you pick a shop.' },
  news:      { icon: '📰', title: 'Street news', text: 'From now on, something can happen each morning. Some news is good, some is bad, and sometimes you must choose.' },
  fans:      { icon: '❤️', title: 'Fans', text: 'Happy customers can become fans, and shops with more stars make many more fans. Every 10 fans make your shops 1% more popular. You can also spend fans on campaigns for a big boost.' },
  buyout:    { icon: '💼', title: 'Buy out', text: 'Tap a MegaMart store to buy it out. It is expensive, but the lot becomes yours and MegaMart loses it.' },
  city:      { icon: '🏙️', title: 'City projects', text: 'Pay for a bus stop, street lights, a park or a metro. They bring more people to the whole street. MegaMart gets those people too!' },
  signature: { icon: '✨', title: 'Signature items', text: 'A Store (size 4) can invent its own famous product. It sells for more, and the combos of that shop get twice as strong.' },
};

// Streets (chapters). Each one adds new ideas.
export const CHAPTERS = [
  {
    id: 'maple', name: 'Maple Street', blurb: 'A quiet street with a few small shops.', lots: 5, days: 20, goal: 3, rivalGoal: 3,
    levelCap: 3, types: ['lemon', 'coffee', 'burger'], traffic: 50, lotBase: 300, theme: 'suburb',
    you: { lot: 0 }, rivalStart: [[4, 1]], rival: { type: 'quick', funding: [12, 1.5], lotCost: [500, 250], buyProb: 0.5, startDelay: 2, cut: 0.6, upProb: 0.35, saves: true },
    unlocks: [{ id: 'staff', day: 2 }, { id: 'lots', day: 4 }, { id: 'quality', day: 7 }],
    startCash: 200,
  },
  {
    id: 'market', name: 'Market Square', blurb: 'A busy square. MegaMart has a store here.', lots: 7, days: 30, goal: 4, rivalGoal: 4,
    levelCap: 4, types: ['lemon', 'coffee', 'burger', 'arcade', 'phone'], traffic: 76, lotBase: 360, theme: 'market',
    you: { lot: 1 }, rivalStart: [[5, 2]], rival: { type: 'mega', funding: [8, 1.5], lotCost: [800, 450], buyProb: 0.4, startDelay: 3, cut: 0.6, upProb: 0.45 },
    unlocks: [{ id: 'combos', day: 1 }, { id: 'news', day: 3 }, { id: 'fans', day: 6 }],
    startCash: 450,
  },
  {
    id: 'downtown', name: 'Downtown', blurb: 'Big city, big money. MegaMart is everywhere.', lots: 9, days: 40, goal: 5, rivalGoal: 5,
    levelCap: 5, types: ['lemon', 'coffee', 'burger', 'arcade', 'phone', 'sneaker'], traffic: 80, lotBase: 500, theme: 'city',
    you: { lot: 1 }, rivalStart: [[4, 2], [7, 3]], rival: { type: 'mega', funding: [10, 2], lotCost: [1300, 600], buyProb: 0.45, startDelay: 3, cut: 0.6, upProb: 0.5 },
    unlocks: [{ id: 'buyout', day: 1 }, { id: 'city', day: 3 }, { id: 'signature', day: 6 }],
    startCash: 800,
  },
];

export const CITY = {
  bus:    { name: 'Bus stop',      icon: '🚏', cost: 800,  s: '+15% visitors every day' },
  lights: { name: 'Street lights', icon: '💡', cost: 1200, s: 'Busy evenings, +10% visitors' },
  park:   { name: 'Little park',   icon: '🌳', cost: 1800, s: '+10% visitors, +½ star for your shops' },
  metro:  { name: 'Metro station', icon: '🚇', cost: 4000, s: '+30% visitors every day' },
};

export const CAMPAIGNS = {
  flash:  { name: 'Flash sale',  icon: '⚡', fans: 25,  s: 'This shop gets 80% more visitors for the rest of today', shop: true },
  meetup: { name: 'Fan meetup',  icon: '🎉', fans: 60,  s: 'All your shops get +½ star right now' },
  viralvid: { name: 'Viral video', icon: '🎬', fans: 120, s: 'All your shops get 40% more visitors for 2 days' },
};

export const PERKS = {
  quick:   { icon: '⚡', name: 'Quick hands',     s: 'Staff work 25% faster.' },
  builder: { icon: '🏗️', name: 'Builder friends', s: 'Build ups cost 15% less.' },
  bargain: { icon: '🏷️', name: 'Bargain hunter',  s: 'Lots cost 15% less.' },
  wallet:  { icon: '💰', name: 'Big wallet',      s: 'Start every street with $600 more.' },
  stars:   { icon: '⭐', name: 'Five-star crew',  s: 'All your shops get +½ star.' },
  fanclub: { icon: '❤️', name: 'Fan club',        s: 'You get 50% more fans.' },
  combo:   { icon: '🔗', name: 'Combo master',    s: 'Combos give 50% more.' },
};

// Tasks per street. need = concept that must be unlocked first.
export const TASKS = {
  maple: [
    { id: 'kiosk',    t: 'Build up your cart into a Kiosk', r: 60 },
    { id: 'serve25',  t: 'Serve 25 customers in one day', r: 60 },
    { id: 'hire',     t: 'Hire your first worker', r: 50, need: 'staff' },
    { id: 'lot1',     t: 'Buy your first lot', r: 100, need: 'lots' },
    { id: 'coffee',   t: 'Open a Coffee shop', r: 80, need: 'lots' },
    { id: 'shop3',    t: 'Grow a shop to Shop size', r: 150 },
    { id: 'stars4',   t: 'Get a shop to 4 stars', r: 120, need: 'quality' },
    { id: 'profit250',t: 'Make $250 profit in one day', r: 150 },
  ],
  market: [
    { id: 'combo1',   t: 'Make your first combo', r: 150 },
    { id: 'store',    t: 'Build a Store (size 4)', r: 300 },
    { id: 'arcade',   t: 'Open an Arcade', r: 150 },
    { id: 'fans50',   t: 'Get 50 fans', r: 150, need: 'fans' },
    { id: 'campaign', t: 'Start a campaign', r: 100, need: 'fans' },
    { id: 'combo3',   t: 'Have 3 combos at once', r: 400 },
    { id: 'profit700',t: 'Make $700 profit in one day', r: 300 },
  ],
  downtown: [
    { id: 'buyout',   t: 'Buy out a MegaMart store', r: 800, need: 'buyout' },
    { id: 'cityp',    t: 'Build a city project', r: 300, need: 'city' },
    { id: 'sig',      t: 'Invent a signature item', r: 500, need: 'signature' },
    { id: 'tower',    t: 'Build a Tower (size 5)', r: 1000 },
    { id: 'combo4',   t: 'Have 4 combos at once', r: 800 },
    { id: 'fans300',  t: 'Get 300 fans', r: 500 },
    { id: 'profit2k', t: 'Make $2,000 profit in one day', r: 1000 },
  ],
};

// Trophies stay across games, also after a new game.
export const TROPHIES = [
  { id: 'kiosk',   icon: '🏪', name: 'Kiosk owner',   s: 'Build up a cart into a kiosk' },
  { id: 'lot',     icon: '🪧', name: 'Land owner',      s: 'Buy your first lot' },
  { id: 'staff3',  icon: '🧑‍🍳', name: 'Full team',     s: 'Hire 3 workers in one shop' },
  { id: 'tips10',  icon: '💵', name: 'Tip jar',        s: 'Collect 10 tips' },
  { id: 'star5',   icon: '⭐', name: 'Five stars',     s: 'Get a shop to 5 stars' },
  { id: 'combo3',  icon: '🔗', name: 'Best friends',   s: 'Have 3 combos at once' },
  { id: 'fans100', icon: '❤️', name: 'Fan favorite',   s: 'Get 100 fans' },
  { id: 'speedy',  icon: '⚡', name: 'Speedy',         s: 'Win a street with 3 stars' },
  { id: 'profit1k',icon: '💰', name: 'Big day',        s: 'Make $1,000 profit in one day' },
  { id: 'sig',     icon: '✨', name: 'Inventor',       s: 'Invent a signature item' },
  { id: 'buyout',  icon: '💼', name: 'Takeover',       s: 'Buy out a MegaMart store' },
  { id: 'tower',   icon: '🏙️', name: 'Sky high',       s: 'Build a Tower' },
  { id: 'metro',   icon: '🚇', name: 'City builder',   s: 'Build the metro station' },
  { id: 'boss',    icon: '👑', name: 'Street Boss',    s: 'Win all three streets' },
];
