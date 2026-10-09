// Pan the complete shared room instead of cropping/stretching its actors.
export function mountRoomCamera(viewport, world, onPan = () => {}) {
  let x = 0, y = 0, width = 0, height = 0;
  let pointer = null;
  let suppressClick = false;
  let selected = 'orange';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function draw() {
    x = clamp(x, Math.min(0, viewport.clientWidth - width), 0);
    y = clamp(y, Math.min(0, viewport.clientHeight - height), 0);
    world.style.transform = `translate(${x}px, ${y}px)`;
  }
  function focus(id) {
    const actor = [...world.querySelectorAll('.cat')].find(cat => cat.dataset.cat === id && !cat.hidden);
    if (!actor) return;
    selected = id;
    x = viewport.clientWidth / 2 - width * parseFloat(actor.style.left) / 100;
    y = viewport.clientHeight * 0.66 - (height * (1 - parseFloat(actor.style.bottom) / 100) - actor.offsetHeight / 2);
    draw();
  }
  function resize() {
    const scale = Math.max(viewport.clientWidth * 1.65 / 1200, viewport.clientHeight * 1.15 / 760);
    width = 1200 * scale;
    height = 760 * scale;
    world.style.width = `${width}px`;
    world.style.height = `${height}px`;
    focus(world.querySelector('.cat.active')?.dataset.cat ?? selected);
    world.classList.add('ready');
  }
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();
  viewport.addEventListener('pointerdown', event => {
    if (pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer = {id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y, dragging: false};
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (!pointer.dragging && Math.hypot(dx, dy) > 8) {
      pointer.dragging = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('dragging');
      onPan();
    }
    if (!pointer.dragging) return;
    event.preventDefault();
    x = pointer.x + dx;
    y = pointer.y + dy;
    draw();
  });
  function release(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    suppressClick = pointer.dragging;
    pointer = null;
    viewport.classList.remove('dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    // A native click follows pointerup in the same task; do not suppress the
    // next deliberate tap after the drag has finished.
    setTimeout(() => { suppressClick = false; }, 0);
  }
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);
  window.addEventListener('pointerup', release);
  viewport.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    onPan();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    x -= (event.shiftKey ? event.deltaY : event.deltaX) * unit;
    y -= (event.shiftKey ? 0 : event.deltaY) * unit;
    draw();
  }, {passive: false});
  return {focus, focusDecoration(id) {
    const positions = {cushion: [215, 645], plant: [1053, 540], blanket: [860, 430]};
    const position = positions[id];
    if (!position) return;
    x = viewport.clientWidth / 2 - width * position[0] / 1200;
    y = viewport.clientHeight * 0.6 - height * position[1] / 760;
    draw();
  }};
}
