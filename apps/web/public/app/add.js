// Add a memory: record (MediaRecorder) or write a story, keep it, and show what the ofrenda heard.
(() => {
  const PERSON = document.body.dataset.person || 'rosa-mendez';
  const $ = id => document.getElementById(id);
  const form = $('story'), rec = $('rec'), title = $('title'), text = $('text');
  const list = $('heard-list'), note = $('heard-note'), status = $('heard-status');
  const keep = form.querySelector('button[type="submit"]');
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KIND = { food: ['kind-food', 'On her table'], song: ['kind-song', 'What she sang'], place: ['kind-place', 'Where she went'], saying: ['kind-saying', 'What she used to say'], ritual: ['kind-ritual', 'How she kept it'], photo: ['kind-photo', 'A photograph'], date: ['kind-date', 'A date'] };

  // Arriving from "Ask Tío Chucho": preselect the teller and use the question as the title.
  const params = new URLSearchParams(location.search);
  const teller = params.get('teller');
  if (teller) { const r = form.querySelector(`input[name="who"][value="${CSS.escape(teller)}"]`); if (r) r.checked = true; }
  if (params.get('title')) { title.value = params.get('title'); text.value = ''; text.placeholder = 'What do you remember?'; }

  // Recording
  let recorder, chunks = [], blob = null, t = 0, timer;
  rec.addEventListener('click', async () => {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { rec.querySelector('.rec-label').textContent = 'The microphone is blocked. Write the story instead.'; return; }
    chunks = []; blob = null; t = 0;
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach(tr => tr.stop());
      blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      clearInterval(timer);
      rec.setAttribute('aria-pressed', 'false');
      rec.querySelector('.rec-label').textContent = `Recorded (${rec.querySelector('.rec-time').textContent}). Record again`;
    };
    recorder.start();
    rec.setAttribute('aria-pressed', 'true');
    rec.querySelector('.rec-label').textContent = 'Stop and keep the recording';
    timer = setInterval(() => { t++; rec.querySelector('.rec-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }, 1000);
  });

  function showItems(items, memoryId, heardText) {
    note.textContent = items.length ? 'Gemma read the story and found these for her altar:' : 'Kept. Gemma found nothing new for the altar in this one.';
    list.innerHTML = items.map(i => {
      const [icon, label] = KIND[i.kind] || ['kind-saying', i.kind];
      return `<li><svg aria-hidden="true"><use href="../svg/sprite.svg#${icon}"/></svg><span class="it">${esc(i.name)}</span><span class="kind">${esc(label)}${i.note ? ` · ${esc(i.note)}` : ''}</span></li>`;
    }).join('');
    status.innerHTML = `Kept on her ofrenda as <a href="index.html#ask">${esc(memoryId)}</a>.${heardText ? ` It heard: “${esc(heardText.slice(0, 220))}${heardText.length > 220 ? '…' : ''}”` : ''}`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const who = form.querySelector('input[name="who"]:checked')?.value || null;
    const stt = form.querySelector('input[name="stt"]:checked')?.value || 'elevenlabs';
    const name = title.value.trim() || 'A memory';
    keep.disabled = true;
    keep.textContent = blob ? 'Listening to the recording…' : 'Finding what belongs on the altar…';
    try {
      let res;
      if (blob) {
        const q = new URLSearchParams({ personId: PERSON, title: name, stt, ...(who ? { tellerId: who } : {}) });
        res = await fetch(`/api/memories/audio?${q}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
      } else {
        if (!text.value.trim()) throw new Error('Record the story or write it first.');
        res = await fetch('/api/memories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: PERSON, tellerId: who, title: name, text: text.value }) });
      }
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
      showItems(out.items || [], out.memoryId, blob ? out.text : null);
      keep.textContent = 'Kept. It is on her ofrenda now.';
      blob = null;
    } catch (err) {
      status.textContent = err.message;
      keep.textContent = 'Keep it on her ofrenda';
    } finally {
      keep.disabled = false;
    }
  });
})();
