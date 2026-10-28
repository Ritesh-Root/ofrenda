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

  function ask(q) {
    const hits = rank(q).slice(0, 2);
    if (!q.trim() || hits.length === 0) {
      lastText = 'Nobody in her family has told the ofrenda about that yet.';
      answer.innerHTML = `<p class="none">Nobody in her family has told the ofrenda about that yet. <a href="#add">You could be the first.</a></p>`;
      return;
    }
    const top = hits[0].score;
    const keep = hits.filter(h => h.score >= top * 0.75);
    lastText = keep.map(h => `${bestSentences(h.s, q)} That is what ${h.s.who.split(',')[0]} remembered.`).join(' ');
    answer.innerHTML = keep.map(h => `
      <blockquote>
        <p>${bestSentences(h.s, q)}</p>
        <p class="said">${candle}<span>${h.s.who}, in <a href="#${h.s.id}">“${h.s.title}”</a></span></p>
      </blockquote>`).join('');
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

  const speak = el('speak');
  if (!('speechSynthesis' in window)) {
    speak.disabled = true;
    speak.textContent = 'Reading aloud needs a browser voice';
  } else {
    speak.addEventListener('click', () => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(lastText);
      u.lang = /[ñáéíóú¿¡]/i.test(lastText) ? 'es-MX' : 'en-US';
      u.rate = 0.92;
      speechSynthesis.speak(u);
    });
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
