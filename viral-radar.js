(() => {
  const $ = id => document.getElementById(id);
  const radar = {
    candidates: [],
    setStatus(message, kind = '') {
      const el = $('radarStatus');
      el.textContent = message;
      el.className = 'notice' + (kind ? ' ' + kind : '');
      el.classList.remove('hidden');
    },
    time(seconds) {
      seconds = Math.max(0, Math.floor(seconds || 0));
      return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    },
    safeWindow(center, duration) {
      const length = Math.min(20, Math.max(8, duration * 0.12));
      let start = Math.max(0, center - length * 0.35);
      let end = Math.min(duration, start + length);
      start = Math.max(0, end - length);
      return { start, end };
    },
    scoreText(text, duration) {
      const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const hooks = /\b(wow|wait|what|why|how|secret|mistake|never|always|truth|best|worst|insane|unbelievable|finally|actually|because|shocking|incredible|tip|trick|fail|win|lost|found|reveals?|proof|learn|watch|look|imagine|important|problem|solution|versus|vs\.?|before|after|number one|top \d+)\b/i;
      const timestamp = /(?:\[?\(?)(\d{1,2}):(\d{2})(?:\]?)|\b(\d{1,2})\s*秒\b)/;
      const timed = [];
      for (const line of lines) {
        const match = line.match(timestamp);
        if (!match) continue;
        const seconds = match[3] ? Number(match[3]) : Number(match[1]) * 60 + Number(match[2]);
        if (seconds >= duration || !Number.isFinite(seconds)) continue;
        const body = line.replace(timestamp, '').replace(/^[-:–—\s]+/, '').trim();
        const words = body.split(/\s+/).filter(Boolean).length;
        const score = 35 + (hooks.test(body) ? 28 : 0) + Math.min(20, words * 1.2) + (/[!?]{1,}/.test(body) ? 8 : 0);
        timed.push({ center: seconds, score: Math.min(95, score), reason: hooks.test(body) ? 'Strong hook or reaction language' : 'Timestamped transcript moment', excerpt: body || line });
      }
      if (!timed.length) {
        const chunks = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 18);
        chunks.forEach((body, i) => {
          const score = 30 + (hooks.test(body) ? 32 : 0) + Math.min(18, body.split(/\s+/).length) + (/[!?]/.test(body) ? 8 : 0);
          timed.push({ center: duration > 0 ? (i + 0.5) / chunks.length * duration : i * 10, score: Math.min(88, score), reason: hooks.test(body) ? 'Hook words found in transcript' : 'Transcript passage to review', excerpt: body });
        });
      }
      return timed.sort((a,b) => b.score-a.score).slice(0, 8).map((item, i) => {
        const w = this.safeWindow(item.center, duration);
        return { ...item, ...w, source: 'transcript', id: 'text-' + i };
      });
    },
    async scanFrames() {
      const video = document.querySelector('#preview video');
      if (!video || !Number.isFinite(video.duration) || video.duration < 3 || !video.videoWidth) {
        this.setStatus('Load a local video and wait for its preview to finish loading before scanning frames.', 'error');
        return [];
      }
      if (!video.paused) video.pause();
      const duration = video.duration;
      const sampleCount = Math.min(80, Math.max(12, Math.floor(duration / 2)));
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 27;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const samples = [];
      const originalTime = video.currentTime;
      const seekTo = time => new Promise((resolve, reject) => {
        const target = Math.max(0, Math.min(duration - 0.05, time));
        let finished = false;
        const done = () => { if (finished) return; finished = true; clearTimeout(timer); video.removeEventListener('seeked', done); resolve(); };
        const timer = setTimeout(() => { if (finished) return; finished = true; video.removeEventListener('seeked', done); reject(new Error('Seeking timed out. Try a shorter or different video.')); }, 5000);
        video.addEventListener('seeked', done, { once: true });
        video.currentTime = target;
        if (Math.abs(video.currentTime - target) < 0.03 && video.readyState >= 2) done();
      });
      try {
        for (let i = 0; i < sampleCount; i++) {
          const t = Math.min(duration - 0.1, i * duration / sampleCount);
          await seekTo(t);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const pixels = [];
          for (let p = 0; p < data.length; p += 12) pixels.push((data[p] + data[p+1] + data[p+2]) / 3);
          let diff = 0;
          if (samples.length) {
            const prev = samples[samples.length - 1].pixels;
            for (let p = 0; p < pixels.length; p++) diff += Math.abs(pixels[p] - prev[p]);
            diff /= pixels.length;
          }
          samples.push({ t, diff, pixels });
          if (i % 8 === 0) this.setStatus('Scanning local video frames… ' + Math.round((i + 1) / sampleCount * 100) + '%');
        }
      } finally {
        try { await seekTo(originalTime); } catch (e) {}
      }
      const ranked = samples.slice(1).map((s, i) => ({ ...s, score: s.diff + (samples[i].diff || 0) * 0.35 }))
        .sort((a,b) => b.score-a.score);
      const chosen = [];
      for (const s of ranked) {
        if (chosen.every(c => Math.abs(c.t - s.t) > 12)) chosen.push(s);
        if (chosen.length >= 6) break;
      }
      return chosen.map((s, i) => {
        const w = this.safeWindow(s.t, duration);
        return { id: 'frame-' + i, ...w, center: s.t, score: Math.min(92, Math.round(30 + s.score * 0.7)), reason: 'Visual scene-change candidate', excerpt: 'Noticeable frame change near ' + this.time(s.t), source: 'frames' };
      });
    },
    render(items) {
      const list = $('radarCandidates');
      list.replaceChildren();
      if (!items.length) {
        list.className = 'queue-empty';
        list.textContent = 'No candidates yet. Scan a local video or paste a transcript / timestamped notes.';
        return;
      }
      list.className = '';
      items.forEach((item, index) => {
        const card = document.createElement('div'); card.className = 'clipitem';
        const title = document.createElement('h4'); title.textContent = (index + 1) + '. ' + this.time(item.start) + '–' + this.time(item.end) + ' · Review candidate';
        const meta = document.createElement('p'); meta.textContent = item.reason + ' · heuristic score ' + Math.round(item.score) + '/100';
        const excerpt = document.createElement('p'); excerpt.textContent = item.excerpt || 'Visual change detected. Preview this segment to judge its story and context.';
        const actions = document.createElement('div'); actions.className = 'buttonrow';
        const use = document.createElement('button'); use.className = 'primary'; use.textContent = 'Use this moment';
        use.onclick = () => {
          $('startTime').value = item.start.toFixed(1);
          $('endTime').value = item.end.toFixed(1);
          $('clipTitle').value = ('Viral candidate ' + this.time(item.start)).slice(0,90);
          const editor = document.getElementById('startTime');
          editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          this.setStatus('Candidate copied into the editor. Preview it and adjust the boundaries before exporting.', 'success');
        };
        actions.append(use); card.append(title, meta, excerpt, actions); list.append(card);
      });
    }
  };
  $('scanVideo').addEventListener('click', async () => {
    $('scanVideo').disabled = true;
    try {
      const items = await radar.scanFrames();
      radar.candidates = items;
      const transcript = $('radarTranscript').value.trim();
      if (transcript) radar.candidates = radar.candidates.concat(radar.scoreText(transcript, document.querySelector('#preview video')?.duration || 600));
      radar.candidates.sort((a,b) => b.score-a.score);
      radar.render(radar.candidates.slice(0,8));
      radar.setStatus(items.length ? 'Scan complete. These are visual-change clues, not a prediction of virality. Review every candidate.' : 'No usable frames were found.', items.length ? 'success' : 'error');
    } catch (err) {
      radar.setStatus(err.message || 'Frame scan failed. Try another local video.', 'error');
    } finally { $('scanVideo').disabled = false; }
  });
  $('analyzeTranscript').addEventListener('click', () => {
    const text = $('radarTranscript').value.trim();
    if (!text) { radar.setStatus('Paste a transcript or timestamped notes first.', 'error'); return; }
    const video = document.querySelector('#preview video');
    const duration = video && Number.isFinite(video.duration) ? video.duration : Math.max(60, ...Array.from(text.matchAll(/(\d{1,2}):(\d{2})/g), m => Number(m[1])*60+Number(m[2])+20));
    const items = radar.scoreText(text, duration);
    radar.candidates = items;
    radar.render(items);
    radar.setStatus('Transcript analysis complete. Scores rank language cues only; they are not measured view or engagement predictions.', 'success');
  });
})();