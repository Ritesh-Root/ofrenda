// Keep the designed page in step with what the family has actually told the ofrenda: every memory
// gets a place (so every citation link lands somewhere), and new altar items join the printed sheet.
// Without the API the page keeps its printed content.
(async () => {
  const PERSON = document.body.dataset.person || 'rosa-mendez';
  let data;
  try { const r = await fetch(`/api/person/${PERSON}`); if (!r.ok) return; data = await r.json(); } catch { return; }
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tellerOf = Object.fromEntries(data.memories.map(m => [m.id, m.tellerId]));
  const short = n => String(n || '').replace(/.*\(|\).*/g, '') || n;

  // Stories: each sheet belongs to the teller of its main memory; list that teller's other memories.
  document.querySelectorAll('.sheet').forEach(sheet => {
    const teller = tellerOf[sheet.id];
    if (!teller) return;
    const shown = new Set([sheet.id]);
    const also = sheet.querySelector('.sheet-also');
    const others = data.memories.filter(m => m.tellerId === teller && !shown.has(m.id));
    if (!also || !others.length) return;
    const name = short(data.tellers.find(t => t.id === teller)?.name);
    also.removeAttribute('id');
    also.innerHTML = `Also told by ${esc(name)}: ` + others.map(m =>
      `<a id="${esc(m.id)}" href="#ask" data-q="${esc(m.title)}">${esc(m.title)}</a>`).join(' · ');
    also.querySelectorAll('a[data-q]').forEach(a => a.addEventListener('click', () => {
      const q = document.getElementById('q'); q.value = a.dataset.q;
      document.getElementById('ask-form').requestSubmit();
    }));
  });

  // Altar: add items the printed sheet does not list yet, under their group.
  const GROUP = { food: 'On her table', song: 'What she sang', place: 'Where she went', saying: 'What she used to say', ritual: 'How she kept it' };
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const printed = new Set([...document.querySelectorAll('.menu-group .it')].map(n => norm(n.textContent)));
  for (const item of data.items) {
    const first = n => n.split(' ').find(w => w.length > 3) || n;
    const n = norm(item.name);
    if (printed.has(n) || [...printed].some(p => p.includes(n) || n.includes(p) || first(p) === first(n))) continue;
    const h = [...document.querySelectorAll('.menu-group h3')].find(x => x.textContent === GROUP[item.kind]);
    const ul = h?.nextElementSibling;
    if (!ul) continue;
    ul.insertAdjacentHTML('beforeend', `<li class="is-new"><span class="it">${esc(item.name)}</span><span class="who">new</span><span class="note">${esc(item.note || '')}</span></li>`);
    printed.add(norm(item.name));
  }
})();
