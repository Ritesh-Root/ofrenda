// Her calavera: asks the server for a calavera literaria written from the family's stories (Gemma 4),
// sets it as a broadsheet, and lets the ofrenda's narrator read it. Without the API it shows the last
// calavera the model wrote (calavera.json), so a static copy of the page still has one.
(() => {
  const PERSON = document.body.dataset.person || 'rosa-mendez';
  const es = document.querySelector('.verse-es');
  const en = document.querySelector('.verse-en');
  const from = document.getElementById('verse-from');
  const read = document.getElementById('calavera-read');
  const fresh = document.getElementById('calavera-new');
  const title = document.getElementById('calavera-h');
  if (!es) return;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stanzas = list => list.map(s => `<p>${s.split('\n').map(esc).join('<br>')}</p>`).join('');
  let current;

  function show(c) {
    current = c;
    es.innerHTML = stanzas(c.es);
    en.innerHTML = stanzas(c.en);
    const n = c.memoryIds.length;
    from.innerHTML = `Written by ${esc((c.model || 'Gemma 4').split('/').pop())} from ${n} of her family's ${n === 1 ? 'story' : 'stories'}: ${c.memoryIds.map(id => `<a href="#${esc(id)}">${esc(id)}</a>`).join(', ')}. Nothing in it was invented.`;
    es.parentElement.classList.remove('is-writing');
  }

  async function load(regenerate) {
    es.parentElement.classList.add('is-writing');
    if (regenerate) { es.innerHTML = '<p class="thinking">La Catrina is choosing her words…</p>'; en.innerHTML = ''; }
    try {
      const res = await fetch('/api/calavera', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: PERSON, fresh: !!regenerate }) });
      if (!res.ok) throw new Error(String(res.status));
      show(await res.json());
    } catch {
      try { show(await (await fetch('calavera.json')).json()); }
      catch { es.innerHTML = '<p class="none">Her calavera could not be written just now.</p>'; es.parentElement.classList.remove('is-writing'); }
    }
  }

  read.addEventListener('click', () => current && window.OfrendaNarrate?.(`${current.title}. ${current.es.join(' ')}`, read));
  fresh.addEventListener('click', () => load(true));

  // Write it when the broadsheet comes into view, not on page load.
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es2 => {
    if (es2.some(e => e.isIntersecting)) { io.disconnect(); load(false); }
  }, { rootMargin: '400px 0px' }) : null;
  io ? io.observe(es.closest('section')) : load(false);
})();
