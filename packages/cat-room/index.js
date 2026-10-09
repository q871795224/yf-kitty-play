const repositoryRoot = new URL('../../', import.meta.url);

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url}: ${response.status}`);
  return response.json();
}

export async function mountCatRoom({room, strip, greeting, motionToggle, svgToggle,
  sceneUrl = new URL('assets/scenes/cozy-room/v1/scene.json', repositoryRoot), onSelect = () => {}}) {
  const [catalog, scene] = await Promise.all([
    readJson(new URL('assets/catalog.json', repositoryRoot)), readJson(sceneUrl),
  ]);
  const assets = new Map(catalog.assets.map(asset => [asset.id, asset]));
  function assetUrl(id) {
    const asset = assets.get(id);
    if (!asset) throw new Error(`Unknown asset: ${id}`);
    return new URL(asset.path, repositoryRoot).href;
  }
  room.querySelector('.room-background').src = assetUrl(scene.backgroundAssetId);
  const layer = document.createElement('div');
  layer.className = 'scene-cats';
  room.append(layer);
  let selected = scene.selected;
  let svgVisible = false;
  let visibleCats = new Set(scene.actors.map(cat => cat.id));
  const timers = new Map();
  const cats = scene.actors;

  function updateSelection() {
    const buttons = [...layer.querySelectorAll('[data-cat]'), ...(strip?.querySelectorAll('[data-cat]') ?? [])];
    buttons.forEach(button => {
      const active = button.dataset.cat === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function greet(cat) {
    if (cat.id !== scene.svgActor.id && !visibleCats.has(cat.id)) return;
    selected = cat.id;
    updateSelection();
    const button = [...layer.querySelectorAll('[data-cat]')].find(button => button.dataset.cat === cat.id);
    clearTimeout(timers.get(cat.id));
    button.classList.remove('greet');
    void button.offsetWidth;
    button.classList.add('greet');
    timers.set(cat.id, setTimeout(() => button.classList.remove('greet'), 1900));
    if (greeting) greeting.textContent = cat.description;
    onSelect(cat);
  }
  function makeCat(cat) {
    const button = document.createElement('button');
    button.className = 'cat';
    button.dataset.cat = cat.id;
    button.setAttribute('aria-label', `摸摸${cat.name}`);
    button.setAttribute('aria-pressed', 'false');
    button.style.cssText = `left:${cat.x}%;bottom:${cat.bottom}%;--duration:${cat.duration}s;--delay:${cat.delay}s`;
    const dimensions = assets.get(cat.assetId).dimensions;
    button.innerHTML = `<span class="cat-shadow"></span><span class="cat-figure"><span class="cat-pet"><img src="${assetUrl(cat.assetId)}" alt="${cat.name}" width="${dimensions[0]}" height="${dimensions[1]}"></span></span><span class="cat-label">${cat.name}</span><span class="bubble" aria-hidden="true">喵 ～</span>`;
    button.addEventListener('click', () => greet(cat));
    layer.append(button);
  }
  cats.forEach(cat => {
    makeCat(cat);
    if (!strip) return;
    const button = document.createElement('button');
    button.className = 'cat-choice';
    button.dataset.cat = cat.id;
    button.innerHTML = `<img src="${assetUrl(cat.assetId)}" alt=""><span>${cat.name}</span>`;
    button.addEventListener('click', () => greet(cat));
    strip.append(button);
  });
  updateSelection();
  if (greeting) greeting.textContent = scene.idleGreeting;

  function setPaused(paused) {
    room.classList.toggle('paused', paused);
    motionToggle?.setAttribute('aria-pressed', String(paused));
    if (motionToggle) motionToggle.textContent = paused ? '继续晃动' : '暂停晃动';
  }
  function setVisibleCats(ids) {
    if (ids.some(id => !cats.some(cat => cat.id === id))) throw new Error('Unknown room actor');
    visibleCats = new Set(ids);
    const buttons = [...layer.querySelectorAll('[data-cat]'), ...(strip?.querySelectorAll('[data-cat]') ?? [])];
    buttons.forEach(button => {
      if (button.dataset.cat !== scene.svgActor.id) button.hidden = !visibleCats.has(button.dataset.cat);
    });
    if (!visibleCats.has(selected) && selected !== scene.svgActor.id) selected = ids[0];
    updateSelection();
  }
  function setSvgVisible(visible) {
    if (visible === svgVisible) return;
    svgVisible = visible;
    svgToggle?.setAttribute('aria-pressed', String(visible));
    if (svgToggle) svgToggle.textContent = visible ? '让 SVG 猫回画册' : '把 SVG 猫放进小屋';
    if (visible) {
      makeCat(scene.svgActor);
      greet(scene.svgActor);
    } else {
      clearTimeout(timers.get(scene.svgActor.id));
      [...layer.querySelectorAll('[data-cat]')].find(button => button.dataset.cat === scene.svgActor.id).remove();
      selected = visibleCats.has(scene.selected) ? scene.selected : [...visibleCats][0];
      updateSelection();
      if (greeting) greeting.textContent = scene.idleGreeting;
    }
  }
  motionToggle?.addEventListener('click', () => setPaused(!room.classList.contains('paused')));
  svgToggle?.addEventListener('click', () => {
    setSvgVisible(!svgVisible);
    room.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'center'});
  });
  function findVisibleCat(id) {
    const cat = [...cats, scene.svgActor].find(cat => cat.id === id);
    if (!cat || (cat.id === scene.svgActor.id ? !svgVisible : !visibleCats.has(id))) throw new Error(`Cat is not in this room: ${id}`);
    return cat;
  }
  return {assetUrl, setPaused, setSvgVisible, setVisibleCats,
    select(id) { greet(findVisibleCat(id)); },
    focus(id) { selected = findVisibleCat(id).id; updateSelection(); },
  };
}
