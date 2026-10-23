// Street Boss, act 2: the city map. You own districts, they earn money every week,
// GigaCorp attacks them, and Factory Park makes your own brand.
import { DISTRICTS, EMPIRE, FACTORY, CITIES, TYPES } from './data.js';

const KEY = 'streetboss.empire.v1';
const r10 = (n) => Math.round(n / 10) * 10;
const r100 = (n) => Math.round(n / 100) * 100;
const money = (n) => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const STREETS = Object.keys(DISTRICTS).filter((k) => !DISTRICTS[k].factory);

/* ---------------- rules (no DOM, so the test bot can use them) ---------------- */
export function newEmpire(bestType, cash) {
  const E = { v: 1, week: 1, cash: r10(cash ?? EMPIRE.startCash), bestType: bestType || 'lemon', districts: {}, factory: null,
    power: EMPIRE.power.start, sel: 'downtown', view: 'map', done: false, stars: 0, away: null, log: [] };
  for (const k of STREETS) E.districts[k] = { owned: DISTRICTS[k].ch <= 2, loy: 100, mgr: 0, sec: 0, lost: false };
  return E;
}
export const product = (E) => TYPES[E.bestType].sig;
export const ownedStreets = (E) => STREETS.filter((k) => E.districts[k].owned);
export const isOpen = (E, k) => { const D = DISTRICTS[k]; return !D.need || E.districts[D.need].owned; };
export function income(E, k) {
  const D = DISTRICTS[k], d = E.districts[k];
  if (!d.owned) return 0;
  return r10(D.income * EMPIRE.mgrMult[d.mgr] * (0.5 + 0.5 * d.loy / 100));
}
export const mgrCost = (k) => (lvl) => r100(DISTRICTS[k].income * EMPIRE.mgrCost[lvl]);
export const secCost = (k) => (lvl) => r100(DISTRICTS[k].income * EMPIRE.secCost[lvl]);
export const buyBackCost = (k) => r100(DISTRICTS[k].income * EMPIRE.buyBack);
export const attackChance = (E) => Math.min(EMPIRE.attack.max, EMPIRE.attack.chance + EMPIRE.attack.perWeek * E.week);
export const gigaCola = (E) => Math.min(FACTORY.giga.max, FACTORY.giga.start + FACTORY.giga.perWeek * E.week);
export function newFactory() {
  const cities = {};
  for (const c of CITIES) cities[c.id] = { open: !c.open, price: 1, ads: 0, want: 0, sold: 0, share: 0 };
  return { machine: 0, recipe: 0, trucks: 1, stock: 0, cities };
}
export function cityDemand(E, c) { return c.perDistrict ? c.demand * ownedStreets(E).length : c.demand; }
export function share(E, id) {
  const F = E.factory, s = F.cities[id];
  const A = 1 + FACTORY.adAppeal * s.ads + FACTORY.recipe[F.recipe].appeal;
  return A / (A + gigaCola(E));
}
// A city counts for the goal when your brand has half the market and you deliver what people want.
export const cityWon = (E, id) => { const s = E.factory && E.factory.cities[id]; return !!s && CITIES.find((c) => c.id === id).truck && s.open && s.want > 0 && s.share >= EMPIRE.shareGoal && s.sold >= s.want * 0.8; };
export const citiesWon = (E) => CITIES.filter((c) => c.truck && cityWon(E, c.id)).length;
export const goalMet = (E) => ownedStreets(E).length === STREETS.length && citiesWon(E) >= EMPIRE.citiesGoal;
export function value(E) {
  let v = E.cash;
  for (const k of ownedStreets(E)) v += DISTRICTS[k].income * 6 * EMPIRE.mgrMult[E.districts[k].mgr];
  if (E.factory) v += DISTRICTS.factory.cost + FACTORY.machine.slice(1, E.factory.machine + 1).reduce((a, m) => a + m.cost, 0) + E.factory.trucks * FACTORY.truck.cost;
  return r100(v);
}

function factoryWeek(E) {
  const F = E.factory;
  const cap = FACTORY.machine[F.machine].cap;
  const made = Math.max(0, Math.min(cap, cap * 2 - F.stock));
  F.stock += made;
  const costs = made * FACTORY.crateCost + FACTORY.wage[0] + FACTORY.wage[1] * F.machine + F.trucks * FACTORY.truck.upkeep;
  let truckLeft = F.trucks * FACTORY.truck.cap, rev = 0;
  const sales = [];
  for (const c of CITIES) {
    const s = F.cities[c.id];
    if (!s.open) continue;
    s.share = share(E, c.id);
    s.want = Math.round(cityDemand(E, c) * FACTORY.price.demand[s.price] * s.share);
    let sold = Math.min(s.want, F.stock);
    if (c.truck) { sold = Math.min(sold, truckLeft); truckLeft -= sold; }
    F.stock -= sold; s.sold = sold;
    const r = sold * FACTORY.price.v[s.price];
    rev += r;
    sales.push({ id: c.id, sold, want: s.want, rev: r });
  }
  return { made, costs, rev, sales };
}

// One week on the city map. Returns a report for the week.
export function weekTick(E, rnd = Math.random) {
  const rep = { week: E.week, streets: [], streetSum: 0, factory: null, attack: null, lost: null, news: [] };
  for (const k of ownedStreets(E)) { const v = income(E, k); rep.streets.push({ k, v }); rep.streetSum += v; }
  E.cash += rep.streetSum;
  if (E.factory) { rep.factory = factoryWeek(E); E.cash += rep.factory.rev - rep.factory.costs; }
  E.power += EMPIRE.power.perWeek;
  const targets = ownedStreets(E);
  if (targets.length && rnd() < attackChance(E)) {
    const k = targets[Math.floor(rnd() * targets.length)], d = E.districts[k];
    const dmg = Math.round((EMPIRE.attack.dmg + EMPIRE.attack.dmgPerPower * E.power) * (1 - EMPIRE.attack.secCut * d.sec));
    d.loy = Math.max(0, d.loy - dmg);
    rep.attack = { k, dmg };
    if (d.loy <= 0) { Object.assign(d, { owned: false, lost: true, mgr: 0, sec: 0 }); rep.lost = k; }
  }
  for (const k of ownedStreets(E)) if (!rep.attack || rep.attack.k !== k) E.districts[k].loy = Math.min(100, E.districts[k].loy + EMPIRE.regen + EMPIRE.secRegen * E.districts[k].sec);
  rep.total = rep.streetSum + (rep.factory ? rep.factory.rev - rep.factory.costs : 0);
  E.week++;
  if (!E.done && goalMet(E)) { E.done = true; E.stars = E.week <= EMPIRE.stars[0] ? 3 : E.week <= EMPIRE.stars[1] ? 2 : 1; rep.win = true; }
  return rep;
}

// Buy something on the map. Returns false when it is not possible.
export function buy(E, kind, k, arg) {
  const spend = (c) => { if (E.cash < c) return false; E.cash -= c; return true; };
  const d = E.districts[k], F = E.factory;
  switch (kind) {
    case 'mgr': return d.owned && d.mgr < 3 && spend(mgrCost(k)(d.mgr)) && !!(d.mgr++, 1);
    case 'sec': return d.owned && d.sec < 3 && spend(secCost(k)(d.sec)) && !!(d.sec++, 1);
    case 'buyback': return d.lost && spend(buyBackCost(k)) && !!Object.assign(d, { owned: true, lost: false, loy: 60 });
    case 'factory': return !F && spend(DISTRICTS.factory.cost) && !!(E.factory = newFactory());
    case 'machine': return F && F.machine < 3 && spend(FACTORY.machine[F.machine + 1].cost) && !!(F.machine++, 1);
    case 'recipe': return F && F.recipe < 2 && spend(FACTORY.recipe[F.recipe + 1].cost) && !!(F.recipe++, 1);
    case 'truck': return F && F.trucks < FACTORY.truck.max && spend(FACTORY.truck.cost) && !!(F.trucks++, 1);
    case 'open': { const c = CITIES.find((x) => x.id === arg); return F && !F.cities[arg].open && spend(c.open) && !!(F.cities[arg].open = true); }
    case 'ads': { const c = CITIES.find((x) => x.id === arg), s = F && F.cities[arg]; return s && s.open && s.ads < 3 && spend(adCost(c, s.ads)) && !!(s.ads++, 1); }
    case 'price': { const s = F && F.cities[arg]; if (!s || !s.open) return false; s.price = k; return true; }
  }
  return false;
}
export const adCost = (c, lvl) => r100(Math.max(1000, c.open) * FACTORY.adCost[lvl]);

/* ---------------- screen ---------------- */
export function makeEmpire(api) {
  const root = document.getElementById('empire');
  let E = null;
  try { E = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
  if (E && E.v !== 1) E = null;
  const save = () => { if (!api.bot) try { localStorage.setItem(KEY, JSON.stringify(E)); } catch (e) { /* ignore */ } };
  const sfx = api.sfx;

  function open() {
    if (!E) return;
    E.view = E.view === 'factory' && E.factory ? 'factory' : 'map';
    root.hidden = false; document.body.classList.add('in-empire');
    api.music('music_game');
    render(); save();
  }
  function close() { root.hidden = true; document.body.classList.remove('in-empire'); }

  function bar(v, cls = '') { return `<span class="ebar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span>`; }
  function head() {
    return `<header class="ehud">
      <div class="cash">${money(E.cash)}</div>
      <div class="day"><b>Week ${E.week}</b><span class="street">City map · worth ${money(value(E))}</span></div>
      <div class="race"><div class="pill riv" title="GigaCorp gets stronger every week"><i></i><span class="who">GigaCorp</span><span>⚡${E.power.toFixed(1)}</span></div></div>
      <div class="ctrl"><button id="eMenu" aria-label="Menu">☰</button></div></header>`;
  }
  function goalCard() {
    const n = ownedStreets(E).length, c = E.factory ? citiesWon(E) : 0;
    return `<div class="egoal"><b>🏆 Become City Boss</b>
      <span>${n === STREETS.length ? '✅' : '🏙️'} Own all ${STREETS.length} streets <b>${n}/${STREETS.length}</b></span>
      <span>${c >= EMPIRE.citiesGoal ? '✅' : '🏭'} Win ${EMPIRE.citiesGoal} cities for your ${product(E)} <b>${c}/${EMPIRE.citiesGoal}</b></span></div>`;
  }
  function tile(k) {
    const D = DISTRICTS[k], d = E.districts[k];
    let st = '', cls = '';
    if (D.factory) { st = E.factory ? `${FACTORY.machine[E.factory.machine].cap} crates a week` : `Build for ${money(D.cost)}`; cls = E.factory ? 'own' : 'buy'; }
    else if (d.owned) { st = `+${money(income(E, k))}/week${bar(d.loy, d.loy < 40 ? 'low' : '')}`; cls = 'own'; }
    else if (d.lost) { st = 'GigaCorp took it!'; cls = 'lost'; }
    else if (isOpen(E, k)) { st = 'Conquer it!'; cls = 'play'; }
    else { st = `After ${DISTRICTS[D.need].name}`; cls = 'lock'; }
    return `<button class="etile ${cls} ${E.sel === k ? 'on' : ''}" data-d="${k}" style="--c:${D.col};grid-column:${D.x + 1};grid-row:${D.y + 1}">
      <span class="ei">${cls === 'lock' ? '🔒' : cls === 'lost' ? '🏢' : D.icon}</span><b>${D.name}</b><span class="es">${st}</span>${d && d.mgr ? `<span class="emgr">${'🧑‍💼'.repeat(d.mgr)}</span>` : ''}</button>`;
  }
  function act(kind, k, s, cost, extra = '') {
    return `<button class="act ${extra}" data-e="${kind}" data-k="${k ?? ''}" ${cost != null ? `data-cost="${cost}"` : ''}><span class="t">${s[0]}</span>${s[1] ? `<span class="s">${s[1]}</span>` : ''}${cost != null ? `<span class="c">${money(cost)}</span>` : ''}</button>`;
  }
  const maxed = (t, s) => `<div class="act max"><span class="t">${t}</span><span class="s">${s}</span></div>`;
  function districtPanel(k) {
    const D = DISTRICTS[k], d = E.districts[k];
    let h = `<div class="phead"><div class="ic" style="background:${D.col}">${D.icon}</div><div class="hd"><h2>${D.name}</h2><p>`;
    if (D.factory) {
      if (!E.factory) {
        h += `Make your own ${product(E)} and sell it in other cities.</p></div></div>
          <div class="hint">A factory makes crates of your ${product(E)} every week. Trucks bring them to other cities. There, it fights GigaCola for customers.</div>
          <div class="grid one">${act('factory', 'factory', ['🏭 Build your factory', `Make your own ${product(E)}`], D.cost)}</div>`;
      } else h += `Your ${product(E)} factory.</p></div></div><div class="grid one"><button class="act" data-e="view" data-k="factory"><span class="t">🏭 Open the factory</span><span class="s">Machines, trucks, cities and prices</span></button></div>`;
      return h;
    }
    if (d.owned) {
      const nextMult = EMPIRE.mgrMult[Math.min(3, d.mgr + 1)];
      h += `Earns <b class="pos">${money(income(E, k))}</b> every week.</p></div></div>
        <div class="stats"><span>Loyalty <b class="${d.loy < 40 ? 'neg' : ''}">${d.loy}%</b></span><span>Managers <b>${d.mgr}/3</b></span><span>Security <b>${d.sec}/3</b></span></div>
        <div class="loyrow">${bar(d.loy, d.loy < 40 ? 'low' : '')}</div>
        <div class="hint">GigaCorp attacks your streets and lowers their loyalty. A street with less loyalty earns less. At 0% GigaCorp takes it. Security protects it and brings loyalty back faster.</div>
        <div class="grid two">${d.mgr < 3 ? act('mgr', k, ['🧑‍💼 Hire a manager', `Earns ${money(D.income * nextMult)}/week at full loyalty`], mgrCost(k)(d.mgr)) : maxed('🧑‍💼 3 managers', 'Earns the most')}
        ${d.sec < 3 ? act('sec', k, ['🛡️ Security', `Attacks hurt ${Math.round(EMPIRE.attack.secCut * (d.sec + 1) * 100)}% less`], secCost(k)(d.sec)) : maxed('🛡️ Top security', 'Attacks hurt 66% less')}</div>`;
    } else if (d.lost) {
      h += `GigaCorp took this street.</p></div></div>
        <div class="hint">Win it back: buy it back, or play the street again and win it. While you play, ${EMPIRE.streetWeeks} weeks pass on the map.</div>
        <div class="grid two">${act('buyback', k, ['💼 Buy it back', 'Loyalty starts at 60%'], buyBackCost(k))}<button class="act" data-e="play" data-k="${k}"><span class="t">🎮 Play to win it back</span><span class="s">${EMPIRE.streetWeeks} weeks pass</span></button></div>`;
    } else if (isOpen(E, k)) {
      const bonus = Math.min(3000, r100(E.cash * 0.5));
      h += `Win this street to add it to your city.</p></div></div>
        <div class="hint">Play ${D.name} like the other streets. While you play, ${EMPIRE.streetWeeks} weeks pass on the map, so get your other streets ready first.</div>
        <div class="grid two"><button class="act" data-e="play" data-k="${k}"><span class="t">🎮 Play ${D.name}</span><span class="s">Start with the normal cash</span></button>
        ${bonus >= 500 ? `<button class="act" data-e="play" data-k="${k}" data-b="${bonus}"><span class="t">💰 Bring ${money(bonus)}</span><span class="s">From your city cash</span></button>` : ''}</div>`;
    } else h += `First win ${DISTRICTS[D.need].name}.</p></div></div>`;
    return h;
  }
  function mapView() {
    return `<main class="emap"><div class="egrid">${Object.keys(DISTRICTS).map(tile).join('')}</div></main>
      <section class="epanel">${districtPanel(E.sel)}${goalCard()}<button class="btn go enext" id="eNext">Next week ▶</button></section>`;
  }
  function factoryView() {
    const F = E.factory, M = FACTORY.machine[F.machine];
    const crates = Math.min(12, Math.round(F.stock / Math.max(1, M.cap * 2) * 12));
    let h = `<main class="emap fac"><div class="fscene">
      <div class="fbuild"><span class="chim">💨</span><span class="fname">${product(E)} Co.</span><span class="fi">🏭</span></div>
      <div class="belt">${'<i>📦</i>'.repeat(5)}</div>
      <div class="wh"><b>Warehouse</b><span>${'📦'.repeat(crates) || '—'}</span><small>${F.stock} / ${M.cap * 2} crates</small></div>
      <div class="trucks">${'<i>🚚</i>'.repeat(F.trucks)}</div>
      <div class="fstat"><span>Makes <b>${M.cap}</b> crates a week</span><span>Trucks carry <b>${F.trucks * FACTORY.truck.cap}</b> a week</span><span>GigaCola strength <b class="neg">${gigaCola(E).toFixed(2)}</b></span></div>
    </div></main><section class="epanel">
      <div class="phead"><div class="ic" style="background:#ffc23d">🏭</div><div class="hd"><h2>${product(E)} factory</h2><p>Make crates, ship them, beat GigaCola.</p></div></div>
      <div class="grid three">
        ${F.machine < 3 ? act('machine', '', [`⚙️ Machine ${F.machine + 1}→${F.machine + 2}`, `${FACTORY.machine[F.machine + 1].cap} crates/week`], FACTORY.machine[F.machine + 1].cost) : maxed('⚙️ Best machine', `${M.cap} crates/week`)}
        ${F.recipe < 2 ? act('recipe', '', [`🧪 Better recipe`, 'More people pick yours'], FACTORY.recipe[F.recipe + 1].cost) : maxed('🧪 Best recipe', 'People love it')}
        ${F.trucks < FACTORY.truck.max ? act('truck', '', [`🚚 Truck ${F.trucks}→${F.trucks + 1}`, `+${FACTORY.truck.cap} crates/week`], FACTORY.truck.cost) : maxed(`🚚 ${FACTORY.truck.max} trucks`, 'The most')}
      </div><div class="cities">`;
    for (const c of CITIES) {
      const s = F.cities[c.id];
      h += `<div class="city ${cityWon(E, c.id) ? 'won' : ''}"><div class="ch"><span class="ci">${c.icon}</span><b>${c.name}</b><span class="muted">${s.open ? `wants ${Math.round(cityDemand(E, c) * FACTORY.price.demand[s.price] * share(E, c.id))} a week` : c.s}</span>${cityWon(E, c.id) ? '<span class="chip good">Won!</span>' : ''}</div>`;
      if (!s.open) h += `<div class="grid one">${act('open', c.id, [`Start selling in ${c.name}`, 'Make a deal with the shops there'], c.open)}</div>`;
      else {
        const sh = Math.round(share(E, c.id) * 100);
        h += `<div class="share"><span class="you">You ${sh}%</span><span class="ebar duo"><i style="width:${sh}%"></i></span><span class="giga">GigaCola ${100 - sh}%</span></div>
          <div class="crow"><div class="grid three prices">${FACTORY.price.name.map((n, p) => `<button class="act ${s.price === p ? 'sel' : ''}" data-e="price" data-k="${p}" data-c="${c.id}"><span class="t">${n}</span><span class="c">$${FACTORY.price.v[p]}</span></button>`).join('')}</div>
          ${s.ads < 3 ? act('ads', c.id, [`📣 Ads ${s.ads}/3`, ''], adCost(c, s.ads)) : maxed('📣 Ads 3/3', '')}</div>
          ${s.want ? `<span class="muted small">Last week: sold ${s.sold} of ${s.want} crates${c.truck && s.sold < s.want ? ' — more trucks or a bigger machine?' : ''}</span>` : ''}`;
      }
      h += `</div>`;
    }
    h += `</div>${goalCard()}<div class="grid two"><button class="btn" data-e="view" data-k="map">← City map</button><button class="btn go" id="eNext">Next week ▶</button></div></section>`;
    return h;
  }
  function render() {
    root.innerHTML = head() + (E.view === 'factory' && E.factory ? factoryView() : mapView());
    root.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { E.sel = b.dataset.d; sfx('ui_tap'); render(); }));
    root.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => click(b)));
    root.querySelectorAll('[data-cost]').forEach((b) => b.classList.toggle('poor', E.cash < +b.dataset.cost));
    const n = document.getElementById('eNext'); if (n) n.onclick = () => { sfx('ui_tap'); nextWeek(); };
    document.getElementById('eMenu').onclick = () => api.menu();
  }
  function click(b) {
    const kind = b.dataset.e, k = b.dataset.k;
    if (kind === 'view') { E.view = k; sfx('ui_open'); render(); save(); return; }
    if (kind === 'play') { sfx('ui_tap'); play(k, +(b.dataset.b || 0)); return; }
    const before = E.factory;
    const ok = kind === 'price' ? buy(E, 'price', +k, b.dataset.c) : buy(E, kind, kind === 'open' || kind === 'ads' ? null : k || E.sel, k);
    if (!ok) { sfx('denied'); flash('Not enough cash yet'); return; }
    sfx(kind === 'price' ? 'tick' : kind === 'factory' || kind === 'open' ? 'milestone' : 'upgrade_buy');
    if (kind === 'factory' && !before) { api.award('factory'); E.view = 'factory'; flash(`🏭 Your ${product(E)} factory is open!`); }
    if (kind === 'buyback') flash(`${DISTRICTS[k].name} is yours again!`);
    render(); save();
  }
  function flash(m) {
    let t = document.getElementById('etoast');
    if (!t) { t = document.createElement('div'); t.id = 'etoast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  }
  function reportHtml(reps) {
    const row = (a, b, cls = '') => `<span>${a}</span><span class="${cls}">${b}</span>`;
    const sum = (f) => reps.reduce((a, r) => a + f(r), 0);
    const fac = reps.some((r) => r.factory);
    let h = `<div class="tbl">${row(`Your streets`, '+' + money(sum((r) => r.streetSum)), 'pos')}`;
    if (fac) {
      h += row(`${product(E)} sales (${sum((r) => (r.factory ? r.factory.sales.reduce((a, s) => a + s.sold, 0) : 0))} crates)`, '+' + money(sum((r) => (r.factory ? r.factory.rev : 0))), 'pos');
      h += row('Factory costs', '−' + money(sum((r) => (r.factory ? r.factory.costs : 0))), 'neg');
    }
    const tot = sum((r) => r.total);
    h += `<span class="sum">Total</span><span class="sum ${tot >= 0 ? 'pos' : 'neg'}">${tot >= 0 ? '+' : '−'}${money(Math.abs(tot))}</span></div>`;
    const news = [];
    for (const r of reps) {
      if (r.lost) news.push({ e: '🏢', t: `GigaCorp took ${DISTRICTS[r.lost].name}! Buy it back or play it again.`, bad: true });
      else if (r.attack) news.push({ e: '⚔️', t: `GigaCorp attacked ${DISTRICTS[r.attack.k].name}: −${r.attack.dmg}% loyalty.`, bad: true });
    }
    const weak = ownedStreets(E).filter((k) => E.districts[k].loy < 40);
    if (weak.length) news.push({ e: '⚠️', t: `Low loyalty: ${weak.map((k) => DISTRICTS[k].name).join(', ')}. Add security!`, bad: true });
    if (E.factory) {
      const F = E.factory, made = FACTORY.machine[F.machine].cap;
      if (F.stock >= made * 2) news.push({ e: '📦', t: 'Your warehouse is full. Open a new city or buy trucks.' });
      for (const c of CITIES) if (c.truck && F.cities[c.id].open && F.cities[c.id].share < EMPIRE.shareGoal) { news.push({ e: '🥤', t: `GigaCola wins in ${c.name}. Ads or a better recipe help.` }); break; }
    }
    if (news.length) h += `<div class="news">${news.slice(0, 4).map((n) => `<span class="${n.bad ? 'bad' : ''}">${n.e} ${n.t}</span>`).join('')}</div>`;
    return h;
  }
  function nextWeek() {
    const rep = weekTick(E);
    save();
    if (rep.win) { win(); return; }
    api.showModal(`<div class="kicker">City map</div><h3>Week ${rep.week} is over</h3>${reportHtml([rep])}<div class="btns"><button class="btn go" id="eOk">Week ${E.week} ▶</button></div>`);
    sfx(rep.lost ? 'lose' : rep.attack ? 'warning' : rep.total > 0 ? 'cash_in' : 'news_bad');
    api.bind('eOk', () => { api.hideModal(); render(); });
    render();
  }
  function win() {
    api.award('cityboss');
    sfx('win');
    api.showModal(`<div class="emoji big">🏆</div><h3>${api.boss() ? api.boss() + ', you are City Boss!' : 'You are City Boss!'}</h3>
      <p>You own every street, and people in ${citiesWon(E)} cities pick your ${product(E)} over GigaCola. GigaCorp gives up and leaves town.</p>
      <p class="bigstars">${[0, 1, 2].map((k) => `<span class="${k < E.stars ? 'on' : 'off'}" style="animation-delay:${0.35 + k * 0.32}s">★</span>`).join('')}</p>
      <p class="muted">City Boss by week ${EMPIRE.stars[0]} gives 3 stars.</p>
      <div class="tbl"><span>Week</span><span>${E.week}</span><span>City worth</span><span>${money(value(E))}</span></div>
      <div class="btns"><button class="btn" id="eKeep">Keep playing</button><button class="btn go" id="eMain">Main menu</button></div>`, 'win');
    api.bind('eKeep', () => { api.hideModal(); render(); });
    api.bind('eMain', () => { close(); api.home(); });
  }
  function play(k, bonus) {
    const D = DISTRICTS[k];
    E.cash -= bonus; E.away = { k, weeks: EMPIRE.streetWeeks }; E.view = 'map';
    save(); close();
    api.playStreet(k, D.ch, bonus);
  }
  // Back from a street. The weeks pass now, then the result shows.
  function streetDone(won, reward) {
    const a = E.away; E.away = null;
    const reps = [];
    for (let n = 0; n < (a ? a.weeks : 0); n++) reps.push(weekTick(E));
    if (a && won) { Object.assign(E.districts[a.k], { owned: true, lost: false, loy: 100 }); E.cash += reward; E.sel = a.k; }
    save(); open();
    const name = a ? DISTRICTS[a.k].name : '';
    api.showModal(`<div class="kicker">Back on the city map</div><h3>${won ? `${name} is part of your city!` : `${name} stays out of reach`}</h3>
      <p>${won ? `It earns ${money(income(E, a.k))} every week from now on.${reward ? ` You also bring ${money(reward)} back.` : ''}` : 'You can try again whenever you like.'} While you were away, ${reps.length} weeks passed:</p>
      ${reportHtml(reps)}<div class="btns"><button class="btn go" id="eOk">Back to the map</button></div>`, won ? 'win' : '');
    api.bind('eOk', () => { api.hideModal(); render(); if (!E.done && goalMet(E)) { E.done = true; E.stars = E.week <= EMPIRE.stars[0] ? 3 : E.week <= EMPIRE.stars[1] ? 2 : 1; save(); win(); } });
  }
  return {
    get E() { return E; },
    exists: () => !!E,
    isOpen: () => !root.hidden,
    away: () => !!(E && E.away),
    start(bestType, cash) { E = newEmpire(bestType, cash); save(); api.award('graduate'); open(); },
    open, close, streetDone, render,
    reset() { E = null; try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } close(); },
  };
}
