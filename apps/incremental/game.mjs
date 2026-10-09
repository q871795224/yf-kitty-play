// Game rules stay in this app; the shared room only renders its actors.
export const SAVE_KEY = 'yf-kitty.incremental.v1';
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
export const MAX_LEVEL = 20;
export const CATS = [
  {id: 'orange', name: '橘白', breed: '橘白短毛', cost: 0, base: 0.6, nest: 18, note: '一小团阳光，也是小屋的第一位住客。'},
  {id: 'british', name: '英短', breed: '蓝灰英短', cost: 120, base: 1.5, nest: 45, note: '慢悠悠地眨眼，把午后过成一场好梦。'},
  {id: 'ragdoll', name: '布偶', breed: '双色布偶', cost: 900, base: 4, nest: 120, note: '软乎乎的陪伴，让平常的日子也发亮。'},
  {id: 'siamese', name: '暹罗', breed: '重点色暹罗', cost: 3800, base: 10, nest: 300, note: '总有说不完的喵喵，想把故事讲给你听。'},
  {id: 'calico', name: '三花', breed: '三花短毛', cost: 12500, base: 24, nest: 720, note: '带着三种颜色，也带来一点小小的幸运。'},
];
export const DECORATIONS = [
  {id: 'cushion', name: '一块软软的垫子', cost: 180, bonus: 0.15, note: '把阳光晒暖的位置留给它们。'},
  {id: 'plant', name: '窗边的一抹绿', cost: 1100, bonus: 0.2, note: '添一点绿意，陪猫猫慢慢长大。'},
  {id: 'blanket', name: '一条格子小毯', cost: 6000, bonus: 0.3, note: '五只猫，也装得下的安心。'},
];

export function createState(now = Date.now()) {
  return {version: 1, points: 0, lifetime: 0, cats: Object.fromEntries(CATS.map(cat => [cat.id, cat.id === 'orange' ? 1 : 0])), decorations: [], selected: 'orange', savedAt: now};
}

export function parseState(raw) {
  const state = JSON.parse(raw);
  if (!state || state.version !== 1 || !state.cats || !Array.isArray(state.decorations)) throw new Error('Invalid save');
  for (const key of ['points', 'lifetime', 'savedAt']) {
    if (!Number.isFinite(state[key]) || state[key] < 0 || state[key] > 1e100) throw new Error(`Invalid ${key}`);
  }
  if (state.lifetime < state.points) throw new Error('Invalid lifetime');
  const cats = {};
  for (const cat of CATS) {
    const level = state.cats[cat.id];
    if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL || (cat.id === 'orange' && level === 0)) throw new Error('Invalid cat level');
    cats[cat.id] = level;
  }
  if (state.decorations.some(id => !DECORATIONS.some(item => item.id === id)) || new Set(state.decorations).size !== state.decorations.length) throw new Error('Invalid decorations');
  return {version: 1, points: state.points, lifetime: state.lifetime, savedAt: state.savedAt, cats, decorations: [...state.decorations], selected: cats[state.selected] > 0 ? state.selected : 'orange'};
}

export function multiplier(state) {
  return 1 + DECORATIONS.filter(item => state.decorations.includes(item.id)).reduce((sum, item) => sum + item.bonus, 0);
}
export function catRate(state, id) {
  const cat = CATS.find(cat => cat.id === id);
  const level = state.cats[id];
  return cat && level > 0 ? cat.base * 1.35 ** (level - 1) * multiplier(state) : 0;
}
export function totalRate(state) {
  return CATS.reduce((sum, cat) => sum + catRate(state, cat.id), 0);
}
export function upgradeCost(state, id) {
  const cat = CATS.find(cat => cat.id === id);
  const level = state.cats[id];
  return cat && level > 0 && level < MAX_LEVEL ? Math.ceil(cat.nest * 1.65 ** (level - 1)) : null;
}
export function petReward(state, id) {
  return state.cats[id] > 0 ? 2 + Math.floor((state.cats[id] - 1) / 3) : 0;
}
function earn(state, amount) {
  state.points += amount;
  state.lifetime += amount;
}
export function pet(state, id) {
  const amount = petReward(state, id);
  if (amount) {
    state.selected = id;
    earn(state, amount);
  }
  return amount;
}

// Wall-clock settlement also covers throttled/hidden tabs. Consume the entire
// gap, including time beyond the cap, so it cannot be claimed again.
export function advance(state, now = Date.now()) {
  const seconds = Math.min(MAX_OFFLINE_SECONDS, Math.max(0, (now - state.savedAt) / 1000));
  const amount = seconds * totalRate(state);
  earn(state, amount);
  state.savedAt = Math.max(state.savedAt, now);
  return {seconds, amount};
}

export function upgrade(state, id) {
  const cost = upgradeCost(state, id);
  if (cost === null || state.points < cost) return false;
  state.points -= cost;
  state.cats[id]++;
  return true;
}
export function invite(state, id) {
  const cat = CATS.find(cat => cat.id === id);
  if (!cat || state.cats[id] > 0 || state.points < cat.cost) return false;
  state.points -= cat.cost;
  state.cats[id] = 1;
  state.selected = id;
  return true;
}
export function decorate(state, id) {
  const item = DECORATIONS.find(item => item.id === id);
  if (!item || state.decorations.includes(id) || state.points < item.cost) return false;
  state.points -= item.cost;
  state.decorations.push(id);
  return true;
}
