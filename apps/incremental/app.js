import { mountCatRoom } from '../../packages/cat-room/index.js';
import { mountRoomCamera } from './room-camera.js';
import { SAVE_KEY, CATS, DECORATIONS, MAX_LEVEL, createState, parseState, totalRate, catRate, multiplier, upgradeCost, pet, advance, upgrade, invite, decorate } from './game.mjs';

const $ = selector => document.querySelector(selector);
const number = (value, digits = 0) => value.toLocaleString('zh-CN', {maximumFractionDigits: digits});
const rateNumber = value => number(value, value < 10 ? 2 : 1);
let state = createState();
let startupNotice = '';
let storageAvailable = true;
let restored = false;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    state = parseState(raw);
    restored = true;
  }
} catch (error) {
  startupNotice = error instanceof SyntaxError || error.message.startsWith('Invalid')
    ? '旧手账暂时无法读取，已经为你打开一本新的。'
    : '浏览器暂时无法读取存档，请保持页面打开。';
}
const welcome = advance(state);
let scene;
let camera;
let toastTimer;
let lastSave = 0;
const catRows = new Map();
const decorRows = new Map();

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2800);
}
function save() {
  lastSave = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    storageAvailable = true;
    $('#save-status').textContent = '进度自动保存在这个浏览器 · 离线收益最多 8 小时';
  } catch {
    if (storageAvailable) toast('浏览器没有保存成功，离开页面前请留意进度。');
    storageAvailable = false;
    $('#save-status').textContent = '存档未成功 · 当前进度仅在本次打开期间有效';
  }
}
function showOffline(receipt) {
  if (receipt.seconds < 60 || receipt.amount < 1 || $('#offline-dialog').open || $('#reset-dialog').open) return;
  const minutes = Math.floor(receipt.seconds / 60);
  $('#offline-duration').textContent = `它们替你攒下了 ${minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`} 的暖意。`;
  $('#offline-amount').textContent = number(Math.floor(receipt.amount));
  $('#offline-dialog').showModal();
}
function buildJournal() {
  for (const cat of CATS) {
    const row = document.createElement('article');
    row.className = 'cat-entry';
    row.dataset.catId = cat.id;
    row.innerHTML = `<img src="${scene.assetUrl(`cat.c3.${cat.id}.v1`)}" alt="${cat.breed}"><div><h3 class="entry-title">${cat.name}</h3><p class="entry-description"></p></div><div class="entry-action"><button data-action="invite" data-id="${cat.id}" disabled></button><small></small></div>`;
    $('#cat-list').append(row);
    catRows.set(cat.id, row);
    const choice = document.createElement('button');
    choice.className = 'owned-choice';
    choice.dataset.action = 'focus-owned';
    choice.dataset.id = cat.id;
    choice.setAttribute('aria-label', `选择${cat.name}`);
    choice.innerHTML = `<img src="${scene.assetUrl(`cat.c3.${cat.id}.v1`)}" alt="">`;
    $('#owned-cats').append(choice);
  }
  const views = {cushion: '135 603 152 80', plant: '991 441 115 190', blanket: '761 369 207 123'};
  for (const item of DECORATIONS) {
    const row = document.createElement('article');
    row.className = 'decor-entry';
    row.dataset.decorId = item.id;
    row.innerHTML = `<div class="decor-heading"><svg class="decor-icon" viewBox="${views[item.id]}" aria-hidden="true"><use href="${scene.assetUrl('decoration.cozy-room.v1')}#${item.id}"></use></svg><div><h3 class="entry-title">${item.name}</h3><p class="entry-description">${item.note}</p></div></div><div class="decor-bottom"><span class="bonus-tag">全屋产量 +${item.bonus * 100}%</span><button class="outlined-button" data-action="decorate" data-id="${item.id}" disabled></button></div>`;
    $('#decor-list').append(row);
    decorRows.set(item.id, row);
  }
}
function render() {
  const owned = CATS.filter(cat => state.cats[cat.id] > 0);
  $('#points').textContent = number(Math.floor(state.points));
  $('#rate').textContent = rateNumber(totalRate(state));
  $('#resident-count').textContent = owned.length;
  $('#cats-tab-count').textContent = `${owned.length}/5`;
  $('#decor-tab-count').textContent = `${state.decorations.length}/3`;
  for (const cat of CATS) {
    const row = catRows.get(cat.id);
    const level = state.cats[cat.id];
    const button = row.querySelector('button');
    const choice = $(`.owned-choice[data-id="${cat.id}"]`);
    choice.hidden = !level;
    choice.setAttribute('aria-pressed', String(state.selected === cat.id));
    row.classList.toggle('owned', level > 0);
    row.classList.toggle('selected', state.selected === cat.id);
    row.querySelector('.entry-description').textContent = level ? `猫窝 Lv.${level} · ${rateNumber(catRate(state, cat.id))} / 秒` : cat.breed;
    button.textContent = level ? (state.selected === cat.id ? '在身边' : '看看它') : '迎接入住';
    button.dataset.action = level ? 'focus' : 'invite';
    button.disabled = !level && state.points < cat.cost;
    button.classList.toggle('owned-button', level > 0);
    button.setAttribute('aria-label', level ? `看看${cat.name}` : `花费 ${cat.cost} 暖心点迎接${cat.name}`);
    row.querySelector('small').textContent = level ? '已入住' : `${number(cat.cost)} ♡`;
  }
  for (const item of DECORATIONS) {
    const owned = state.decorations.includes(item.id);
    const button = decorRows.get(item.id).querySelector('button');
    button.textContent = owned ? '已添置 ✓' : `添置 · ${number(item.cost)} ♡`;
    button.disabled = owned || state.points < item.cost;
    // SVG elements do not reflect the HTML hidden property consistently.
    $(`[data-decoration="${item.id}"]`).toggleAttribute('hidden', !owned);
  }
  $('#decor-bonus').textContent = `+${Math.round((multiplier(state) - 1) * 100)}%`;
  const selected = CATS.find(cat => cat.id === state.selected);
  $('#selected-name').textContent = selected.name;
  $('#selected-breed').textContent = selected.breed;
  $('#selected-note').textContent = selected.note;
  $('#selected-level').textContent = `猫窝 Lv.${state.cats[selected.id]}`;
  $('#selected-rate').textContent = rateNumber(catRate(state, selected.id));
  const image = $('#selected-image');
  if (image.dataset.cat !== selected.id) {
    image.src = scene.assetUrl(`cat.c3.${selected.id}.v1`);
    image.alt = selected.breed;
    image.dataset.cat = selected.id;
  }
  const cost = upgradeCost(state, selected.id);
  $('#upgrade').textContent = cost === null ? `猫窝已满级 · Lv.${MAX_LEVEL}` : `升级猫窝 · ${number(cost)} ♡`;
  $('#upgrade').disabled = cost === null || state.points < cost;
  $('#upgrade-gain').textContent = cost === null ? '已经是最舒服的猫窝了' : `升级后 ${rateNumber(catRate(state, selected.id) * 1.35)} / 秒`;
  const progress = owned.length + state.decorations.length;
  $('#chapter-count').textContent = `${progress} / 8`;
  $('#chapter-progress').style.width = `${progress / 8 * 100}%`;
  $('.progress-track').setAttribute('aria-valuenow', progress);
  if (progress === 8) {
    $('#chapter-title').textContent = '五只猫，一间满满的温暖小屋。';
    $('#next-goal').textContent = '第一章完成了。还可以继续升级猫窝，或留一点时间陪它们发呆。';
  } else {
    $('#chapter-title').textContent = '让每一个角落，都有陪伴。';
    const nextCat = CATS.find(cat => !state.cats[cat.id]);
    const nextDecor = DECORATIONS.find(item => !state.decorations.includes(item.id));
    $('#next-goal').textContent = state.cats.orange === 1 && owned.length === 1
      ? '摸摸橘白，攒下 18 暖心点，给它升级第一个猫窝。'
      : nextCat ? `下一位住客是${nextCat.name}。攒下 ${number(nextCat.cost)} 暖心点，给它留个位置。`
        : `猫猫都到齐了，再添置「${nextDecor.name}」，让小屋更暖一点。`;
  }
}
function syncRoom() {
  scene.setVisibleCats(CATS.filter(cat => state.cats[cat.id] > 0).map(cat => cat.id));
  scene.focus(state.selected);
}
function transact(action, id) {
  advance(state);
  if (!action(state, id)) return false;
  syncRoom();
  render();
  save();
  return true;
}
function floatReward(id, amount) {
  const actor = $(`#room .cat[data-cat="${id}"]`);
  const float = document.createElement('span');
  float.className = 'point-float';
  float.textContent = `+${amount} ♡`;
  float.setAttribute('aria-hidden', 'true');
  actor.append(float);
  setTimeout(() => float.remove(), 900);
}

try {
  scene = await mountCatRoom({
    room: $('#room'), greeting: $('#greeting'), motionToggle: $('#motion-toggle'),
    onSelect(cat) {
      advance(state);
      const amount = pet(state, cat.id);
      if (!amount) return;
      render();
      floatReward(cat.id, amount);
      $('#scene-hint').classList.add('dismissed');
      $('#greeting').textContent = `${cat.description} +${amount} 暖心点`;
      save();
    },
  });
  document.querySelectorAll('[data-decoration-use]').forEach(use => {
    use.setAttribute('href', `${scene.assetUrl('decoration.cozy-room.v1')}#${use.dataset.decorationUse}`);
  });
  buildJournal();
  syncRoom();
  camera = mountRoomCamera($('#scene-viewport'), $('#room'), () => $('#scene-hint').classList.add('dismissed'));
  camera.focus(state.selected);
  render();
  save();
  document.querySelectorAll('[data-open], #recenter').forEach(button => { button.disabled = false; });
  if (restored) $('#greeting').textContent = '欢迎回来，猫猫一直给你留着位置。';
  if (startupNotice) toast(startupNotice);
  if (restored) showOffline(welcome);

  $('#upgrade').addEventListener('click', () => {
    const id = state.selected;
    if (state.points < upgradeCost(state, id) || upgradeCost(state, id) === null) return;
    transact(upgrade, id);
    toast(`${CATS.find(cat => cat.id === id).name}的猫窝更舒服了 · Lv.${state.cats[id]}`);
  });
  function openSheet(id) {
    document.querySelectorAll('.bottom-sheet[open]').forEach(dialog => dialog.close());
    $(`#${id}`).showModal();
  }
  document.body.addEventListener('click', event => {
    const opener = event.target.closest('[data-open]');
    if (opener && !opener.disabled) openSheet(opener.dataset.open);
    const closer = event.target.closest('[data-close]');
    if (closer) closer.closest('dialog').close();
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const {action, id} = button.dataset;
    if (action === 'focus' || action === 'focus-owned') {
      state.selected = id;
      scene.focus(id);
      render();
      save();
      if (action === 'focus') openSheet('cat-sheet');
    } else if (action === 'invite') {
      if (!transact(invite, id)) return;
      $('#invite-sheet').close();
      camera.focus(id);
      const cat = CATS.find(cat => cat.id === id);
      $('#greeting').textContent = `${cat.name}轻轻走进小屋：以后也请多多陪伴。`;
      toast(`欢迎${cat.name}，小屋又暖了一点。`);
    } else if (action === 'decorate') {
      if (!transact(decorate, id)) return;
      $('#decor-sheet').close();
      // Show the newly placed object, without moving any cat independently.
      camera.focusDecoration(id);
      toast(`添置了${DECORATIONS.find(item => item.id === id).name}。`);
    }
  });
  document.querySelectorAll('.bottom-sheet').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientX < rect.left || event.clientX > rect.right) dialog.close();
    });
  });
  $('#recenter').addEventListener('click', () => camera.focus(state.selected));
  $('#find-cat').addEventListener('click', () => {
    $('#cat-sheet').close();
    camera.focus(state.selected);
  });
  $('#reset').addEventListener('click', () => {
    $('#reset-dialog').returnValue = 'cancel';
    $('#reset-dialog').showModal();
  });
  $('#reset-dialog').addEventListener('close', () => {
    if ($('#reset-dialog').returnValue !== 'reset') return;
    state = createState();
    syncRoom();
    camera.focus('orange');
    document.querySelectorAll('.bottom-sheet[open]').forEach(dialog => dialog.close());
    render();
    save();
    $('#greeting').textContent = '橘白正在晒太阳。新的一本手账，从这里开始。';
    toast('小屋重新开始了，橘白还在等你。');
  });
  setInterval(() => {
    if (document.hidden) return;
    advance(state);
    render();
    if (Date.now() - lastSave >= 5000) save();
  }, 200);
  document.addEventListener('visibilitychange', () => {
    const receipt = advance(state);
    save();
    if (!document.hidden) {
      render();
      showOffline(receipt);
    }
  });
  window.addEventListener('pagehide', () => { advance(state); save(); });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      const receipt = advance(state);
      render();
      save();
      showOffline(receipt);
    }
  });
  // Follow saves from another tab instead of retaining an outdated balance.
  window.addEventListener('storage', event => {
    if (event.key !== SAVE_KEY || !event.newValue) return;
    try {
      state = parseState(event.newValue);
      advance(state);
      syncRoom();
      render();
    } catch { /* Keep the valid in-memory hand journal. */ }
  });
} catch (error) {
  $('#greeting').textContent = '小屋暂时没有打开，请刷新页面重试。';
  $('#save-status').textContent = '小屋加载失败 · 请检查预览服务';
  console.error(error);
}
