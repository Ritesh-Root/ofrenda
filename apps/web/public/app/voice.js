// The ofrenda's voice moves the candles. While the narrator speaks, the loudness of the voice is
// written to --voice (0..1) on <html>; flames and the altar's glow-free "breath" read it in CSS.
// Reduced motion: the variable stays 0 and nothing moves.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ctx, analyser, data, raf;
  const root = document.documentElement;

  function loop() {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    const rms = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
    const prev = parseFloat(root.style.getPropertyValue('--voice')) || 0;
    root.style.setProperty('--voice', (prev * 0.6 + rms * 0.4).toFixed(3));
    raf = requestAnimationFrame(loop);
  }

  window.OfrendaVoice = {
    attach(audio) {
      if (still) return;
      try {
        ctx ??= new AudioContext();
        analyser ??= Object.assign(ctx.createAnalyser(), { fftSize: 1024 });
        data ??= new Uint8Array(analyser.fftSize);
        const src = ctx.createMediaElementSource(audio);
        src.connect(analyser);
        analyser.connect(ctx.destination);
        ctx.resume();
        root.classList.add('is-speaking');
        cancelAnimationFrame(raf);
        loop();
        const end = () => {
          cancelAnimationFrame(raf);
          root.style.setProperty('--voice', '0');
          root.classList.remove('is-speaking');
        };
        audio.addEventListener('ended', end, { once: true });
        audio.addEventListener('pause', end, { once: true });
      } catch { /* audio still plays; the candles just stay calm */ }
    },
  };
})();
