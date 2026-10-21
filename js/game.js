// Street Boss: grow a lemonade cart into a street of shops.
import { TYPES, RIVAL_TYPES, COMBOS, comboName, partners, LV, PRICE, CONCEPTS, CHAPTERS, CITY, CAMPAIGNS, PERKS, TASKS } from './data.js';
import { Sound } from '../sound/sound.js';

const DAY_LEN = 34;
const SAVE_KEY = 'streetboss.save.v2';
const START_KEY = 'streetboss.chapterstart.v2';
const BOT = !!window.__SB_BOT;

/* ---------------- sound ---------------- */
const sound = new Sound({ base: './sound/', storageKey: 'streetboss.sound' });
if (!BOT) sound.load().catch(() => {});
let lastCoin = 0;
function sfx(name, opts) {
  if (BOT) return;
  try {
    if (name === 'coin') {
      const n = performance.now();
      if (n - lastCoin < 160) return;
      lastCoin = n;
      opts = { volume: 0.35, pitchVariance: 0.12 };
    }
    sound.play(name, opts);
  } catch (e) { /* ignore */ }
}
function music(name) { if (!BOT) try { sound.music(name, { fade: 0.8 }); } catch (e) { /* ignore */ } }

/* ---------------- state ---------------- */
let S = null;
const ch = () => CHAPTERS[S.ch];
const rt = () => RIVAL_TYPES[ch().rival.type];
const has = (c) => !!S.unlocked[c];
const perk = (p) => S.perks.includes(p);
function newLot() {
  return { owner: null, type: null, level: 0, staff: 0, quality: 0, price: 1, rating: 3, sig: false, flash: 0,
    queue: [], inside: [], today: { rev: 0, served: 0, lost: 0 }, pop: 0, buildT: 0 };
}
function newGame() {
  S = { v: 2, ch: 0, day: 1, t: 0, cash: 0, fans: 0, lots: [], rival: { cash: 0, war: 0 }, city: {}, effects: [], loans: [],
    debtDays: 0, unlocked: { build: true, price: true }, perks: [], tasksDone: [], stars: [], free: false,
    history: { totalRev: 0, bestProfit: 0, lastEvent: null, served: 0 }, sel: 0, tab: 'shop', speed: 1, paused: true, ended: false,
    people: [], fx: [], cars: [], spawnAcc: 0, dayServed: 0 };
  setupChapter(0, null);
}
function setupChapter(i, carry) {
  const C = CHAPTERS[i];
  S.ch = i; S.day = 1; S.t = 0; S.ended = false; S.debtDays = 0; S.effects = []; S.loans = []; S.city = {};
  S.rival = { cash: 250 + i * 300, war: 0 };
  S.people = []; S.fx = []; S.cars = []; S.spawnAcc = 0; S.dayServed = 0;
  S.lots = [];
  for (let k = 0; k < C.lots; k++) S.lots.push(newLot());
  const start = S.lots[C.you.lot];
  Object.assign(start, { owner: 'you', type: carry ? carry.type : 'lemon', level: carry ? carry.level : 1, rating: 3 });
  for (const [lot, lvl] of C.rivalStart) Object.assign(S.lots[lot], { owner: 'rival', type: 'rival', level: lvl, rating: 3.2, staff: lvl - 1 });
  S.cash = C.startCash + (carry ? carry.bonus : 0) + (perk('wallet') && i > 0 ? 600 : 0);
  S.sel = C.you.lot; S.tab = 'shop';
  S.camX = 0;
  for (const u of C.unlocks) if (u.day <= 1) S.pendingUnlocks = [...(S.pendingUnlocks || []), u.id];
  if (i > 0) Object.assign(S.unlocked, { staff: true, lots: true, quality: true });
  if (i > 1) Object.assign(S.unlocked, { combos: true, news: true, fans: true });
  try { localStorage.setItem(START_KEY, JSON.stringify(serial())); } catch (e) { /* ignore */ }
}
const own = (o) => S.lots.filter((l) => l.owner === o);
const youCount = () => own('you').length;
const rivCount = () => own('rival').length;
const isShop = (l) => l.owner === 'you' && l.type;
const effect = (k) => S.effects.find((e) => e.kind === k && e.until >= S.day);
const money = (n) => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const r10 = (n) => Math.round(n / 10) * 10;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------------- economy ---------------- */
const TT = (l) => (l.owner === 'rival' ? rt() : TYPES[l.type]);
const lotPrice = () => r10(ch().lotBase * Math.pow(1.4, youCount() - 1) * (perk('bargain') ? 0.85 : 1));
const upCost = (l) => r10(TYPES[l.type].upBase * LV.up[l.level - 1] * (perk('builder') ? 0.85 : 1));
const staffCost = (l) => 60 * (l.staff + 1) * l.level;
const qualCost = (l) => 100 * (l.quality + 1) * l.level;
const sigCost = (l) => r10(800 + TYPES[l.type].build);
const wage = (l) => 15 + 5 * l.level;
const rent = (l) => Math.round(LV.rent[l.level - 1] * (1 + (l.owner === 'you' ? TYPES[l.type].build : 300) / 1500));
const buyoutCost = (l) => 800 + 600 * l.level + 200 * rivCount();
const rivalLotCost = () => { const c = ch().rival.lotCost; return c[0] + c[1] * Math.max(0, rivCount() - 1); };
const priceOf = (l) => (l.owner === 'rival' && S.rival.war > 0 ? 0 : l.price);
function ticket(l, price) {
  const T = TT(l);
  const p = T.price * LV.price[l.level - 1] * PRICE.mult[price ?? priceOf(l)] * (l.sig ? 1.25 : 1);
  return Math.max(1, Math.round(p));
}
const servers = (l) => 1 + l.staff;
const serveTime = (l) => TT(l).serve * (1 - 0.08 * (l.level - 1)) / (l.owner === 'you' && perk('quick') ? 1.25 : 1);
function shopValue(l) { return l.type && l.owner === 'you' ? Math.round((TYPES[l.type].build + 150 * l.level * l.level) * 0.8) : lotPrice() * 0.6; }
function netWorth() { return S.cash + own('you').reduce((a, l) => a + shopValue(l), 0) - S.loans.reduce((a, x) => a + x.amt, 0); }
const fanBoost = () => (has('fans') ? 1 + Math.min(0.5, S.fans / 1000) : 1);
const dayCosts = (l) => rent(l) + wage(l) * l.staff;

// Combos between neighbors. Returns list of {a,b,kind:'combo'|'clash',name}.
function links() {
  const out = [];
  if (!has('combos')) return out;
  for (let i = 0; i < S.lots.length - 1; i++) {
    const a = S.lots[i], b = S.lots[i + 1];
    if (!isShop(a) || !isShop(b)) continue;
    const n = comboName(a.type, b.type);
    if (n) out.push({ a: i, b: i + 1, kind: 'combo', name: n, sig: a.sig || b.sig });
    else if (a.type === b.type) out.push({ a: i, b: i + 1, kind: 'clash' });
  }
  return out;
}
const comboCount = () => links().filter((x) => x.kind === 'combo').length;
function comboMult(i) {
  let m = 1;
  for (const x of links()) {
    if (x.a !== i && x.b !== i) continue;
    if (x.kind === 'combo') m *= 1 + 0.2 * (x.sig ? 2 : 1) * (perk('combo') ? 1.5 : 1);
    else m *= 0.85;
  }
  return m;
}
function comboChance(i, j) {
  const n = comboName(S.lots[i].type, S.lots[j].type);
  if (!n) return 0;
  return 0.22 * (S.lots[i].sig || S.lots[j].sig ? 2 : 1) * (perk('combo') ? 1.5 : 1);
}
let linkCache = [], comboMults = [];
function refreshLinks() { linkCache = links(); comboMults = S.lots.map((_, i) => comboMult(i)); }

function appeal(l, i) {
  if (!l.type) return 0;
  const T = TT(l);
  let a = T.appeal * LV.appeal[l.level - 1] * PRICE.appeal[priceOf(l)] * (0.45 + l.rating / 5);
  const t = S.t;
  if (l.type === 'coffee' && t < 0.3) a *= 1.8;
  if (l.type === 'burger' && t > 0.3 && t < 0.5) a *= 1.6;
  if (l.type === 'arcade' && t > 0.62) a *= S.city.lights ? 2.2 : 1.7;
  if (l.type === 'sneaker' && t > 0.45 && t < 0.75) a *= 1.4;
  if (l.type === 'lemon' && effect('heat')) a *= 2;
  if (l.owner === 'you') {
    a *= fanBoost() * (comboMults[i] || 1);
    if (l.flash === S.day) a *= 1.8;
    if (effect('viralvid')) a *= 1.4;
    const tr = effect('trend');
    if (tr && tr.lot === i) a *= 1.8;
  } else if (effect('powercut') && effect('powercut').lot === i) a = 0;
  return a;
}
function visitorsToday() {
  const open = S.lots.filter((l) => l.type).length;
  const distinct = new Set(S.lots.filter((l) => l.type).map((l) => l.type)).size;
  let v = ch().traffic * (1 + 0.05 * open) * (1 + 0.05 * distinct);
  if (S.city.bus) v *= 1.15;
  if (S.city.lights) v *= 1.1;
  if (S.city.park) v *= 1.1;
  if (S.city.metro) v *= 1.3;
  for (const e of S.effects) if (e.until >= S.day && e.traffic) v *= e.traffic;
  return v * (1 + Math.min(S.day, 40) * 0.012);
}
function curve(t) {
  const g = (m, s) => Math.exp(-((t - m) * (t - m)) / (2 * s * s));
  let c = 0.35 + 0.7 * g(0.12, 0.08) + 1.1 * g(0.4, 0.09) + 0.8 * g(0.75, 0.1);
  if (S.city.lights && t > 0.7) c += 0.4;
  return c * 0.95;
}

/* ---------------- people ---------------- */
const SKIN = ['#f6d2b5', '#e0ac85', '#c68863', '#8d5a3b', '#5c3a24'];
const SHIRT = ['#3de8ff', '#ff5c8a', '#ffd23f', '#3ddc97', '#7b5cff', '#ff8a3d', '#ffffff', '#4ea1ff', '#ff6b6b'];
const HAIR = ['#2b1d14', '#5a3a1a', '#d9a441', '#1a1a1a', '#8b3a1a', '#c9c9c9'];
function chooseTarget() {
  let tot = 1.2;
  const w = S.lots.map((l, i) => { const a = appeal(l, i); tot += a; return a; });
  let r = Math.random() * tot;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
  return -1;
}
function spawn() {
  const N = S.lots.length;
  const dir = Math.random() < 0.5 ? 1 : -1;
  S.people.push({ x: dir > 0 ? -0.4 : N + 0.4, dir, lane: Math.random(), spd: 0.55 + Math.random() * 0.25, target: chooseTarget(), state: 'walk',
    skin: pick(SKIN), shirt: pick(SHIRT), pants: pick(['#2b2d42', '#3a5a99', '#5a4636', '#222', '#6b4f8a']), hair: pick(HAIR),
    hat: Math.random() < 0.15 ? pick(['#ff5c6c', '#3ddc97', '#ffd23f', '#4ea1ff']) : null, ph: Math.random() * 6, kid: Math.random() < 0.2, mood: null, bag: null, chained: false });
}
const door = (i) => i + 0.5;

/* ---------------- simulation ---------------- */
function step(dt) {
  if (S.ended || S.t >= 1) return;
  S.t += dt / DAY_LEN;
  const N = S.lots.length;
  if (S.t < 0.93) {
    S.spawnAcc += visitorsToday() * curve(S.t) * dt / DAY_LEN;
    while (S.spawnAcc >= 1) { S.spawnAcc -= 1; spawn(); }
  }
  for (const p of S.people) {
    p.ph += dt * p.spd * 14;
    if (p.state === 'walk' || p.state === 'leave') {
      const tx = p.target >= 0 && p.state === 'walk' ? door(p.target) : null;
      if (tx !== null && Math.abs(p.x - tx) < 0.06) {
        const l = S.lots[p.target];
        if (!l.type || l.buildT > 0) { p.target = -1; p.state = 'leave'; continue; }
        if (l.queue.length < LV.cap[l.level - 1] && S.t < 0.98) { p.state = 'queue'; l.queue.push(p); }
        else {
          l.today.lost++; p.mood = { e: '😠', t: 1.6 }; p.target = -1; p.state = 'leave';
          if (l.owner === 'you') sfx('denied', { volume: 0.25 });
        }
      } else {
        if (tx !== null && Math.sign(tx - p.x) !== p.dir) p.dir = Math.sign(tx - p.x) || p.dir;
        p.x += p.dir * p.spd * dt * (p.kid ? 1.1 : 1);
      }
    }
    if (p.mood) { p.mood.t -= dt; if (p.mood.t <= 0) p.mood = null; }
  }
  S.lots.forEach((l, i) => {
    if (l.buildT > 0) l.buildT = Math.max(0, l.buildT - dt);
    if (l.pop > 0) l.pop = Math.max(0, l.pop - dt * 1.6);
    if (!l.type) return;
    for (const s of l.inside) s.left -= dt;
    for (let k = l.inside.length - 1; k >= 0; k--) {
      const s = l.inside[k];
      if (s.left > 0) continue;
      l.inside.splice(k, 1);
      const m = ticket(l);
      l.today.rev += m; l.today.served++;
      const p = s.p;
      p.state = 'leave'; p.target = -1; p.x = door(i); p.hidden = false;
      if (l.owner === 'you') {
        S.cash += m; S.history.totalRev += m; S.history.served++; S.dayServed++;
        sfx('coin'); addFx(door(i), '+$' + m, '#ffc23d');
        p.bag = TYPES[l.type].c1;
        if (has('fans')) {
          const ch2 = Math.max(0, l.rating - 2.5) * 0.12 * (perk('fanclub') ? 1.5 : 1);
          if (Math.random() < ch2) { S.fans++; p.mood = { e: '❤️', t: 1.3 }; }
        }
        // combo: walk on to a partner neighbor
        if (!p.chained && has('combos')) {
          for (const j of [i - 1, i + 1]) {
            if (j < 0 || j >= N || !isShop(S.lots[j])) continue;
            if (Math.random() < comboChance(i, j)) { p.chained = true; p.target = j; p.state = 'walk'; p.dir = j > i ? 1 : -1; p.mood = { e: '🔗', t: 1.4 }; break; }
          }
        }
        if (!p.mood && Math.random() < 0.2) p.mood = { e: pick(['😋', '😄', '🤩', '👍']), t: 1.1 };
      } else {
        S.rival.cash += m * ch().rival.cut;
        p.bag = rt().c2;
        if (Math.random() < 0.2) addFx(door(i), '+$' + m, '#ff9aa5');
      }
    }
    while (l.inside.length < servers(l) && l.queue.length) {
      const p = l.queue.shift(); p.hidden = true;
      l.inside.push({ p, left: serveTime(l) * (0.8 + Math.random() * 0.4) });
    }
    l.queue.forEach((p, k) => { p.x = door(i) + 0.16 + k * 0.085; p.dir = -1; });
  });
  S.people = S.people.filter((p) => p.x > -0.8 && p.x < N + 0.8);
  if (Math.random() < dt * (0.25 + 0.1 * S.ch)) S.cars.push({ x: Math.random() < 0.5 ? -1 : N + 1, dir: 0, c: pick(['#ff5c6c', '#4ea1ff', '#ffd23f', '#3ddc97', '#f4f4f4', '#7b5cff']), kind: Math.random() < 0.15 ? 'van' : 'car' });
  for (const c of S.cars) { if (!c.dir) c.dir = c.x < 0 ? 1 : -1; c.x += c.dir * dt * 2.2; }
  S.cars = S.cars.filter((c) => c.x > -1.5 && c.x < N + 1.5);
  checkTasks();
  if (S.t >= 1) endDay();
}
function addFx(x, txt, color) { S.fx.push({ x, y: 0, txt, color, life: 1.3 }); }
function bigFx(i, txt) { if (!BOT) S.fx.push({ x: door(i), y: 0, txt, color: '#fff', life: 2, big: true, top: true }); }

/* ---------------- tasks ---------------- */
function taskDone(id) {
  const shops = own('you').filter((l) => l.type);
  switch (id) {
    case 'kiosk': return shops.some((l) => l.level >= 2);
    case 'serve25': return S.dayServed >= 25;
    case 'hire': return shops.some((l) => l.staff > 0);
    case 'lot1': return youCount() >= 2;
    case 'coffee': return shops.some((l) => l.type === 'coffee');
    case 'shop3': return shops.some((l) => l.level >= 3);
    case 'stars4': return shops.some((l) => l.rating >= 3.95);
    case 'profit250': return S.lastProfit >= 250;
    case 'combo1': return comboCount() >= 1;
    case 'store': return shops.some((l) => l.level >= 4);
    case 'arcade': return shops.some((l) => l.type === 'arcade');
    case 'fans50': return S.fans >= 50;
    case 'campaign': return !!S.usedCampaign;
    case 'combo3': return comboCount() >= 3;
    case 'profit700': return S.lastProfit >= 700;
    case 'buyout': return !!S.didBuyout;
    case 'cityp': return Object.keys(S.city).length > 0;
    case 'sig': return shops.some((l) => l.sig);
    case 'tower': return shops.some((l) => l.level >= 5);
    case 'combo4': return comboCount() >= 4;
    case 'fans300': return S.fans >= 300;
    case 'profit2k': return S.lastProfit >= 2000;
  }
  return false;
}
function activeTasks() {
  const list = TASKS[ch().id].filter((t) => !S.tasksDone.includes(t.id) && (!t.need || has(t.need)));
  return list.slice(0, 3);
}
let taskTimer = 0;
function checkTasks(force) {
  taskTimer += 1;
  if (!force && taskTimer % 10) return;
  for (const t of activeTasks()) {
    if (taskDone(t.id)) {
      S.tasksDone.push(t.id); S.cash += t.r;
      sfx('milestone'); flashCash(t.r);
      toast(`✅ ${t.t}  +${money(t.r)}`);
      renderPanel();
    }
  }
  renderTaskChip();
}

/* ---------------- day cycle ---------------- */
function endDay() {
  S.t = 1;
  const mine = own('you').filter((l) => l.type);
  let rev = 0, rentSum = 0, wages = 0, served = 0, lost = 0;
  let best = null;
  for (const l of mine) {
    rev += l.today.rev; served += l.today.served; lost += l.today.lost; rentSum += rent(l); wages += wage(l) * l.staff;
    if (!best || l.today.rev > best.today.rev) best = l;
  }
  let loanPay = 0;
  for (const x of S.loans) if (x.due === S.day) loanPay += x.amt;
  S.loans = S.loans.filter((x) => x.due !== S.day);
  const costs = rentSum + wages + loanPay;
  S.cash -= costs;
  S.lots.forEach((l) => {
    if (!l.type) return;
    const yours = l.owner === 'you';
    const target = 2.6 + 0.55 * l.quality + PRICE.star[priceOf(l)] + (yours && S.city.park ? 0.5 : 0) + (yours && perk('stars') ? 0.5 : 0) +
      (l.level - 1) * 0.12 - Math.min(1.6, l.today.lost * 0.1) + (yours ? 0 : 0.3) + (yours && l.sig ? 0.3 : 0);
    l.rating = Math.max(1, Math.min(5, l.rating + (target - l.rating) * 0.5));
  });
  const news = rivalTurn();
  if (S.rival.war > 0) S.rival.war--;
  const profit = rev - costs;
  S.lastProfit = profit;
  S.history.bestProfit = Math.max(S.history.bestProfit, profit);
  checkTasks(true);
  const report = { day: S.day, rev, rentSum, wages, loanPay, profit, served, lost, news, best };
  if (S.cash < 0) S.debtDays++; else S.debtDays = 0;
  let end = null;
  if (!S.free) {
    if (youCount() >= ch().goal) end = 'win';
    else if (rivCount() >= ch().rivalGoal) end = 'rival';
    else if (S.debtDays >= 2) end = 'broke';
    else if (S.day >= ch().days) end = 'time';
  } else if (S.debtDays >= 3) end = 'broke';
  if (end) S.ended = true;
  save();
  showReport(report, end);
}
function rivalTurn() {
  const news = [];
  const R = S.rival, C = ch().rival, name = rt().name;
  R.cash += C.funding[0] + C.funding[1] * S.day;
  if (S.free) R.cash += 20 * S.day;
  const lotsOpenDay = S.ch === 0 ? CHAPTERS[0].unlocks.find((u) => u.id === 'lots').day : 1;
  const empty = S.lots.map((l, i) => (!l.owner ? i : -1)).filter((i) => i >= 0);
  const mine = own('rival');
  if (empty.length && has('lots') && S.day >= lotsOpenDay + C.startDelay && R.cash >= rivalLotCost() * 1.15 && Math.random() < C.buyProb) {
    // MegaMart likes lots next to your shops: that breaks your combos.
    const nearYou = empty.filter((i) => [i - 1, i + 1].some((j) => S.lots[j] && isShop(S.lots[j])));
    const i = nearYou.length && Math.random() < 0.6 ? pick(nearYou) : pick(empty);
    R.cash -= rivalLotCost();
    Object.assign(S.lots[i], newLot(), { owner: 'rival', type: 'rival', level: 1 + (S.day > 15 ? 1 : 0) + (S.ch === 2 ? 1 : 0), rating: 3, pop: 1, buildT: 1 });
    news.push({ e: '🔴', t: `${name} opened a store on lot ${i + 1}.`, bad: true });
    if (!BOT) sfx('rival_alert');
  } else if (mine.length) {
    const l = mine.filter((x) => x.level < ch().levelCap).sort((a, b) => a.level - b.level)[0];
    if (l) {
      const c = Math.round(500 * l.level * 1.1);
      if (R.cash >= c * 1.2 && Math.random() < C.upProb) { R.cash -= c; l.level++; l.pop = 1; l.buildT = 1; news.push({ e: '🔴', t: `${name} made its store on lot ${S.lots.indexOf(l) + 1} bigger.`, bad: true }); }
      else if (l.staff < 3 && R.cash > 300 && Math.random() < 0.3) { R.cash -= 150; l.staff++; }
    }
  }
  return news;
}
function startDay() {
  S.day++; S.t = 0; S.spawnAcc = 0; S.people = []; S.fx = []; S.dayServed = 0;
  S.lots.forEach((l) => { l.queue = []; l.inside = []; l.today = { rev: 0, served: 0, lost: 0 }; });
  S.effects = S.effects.filter((e) => e.until >= S.day);
  for (const u of ch().unlocks) if (u.day <= S.day && !has(u.id) && !(S.pendingUnlocks || []).includes(u.id)) S.pendingUnlocks = [...(S.pendingUnlocks || []), u.id];
  save();
  queueMorning();
}
function queueMorning() {
  const q = [];
  for (const id of S.pendingUnlocks || []) q.push(() => showUnlock(id));
  S.pendingUnlocks = [];
  if (has('news')) { const ev = rollEvent(); if (ev) q.push(() => showEvent(ev)); }
  runQueue(q, () => { S.paused = false; refreshLinks(); renderPanel(); dayBanner(); });
}
function dayBanner() {
  if (BOT) return;
  const e = document.getElementById('dayBanner');
  const left = ch().days - S.day;
  e.innerHTML = `<b>Day ${S.day}</b><span>${S.free ? ch().name : left === 0 ? 'Last day!' : left === 1 ? '1 day left after today' : ch().name}</span>`;
  e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
}
function runQueue(q, done) {
  if (!q.length) { hideModal(); done(); return; }
  const f = q.shift();
  modalNext = () => runQueue(q, done);
  f();
}
let modalNext = null;
function next() { const f = modalNext; modalNext = null; if (f) f(); else hideModal(); }

/* ---------------- events ---------------- */
function EVENTS() {
  const name = rt().name;
  const shops = own('you').filter((l) => l.type);
  return [
    { id: 'heat', w: 1, ok: true, make: () => ({ icon: '☀️', good: true, title: 'Heatwave!', text: 'It is very hot today. Lemonade sells twice as well, and more people are out.', choices: [{ t: 'Nice!', f: () => S.effects.push({ kind: 'heat', until: S.day, traffic: 1.15 }) }] }) },
    { id: 'rain', w: 1, ok: true, make: () => ({ icon: '🌧️', title: 'Rainy day', text: 'Rain all day long. Fewer people come out.', choices: [
      { t: 'Free umbrellas', s: '$80 · +stars for your shops', cost: 80, f: () => { S.cash -= 80; shops.forEach((l) => (l.rating = Math.min(5, l.rating + 0.3))); S.effects.push({ kind: 'rain', until: S.day, traffic: 0.65 }); } },
      { t: 'Stay dry', f: () => S.effects.push({ kind: 'rain', until: S.day, traffic: 0.65 }) }] }) },
    { id: 'influencer', w: 1, ok: true, make: () => ({ icon: '🤳', title: 'An influencer calls', text: '@StreetStarr (1.2M followers) will post a video about your street if you pay for it.', choices: [
      { t: 'Pay ' + money(100 + 50 * S.ch), s: '+30% visitors for 3 days', cost: 100 + 50 * S.ch, f: () => { S.cash -= 100 + 50 * S.ch; S.effects.push({ kind: 'buzz', until: S.day + 2, traffic: 1.3 }); } },
      { t: 'No thanks', f: () => {} }] }) },
    { id: 'inspector', w: 1, ok: shops.some((l) => l.level >= 2), make: () => ({ icon: '🧑‍⚕️', title: 'Health inspector', text: 'An inspector checks shops today. Shops with no quality upgrade can get a fine.', choices: [
      { t: 'Deep clean', s: '$100 · no risk', cost: 100, f: () => { S.cash -= 100; toast('Inspector: everything is spotless ✨'); } },
      { t: 'Take the risk', f: () => { const bad = shops.filter((l) => l.quality === 0 && l.level >= 2); if (bad.length && Math.random() < 0.6) { S.cash -= 250; bad.forEach((l) => (l.rating = Math.max(1, l.rating - 0.5))); toast('Fined $250, and your stars went down'); sfx('news_bad'); } else toast('The inspector was happy. Phew!'); } }] }) },
    { id: 'war', w: 1.2, ok: S.day >= 4 && S.rival.war <= 0, make: () => ({ icon: '⚔️', title: 'Price war!', text: `${name} puts all prices on Cheap for 3 days to steal your customers.`, choices: [
      { t: 'Match prices', s: 'All your shops go Cheap', f: () => { S.rival.war = 3; shops.forEach((l) => (l.price = 0)); } },
      { t: 'Keep my prices', f: () => { S.rival.war = 3; } }] }) },
    { id: 'loan', w: 0.7, ok: S.loans.length === 0 && S.day < ch().days - 6, make: () => { const a = 800 + 500 * S.ch; return { icon: '🏦', title: 'The bank calls', text: `You can borrow ${money(a)} now. You pay back ${money(a * 1.25)} in 6 days.`, choices: [
      { t: 'Take the loan', s: '+' + money(a) + ' now', f: () => { S.cash += a; S.loans.push({ amt: a * 1.25, due: S.day + 6 }); } },
      { t: 'No loan', f: () => {} }] }; } },
    { id: 'festival', w: 0.7, ok: S.day >= 4, make: () => ({ icon: '🎉', good: true, title: 'Street festival!', text: 'There is a festival on your street today. Twice as many visitors!', choices: [{ t: 'Let’s go', f: () => S.effects.push({ kind: 'fest', until: S.day, traffic: 2 }) }] }) },
    { id: 'offer', w: 0.6, ok: shops.length >= 2 && rivCount() < ch().rivalGoal - 1, make: () => {
      const l = [...shops].sort((a, b) => shopValue(a) - shopValue(b))[0]; const i = S.lots.indexOf(l); const v = r10(shopValue(l) * 2 + lotPrice());
      return { icon: '💼', title: `${name} makes an offer`, text: `${name} wants to buy your ${TYPES[l.type].name} on lot ${i + 1} for ${money(v)}. That is a lot of money, but ${name} gets one lot closer to winning.`, choices: [
        { t: 'Sell it', s: '+' + money(v), f: () => { S.cash += v; Object.assign(S.lots[i], newLot(), { owner: 'rival', type: 'rival', level: Math.max(1, Math.min(l.level, ch().levelCap)), rating: 3, pop: 1 }); } },
        { t: 'Not for sale', f: () => {} }] }; } },
    { id: 'trend', w: 0.8, ok: shops.length > 0, make: () => { const l = pick(shops); const i = S.lots.indexOf(l);
      return { icon: '📈', good: true, title: 'You are trending!', text: `A video about your ${TYPES[l.type].name} on lot ${i + 1} has 2 million views. It will be extra busy for 2 days.`, choices: [{ t: 'Awesome', f: () => { S.effects.push({ kind: 'trend', lot: i, until: S.day + 1 }); l.rating = Math.min(5, l.rating + 0.3); } }] }; } },
    { id: 'quit', w: 0.6, ok: shops.some((l) => l.staff > 0), make: () => { const l = pick(shops.filter((x) => x.staff > 0)); const i = S.lots.indexOf(l);
      return { icon: '🚪', title: 'A worker wants to quit', text: `One of your workers at the ${TYPES[l.type].name} on lot ${i + 1} got a job offer from ${name}.`, choices: [
        { t: 'Give a raise', s: '$120 · they stay', cost: 120, f: () => { S.cash -= 120; toast('The team is happy again'); } },
        { t: 'Let them go', f: () => { l.staff--; toast('One less worker on lot ' + (i + 1)); } }] }; } },
    { id: 'critic', w: 0.7, ok: shops.length > 0, make: () => { const l = [...shops].sort((a, b) => b.level - a.level)[0]; const i = S.lots.indexOf(l); const good = l.quality >= 1;
      return { icon: '🧐', good, title: 'A food critic visits', text: good ? `The critic loved your ${TYPES[l.type].name} on lot ${i + 1}! Your stars go up.` : `The critic did not like your ${TYPES[l.type].name} on lot ${i + 1}. Quality upgrades would have helped.`, choices: [{ t: 'OK', f: () => { l.rating = Math.max(1, Math.min(5, l.rating + (good ? 0.5 : -0.3))); } }] }; } },
    { id: 'powercut', w: 0.5, ok: rivCount() > 0, make: () => { const r = pick(own('rival')); const i = S.lots.indexOf(r);
      return { icon: '🔌', good: true, title: `Power cut at ${name}`, text: `The ${name} store on lot ${i + 1} has no power today. Its customers will look for other shops.`, choices: [{ t: 'Too bad for them', f: () => S.effects.push({ kind: 'powercut', lot: i, until: S.day }) }] }; } },
  ];
}
function rollEvent() {
  if (Math.random() > 0.5) return null;
  const ok = EVENTS().filter((e) => e.id !== S.history.lastEvent && e.ok);
  let tot = ok.reduce((a, e) => a + e.w, 0), r = Math.random() * tot;
  for (const e of ok) { r -= e.w; if (r < 0) { S.history.lastEvent = e.id; return e.make(); } }
  return null;
}

/* ---------------- actions ---------------- */
function spend(c) {
  if (S.cash < c) { sfx('denied'); toast('Not enough cash yet'); return false; }
  S.cash -= c; flashCash(-c); return true;
}
function act(kind, arg) {
  const i = S.sel, l = S.lots[i];
  switch (kind) {
    case 'buyLot':
      if (!has('lots')) return;
      if (spend(lotPrice())) { Object.assign(l, newLot(), { owner: 'you' }); l.pop = 1; sfx('upgrade_buy'); toast(`Lot ${i + 1} is yours! Pick a shop to build.`); confetti(i, 18); }
      break;
    case 'build': {
      const T = TYPES[arg];
      if (spend(T.build)) { Object.assign(l, { type: arg, level: 1, rating: 3, pop: 1, buildT: 1 }); sfx('upgrade_buy'); toast(`${T.name} cart is open!`); confetti(i, 30); bigFx(i, 'OPEN!'); }
      break;
    }
    case 'up':
      if (l.level < ch().levelCap && spend(upCost(l))) { l.level++; l.pop = 1; l.buildT = 1; sfx('upgrade_buy'); toast(`Your ${TYPES[l.type].name} is now a ${LV.name[l.level - 1]}!`); confetti(i, 40); bigFx(i, LV.name[l.level - 1].toUpperCase() + '!'); }
      break;
    case 'staff': if (has('staff') && l.staff < 3 && spend(staffCost(l))) { l.staff++; l.pop = 0.5; sfx('cash_in', { volume: 0.5 }); } break;
    case 'qual': if (has('quality') && l.quality < 3 && spend(qualCost(l))) { l.quality++; l.pop = 0.5; sfx('cash_in', { volume: 0.5 }); toast('Better quality: stars go up tonight'); } break;
    case 'sig': if (has('signature') && !l.sig && l.level >= 4 && spend(sigCost(l))) { l.sig = true; l.pop = 1; sfx('milestone'); toast(`✨ ${TYPES[l.type].sig} is born!`); confetti(i, 60, true); } break;
    case 'price': l.price = +arg; sfx('tick'); break;
    case 'buyout':
      if (has('buyout') && spend(buyoutCost(l))) {
        l.queue.forEach((p) => { p.state = 'leave'; p.target = -1; }); l.inside.forEach((s) => { s.p.hidden = false; s.p.state = 'leave'; });
        Object.assign(l, newLot(), { owner: 'you' }); l.pop = 1; S.didBuyout = true; sfx('win', { volume: 0.6 }); toast(`You bought out ${rt().name}! Pick a shop to build.`); confetti(i, 50);
      }
      break;
    case 'city': { const c = CITY[arg]; if (has('city') && !S.city[arg] && spend(c.cost)) { S.city[arg] = true; sfx('milestone'); toast(`${c.icon} ${c.name} is built!`); } break; }
    case 'camp': {
      const c = CAMPAIGNS[arg];
      if (!has('fans')) return;
      if (S.fans < c.fans) { sfx('denied'); toast(`You need ${c.fans} ❤️ fans`); return; }
      if (arg === 'flash') { if (!isShop(l) || l.flash === S.day) return; l.flash = S.day; }
      if (arg === 'meetup') own('you').forEach((x) => { if (x.type) x.rating = Math.min(5, x.rating + 0.5); });
      if (arg === 'viralvid') { if (effect('viralvid')) return; S.effects.push({ kind: 'viralvid', until: S.day + 1 }); }
      S.fans -= c.fans; S.usedCampaign = true; sfx('news_good'); toast(`${c.icon} ${c.name}!`);
      break;
    }
  }
  refreshLinks();
  checkTasks(true);
  renderPanel();
  save();
}

/* ---------------- canvas ---------------- */
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, G = {};
let cam = { x: 0, target: null, vx: 0 };
function resize() {
  const r = cv.getBoundingClientRect();
  DPR = Math.min(2.5, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  if (!W || !H) return;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  layout();
}
function layout() {
  if (!S || !W) return;
  const N = S.lots.length;
  let vis = Math.min(N, Math.max(4.4, W / 76));
  if (N - vis < 0.35) vis = N;
  const lotW = W / vis;
  const roadH = Math.max(24, Math.min(64, H * 0.1));
  const pavH = Math.max(32, Math.min(76, H * 0.12));
  const groundY = H - roadH - pavH;
  // Floor height: the tallest building this street allows fills most of the sky.
  const tallest = [0.75, 1.15, 1.9, 2.9, 4.3][ch().levelCap - 1] + 1.1;
  const fh = Math.min((groundY - 30) / tallest, lotW * 1.25);
  G = { N, vis, lotW, roadH, pavH, groundY, fh, s: Math.max(0.75, Math.min(2.1, Math.min(lotW / 64, fh / 46))), maxCam: Math.max(0, N - vis) };
  cam.x = Math.max(0, Math.min(G.maxCam, cam.x));
  makeBackdrop();
}
let backdrop = [];
function makeBackdrop() {
  backdrop = [];
  let seed = 11 + S.ch * 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const theme = ch().theme;
  const worldW = G.N * G.lotW + W;
  for (const layer of [0.3, 0.6]) {
    let x = -20;
    while (x < worldW * layer + W) {
      let w, h, kind;
      if (theme === 'suburb') {
        const k = Math.max(1, G.fh / 60);
        kind = rnd() < 0.55 ? 'tree' : 'house';
        w = (kind === 'tree' ? 26 + rnd() * 30 : 50 + rnd() * 50) * k;
        h = (kind === 'tree' ? 40 + rnd() * 60 : 40 + rnd() * 40) * k;
        h *= layer === 0.3 ? 0.8 : 1.15;
      } else if (theme === 'market') {
        kind = 'block'; w = 36 + rnd() * 60; h = (0.18 + rnd() * 0.32) * G.groundY * (layer === 0.3 ? 1.25 : 0.85);
      } else {
        kind = rnd() < 0.15 ? 'spire' : 'block'; w = 30 + rnd() * 70; h = (0.3 + rnd() * 0.55) * G.groundY * (layer === 0.3 ? 1.15 : 0.8);
      }
      backdrop.push({ layer, x, w, h, kind, win: rnd(), hue: rnd() });
      x += w + (theme === 'suburb' ? (4 + rnd() * 20) * Math.max(1, G.fh / 60) : 2);
    }
  }
}
const SKY = [[0, '#8fd3ff', '#ffe5b8'], [0.25, '#4aa8ff', '#bfe6ff'], [0.6, '#5aa0ff', '#ffd9a8'], [0.78, '#ff7e5f', '#ffc07a'], [0.9, '#4a3a9a', '#ff8a6a'], [1, '#2b2166', '#5a4290']];
function lerpC(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
function skyAt(t) {
  for (let k = 0; k < SKY.length - 1; k++) {
    const a = SKY[k], b = SKY[k + 1];
    if (t <= b[0]) { const u = (t - a[0]) / (b[0] - a[0]); return [lerpC(a[1], b[1], u), lerpC(a[2], b[2], u)]; }
  }
  return [SKY[5][1], SKY[5][2]];
}
function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else ctx.rect(x, y, w, h); }
const EMOJI_FONT = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';
let particles = [];
function confetti(i, n, gold) {
  if (BOT) return;
  for (let k = 0; k < n; k++) particles.push({ x: door(i) + (Math.random() - 0.5) * 0.6, y: 1 + Math.random() * 2, vx: (Math.random() - 0.5) * 1.6, vy: 1.5 + Math.random() * 2.5,
    c: gold ? pick(['#ffd23f', '#fff3b0', '#ffc23d']) : pick(['#ffd23f', '#ff5c8a', '#3ddc97', '#4ea1ff', '#7b5cff', '#ff8a3d']), life: 1.4 + Math.random() * 0.6, r: Math.random() * 6 });
}

function draw(dtReal) {
  if (!W) return;
  const t = Math.min(1, S.t), night = Math.max(0, (t - 0.8) / 0.2);
  const lw = G.lotW, gy = G.groundY, fh = G.fh;
  const ox = -cam.x * lw;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const [top, bot] = skyAt(t);
  const g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, top); g.addColorStop(1, effect('heat') ? lerpC('#ffb070', '#ffe2a0', 0.5) : bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, gy + 2);
  if (night > 0) { ctx.fillStyle = `rgba(255,255,255,${night * 0.8})`; for (let k = 0; k < 50; k++) ctx.fillRect((k * 97.3) % W, (k * 53.1) % (gy * 0.55), 1.5, 1.5); }
  const ang = Math.PI * (1 - t);
  const sx = W / 2 + Math.cos(ang) * W * 0.42, sy = gy * 0.95 - Math.sin(ang) * gy * 0.8;
  ctx.fillStyle = t < 0.85 ? (effect('heat') ? '#ffe066' : '#fff3b0') : '#f4f1ff';
  ctx.beginPath(); ctx.arc(sx, sy, Math.max(12, fh * 0.28) * (effect('heat') ? 1.4 : 1), 0, 7); ctx.fill();
  drawBackdrop(t, night);
  // lots
  for (let i = 0; i < S.lots.length; i++) {
    const x0 = ox + i * lw;
    if (x0 > W + lw || x0 < -2 * lw) continue;
    drawLot(S.lots[i], i, x0, night);
  }
  drawLinks(ox);
  // pavement + road
  const pav = ch().theme === 'suburb' ? '#d6ccb8' : ch().theme === 'market' ? '#cdbfae' : '#bdb6ae';
  ctx.fillStyle = pav; ctx.fillRect(0, gy, W, G.pavH);
  ctx.fillStyle = 'rgba(0,0,0,.07)';
  for (let x = ox % (lw / 3); x < W; x += lw / 3) ctx.fillRect(x, gy, 1.5, G.pavH);
  ctx.fillStyle = '#8f8576'; ctx.fillRect(0, gy + G.pavH - 5, W, 5);
  ctx.fillStyle = '#3a3550'; ctx.fillRect(0, gy + G.pavH, W, G.roadH);
  ctx.fillStyle = '#ffd23f';
  for (let x = ox % 44 - 44; x < W; x += 44) ctx.fillRect(x, gy + G.pavH + G.roadH / 2 - 1.5, 22, 3);
  drawCity(ox, night);
  const ppl = S.people.filter((p) => !p.hidden).sort((a, b) => a.lane - b.lane);
  for (const p of ppl) drawPerson(p, ox);
  for (const c of S.cars) drawCar(c, ox, night);
  // money floats
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(14 * G.s)}px "Lilita One",sans-serif`;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,50,.8)';
  for (const f of S.fx) {
    ctx.globalAlpha = Math.min(1, f.life * 1.5);
    const x = ox + f.x * lw;
    if (f.big) {
      const age = 2 - f.life, sc = Math.min(1, age * 5) * (1 + Math.max(0, 0.25 - age) * 2);
      const l = S.lots[Math.floor(f.x)];
      const top = gy - fh * ([0.75, 1.15, 1.9, 2.9, 4.3][(l.level || 1) - 1] + 0.7) - f.y * 20;
      ctx.font = `${Math.round(24 * G.s)}px "Lilita One",sans-serif`;
      const half = ctx.measureText(f.txt).width / 2 + 8;
      ctx.save(); ctx.translate(Math.max(half, Math.min(W - half, x)), Math.max(30, top)); ctx.scale(sc, sc); ctx.lineWidth = 6; ctx.strokeStyle = '#c2410c';
      ctx.strokeText(f.txt, 0, 0); ctx.fillStyle = '#ffd23f'; ctx.fillText(f.txt, 0, 0); ctx.restore();
      ctx.font = `${Math.round(14 * G.s)}px "Lilita One",sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,50,.8)';
      continue;
    }
    const y = gy - 6 - f.y * fh * 0.9;
    ctx.strokeText(f.txt, x, y); ctx.fillStyle = f.color; ctx.fillText(f.txt, x, y);
  }
  ctx.globalAlpha = 1;
  // confetti
  for (const p of particles) {
    p.life -= dtReal; p.x += p.vx * dtReal * 0.5; p.y += p.vy * dtReal; p.vy -= 5 * dtReal; p.r += dtReal * 8;
    ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.save(); ctx.translate(ox + p.x * lw, gy - p.y * fh); ctx.rotate(p.r); ctx.fillRect(-3, -2, 6, 4); ctx.restore();
  }
  particles = particles.filter((p) => p.life > 0 && p.y > -1);
  ctx.globalAlpha = 1;
  // weather
  if (effect('rain')) {
    ctx.strokeStyle = 'rgba(200,220,255,.45)'; ctx.lineWidth = 1.2; ctx.beginPath();
    const tt = performance.now() / 1000;
    for (let k = 0; k < 90; k++) { const x = ((k * 61.7 + tt * 40) % (W + 40)) - 20, y = ((k * 37.3 + tt * 520) % (H + 20)) - 20; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); }
    ctx.stroke(); ctx.fillStyle = 'rgba(40,50,90,.18)'; ctx.fillRect(0, 0, W, H);
  }
  if (night > 0) { ctx.fillStyle = `rgba(20,10,60,${night * 0.1})`; ctx.fillRect(0, 0, W, H); }
  // selection
  if (S.tab === 'shop' && S.sel >= 0) {
    const x = ox + S.sel * lw;
    ctx.strokeStyle = '#ffc23d'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    rr(x + 3, 8, lw - 6, gy - 8 + G.pavH * 0.3, 10); ctx.stroke(); ctx.setLineDash([]);
  }
  drawMinimap();
}
function drawBackdrop(t, night) {
  const theme = ch().theme;
  const gy = G.groundY;
  for (const b of backdrop) {
    const x = b.x - cam.x * G.lotW * b.layer;
    if (x > W + 10 || x + b.w < -10) continue;
    const far = b.layer === 0.3;
    if (theme === 'suburb') {
      const col = lerpC(far ? '#a6d7a0' : '#7cc47f', far ? '#2b3c55' : '#23334a', Math.min(1, t * 1.05));
      if (b.kind === 'tree') {
        ctx.fillStyle = lerpC('#7a5a3a', '#2a2238', t); ctx.fillRect(x + b.w / 2 - 2, gy - b.h * 0.4, 4, b.h * 0.4);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + b.w / 2, gy - b.h * 0.55, b.w / 2, 0, 7); ctx.fill();
      } else {
        const hc = lerpC(['#f4d6b5', '#cfe3f2', '#f2c6c6', '#e8e1c0'][Math.floor(b.hue * 4)], '#2a2448', Math.min(1, t * 1.05));
        ctx.fillStyle = hc; ctx.fillRect(x, gy - b.h, b.w, b.h);
        ctx.fillStyle = lerpC('#b5543a', '#2a1f3a', t); ctx.beginPath(); ctx.moveTo(x - 5, gy - b.h); ctx.lineTo(x + b.w / 2, gy - b.h - b.w * 0.4); ctx.lineTo(x + b.w + 5, gy - b.h); ctx.fill();
        ctx.fillStyle = night > 0.2 ? '#ffd77a' : 'rgba(60,80,120,.5)'; ctx.fillRect(x + b.w * 0.2, gy - b.h * 0.7, b.w * 0.18, b.h * 0.25); ctx.fillRect(x + b.w * 0.62, gy - b.h * 0.7, b.w * 0.18, b.h * 0.25);
      }
    } else {
      ctx.fillStyle = lerpC(far ? '#a9bfe8' : '#8aa3d6', far ? '#2a2252' : '#211b45', Math.min(1, t * 1.1));
      ctx.globalAlpha = far ? 0.55 : 0.75;
      ctx.fillRect(x, gy - b.h, b.w, b.h);
      if (b.kind === 'spire') { ctx.beginPath(); ctx.moveTo(x + b.w * 0.2, gy - b.h); ctx.lineTo(x + b.w / 2, gy - b.h - b.w); ctx.lineTo(x + b.w * 0.8, gy - b.h); ctx.fill(); }
      if (night > 0.2) {
        ctx.globalAlpha = night * 0.7; ctx.fillStyle = '#ffd77a';
        for (let yy = gy - b.h + 8; yy < gy - 6; yy += 12) for (let xx = x + 5; xx < x + b.w - 5; xx += 10) if (((xx * 7 + yy * 13 + b.win * 100) | 0) % 5 === 0) ctx.fillRect(xx, yy, 3, 4);
      }
      ctx.globalAlpha = 1;
    }
  }
  if (ch().theme === 'market' || effect('fest')) {
    // bunting across the street
    ctx.strokeStyle = 'rgba(80,60,60,.6)'; ctx.lineWidth = 1;
    const y0 = G.groundY - G.fh * 1.65;
    for (let k = -1; k < G.N + 1; k++) {
      const x0 = (k - cam.x) * G.lotW, x1 = x0 + G.lotW;
      if (x1 < 0 || x0 > W) continue;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + G.lotW / 2, y0 + 16, x1, y0); ctx.stroke();
      for (let f = 1; f < 6; f++) {
        const u = f / 6, fx = x0 + G.lotW * u, fy = y0 + 16 * 2 * u * (1 - u) * 1.0;
        ctx.fillStyle = ['#ff5c8a', '#ffd23f', '#3ddc97', '#4ea1ff', '#ff8a3d'][(k + f + 10) % 5];
        ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.lineTo(fx + 4, fy); ctx.lineTo(fx, fy + 9); ctx.fill();
      }
    }
  }
}
function drawLot(l, i, x0, night) {
  const w = G.lotW, gy = G.groundY, fh = G.fh;
  const lit = night > 0.15;
  if (!l.owner || (l.owner === 'you' && !l.type)) {
    ctx.fillStyle = l.owner ? '#7fd18b' : '#6fbf73'; ctx.fillRect(x0 + 2, gy - 8, w - 4, 8);
    ctx.fillStyle = '#e9dcc3';
    for (let x = x0 + 6; x < x0 + w - 6; x += Math.max(7, w / 9)) ctx.fillRect(x, gy - fh * 0.32, 3, fh * 0.32);
    ctx.fillRect(x0 + 4, gy - fh * 0.26, w - 8, 3); ctx.fillRect(x0 + 4, gy - fh * 0.14, w - 8, 3);
    const sw = Math.min(w * 0.8, 120), sh = Math.max(28, Math.min(48, fh * 0.5)), sx = x0 + (w - sw) / 2, sy = gy - fh * 0.32 - sh - fh * 0.25;
    ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x0 + w / 2 - 2, sy + sh, 4, fh * 0.6);
    const locked = !has('lots') && !l.owner;
    rr(sx, sy, sw, sh, 7); ctx.fillStyle = l.owner ? '#3ddc97' : locked ? '#d9d2c4' : '#fff4e0'; ctx.fill();
    ctx.fillStyle = '#1d1633'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.max(10, Math.min(17, sw / 6.2));
    ctx.font = `${fs}px "Lilita One",sans-serif`;
    if (l.owner) { ctx.fillText('BUILD', x0 + w / 2, sy + sh * 0.35); ctx.fillText('HERE', x0 + w / 2, sy + sh * 0.72); }
    else if (locked) { ctx.fillStyle = '#6d6680'; ctx.fillText('SOON', x0 + w / 2, sy + sh * 0.52); }
    else { ctx.fillText('FOR SALE', x0 + w / 2, sy + sh * 0.35); ctx.fillStyle = '#c2410c'; ctx.fillText(money(lotPrice()), x0 + w / 2, sy + sh * 0.72); }
    return;
  }
  const riv = l.owner === 'rival';
  const T = riv ? rt() : TYPES[l.type], L = l.level;
  const building = l.buildT > 0;
  const pop = l.pop > 0 ? 1 + Math.sin(l.pop * Math.PI) * 0.1 : 1;
  ctx.save(); ctx.translate(x0 + w / 2, gy); ctx.scale(1 / Math.sqrt(pop), pop);
  if (building) ctx.globalAlpha = 0.35 + 0.65 * (1 - l.buildT);
  const bw = w * [0.62, 0.78, 0.88, 0.92, 0.92][L - 1], bh = fh * [0.75, 1.15, 1.9, 2.9, 4.3][L - 1];
  const X = -bw / 2, Y = -bh;
  const main = T.c1, accent = T.c2, roof = T.roof;
  if (L === 1) {
    const cw = bw, chh = fh * 0.42;
    ctx.fillStyle = main; rr(-cw / 2, -chh - fh * 0.12, cw, chh, 5); ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(-cw / 2, -chh - fh * 0.12, cw, chh * 0.22);
    ctx.fillStyle = '#333';
    for (const wx of [-cw * 0.3, cw * 0.3]) { ctx.beginPath(); ctx.arc(wx, -fh * 0.1, fh * 0.1, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#777'; ctx.fillRect(-1.5, -bh - fh * 0.1, 3, bh - chh);
    const ur = cw * 0.62;
    ctx.beginPath(); ctx.moveTo(-ur, -chh - fh * 0.25); ctx.quadraticCurveTo(0, -bh - fh * 0.55, ur, -chh - fh * 0.25); ctx.closePath();
    ctx.fillStyle = riv ? accent : roof; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let k = -3; k < 3; k += 2) ctx.fillRect((k * ur) / 3, -bh - fh, ur / 3, fh * 2); ctx.restore();
    icon(l, 0, -chh * 0.55 - fh * 0.12, Math.min(cw * 0.5, fh * 0.32));
  } else {
    ctx.fillStyle = main; rr(X, Y, bw, bh, L >= 4 ? 4 : 6); ctx.fill();
    // side shade
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(X + bw * 0.86, Y, bw * 0.14, bh);
    const ground = fh * 0.95;
    if (L >= 3) {
      const rows = Math.max(1, Math.round((bh - ground - fh * 0.45) / (fh * 0.5)));
      const cols = L >= 4 ? 4 : 3;
      const ww = bw / (cols * 1.6), wh = fh * 0.28;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wx = X + (bw * (c + 0.5)) / cols - ww / 2, wy = -ground - fh * 0.42 - ((r + 0.5) * (bh - ground - fh * 0.45)) / rows - wh / 2;
        ctx.fillStyle = lit && (r * 3 + c + i) % 4 !== 0 ? '#ffe08a' : 'rgba(30,40,70,.5)'; rr(wx, wy, ww, wh, 2); ctx.fill();
      }
    }
    const gw = bw * 0.86;
    ctx.fillStyle = lit ? '#fff1b8' : 'rgba(190,230,255,.92)'; rr(X + bw * 0.07, -ground * 0.78, gw, ground * 0.62, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(X + bw * 0.12, -ground * 0.74, gw * 0.12, ground * 0.5);
    ctx.fillStyle = riv ? T.dark : 'rgba(40,30,60,.78)'; ctx.fillRect(-bw * 0.09, -ground * 0.7, bw * 0.18, ground * 0.7);
    const ay = -ground, ah = fh * 0.18;
    ctx.fillStyle = riv ? accent : roof; ctx.fillRect(X - 2, ay - ah, bw + 4, ah);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let k = 0; k < 8; k += 2) ctx.fillRect(X - 2 + ((bw + 4) * k) / 8, ay - ah, (bw + 4) / 8, ah);
    ctx.fillStyle = riv ? T.roof : roof; ctx.fillRect(X - 3, Y - 4, bw + 6, 6);
    if (L >= 4) { ctx.fillStyle = '#9aa0b5'; ctx.fillRect(X + bw * 0.12, Y - fh * 0.16, bw * 0.18, fh * 0.12); ctx.fillRect(X + bw * 0.62, Y - fh * 0.12, bw * 0.12, fh * 0.08); }
    if (L === 5) {
      ctx.fillStyle = '#bbb'; ctx.fillRect(-1.5, Y - fh * 0.7, 3, fh * 0.6);
      ctx.fillStyle = Math.floor(performance.now() / 500) % 2 ? '#ff3b4f' : '#ffb3ba'; ctx.beginPath(); ctx.arc(0, Y - fh * 0.72, 3.5, 0, 7); ctx.fill();
    }
    const signH = Math.max(16, fh * 0.32), signY = L === 2 ? Y - signH * 0.6 : -ground - ah - signH - 2;
    ctx.fillStyle = riv ? accent : accent; rr(X + bw * 0.1, signY, bw * 0.8, signH, 5); ctx.fill();
    if ((L >= 4 || l.sig) && lit && !riv) { ctx.save(); ctx.shadowColor = l.sig ? '#ffd23f' : accent; ctx.shadowBlur = 18; ctx.strokeStyle = l.sig ? '#ffd23f' : accent; ctx.lineWidth = 2; rr(X + bw * 0.1, signY, bw * 0.8, signH, 5); ctx.stroke(); ctx.restore(); }
    icon(l, 0, signY + signH / 2, signH * 0.72);
    if (l.sig) { ctx.font = `${Math.round(signH * 0.7)}px ${EMOJI_FONT}`; ctx.fillText('✨', X + bw * 0.86, signY); }
    if (l.flash === S.day || (riv && S.rival.war > 0)) {
      ctx.fillStyle = '#ff3b4f'; rr(X + bw * 0.15, -ground * 0.98, bw * 0.7, fh * 0.22, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `${Math.round(fh * 0.17)}px "Lilita One",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(riv ? '−30%' : 'SALE', 0, -ground * 0.98 + fh * 0.11);
    }
  }
  ctx.globalAlpha = 1;
  if (building) {
    // scaffolding
    ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 2;
    const sh = bh + fh * 0.2;
    for (let y = 0; y > -sh; y -= fh * 0.4) { ctx.beginPath(); ctx.moveTo(X - 4, y); ctx.lineTo(X + bw + 4, y); ctx.stroke(); }
    for (const x of [X - 4, 0, X + bw + 4]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -sh); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,176,32,.6)'; ctx.beginPath(); ctx.moveTo(X - 4, 0); ctx.lineTo(X + bw + 4, -sh); ctx.stroke();
  }
  ctx.restore();
  // label under shop: stars or rival name
  const fs = Math.max(9, Math.min(13, w / 7));
  ctx.font = `600 ${fs}px Fredoka,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lab = riv ? T.name.toUpperCase() : '★'.repeat(Math.round(l.rating));
  const ly = gy + G.pavH - 13;
  if (w > 40) {
    ctx.fillStyle = 'rgba(20,15,38,.6)';
    const tw = ctx.measureText(lab).width + 12;
    rr(x0 + w / 2 - tw / 2, ly - fs * 0.68, tw, fs * 1.36, fs * 0.68); ctx.fill();
    ctx.fillStyle = riv ? '#ff9aa5' : '#ffc23d'; ctx.fillText(lab, x0 + w / 2, ly);
  }
  if (l.type && l.owner === 'you' && l.queue.length >= LV.cap[l.level - 1]) {
    ctx.font = `${fs + 3}px ${EMOJI_FONT}`; ctx.fillText('⚠️', x0 + w * 0.86, gy - fh * 0.25);
  }
}
function icon(l, x, y, size) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (l.owner === 'rival') {
    const T = rt(); const txt = size > 24 ? T.short : T.short[0];
    ctx.font = `${Math.round(size * (txt.length > 2 ? 0.8 : 0.95))}px "Lilita One",sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y + size * 0.05); return;
  }
  ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`; ctx.fillText(TYPES[l.type].icon, x, y + size * 0.06);
}
function drawLinks(ox) {
  const gy = G.groundY, fh = G.fh;
  const tt = performance.now() / 1000;
  for (const k of linkCache) {
    const x = ox + (k.a + 1) * G.lotW;
    if (x < -40 || x > W + 40) continue;
    const y = gy - fh * 1.05;
    const r = Math.max(11, Math.min(18, G.lotW * 0.16));
    ctx.save();
    if (k.kind === 'combo') {
      const pulse = 1 + Math.sin(tt * 3) * 0.05;
      const pct = Math.round(20 * (k.sig ? 2 : 1) * (perk('combo') ? 1.5 : 1));
      const txt = '+' + pct + '%';
      const fs = Math.round(r * 0.95);
      ctx.translate(x, y); ctx.scale(pulse, pulse);
      ctx.font = `${fs}px "Lilita One",sans-serif`;
      const tw = ctx.measureText(txt).width + fs * 0.9;
      rr(-tw / 2, -r * 0.75, tw, r * 1.5, r * 0.75); ctx.fillStyle = k.sig ? '#ffd23f' : '#3ddc97'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = k.sig ? '#5a3a00' : '#0d3b27'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 1);
    } else {
      ctx.translate(x, y);
      ctx.fillStyle = '#ff5c6c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `${Math.round(r)}px "Lilita One",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('=', 0, 1);
    }
    ctx.restore();
  }
}
function drawPerson(p, ox) {
  const s = G.s * (p.kid ? 0.8 : 1), x = ox + p.x * G.lotW, y = G.groundY + G.pavH * (0.28 + p.lane * 0.45);
  if (x < -20 || x > W + 20) return;
  const walking = p.state !== 'queue', sw = walking ? Math.sin(p.ph) * 3 * s : 0;
  ctx.strokeStyle = p.pants; ctx.lineWidth = 2.4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 7 * s); ctx.lineTo(x + sw, y); ctx.moveTo(x, y - 7 * s); ctx.lineTo(x - sw, y); ctx.stroke();
  ctx.fillStyle = p.shirt; rr(x - 3.5 * s, y - 15 * s, 7 * s, 9 * s, 2.5 * s); ctx.fill();
  if (p.bag) { ctx.fillStyle = p.bag; rr(x + p.dir * 3.5 * s, y - 10 * s, 4 * s, 5 * s, 1); ctx.fill(); }
  ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(x, y - 18.5 * s, 3.6 * s, 0, 7); ctx.fill();
  ctx.fillStyle = p.hat || p.hair; ctx.beginPath(); ctx.arc(x, y - 19.5 * s, 3.7 * s, Math.PI, 0); ctx.fill();
  if (p.hat) ctx.fillRect(x - (p.dir > 0 ? 0 : 5 * s), y - 19.8 * s, 5 * s, 1.4 * s);
  if (p.mood) { ctx.font = `${Math.round(13 * G.s)}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.mood.e, x, y - 30 * s); }
}
function drawCar(c, ox, night) {
  const s = G.s, x = ox + c.x * G.lotW, y = G.groundY + G.pavH + G.roadH * (c.dir > 0 ? 0.74 : 0.34);
  if (x < -40 || x > W + 40) return;
  const w = (c.kind === 'van' ? 34 : 26) * s, h = (c.kind === 'van' ? 13 : 9) * s;
  ctx.fillStyle = c.c; rr(x - w / 2, y - h, w, h, 3 * s); ctx.fill();
  if (c.kind !== 'van') { rr(x - w * 0.28, y - h - 6 * s, w * 0.5, 7 * s, 3 * s); ctx.fill(); }
  ctx.fillStyle = 'rgba(200,235,255,.9)'; ctx.fillRect(x + c.dir * w * 0.12 - 3 * s, y - h - (c.kind === 'van' ? -2 : 4.5) * s, 6 * s, 3.5 * s);
  ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(x - w * 0.3, y, 3 * s, 0, 7); ctx.arc(x + w * 0.3, y, 3 * s, 0, 7); ctx.fill();
  if (night > 0.3) { ctx.fillStyle = 'rgba(255,240,170,.85)'; ctx.beginPath(); ctx.arc(x + (c.dir * w) / 2, y - h * 0.5, 2 * s, 0, 7); ctx.fill(); }
}
function drawCity(ox, night) {
  const gy = G.groundY, s = G.s, fh = G.fh, lw = G.lotW;
  if (S.city.lights) {
    for (let i = 0; i <= G.N; i += 2) {
      const x = ox + i * lw; if (x < -60 || x > W + 60) continue;
      ctx.fillStyle = '#4a4560'; ctx.fillRect(x - 1.5, gy - fh * 1.3, 3, fh * 1.3 + G.pavH * 0.2);
      ctx.fillStyle = night > 0.1 ? '#fff1a8' : '#ddd'; ctx.beginPath(); ctx.arc(x, gy - fh * 1.3, 4 * s, 0, 7); ctx.fill();
      if (night > 0.1) { const gr = ctx.createRadialGradient(x, gy - fh * 1.3, 0, x, gy - fh * 1.3, fh * 1.2); gr.addColorStop(0, `rgba(255,240,160,${0.45 * night})`); gr.addColorStop(1, 'rgba(255,240,160,0)'); ctx.fillStyle = gr; ctx.fillRect(x - fh * 1.2, gy - fh * 2.5, fh * 2.4, fh * 2.6); }
    }
  }
  if (S.city.bus) {
    const x = ox + G.N * lw - lw * 0.22;
    ctx.fillStyle = '#4ea1ff'; ctx.fillRect(x - 1.5, gy - fh * 0.9 + G.pavH * 0.3, 3, fh * 0.9);
    rr(x - 9 * s, gy - fh * 0.9 + G.pavH * 0.3 - 10 * s, 18 * s, 12 * s, 3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(9 * s)}px "Lilita One",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BUS', x, gy - fh * 0.9 + G.pavH * 0.3 - 4 * s);
  }
  if (S.city.park) {
    for (let k = 0; k < G.N; k += 3) {
      const x = ox + (k + 0.03) * lw + 4;
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 2, gy + G.pavH * 0.05 - fh * 0.5, 4, fh * 0.5);
      ctx.fillStyle = '#3ddc97'; ctx.beginPath(); ctx.arc(x, gy - fh * 0.6, fh * 0.28, 0, 7); ctx.fill();
    }
  }
  if (S.city.metro) {
    const x = ox + lw * 0.12;
    ctx.fillStyle = '#1f4fbf'; rr(x - 10 * s, gy + G.pavH * 0.1 - 22 * s, 20 * s, 18 * s, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(13 * s)}px "Lilita One",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', x, gy + G.pavH * 0.1 - 13 * s);
  }
}
// Minimap of all lots, for small screens where the street pans.
let miniRect = null;
function drawMinimap() {
  miniRect = null;
  if (G.maxCam <= 0) return;
  const N = G.N, cw = Math.min(22, (W * 0.5) / N), chh = 12, pad = 6;
  const w = N * cw + pad * 2, x0 = W - w - 8, y0 = 8;
  ctx.fillStyle = 'rgba(20,15,38,.6)'; rr(x0, y0, w, chh + pad * 2, 9); ctx.fill();
  for (let i = 0; i < N; i++) {
    const l = S.lots[i];
    ctx.fillStyle = l.owner === 'you' ? '#3ddc97' : l.owner === 'rival' ? '#ff5c6c' : 'rgba(255,255,255,.3)';
    rr(x0 + pad + i * cw + 1.5, y0 + pad, cw - 3, chh, 3); ctx.fill();
  }
  ctx.strokeStyle = '#ffc23d'; ctx.lineWidth = 2;
  rr(x0 + pad + cam.x * cw, y0 + pad - 3, G.vis * cw, chh + 6, 5); ctx.stroke();
  miniRect = { x0: x0 + pad, y0, cw, w: N * cw, h: chh + pad * 2 };
  // edge arrows
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = `${Math.round(22 * Math.min(1.3, G.s))}px "Lilita One",sans-serif`; ctx.textBaseline = 'middle';
  const ay = G.groundY * 0.5;
  if (cam.x > 0.05) { ctx.textAlign = 'left'; ctx.fillText('‹', 6, ay); }
  if (cam.x < G.maxCam - 0.05) { ctx.textAlign = 'right'; ctx.fillText('›', W - 6, ay); }
}
function focusLot(i) {
  if (G.maxCam <= 0) return;
  const left = i - 0.15, right = i + 1.15;
  if (left < cam.x) cam.target = Math.max(0, left);
  else if (right > cam.x + G.vis) cam.target = Math.min(G.maxCam, right - G.vis);
}

/* ---------------- input ---------------- */
let drag = null;
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture?.(e.pointerId);
  drag = { x: e.clientX, cam: cam.x, moved: false, t: performance.now(), lastX: e.clientX, lastT: performance.now() };
  cam.vx = 0; cam.target = null;
});
cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 8) drag.moved = true;
  if (drag.moved && G.maxCam > 0) {
    cam.x = Math.max(0, Math.min(G.maxCam, drag.cam - dx / G.lotW));
    const now = performance.now();
    cam.vx = (-(e.clientX - drag.lastX) / G.lotW) / Math.max(1, now - drag.lastT) * 1000;
    drag.lastX = e.clientX; drag.lastT = now;
  }
});
cv.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const wasDrag = drag.moved; drag = null;
  if (wasDrag) return;
  cam.vx = 0;
  const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  if (miniRect && y >= miniRect.y0 && y <= miniRect.y0 + miniRect.h && x >= miniRect.x0 && x <= miniRect.x0 + miniRect.w) {
    const i = Math.max(0, Math.min(G.N - 1, Math.floor((x - miniRect.x0) / miniRect.cw)));
    cam.target = Math.max(0, Math.min(G.maxCam, i + 0.5 - G.vis / 2)); sfx('tick'); return;
  }
  const i = Math.max(0, Math.min(S.lots.length - 1, Math.floor(x / G.lotW + cam.x)));
  selectLot(i);
});
cv.addEventListener('pointercancel', () => { drag = null; });
function selectLot(i) {
  S.sel = i; S.tab = 'shop'; sfx('ui_tap'); focusLot(i); renderPanel();
  const l = S.lots[i]; l.pop = Math.max(l.pop, 0.35);
}
document.getElementById('bPause').onclick = () => { if (!modalOpen()) { S.paused = !S.paused; sfx('tick'); hudControls(); } };
document.getElementById('bSpeed').onclick = () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; sfx('tick'); hudControls(); };
document.getElementById('bMenu').onclick = () => { if (!modalOpen()) showMenu(); };
document.addEventListener('keydown', (e) => {
  if (modalOpen()) { if (e.key === 'Enter' || e.key === ' ') { const b = MC.querySelector('.btn.go'); if (b) { e.preventDefault(); b.click(); } } return; }
  if (e.key === ' ') { e.preventDefault(); S.paused = !S.paused; hudControls(); }
  else if (e.key === 'ArrowRight') selectLot(Math.min(S.lots.length - 1, S.sel + 1));
  else if (e.key === 'ArrowLeft') selectLot(Math.max(0, S.sel - 1));
  else if (['1', '2', '3'].includes(e.key)) { S.speed = +e.key; hudControls(); }
});
document.addEventListener('gesturestart', (e) => e.preventDefault());
function hudControls() {
  const b = document.getElementById('bPause'); const p = S.paused && !modalOpen();
  b.innerHTML = p ? '▶' : '❚❚'; b.classList.toggle('on', p); b.setAttribute('aria-label', p ? 'Play' : 'Pause');
  const sp = document.getElementById('bSpeed'); sp.textContent = S.speed + '×'; sp.classList.toggle('on', S.speed > 1);
}

/* ---------------- panel ---------------- */
const P = document.getElementById('panel');
function starStr(r) {
  const n = Math.round(r * 2) / 2;
  return '★'.repeat(Math.floor(n)) + (n % 1 ? '<span class="half">★</span>' : '') + '<span class="off">' + '★'.repeat(5 - Math.ceil(n)) + '</span>';
}
function btn(kind, arg, t, s, c, extra = '', unit = '$') {
  const cost = c == null ? '' : c;
  const cl = c == null ? '' : unit === '❤️' ? `<span class="c fan">${c} ❤️</span>` : `<span class="c">${money(c)}</span>`;
  return `<button class="act ${extra}" data-k="${kind}" data-a="${arg ?? ''}" data-cost="${unit === '$' ? cost : ''}" data-fans="${unit === '❤️' ? cost : ''}"><span class="t">${t}</span>${s ? `<span class="s">${s}</span>` : ''}${cl}</button>`;
}
function renderPanel() {
  if (!S) return;
  const l = S.lots[S.sel];
  const tabName = !l.owner ? `Lot ${S.sel + 1}` : l.owner === 'rival' ? rt().name : l.type ? TYPES[l.type].name : `Lot ${S.sel + 1}`;
  const tabs = `<div class="tabs"><button data-tab="shop" class="${S.tab === 'shop' ? 'on' : ''}">${tabName}</button><button data-tab="plan" class="${S.tab === 'plan' ? 'on' : ''}">Boss plan${activeTasks().length ? ` <i class="dot">${activeTasks().length}</i>` : ''}</button></div>`;
  let h = '';
  if (S.tab === 'plan') h = planPanel();
  else if (!l.owner) h = lotPanel(l);
  else if (l.owner === 'you' && !l.type) h = buildPanel(l);
  else if (l.owner === 'you') h = shopPanel(l);
  else h = rivalPanel(l);
  if (S.tab !== 'plan') h += streetList();
  P.innerHTML = tabs + `<div class="pbody">${h}</div>`;
  P.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; sfx('ui_tap'); renderPanel(); }));
  P.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => act(b.dataset.k, b.dataset.a)));
  P.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => selectLot(+b.dataset.go)));
  const m = document.getElementById('pMenu'); if (m) m.onclick = showMenu;
  refreshAfford();
  hudPills();
}
// Overview of every lot. Shown only on wide screens, where the panel has room.
function streetList() {
  const rows = S.lots.map((l, i) => {
    let ic, name, info, cls = '';
    if (l.owner === 'you' && l.type) { const T = TYPES[l.type]; ic = T.icon; name = `${T.name} <span class="lvl">${'●'.repeat(l.level)}</span>`; info = `<b>${money(l.today.rev)}</b> today`; }
    else if (l.owner === 'you') { ic = '🏗️'; name = 'Your empty lot'; info = 'Pick a shop'; }
    else if (l.owner === 'rival') { ic = rt().short[0]; name = rt().name; info = `${l.today.served} customers`; cls = 'riv'; }
    else { ic = has('lots') ? '🪧' : '🚧'; name = has('lots') ? 'For sale' : 'Not for sale yet'; info = has('lots') ? money(lotPrice()) : ''; cls = 'free'; }
    return `<button class="srow ${cls} ${i === S.sel ? 'on' : ''}" data-go="${i}"><span class="n">${i + 1}</span><span class="i">${ic}</span><span class="nm">${name}</span><span class="inf">${info}</span></button>`;
  }).join('');
  return `<div class="sec wide-only"><b>Your street</b><div class="slist">${rows}</div></div>`;
}
function hint() {
  const shops = own('you').filter((l) => l.type);
  if (S.ch === 0 && S.day === 1 && !shops.some((l) => l.level >= 2)) return `<div class="hint">People walk by, and some buy lemonade. When you have ${money(upCost(shops[0]))}, tap <b>Build up</b> to turn your cart into a kiosk.</div>`;
  if (S.ch === 0 && has('lots') && youCount() === 1) return `<div class="hint">Tap a <b>FOR SALE</b> lot to buy it before ${rt().name} does. Own ${ch().goal} lots to win this street.</div>`;
  return '';
}
function neighborsText(i, type) {
  if (!has('combos')) return '';
  const parts = partners(type).filter((p) => ch().types.includes(p));
  const out = [];
  for (const j of [i - 1, i + 1]) {
    const n = S.lots[j];
    if (!n || !isShop(n)) continue;
    const name = comboName(type, n.type);
    if (name) out.push(`<span class="chip good">🔗 ${name} with ${TYPES[n.type].icon} lot ${j + 1}</span>`);
    else if (n.type === type) out.push(`<span class="chip bad">Too alike: ${TYPES[n.type].icon} lot ${j + 1} steals customers</span>`);
  }
  if (out.length > 1 && out.every((o) => o.includes('good'))) {
    const names = linkCache.filter((x) => x.kind === 'combo' && (x.a === i || x.b === i)).map((x) => x.name);
    return `<div class="chips"><span class="chip good">🔗 ${names.length} combos: ${names.join(' + ')}</span></div>`;
  }
  if (!out.length && parts.length) out.push(`<span class="chip">Combo partners: ${parts.map((p) => TYPES[p].icon + ' ' + TYPES[p].name).join(', ')}</span>`);
  return `<div class="chips">${out.join('')}</div>`;
}
function shopPanel(l) {
  const T = TYPES[l.type], i = S.lots.indexOf(l), L = l.level, cap = ch().levelCap;
  const lost = l.today.lost > 0 ? `<span>Walked away <b class="neg" id="stLost">${l.today.lost}</b></span>` : `<span>Walked away <b id="stLost">0</b></span>`;
  let h = `<div class="phead"><div class="ic" style="background:${T.c1}">${T.icon}</div><div class="hd"><h2>${l.sig ? T.sig : T.name + ' ' + LV.name[L - 1]}</h2><p><span class="stars">${starStr(l.rating)}</span> <span class="lvl">${'●'.repeat(L)}<span class="off">${'●'.repeat(cap - L)}</span></span> · ${T.tag}</p></div></div>
  <div class="stats"><span>Today <b id="stRev">${money(l.today.rev)}</b></span><span>Sold <b id="stSold">${l.today.served}</b></span>${lost}<span>Costs <b>${money(dayCosts(l))}</b>/night</span></div>`;
  h += hint() + neighborsText(i, l.type);
  h += `<div class="grid one">`;
  if (L < cap) h += btn('up', '', `Build up → ${LV.name[L]}`, `+${Math.round((LV.appeal[L] / LV.appeal[L - 1] - 1) * 100)}% visitors, ${money(ticket({ ...l, level: L + 1 }))} a sale`, upCost(l), 'big');
  else if (L < 5) h += `<div class="act big max"><span class="t">Biggest size here</span><span class="s">Bigger buildings come in the next street</span></div>`;
  else h += `<div class="act big max"><span class="t">Tower!</span><span class="s">As big as it gets</span></div>`;
  h += `</div>`;
  let small = '';
  if (has('staff')) small += btn('staff', '', `Staff ${l.staff}/3`, `Serve ${servers(l) + 1} at once`, l.staff < 3 ? staffCost(l) : null, l.staff >= 3 ? 'max' : '');
  if (has('quality')) small += btn('qual', '', `Quality ${l.quality}/3`, 'More stars', l.quality < 3 ? qualCost(l) : null, l.quality >= 3 ? 'max' : '');
  if (has('fans')) small += btn('camp', 'flash', l.flash === S.day ? 'Sale is on!' : '⚡ Flash sale', '+80% visitors today', l.flash === S.day ? null : CAMPAIGNS.flash.fans, l.flash === S.day ? 'max' : '', '❤️');
  if (has('signature')) {
    if (l.sig) small += `<div class="act max gold"><span class="t">✨ ${T.sig}</span><span class="s">+25% price, combos ×2</span></div>`;
    else if (L >= 4) small += btn('sig', '', `✨ ${T.sig}`, '+25% price, combos ×2', sigCost(l), 'gold');
    else small += `<div class="act max"><span class="t">✨ Signature</span><span class="s">Needs a Store (size 4)</span></div>`;
  }
  const n = (small.match(/class="act/g) || []).length;
  if (n) h += `<div class="grid small n${n}">${small}</div>`;
  h += `<div class="price"><span>Price</span><div class="grid">`;
  for (let k = 0; k < 3; k++) h += `<button class="act ${l.price === k ? 'sel' : ''}" data-k="price" data-a="${k}"><span class="t">${PRICE.name[k]}</span><span class="c">${money(ticket(l, k))}</span></button>`;
  h += `</div></div>`;
  return h;
}
function lotPanel(l) {
  const i = S.sel;
  if (!has('lots')) return `<div class="phead"><div class="ic" style="background:#9a92ad">🚧</div><div class="hd"><h2>Lot ${i + 1}</h2><p>This lot is not for sale yet. Grow your cart first!</p></div></div>${hint()}`;
  const nb = [i - 1, i + 1].map((j) => S.lots[j]).filter((n) => n && n.type).map((n) => (n.owner === 'you' ? TYPES[n.type].icon + ' your ' + TYPES[n.type].name : rt().name)).join(' and ');
  return `<div class="phead"><div class="ic" style="background:#6fbf73">🏗️</div><div class="hd"><h2>Lot ${i + 1} for sale</h2><p>${nb ? 'Next to ' + nb + '.' : 'An empty lot.'} Buy it, then build any shop.</p></div></div>
  ${hint()}
  <div class="grid">${btn('buyLot', '', `Buy lot ${i + 1}`, `You need ${ch().goal} lots to win. Each new lot costs more.`, lotPrice(), 'big')}</div>
  ${raceLine()}`;
}
function raceLine() {
  return `<p class="stats">You own <b class="pos">${youCount()}</b> of ${ch().goal} lots. ${rt().name} owns <b class="neg">${rivCount()}</b> and needs ${ch().rivalGoal}.</p>`;
}
function buildPanel(l) {
  const i = S.sel;
  let h = `<div class="phead"><div class="ic" style="background:#3ddc97">🏗️</div><div class="hd"><h2>Pick a shop for lot ${i + 1}</h2><p>${has('combos') ? 'A 🔗 means it makes a combo with a neighbor.' : 'Different shops on one street bring more visitors.'}</p></div></div><div class="types">`;
  for (const k of ch().types) {
    const T = TYPES[k];
    let badge = '';
    if (has('combos')) {
      for (const j of [i - 1, i + 1]) { const n = S.lots[j]; if (n && isShop(n)) { if (comboName(k, n.type)) badge = '<i class="bdg good">🔗 Combo</i>'; else if (n.type === k && !badge) badge = '<i class="bdg bad">Too alike</i>'; } }
    }
    h += `<button class="act type" data-k="build" data-a="${k}" data-cost="${T.build}">${badge}<span class="e">${T.icon}</span><span class="t">${T.name}</span><span class="s">${money(T.price)} a sale · ${T.tag}</span><span class="c">${money(T.build)}</span></button>`;
  }
  const next = CHAPTERS.slice(S.ch + 1).flatMap((c) => c.types).filter((k, n, a) => !ch().types.includes(k) && a.indexOf(k) === n);
  for (const k of next.slice(0, 1)) h += `<div class="act type locked"><span class="e">🔒</span><span class="t">${TYPES[k].name}</span><span class="s">In the next street</span></div>`;
  return h + `</div>`;
}
function rivalPanel(l) {
  const i = S.lots.indexOf(l), T = rt();
  return `<div class="phead"><div class="ic" style="background:${T.c2}">${T.short[0]}</div><div class="hd"><h2>${T.name} ${LV.name[l.level - 1]}</h2><p><span class="stars">${starStr(l.rating)}</span> · Your rival on lot ${i + 1}</p></div></div>
  <div class="stats"><span>Today <b id="stRev">${money(l.today.rev)}</b></span><span>Sold <b id="stSold">${l.today.served}</b></span>${S.rival.war > 0 ? '<span class="neg"><b>Price war!</b></span>' : ''}</div>
  ${has('buyout') ? `<div class="grid">${btn('buyout', '', 'Buy them out', `The lot becomes yours, and ${T.name} loses it.`, buyoutCost(l), 'big')}</div>` : `<div class="hint">Win customers from ${T.name} with better stars, good prices and bigger shops. In Downtown you can even buy them out.</div>`}
  ${raceLine()}`;
}
function planPanel() {
  const C = ch();
  const days = C.days - S.day;
  let h = `<div class="goal"><div class="race-row"><span>You <b class="pos">${youCount()}/${C.goal}</b></span><span>${S.free ? 'Free play' : days === 0 ? 'Last day!' : days + ' days left'}</span><span>${rt().name} <b class="neg">${rivCount()}/${C.rivalGoal}</b></span></div>
  <div class="bar">${S.lots.map((l, i) => `<i data-go="${i}" style="background:${l.owner === 'you' ? 'var(--mint)' : l.owner === 'rival' ? 'var(--red)' : 'var(--panel2)'}"></i>`).join('')}</div>
  <span>${S.free ? 'You won the city. Keep growing your shops as long as you like!' : `<b>${C.name}:</b> own ${C.goal} lots before day ${C.days}. If ${rt().name} gets ${C.rivalGoal} lots first, or your cash is below $0 for two nights, you lose.`}</span></div>`;
  const tasks = activeTasks();
  if (tasks.length) {
    h += `<div class="sec"><b>Tasks</b>`;
    for (const t of tasks) h += `<div class="task"><span>🎯 ${t.t}</span><span class="c">+${money(t.r)}</span></div>`;
    h += `</div>`;
  }
  if (has('fans')) {
    h += `<div class="sec"><b>Campaigns <span class="muted">you have ${S.fans} ❤️ · +${Math.round((fanBoost() - 1) * 100)}% customers</span></b><div class="grid two">`;
    h += btn('camp', 'meetup', `${CAMPAIGNS.meetup.icon} ${CAMPAIGNS.meetup.name}`, CAMPAIGNS.meetup.s, CAMPAIGNS.meetup.fans, '', '❤️');
    h += btn('camp', 'viralvid', `${CAMPAIGNS.viralvid.icon} ${CAMPAIGNS.viralvid.name}`, effect('viralvid') ? 'Running now!' : CAMPAIGNS.viralvid.s, effect('viralvid') ? null : CAMPAIGNS.viralvid.fans, effect('viralvid') ? 'max' : '', '❤️');
    h += `</div><span class="muted">Flash sales are on each shop's page.</span></div>`;
  }
  if (has('city')) {
    h += `<div class="sec city"><b>City projects</b>`;
    for (const k in CITY) {
      const c = CITY[k];
      h += S.city[k] ? `<div class="act row"><span class="t">${c.icon} ${c.name}</span><span class="done">Built</span></div>`
        : `<button class="act row" data-k="city" data-a="${k}" data-cost="${c.cost}"><span><span class="t">${c.icon} ${c.name}</span><span class="s">${c.s}</span></span><span class="c">${money(c.cost)}</span></button>`;
    }
    h += `</div>`;
  }
  if (S.perks.length) h += `<div class="sec"><b>Your boss perks</b><div class="chips">${S.perks.map((p) => `<span class="chip">${PERKS[p].icon} ${PERKS[p].name}</span>`).join('')}</div></div>`;
  h += `<div class="sec"><b>Money</b><div class="tbl"><span>Net worth</span><span>${money(netWorth())}</span><span>Costs every night</span><span>${money(own('you').filter((l) => l.type).reduce((a, l) => a + dayCosts(l), 0))}</span>${S.loans.length ? `<span>Loan due day ${S.loans[0].due}</span><span class="neg">${money(S.loans[0].amt)}</span>` : ''}</div></div>`;
  return h;
}
function refreshAfford() {
  P.querySelectorAll('[data-cost]').forEach((b) => { if (b.dataset.cost !== '') b.classList.toggle('poor', +b.dataset.cost > S.cash); });
  P.querySelectorAll('[data-fans]').forEach((b) => { if (b.dataset.fans !== '') b.classList.toggle('poor', +b.dataset.fans > S.fans); });
}

/* ---------------- HUD ---------------- */
let shownCash = 0;
function hud() {
  shownCash += (S.cash - shownCash) * 0.25; if (Math.abs(S.cash - shownCash) < 0.5) shownCash = S.cash;
  const c = document.getElementById('cashV'); c.textContent = money(shownCash); c.parentNode.classList.toggle('neg', S.cash < 0);
  document.getElementById('dayLbl').innerHTML = `Day ${S.day}${S.free ? '' : ` <span>/ ${ch().days}</span>`}`;
  document.getElementById('clockBar').style.width = Math.min(1, S.t) * 100 + '%';
  const f = document.getElementById('fansV');
  if (f && +f.textContent !== S.fans) { const up = S.fans > +f.textContent; f.textContent = S.fans; if (up) { const pl = f.parentNode; pl.classList.remove('bump'); void pl.offsetWidth; pl.classList.add('bump'); } }
  const l = S.lots[S.sel];
  if (l && l.today) {
    const r = document.getElementById('stRev'); if (r) r.textContent = money(l.today.rev);
    const so = document.getElementById('stSold'); if (so) so.textContent = l.today.served;
    const lo = document.getElementById('stLost'); if (lo) { lo.textContent = l.today.lost; lo.classList.toggle('neg', l.today.lost > 0); }
  }
}
function hudPills() {
  document.getElementById('youLots').textContent = `${youCount()}/${ch().goal}`;
  document.getElementById('rivLots').textContent = `${rivCount()}/${ch().rivalGoal}`;
  document.getElementById('rivName').textContent = rt().name;
  document.getElementById('fansPill').hidden = !has('fans');
  document.getElementById('streetName').textContent = ch().name;
}
let cdT = 0;
function flashCash(d) {
  const e = document.getElementById('cashDelta');
  e.textContent = (d < 0 ? '−' : '+') + money(Math.abs(d)); e.className = d < 0 ? 'neg' : 'pos'; e.style.opacity = 1;
  clearTimeout(cdT); cdT = setTimeout(() => (e.style.opacity = 0), 1200);
}
let toastT = 0;
function toast(m) {
  if (BOT) return;
  const e = document.getElementById('toast'); e.textContent = m; e.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600);
}
function renderTaskChip() {
  const e = document.getElementById('taskChip'); if (!e || BOT) return;
  const t = activeTasks()[0];
  const html = t ? `🎯 <span>${t.t}</span> <b>+${money(t.r)}</b>` : '';
  if (e.dataset.h !== html) { e.dataset.h = html; e.innerHTML = html; e.hidden = !t; }
}
document.getElementById('taskChip').onclick = () => { S.tab = 'plan'; sfx('ui_open'); renderPanel(); };

/* ---------------- modals ---------------- */
const M = document.getElementById('modal'), MC = document.getElementById('modalCard');
function showModal(html, cls = '') {
  MC.className = 'card ' + cls; MC.innerHTML = html; M.hidden = false; hudControls();
  const b = MC.querySelector('.btn.go'); if (b && !BOT && matchMedia('(hover:hover)').matches) b.focus({ preventScroll: true });
}
function hideModal() { M.hidden = true; hudControls(); }
function modalOpen() { return !M.hidden; }
function bind(id, f) { const b = document.getElementById(id); if (b) b.onclick = () => { sfx('ui_tap'); f(); }; }
function showReport(r, end) {
  if (BOT) { botReport(r, end); return; }
  const row = (a, b, cls = '') => `<span>${a}</span><span class="${cls}">${b}</span>`;
  let h = `<div class="kicker">${ch().name}</div><h3>Day ${r.day} is over</h3><div class="tbl">
    ${row(`Sales (${r.served} customers)`, '+' + money(r.rev), 'pos')}
    ${row('Rent', '−' + money(r.rentSum), 'neg')}
    ${r.wages ? row('Staff pay', '−' + money(r.wages), 'neg') : ''}
    ${r.loanPay ? row('Loan payback', '−' + money(r.loanPay), 'neg') : ''}
    <span class="sum">Profit</span><span class="sum ${r.profit >= 0 ? 'pos' : 'neg'}">${r.profit >= 0 ? '+' : '−'}${money(Math.abs(r.profit))}</span>
  </div>`;
  const notes = [...r.news];
  if (r.best && r.best.today.rev > 0 && own('you').filter((l) => l.type).length > 1) notes.push({ e: '🏆', t: `Best shop: ${TYPES[r.best.type].name} on lot ${S.lots.indexOf(r.best) + 1} with ${money(r.best.today.rev)}.` });
  if (r.lost > 0) notes.push({ e: '😠', t: `${r.lost} ${r.lost === 1 ? 'customer' : 'customers'} walked away from a full line.${has('staff') ? ' More staff or a bigger shop helps.' : ''}` });
  if (S.cash < 0 && !end) notes.push({ e: '⚠️', t: 'Your cash is below $0! Get above $0 by tonight, or you go bankrupt.', bad: true });
  const soon = ch().unlocks.find((u) => u.day === r.day + 1 && !has(u.id));
  if (soon && !end) notes.push({ e: '🎁', t: `Tomorrow: something new to try — ${CONCEPTS[soon.id].title}!` });
  if (notes.length) h += `<div class="news">${notes.map((n) => `<span class="${n.bad ? 'bad' : ''}">${n.e} ${n.t}</span>`).join('')}</div>`;
  if (end) {
    h += `<div class="btns"><button class="btn go" id="mEnd">${end === 'win' ? 'Celebrate!' : 'See what happened'}</button></div>`;
    showModal(h); sfx(end === 'win' ? 'milestone' : 'warning');
    bind('mEnd', () => (end === 'win' ? showChapterWin() : showLose(end)));
    return;
  }
  h += `<div class="btns"><button class="btn go" id="mNext">Start day ${r.day + 1}</button></div>`;
  showModal(h);
  if (r.profit > 0) sfx('cash_in'); else sfx('news_bad');
  bind('mNext', startDay);
}
function showUnlock(id) {
  const c = CONCEPTS[id];
  S.unlocked[id] = true; refreshLinks();
  if (BOT) { next(); return; }
  showModal(`<div class="new">NEW</div><div class="emoji big">${c.icon}</div><h3>${c.title}</h3><p>${c.text}</p><div class="btns"><button class="btn go" id="mOk">Got it!</button></div>`, 'unlock');
  sfx('milestone');
  renderPanel();
  bind('mOk', next);
}
function showEvent(ev) {
  if (BOT) { const c = ev.choices[ev.choices.length - 1]; c.f(); next(); return; }
  let h = `<div class="kicker">Morning news · Day ${S.day}</div><div class="emoji">${ev.icon}</div><h3>${ev.title}</h3><p>${ev.text}</p><div class="btns">`;
  ev.choices.forEach((c, k) => { h += `<button class="btn ${k === 0 ? 'go' : ''}" data-c="${k}">${c.t}${c.s ? `<small>${c.s}</small>` : ''}</button>`; });
  showModal(h + '</div>');
  sfx(ev.good ? 'news_good' : 'news_bad');
  MC.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
    const c = ev.choices[+b.dataset.c];
    if (c.cost && S.cash < c.cost) { sfx('denied'); toast('Not enough cash for that'); return; }
    sfx('ui_tap'); c.f(); refreshLinks(); renderPanel(); next();
  }));
}
function chapterStars() { const d = S.day / ch().days; return d <= 0.55 ? 3 : d <= 0.8 ? 2 : 1; }
function showChapterWin() {
  const stars = chapterStars();
  S.stars[S.ch] = Math.max(S.stars[S.ch] || 0, stars);
  const last = S.ch === CHAPTERS.length - 1;
  const C = ch();
  sfx('win'); music(null);
  confettiScreen();
  showModal(`<div class="emoji big">🏆</div><h3>${last ? 'You are the Street Boss!' : C.name + ' is yours!'}</h3>
    <p>You own ${youCount()} lots on day ${S.day}. ${rt().name} ${last ? 'packed up and left the city.' : 'has to leave this street.'}</p>
    <p class="bigstars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></p>
    <p class="muted">Win before day ${Math.floor(C.days * 0.55) + 1} for 3 stars.</p>
    <div class="tbl"><span>Net worth</span><span>${money(netWorth())}</span><span>Total sales</span><span>${money(S.history.totalRev)}</span><span>Best day profit</span><span>${money(S.history.bestProfit)}</span>${has('fans') ? `<span>Fans</span><span>${S.fans} ❤️</span>` : ''}</div>
    <div class="btns">${last ? `<button class="btn" id="mFree">Keep playing</button><button class="btn go" id="mMenu">Main menu</button>` : `<button class="btn go" id="mNextCh">Next street: ${CHAPTERS[S.ch + 1].name}</button>`}</div>`, 'win');
  bind('mNextCh', showPerks);
  bind('mFree', () => { S.free = true; S.ended = false; save(); hideModal(); startDay(); music('music_game'); });
  bind('mMenu', () => { save(); showStart(); });
  save();
}
function showPerks() {
  const avail = Object.keys(PERKS).filter((p) => !S.perks.includes(p) && !(p === 'fanclub' && S.ch >= 2));
  const opts = [];
  while (opts.length < 3 && avail.length) opts.push(avail.splice(Math.floor(Math.random() * avail.length), 1)[0]);
  showModal(`<div class="kicker">Boss perk</div><h3>Pick one perk</h3><p>It stays with you for the rest of the game.</p><div class="perks">${opts.map((p) => `<button class="perk" data-p="${p}"><span class="e">${PERKS[p].icon}</span><b>${PERKS[p].name}</b><span>${PERKS[p].s}</span></button>`).join('')}</div>`);
  MC.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { S.perks.push(b.dataset.p); sfx('upgrade_buy'); goNextChapter(); }));
}
function goNextChapter() {
  const shops = own('you').filter((l) => l.type).sort((a, b) => b.level - a.level || b.today.rev - a.today.rev);
  const best = shops[0];
  const carry = { type: best ? best.type : 'lemon', level: Math.min(best ? best.level : 1, S.ch === 0 ? 2 : 3), bonus: r10(Math.min(1500, Math.max(0, netWorth()) * 0.1)) };
  setupChapter(S.ch + 1, carry);
  layout(); refreshLinks();
  showChapterIntro(carry);
}
function showChapterIntro(carry) {
  const C = ch();
  const news = C.unlocks.map((u) => `<li>${CONCEPTS[u.id].icon} <b>${CONCEPTS[u.id].title}</b>${u.day > 1 ? ` <span class="muted">(day ${u.day})</span>` : ''}</li>`).join('');
  const newTypes = C.types.filter((k) => !(CHAPTERS[S.ch - 1] || { types: [] }).types.includes(k));
  showModal(`<div class="kicker">Street ${S.ch + 1} of ${CHAPTERS.length}</div><h3>${C.name}</h3><p>${C.blurb}</p>
    ${carry ? `<p>You move your <b>${TYPES[carry.type].name} ${LV.name[carry.level - 1]}</b> here${carry.bonus ? ` and bring <b>${money(carry.bonus)}</b> from selling the old street` : ''}.</p>` : ''}
    <div class="news"><span>🎯 Own <b>${C.goal} of ${C.lots}</b> lots before day ${C.days}. ${rt().name} needs ${C.rivalGoal}.</span>
    ${newTypes.length && S.ch > 0 ? `<span>🆕 New shops: ${newTypes.map((k) => TYPES[k].icon + ' ' + TYPES[k].name).join(', ')}</span>` : ''}
    <span>🏗️ Shops can grow up to <b>${LV.name[C.levelCap - 1]}</b> size.</span></div>
    ${S.ch > 0 ? `<b>New ideas here:</b><ul class="newlist">${news}</ul>` : ''}
    <div class="btns"><button class="btn go" id="mGo">Open for business</button></div>`);
  bind('mGo', () => { music('music_game'); hideModal(); S.paused = false; queueMorning(); renderPanel(); save(); });
}
function showLose(end) {
  const T = {
    rival: ['🏬', `${rt().name} took over`, `${rt().name} owns ${rivCount()} lots, so this street is theirs. Tip: buy lots early, before ${rt().name} has the cash.`],
    broke: ['💸', 'Bankrupt', 'Your cash stayed below $0 for two nights. Tip: check the costs of each shop before you hire staff.'],
    time: ['⏰', 'Time is up', `Day ${ch().days} is over and you own ${youCount()} of ${ch().goal} lots. So close!`],
  }[end];
  sfx('lose'); music(null);
  showModal(`<div class="emoji big">${T[0]}</div><h3>${T[1]}</h3><p>${T[2]}</p>
   <div class="btns"><button class="btn go" id="mRetry">Try ${ch().name} again</button><button class="btn" id="mMenu">Main menu</button></div>`);
  bind('mRetry', retryChapter);
  bind('mMenu', () => showStart());
}
function retryChapter() {
  let snap = null;
  try { snap = JSON.parse(localStorage.getItem(START_KEY)); } catch (e) { /* ignore */ }
  if (snap && snap.ch === S.ch) { S = revive(snap); }
  else { const keep = { perks: S.perks, unlocked: S.unlocked, stars: S.stars, fans: S.fans }; const c = S.ch; newGame(); Object.assign(S, keep); setupChapter(c, null); }
  layout(); refreshLinks(); save();
  showChapterIntro(null);
}
function confettiScreen() {
  const vis = [Math.floor(cam.x), Math.floor(cam.x + G.vis / 2), Math.floor(cam.x + G.vis - 0.5)];
  for (const i of vis) confetti(i, 50);
}
function showMenu() {
  const wasPaused = S.paused; S.paused = true;
  const muted = sound.muted, musicOn = sound.getVolume('music') > 0;
  showModal(`<h3>Menu</h3>
   <div class="menu">
    <button class="btn" id="mSound">${muted ? '🔈 Sound: off' : '🔊 Sound: on'}</button>
    <button class="btn" id="mMusic">${musicOn ? '🎵 Music: on' : '🎵 Music: off'}</button>
    <button class="btn" id="mHow">❓ How to play</button>
    <button class="btn" id="mRestart">↺ Restart ${ch().name}</button>
    <button class="btn" id="mMain">🏠 Main menu</button>
   </div>
   <div class="btns"><button class="btn go" id="mBack">Back to the game</button></div>`);
  bind('mSound', () => { sound.toggleMute(); showMenu(); S.paused = wasPaused; });
  bind('mMusic', () => { sound.setVolume('music', musicOn ? 0 : 0.55); showMenu(); S.paused = wasPaused; });
  bind('mHow', () => showHow(() => { showMenu(); S.paused = wasPaused; }));
  bind('mRestart', () => showModal(`<h3>Restart ${ch().name}?</h3><p>You go back to day 1 of this street. Your perks stay.</p><div class="btns"><button class="btn" id="mNo">Cancel</button><button class="btn go" id="mYes">Restart</button></div>`) || (bind('mNo', () => { showMenu(); S.paused = wasPaused; }), bind('mYes', retryChapter)));
  bind('mMain', () => { save(); showStart(); });
  bind('mBack', () => { hideModal(); S.paused = wasPaused; hudControls(); });
}
function showHow(back) {
  showModal(`<h3>How to play</h3><ul>
    <li><b>Tap a building</b> to see it. Tap <b>Build up</b> to make it bigger: more visitors and higher prices.</li>
    <li>Set the <b>price</b>. Cheap brings more people, Premium brings more money per sale.</li>
    <li>Every night you pay <b>rent and staff</b>. Keep your cash above $0!</li>
    <li>Buy <b>FOR SALE</b> lots before your rival does. The first to own enough lots wins the street.</li>
    <li>Each street adds new ideas: staff, stars, combos, fans, city projects and more.</li>
    <li>On a Mac: <b>space</b> pauses, <b>1 2 3</b> set the speed, <b>← →</b> pick a lot.</li></ul>
    <div class="btns"><button class="btn go" id="mHB">OK</button></div>`);
  bind('mHB', back);
}
function showStart() {
  S.paused = true;
  const saved = load();
  music('music_menu');
  const stars = (saved || S || {}).stars || [];
  const at = saved ? saved.ch : 0;
  const nodes = CHAPTERS.map((c, i) => {
    const st = stars[i] || 0, state = i < at || st ? 'done' : i === at ? 'now' : 'lock';
    return `<div class="node ${state}"><div class="n">${state === 'lock' ? '🔒' : i + 1}</div><b>${c.name}</b><span class="st">${'★'.repeat(st)}<span class="off">${'★'.repeat(3 - st)}</span></span></div>`;
  }).join('<div class="road"></div>');
  showModal(`<div class="logo"><span>STREET</span><span>BOSS</span></div>
   <p class="lead">Start with a lemonade cart. End with a whole street of shops.</p>
   <div class="map">${nodes}</div>
   <div class="btns">${saved ? `<button class="btn go" id="mCont">Continue<small>${CHAPTERS[saved.ch].name} · day ${saved.day}</small></button><button class="btn" id="mNew">New game</button>` : `<button class="btn go" id="mNew">Open the shop</button>`}</div>
   <button class="link" id="mHow2">How to play</button>`, 'start');
  bind('mCont', () => { S = saved; afterLoad(); hideModal(); music('music_game'); S.paused = false; renderPanel(); hudControls(); if (S.ended) startDay(); });
  bind('mNew', () => {
    if (saved) {
      showModal(`<h3>Start a new game?</h3><p>Your saved game will be gone.</p><div class="btns"><button class="btn" id="mNo">Keep my game</button><button class="btn go" id="mYes">New game</button></div>`);
      bind('mNo', showStart); bind('mYes', beginNew);
    } else beginNew();
  });
  bind('mHow2', () => showHow(showStart));
}
function beginNew() {
  newGame(); afterLoad(); save();
  showModal(`<div class="emoji big">🍋</div><h3>Welcome to Maple Street</h3><p>You just opened a small lemonade cart. A chain called <b class="neg">QuickStop</b> wants the whole street.</p>
  <div class="news"><span>👆 Tap your cart to see what you can do.</span><span>🏗️ Build it up: cart, kiosk, shop… and later much bigger.</span><span>🎯 Own <b>3 lots</b> before day 20 to win this street.</span></div>
  <div class="btns"><button class="btn go" id="mGo">Open the cart</button></div>`);
  bind('mGo', () => { music('music_game'); hideModal(); S.paused = false; renderPanel(); });
}

/* ---------------- save ---------------- */
function serial() { return { ...S, people: [], fx: [], cars: [], lots: S.lots.map((l) => ({ ...l, queue: [], inside: [] })) }; }
function save() { if (BOT) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(serial())); } catch (e) { /* ignore */ } }
function revive(s) {
  s.t = 0; s.spawnAcc = 0; s.people = []; s.fx = []; s.cars = []; s.dayServed = 0;
  s.lots.forEach((l) => { l.today = { rev: 0, served: 0, lost: 0 }; l.queue = []; l.inside = []; l.buildT = 0; });
  return s;
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) return revive(s); } catch (e) { /* ignore */ }
  return null;
}
function afterLoad() { cam.x = 0; layout(); refreshLinks(); focusLot(S.sel); if (cam.target != null) cam.x = cam.target; renderPanel(); hudControls(); }

/* ---------------- loop ---------------- */
let last = performance.now(), acc = 0, lastPs = '';
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S && !S.paused && !modalOpen() && !S.ended) {
    let d = dt * S.speed;
    while (d > 0) { const k = Math.min(d, 0.05); step(k); d -= k; if (modalOpen()) break; }
  }
  // camera
  if (!drag) {
    if (cam.target != null) { cam.x += (cam.target - cam.x) * Math.min(1, dt * 8); if (Math.abs(cam.target - cam.x) < 0.01) { cam.x = cam.target; cam.target = null; } }
    else if (Math.abs(cam.vx) > 0.05) { cam.x = Math.max(0, Math.min(G.maxCam || 0, cam.x + cam.vx * dt)); cam.vx *= Math.pow(0.04, dt); }
  }
  if (S) {
    for (const f of S.fx) { f.life -= dt * (f.big ? 1 : Math.min(S.speed, 2)); f.y += dt * 0.5; }
    S.fx = S.fx.filter((f) => f.life > 0);
    draw(dt); hud(); const ps = S.paused + ':' + modalOpen() + ':' + S.speed; if (ps !== lastPs) { lastPs = ps; hudControls(); } }
  acc += dt; if (acc > 0.3) { acc = 0; refreshAfford(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && S) { save(); if (!modalOpen()) { S.paused = true; hudControls(); } } });

/* ---------------- bot helpers (tests) ---------------- */
let botLog = null;
function botReport(r, end) { botLog = { r, end }; }

/* ---------------- boot ---------------- */
new ResizeObserver(() => { resize(); }).observe(cv);
newGame();
resize(); refreshLinks();
renderPanel(); hudControls();
if (!BOT) showStart();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:' && /github\.io$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});

window.__SB = {
  get S() { return S; }, set S(v) { S = v; }, step, act, startDay, endDay, newGame, setupChapter, goNextChapter, refreshLinks, layout,
  links, lotPrice, upCost, staffCost, qualCost, sigCost, buyoutCost, appeal, comboName, isShop, youCount, rivCount, TYPES, CHAPTERS, CITY, CONCEPTS,
  get botLog() { const b = botLog; botLog = null; return b; }, queueMorning, selectLot, showStart, showPerks,
};
