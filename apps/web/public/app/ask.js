// Ofrenda mockup: "Ask her ofrenda" with no model. It ranks the family's stories by word overlap and
// quotes the best sentences with who told them. In the app, Gemma writes the answer from the same
// retrieved stories (hybrid BM25 + EmbeddingGemma), with the same rule: no story, no answer.
(() => {
  const STORIES = [
    { id: 'm1', title: 'Mole on Sundays', who: 'Lupita, her daughter', text: "Every Sunday my mother started the mole negro before the church bells at Santo Domingo rang for seven o'clock mass. She toasted the chilhuacles until the whole street coughed. Nobody was allowed to stir the pot but her. When I was fourteen she finally handed me the wooden spoon and said, “Now you will never be hungry, and neither will anyone you love.”", tags: 'cook cooked cooking food sunday sundays domingo domingos mole cocinaba comida' },
    { id: 'm2', title: 'El puesto de chocolate', who: 'Tío Chucho, her brother', text: 'Rosa abrió su puesto en el Mercado 20 de Noviembre con un metate prestado y tres kilos de cacao. Molía el chocolate con canela y almendra delante de los clientes, porque decía que la gente compra lo que ve hacer. Yo le cargaba los costales y ella me pagaba con pan de yema.', tags: 'work job stall market sold sell chocolate mercado trabajo vendía puesto bread pan' },
    { id: 'm3', title: 'The song she sang off-key', who: 'Mateo, her grandson', text: 'Abuela sang “Canción Mixteca” while she washed dishes, always a little flat on the high part, and she knew it. If you laughed she sang louder. It was the song her father whistled walking down from the Sierra to sell coffee.', tags: 'sing sang song songs music cantaba canción canciones música' },
    { id: 'm4', title: 'Al mal tiempo, buena cara', who: 'Ana Sofía, her granddaughter', text: 'Cuando reprobé el examen de admisión, la abuela me puso un chocolate enfrente, me dijo “al mal tiempo, buena cara, mija” y me mandó a lavarme la cara. Luego me enseñó su libreta de cuentas del puesto: años enteros de números en rojo.', tags: 'say said saying sayings advice bad mal decía dicho consejo failed reprobé' },
    { id: 'm5', title: 'The road to Monte Albán', who: 'Lupita, her daughter', text: 'On the first Sunday of every year my mother walked us up the road to Monte Albán. She packed tlayudas and oranges and made us sit on the steps of the ball court to eat. She said the old ones up there were also somebody\'s grandparents, and that if we ate in front of them we had to say thank you.', tags: 'year new walk trip took monte alban albán tlayudas año' },
    { id: 'm6', title: 'Pan de muerto for the dog', who: 'Mateo, her grandson', text: 'Every year on the ofrenda she put one small pan de muerto at the very bottom, on the floor tier, for Canelo, the dog she had as a girl. One year our dog ate it during the night and she decided that counted, that Canelo had sent someone to collect it.', tags: 'dog perro canelo bread floor pan muerto pet' },
    { id: 'm7', title: 'Hay más tiempo que vida', who: 'Tío Chucho, her brother', text: 'Nunca la vi correr. Si llegábamos tarde a misa, a una boda, a lo que fuera, ella caminaba igual de despacio y decía “hay más tiempo que vida”. Ahora que soy viejo entiendo que no hablaba del reloj.', tags: 'late tarde run corría correr slow despacio hurry time tiempo decía say' },
    { id: 'm8', title: 'Marigolds from the roof', who: 'Ana Sofía, her granddaughter', text: 'Her last October she couldn\'t go to the market, so she grew cempasúchil in paint buckets on the roof. She made me lay a line of petals from the front door to the ofrenda. “If the path is crooked they get lost,” she said.', tags: 'flower flowers marigold marigolds cempasuchil cempasúchil petals path flores camino roof' },
  ];

  const STOP = new Set('a an the and or of to in on at for did does do she her he his was is what who where when why how which with it that this de la el los las y o en que qué por para con su sus le lo se una un cuando cómo como dónde quién'.split(' '));
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = s => norm(s).match(/[a-zñ0-9]+/g)?.filter(w => w.length > 2 && !STOP.has(w)) ?? [];

  function rank(q) {
    const qw = words(q);
    return STORIES.map(s => {
      const bag = new Set(words(s.title + ' ' + s.text + ' ' + s.tags));
      const score = qw.reduce((n, w) => n + (bag.has(w) ? 1 : [...bag].some(b => b.startsWith(w.slice(0, 5)) && w.length > 4) ? 0.5 : 0), 0);
      return { s, score };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  }

  function bestSentences(story, q) {
    const qw = new Set(words(q + ' ' + story.tags));
    const sentences = story.text.match(/[^.!?]+[.!?”]+/g) ?? [story.text];
    const scored = sentences.map((t, i) => ({ t: t.trim(), i, n: words(t).filter(w => qw.has(w)).length }));
    const top = scored.sort((a, b) => b.n - a.n).slice(0, 2).sort((a, b) => a.i - b.i);
    return top.map(x => x.t).join(' ');
  }

  const candle = '<svg viewBox="0 0 40 120" aria-hidden="true"><use href="../svg/sprite.svg#candle"/></svg>';
  const el = id => document.getElementById(id);
  const answer = el('answer');
  let lastText = '';
  let lastLang = 'en';
  const PERSON = document.body.dataset.person || 'rosa-mendez';
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isEs = t => /[ñáéíóú¿¡]|\b(qué|cómo|dónde|por qué|cuál|ella|su|le)\b/i.test(t);
  const NONE_EN = 'Nobody in her family has told the ofrenda about that yet.';
  const NONE_ES = 'Nadie de su familia le ha contado eso a la ofrenda todavía.';

  // Offline fallback (static hosting, or the API is down): the same keyword ranking as the design mockup.
  function askLocal(q) {
    const hits = rank(q).slice(0, 2);
    if (!q.trim() || hits.length === 0) return { found: false };
    const top = hits[0].score;
    const keep = hits.filter(h => h.score >= top * 0.75);
    return {
      found: true, mode: 'extractive',
      parts: keep.map(h => ({ text: bestSentences(h.s, q), id: h.s.id, title: h.s.title, teller: h.s.who })),
    };
  }

  function render(result, q, heard) {
    lastLang = isEs(q) ? 'es' : 'en';
    const asked = heard ? `<p class="heard-q">You asked: “${esc(heard)}”</p>` : '';
    if (!result.found) {
      lastText = lastLang === 'es' ? NONE_ES : NONE_EN;
      const who = result.ask;
      if (who) {
        const name = short(who.name);
        lastText += lastLang === 'es' ? ` Pregúntale a ${name}.` : ` Ask ${name}, ${who.relation}.`;
        answer.innerHTML = `${asked}<p class="none">${esc(lastLang === 'es' ? NONE_ES : NONE_EN)}</p>
          <div class="ask-who" style="--tint:${tint(who.name)}">
            <p>Ask <strong>${esc(name)}</strong>, ${esc(who.relation)}.${who.because ? ` ${esc(name)} told the ofrenda “${esc(who.because)}”, the closest story to your question.` : ''}</p>
            <a class="ask-who-btn" href="add.html?teller=${encodeURIComponent(who.tellerId)}&title=${encodeURIComponent(q)}">Record ${esc(name)}'s answer</a>
          </div>`;
        return;
      }
      answer.innerHTML = `${asked}<p class="none">${esc(lastText)} <a href="#add">${lastLang === 'es' ? 'Tú puedes contárselo primero.' : 'You could be the first.'}</a></p>`;
      return;
    }
    if (result.parts) {
      lastText = result.parts.map(p => p.text).join(' ');
      answer.innerHTML = asked + result.parts.map(p => `
        <blockquote>
          <p>${esc(p.text)}</p>
          <p class="said">${candle}<span>${esc(p.teller)}, in <a href="#${esc(p.id)}">“${esc(p.title)}”</a></span></p>
        </blockquote>`).join('');
      return;
    }
    lastText = result.answer;
    const cites = (result.citations || []).map(c =>
      `<span class="cite">${candle}<span>${esc(c.teller || 'The family')}, in <a href="#${esc(c.id)}">“${esc(c.title)}”</a></span></span>`).join('');
    const meta = result.model ? `<p class="meta">${esc(result.model.split('/').pop())} · ${result.mode === 'model' ? 'in its own words, checked against the stories' : 'quoting the family directly'} · ${(result.ms / 1000).toFixed(1)} s</p>` : '';
    answer.innerHTML = `${asked}<blockquote><p>${esc(result.answer)}</p><p class="said">${cites}</p></blockquote>${truthsHtml(result.truths)}${meta}`;
    if (result.truths?.conflict) {
      lastText += ` ${lastLang === 'es' ? 'La familia lo recuerda de dos maneras.' : 'But the family remembers this two ways.'} ` +
        result.truths.versions.map(v => `${short(v.teller)}: ${v.says}`).join(' ');
    }
  }

  const short = t => String(t || '').replace(/.*\(|\).*/g, '') || 'Someone';
  const tint = t => { const n = String(t || '').toLowerCase(); return n.includes('lupita') ? 'var(--who-lupita)' : n.includes('chucho') ? 'var(--who-chucho)' : n.includes('mateo') ? 'var(--who-mateo)' : n.includes('ana') ? 'var(--who-ana)' : 'var(--paper-2)'; };
  function truthsHtml(t) {
    if (!t?.conflict) return '';
    return `<div class="truths">
      <p class="truths-h">The family remembers this two ways${t.about ? `: ${esc(t.about)}` : ''}.</p>
      <div class="truths-row">${t.versions.map(v => `
        <figure class="truth" style="--tint:${tint(v.teller)}">
          <blockquote>“${esc(v.says)}”</blockquote>
          <figcaption>${candle}<span>${esc(v.teller)}, in <a href="#${esc(v.memoryId)}">“${esc(v.title)}”</a></span></figcaption>
        </figure>`).join('')}</div>
      <p class="truths-note">The ofrenda keeps both. It is not its place to decide.</p>
    </div>`;
  }

  let asking = 0;
  async function ask(q, { voice = false } = {}) {
    if (!q || !q.trim()) return;
    const ticket = ++asking;
    answer.innerHTML = `<p class="thinking">${isEs(q) ? 'Buscando entre lo que su familia le contó…' : 'Looking through what her family told it…'}</p>`;
    let result;
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: PERSON, q }) });
      if (!res.ok) throw new Error(String(res.status));
      result = await res.json();
    } catch {
      result = askLocal(q);
    }
    if (ticket !== asking) return;
    render(result, q);
    if (voice) narrate(lastText);
  }

  const form = el('ask-form');
  const input = el('q');
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });

  const tabs = [...document.querySelectorAll('.ask-tabs [role="tab"]')];
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
    input.value = t.dataset.q;
    ask(t.dataset.q);
  }));

  document.querySelectorAll('a[data-q]').forEach(a => a.addEventListener('click', () => {
    input.value = a.dataset.q;
    ask(a.dataset.q);
  }));

  // ---- The ofrenda's voice: ElevenLabs narration, candles that flicker with it, browser voice as fallback.
  let player;
  async function narrate(text, button) {
    if (!text) return;
    if (player) { player.pause(); player = null; }
    speechSynthesis?.cancel?.();
    button?.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch('/api/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      player = new Audio(url);
      window.OfrendaVoice?.attach(player);
      await player.play();
    } catch {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = isEs(text) ? 'es-MX' : 'en-US';
      u.rate = 0.92;
      speechSynthesis.speak(u);
    } finally {
      button?.removeAttribute('aria-busy');
    }
  }
  window.OfrendaNarrate = narrate;
  const speakBtn = el('speak');
  speakBtn.addEventListener('click', () => narrate(lastText, speakBtn));

  // ---- Ask out loud: hold the button, speak, let go. ElevenLabs Scribe hears it; Gemma answers; the narrator replies.
  const mic = el('mic');
  if (mic && navigator.mediaDevices && window.MediaRecorder) {
    let rec, chunks = [], stream;
    const start = async e => {
      e.preventDefault();
      if (rec) return;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { mic.textContent = 'The microphone is blocked'; return; }
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        rec = null;
        mic.classList.remove('is-live');
        mic.querySelector('span').textContent = 'Listening to what you asked…';
        answer.innerHTML = `<p class="thinking">Listening to what you asked…</p>`;
        try {
          const res = await fetch(`/api/voice?personId=${encodeURIComponent(PERSON)}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || res.status);
          input.value = result.question;
          render(result, result.question, result.question);
          narrate(lastText);
        } catch (err) {
          answer.innerHTML = `<p class="none">${esc(err.message || 'The ofrenda could not hear that.')} Try typing the question instead.</p>`;
        } finally {
          mic.querySelector('span').textContent = 'Hold to ask out loud';
        }
      };
      rec.start();
      mic.classList.add('is-live');
      mic.querySelector('span').textContent = 'Listening. Let go when you are done';
    };
    const stop = e => { e.preventDefault(); if (rec && rec.state === 'recording') rec.stop(); };
    mic.addEventListener('pointerdown', start);
    mic.addEventListener('pointerup', stop);
    mic.addEventListener('pointerleave', stop);
    mic.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !rec) start(e); });
    mic.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(e); });
  } else if (mic) {
    mic.hidden = true;
  }

  ask(input.value);

  // Entrances: stagger the parts of each section once as it arrives.
  const items = document.querySelectorAll('[data-enter]');
  const groups = new Map();
  items.forEach(n => {
    const sec = n.closest('section, header, footer');
    const k = groups.get(sec) ?? 0; groups.set(sec, k + 1);
    n.style.setProperty('--n', k);
  });
  if (!('IntersectionObserver' in window)) { items.forEach(n => n.classList.add('is-in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(n => io.observe(n));
})();
