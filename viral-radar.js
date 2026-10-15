(() => {
  const $ = id => document.getElementById(id);
  const radar = {
    candidates: [],
    audioContext: null,
    audioSource: null,
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
    clipLength() {
      return Math.max(5, Number($('radarClipLength')?.value || 15));
    },
    safeWindow(center, duration, requestedLength) {
      const length = Math.min(duration, Math.max(1, requestedLength || this.clipLength()));
      let start = Math.max(0, center - length * 0.35);
      let end = Math.min(duration, start + length);
      start = Math.max(0, end - length);
      return { start, end };
    },
    scoreText(text, duration) {
      const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const hooks = /\b(wow|wait|what|why|how|secret|mistake|never|always|truth|best|worst|insane|unbelievable|finally|actually|because|shocking|incredible|tip|trick|fail|win|lost|found|reveals?|proof|learn|watch|look|imagine|important|problem|solution|versus|vs\.?|before|after|number one|top \d+)\b/i;
      const timestamp = /(\d{1,2}):(\d{2})/;
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
        const w = this.safeWindow(item.center, duration, this.clipLength());
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
        const w = this.safeWindow(s.t, duration, this.clipLength());
        return { id: 'frame-' + i, ...w, center: s.t, score: Math.min(92, Math.round(30 + s.score * 0.7)), reason: 'Visual scene-change candidate', excerpt: 'Noticeable frame change near ' + this.time(s.t), source: 'frames' };
      });
    },
    async scanAudioEnergy() {
      const video = document.querySelector('#preview video');
      if (!video || !video.currentSrc || !Number.isFinite(video.duration) || !video.videoWidth) return [];
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass || !video.captureStream && !video.mozCaptureStream) {
        this.setStatus('This browser cannot analyze the video audio stream. Visual and transcript clues will still be used.');
        return [];
      }
      let context, source, analyser, gain, frameId, timerId;
      const originalTime = video.currentTime;
      const originalRate = video.playbackRate;
      const wasPaused = video.paused;
      const originalMuted = video.muted;
      const samples = [];
      try {
        context = this.audioContext || (this.audioContext = new AudioContextClass());
        await context.resume();
        source = this.audioSource || (this.audioSource = context.createMediaElementSource(video));
        source.disconnect();
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        gain = context.createGain();
        gain.gain.value = 0;
        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(context.destination);
        video.pause();
        video.currentTime = 0;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Audio scan could not seek to the start.')), 5000);
          const done = () => { clearTimeout(timer); video.removeEventListener('seeked', done); resolve(); };
          video.addEventListener('seeked', done, { once: true });
          if (video.currentTime === 0 && video.readyState >= 2) done();
        });
        const data = new Uint8Array(analyser.fftSize);
        let lastBucket = -1;
        video.muted = false;
        video.playbackRate = 4;
        const finished = new Promise((resolve, reject) => {
          const startedAt = Date.now();
          const sample = () => {
            if (video.currentTime >= video.duration - 0.05 || video.ended) { resolve(); return; }
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const value = (data[i] - 128) / 128;
              sum += value * value;
            }
            const bucket = Math.floor(video.currentTime * 2);
            if (bucket !== lastBucket) {
              samples.push({ t: video.currentTime, energy: Math.sqrt(sum / data.length) });
              lastBucket = bucket;
            }
            if (Date.now() - startedAt > Math.max(20000, video.duration * 1000 / 2 + 10000)) {
              reject(new Error('Audio scan timed out. You can still use visual and transcript clues.'));
              return;
            }
            frameId = requestAnimationFrame(sample);
          };
          video.addEventListener('ended', resolve, { once: true });
          video.play().then(sample).catch(reject);
        });
        await finished;
        cancelAnimationFrame(frameId);
        video.pause();
        if (samples.length < 2) return [];
        const sorted = samples.map(x => x.energy).sort((a,b) => a-b);
        const baseline = sorted[Math.floor((sorted.length - 1) * 0.25)] || 0;
        const high = sorted[Math.floor((sorted.length - 1) * 0.90)] || 0;
        const spread = Math.max(0.00001, high - baseline);
        const peaks = samples.map(p => ({ ...p, score: Math.max(0, Math.min(100, Math.round(25 + (p.energy - baseline) / spread * 55))) })).sort((a,b)=>b.score-a.score);
        const chosen = [];
        for (const p of peaks) {
          if (chosen.every(c => Math.abs(c.center - p.t) >= 4)) chosen.push({ center:p.t, score:p.score });
          if (chosen.length >= 6) break;
        }
        return chosen.map((p,i) => {
          const w = this.safeWindow(p.center, video.duration, this.clipLength());
          return { id:'audio-'+i, ...w, center:p.center, score:p.score, reason:'Audio-energy peak — listen for a reaction, emphasis, or meaningful sound', excerpt:'Higher-than-baseline audio energy near '+this.time(p.center), source:'audio' };
        });
      } catch (err) {
        this.setStatus((err.message || 'Audio scan failed.') + ' Visual and transcript clues can still be used.');
        return [];
      } finally {
        if (frameId) cancelAnimationFrame(frameId);
        if (timerId) clearTimeout(timerId);
        video.pause();
        video.playbackRate = originalRate || 1;
        video.muted = originalMuted;
        try {
          const target = Math.min(originalTime, Math.max(0, video.duration - 0.05));
          video.currentTime = target;
        } catch (e) {}
        if (!wasPaused) video.play().catch(() => {});
        if (analyser) try { analyser.disconnect(); } catch (e) {}
        if (gain) try { gain.disconnect(); } catch (e) {}
      }
    },
    combineCandidates(items) {
      const groups = ['frames', 'audio', 'transcript'];
      const merged = [];
      items.forEach(item => {
        let target = merged.find(existing => Math.abs(existing.center - item.center) <= Math.max(3, Math.min(8, this.clipLength() * 0.35)));
        if (!target) {
          target = { ...item, signals: [item.source], signalScores: [Number(item.score) || 0] };
          merged.push(target);
        } else {
          if (!target.signals.includes(item.source)) target.signals.push(item.source);
          target.signalScores.push(Number(item.score) || 0);
          if (item.source === 'transcript' && item.excerpt) target.excerpt = item.excerpt;
          target.start = Math.max(0, Math.min(target.start, item.start));
          target.end = Math.max(target.end, item.end);
        }
      });
      return merged.map(item => {
        const signals = item.signals || [item.source];
        const values = item.signalScores || [Number(item.score) || 0];
        const average = values.reduce((sum,value)=>sum+value,0) / values.length;
        const bonus = Math.max(0, signals.length - 1) * 8;
        const score = Math.min(98, Math.round(average + bonus));
        const labels = { frames:'visual change', audio:'audio energy', transcript:'transcript cue' };
        const evidence = signals.map(s => labels[s] || s).join(' + ');
        return { ...item, score, reason: signals.length > 1 ? 'Combined evidence: ' + evidence : item.reason, excerpt: item.excerpt || 'Review the full context and sound.', source: signals.length > 1 ? 'combined' : item.source };
      }).sort((a,b)=>b.score-a.score).map((item,i)=>({ ...item, id:'candidate-'+i }));
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
        const preview = document.createElement('button'); preview.textContent = 'Preview moment';
        preview.onclick = async () => {
          const video = document.querySelector('#preview video');
          if (!video || !Number.isFinite(video.duration)) { this.setStatus('Load the matching local video to preview this candidate.', 'error'); return; }
          video.pause();
          const start = Math.max(0, Math.min(item.start, video.duration - 0.1));
          const end = Math.min(video.duration, item.end);
          try {
            await new Promise((resolve, reject) => {
              let done = false;
              const finish = () => { if (done) return; done = true; clearTimeout(timer); video.removeEventListener('seeked', finish); resolve(); };
              const timer = setTimeout(() => { if (done) return; done = true; video.removeEventListener('seeked', finish); reject(new Error('Video seek timed out')); }, 5000);
              video.addEventListener('seeked', finish, { once: true }); video.currentTime = start;
              if (Math.abs(video.currentTime - start) < 0.03 && video.readyState >= 2) finish();
            });
            await video.play();
            const stop = () => { if (video.currentTime >= end) { video.pause(); video.removeEventListener('timeupdate', stop); } };
            video.addEventListener('timeupdate', stop);
            document.querySelector('#preview').scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.setStatus('Previewing candidate from ' + this.time(start) + ' to ' + this.time(end) + '.', 'success');
          } catch (e) { this.setStatus(e.message || 'Could not preview this candidate.', 'error'); }
        };
        const use = document.createElement('button'); use.className = 'primary'; use.textContent = 'Use this moment';
        use.onclick = () => {
          $('startTime').value = item.start.toFixed(1);
          $('endTime').value = item.end.toFixed(1);
          $('clipTitle').value = ('Viral candidate ' + this.time(item.start)).slice(0,90);
          const editor = document.getElementById('startTime');
          editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          this.setStatus('Candidate copied into the editor. Preview it and adjust the boundaries before exporting.', 'success');
        };
        actions.append(preview, use); card.append(title, meta, excerpt, actions); list.append(card);
      });
    }
  };
  $('scanVideo').addEventListener('click', async () => {
    $('scanVideo').disabled = true;
    try {
      const items = await radar.scanFrames();
      const audioItems = await radar.scanAudioEnergy();
      const transcript = $('radarTranscript').value.trim();
      const transcriptItems = transcript ? radar.scoreText(transcript, document.querySelector('#preview video')?.duration || 600) : [];
      radar.candidates = radar.combineCandidates(items.concat(audioItems, transcriptItems));
      radar.render(radar.candidates.slice(0,8));
      const signalCount = [items.length ? 'visual' : '', audioItems.length ? 'audio' : '', transcriptItems.length ? 'transcript' : ''].filter(Boolean);
      radar.setStatus(radar.candidates.length ? 'Scan complete using ' + (signalCount.join(', ') || 'available') + ' clues. Combined scores are review priorities, not predictions of virality.' : 'No usable clues were found.', radar.candidates.length ? 'success' : 'error');
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