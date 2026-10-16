(() => {
  const $ = id => document.getElementById(id);
  const selectedMoments = new Map();
  const loadedMomentKeys = new Set();
  let momentLoadIndex = 0;
  const momentKey = item => Number(item.start).toFixed(1)+'-'+Number(item.end).toFixed(1);
  const overlapRatio = (a,b) => {
    const overlap=Math.max(0,Math.min(Number(a.end),Number(b.end))-Math.max(Number(a.start),Number(b.start)));
    const shorter=Math.max(0.1,Math.min(Number(a.end)-Number(a.start),Number(b.end)-Number(b.start)));
    return overlap/shorter;
  };
  const classifyMoment = text => {
    const t=String(text||'');
    if(/\b(goal|penalty|red card|last minute|match point|overtime|knockout|save|tackle|free kick|offside|championship|derby|final whistle|counterattack|shot|scoreboard)\b/i.test(t)) return 'Sports drama';
    if(/\b(laugh|laughing|hilarious|funny|joke|comedy|prank|awkward|embarrass|reaction|roast|meme|fails?)\b/i.test(t)) return 'Funny reaction';
    if(/\b(shocking|surprise|unexpected|plot twist|suddenly|didn.t expect|unbelievable|wait for it|revealed|secret|turns out)\b/i.test(t)) return 'Surprising moment';
    if(/\b(how to|tutorial|tip|trick|learn|explains?|lesson|mistake|step by step|here.s why|because|solution|fix|important)\b/i.test(t)) return 'Useful information';
    if(/\b(wow|wait|what|why|how|watch this|look at|imagine|finally|actually|before|after|versus|vs\.?|best|worst|insane)\b/i.test(t)) return 'Strong hook';
    return 'Moment to review';
  };
  const updateMomentControls = () => {
    const load=$('loadNextMoment');
    if(load) load.textContent='Load next selected clip ('+selectedMoments.size+')';
    if(load) load.disabled=selectedMoments.size===0;
  };
  $('clearMomentSelection')?.addEventListener('click',()=>{
    selectedMoments.clear();loadedMomentKeys.clear();momentLoadIndex=0;
    updateMomentControls();
    const status=$('multiClipStatus');status.classList.add('hidden');
    radar.render(Array.isArray(radar.candidates)?radar.candidates.slice(0,8):[]);
  });
  $('loadNextMoment')?.addEventListener('click',()=>{
    const queue=[...selectedMoments.values()].sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));
    let next=queue.find(item=>!loadedMomentKeys.has(momentKey(item)));
    if(!next){
      loadedMomentKeys.clear();momentLoadIndex=0;
      next=queue[0];
    }
    if(!next){setMultiStatus('Select at least one candidate moment first.','error');return}
    const video=document.querySelector('#preview video');
    if(!video||!Number.isFinite(video.duration)||video.duration<=0){setMultiStatus('Upload the matching local video before loading selected moments.','error');return}
    const start=Math.max(0,Math.min(Number(next.start)||0,Math.max(0,video.duration-0.1)));
    const end=Math.min(video.duration,Math.max(start+0.5,Number(next.end)||start+0.5));
    if(end<=start){setMultiStatus('This selected moment has invalid boundaries. Re-run the scan.','error');return}
    $('startTime').value=start.toFixed(1);$('endTime').value=end.toFixed(1);
    makeAutoMetadata(next);
    loadedMomentKeys.add(momentKey(next));momentLoadIndex++;
    $('startTime').scrollIntoView({behavior:'smooth',block:'center'});
    setMultiStatus('Loaded selected clip '+momentLoadIndex+' of '+queue.length+' (score '+Math.round(Number(next.score)||0)+'/100). Export this clip separately, then load the next selected moment.','success');
  });
  function setMultiStatus(message,kind=''){const el=$('multiClipStatus');if(!el)return;el.textContent=message;el.className='notice'+(kind?' '+kind:'');el.classList.remove('hidden')}
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
      // Keep context before the event, but reserve most of the clip for the reaction/payoff.
      const preRoll = length * 0.30;
      let start = Math.max(0, Math.min(duration - length, center - preRoll));
      let end = Math.min(duration, start + length);
      start = Math.max(0, end - length);
      return { start, end };
    },
    scoreText(text, duration) {
      const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const hooks = /\b(wow|wait|what|why|how|secret|mistake|never|always|truth|best|worst|insane|unbelievable|finally|actually|because|shocking|incredible|tip|trick|fail|win|lost|found|reveals?|proof|learn|watch|look|imagine|important|problem|solution|versus|vs\.?|before|after|number one|top \d+)\b/i;
      // Accept MM:SS and HH:MM:SS timestamps, optionally in square brackets.
      const timestamp = /(?:\[)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\])?/
      const timed = [];
      for (const line of lines) {
        const match = line.match(timestamp);
        if (!match) continue;
        const seconds = match[3] !== undefined ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : Number(match[1]) * 60 + Number(match[2]);
        if (seconds >= duration || !Number.isFinite(seconds)) continue;
        const body = line.replace(timestamp, '').replace(/^[-:–—\s]+/, '').trim();
        const words = body.split(/\s+/).filter(Boolean).length;
        const momentType = classifyMoment(body);
        const score = 35 + (hooks.test(body) ? 24 : 0) + (momentType !== 'Moment to review' ? 8 : 0) + Math.min(20, words * 1.2) + (/[!?]{1,}/.test(body) ? 8 : 0);
        timed.push({ center: seconds, score: Math.min(95, score), momentType, reason: momentType + (hooks.test(body) ? ' · strong hook language' : ' · transcript cue'), excerpt: body || line });
      }
      if (!timed.length) {
        const chunks = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 18);
        chunks.forEach((body, i) => {
          const momentType = classifyMoment(body);
          const score = 30 + (hooks.test(body) ? 28 : 0) + (momentType !== 'Moment to review' ? 8 : 0) + Math.min(18, body.split(/\s+/).length) + (/[!?]/.test(body) ? 8 : 0);
          timed.push({ center: duration > 0 ? (i + 0.5) / chunks.length * duration : i * 10, score: Math.min(88, score), momentType, reason: momentType + (hooks.test(body) ? ' · hook words found' : ' · transcript passage'), excerpt: body });
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
      // Scale scan cost to the device: repeated seeks are expensive on low-memory phones.
      const memory = Number(navigator.deviceMemory) || 4;
      const mobile = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
      const sampleCap = memory <= 3 ? 28 : memory <= 4 || mobile ? 42 : 80;
      const sampleCount = Math.min(sampleCap, Math.max(10, Math.floor(duration / (memory <= 3 || mobile ? 4 : 2))));
      const canvas = document.createElement('canvas');
      const sampleWidth = memory <= 3 ? 32 : mobile || memory <= 4 ? 40 : 48;
      canvas.width = sampleWidth; canvas.height = Math.round(sampleWidth * 9 / 16);
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
          let diff = 0, brightness = 0, contrast = 0;
          for (let p = 0; p < pixels.length; p++) brightness += pixels[p];
          brightness /= Math.max(1, pixels.length);
          for (let p = 0; p < pixels.length; p++) contrast += Math.abs(pixels[p] - brightness);
          contrast /= Math.max(1, pixels.length);
          if (samples.length) {
            const prev = samples[samples.length - 1].pixels;
            for (let p = 0; p < pixels.length; p++) diff += Math.abs(pixels[p] - prev[p]);
            diff /= pixels.length;
          }
          // Keep a small visual fingerprint for local activity scoring; no frames are uploaded.
          samples.push({ t, diff, brightness, contrast, pixels });
          if (i % 8 === 0) this.setStatus('Scanning local video frames… ' + Math.round((i + 1) / sampleCount * 100) + '%');
        }
      } finally {
        try { await seekTo(originalTime); } catch (e) {}
      }
      const rankedRaw = samples.slice(1).map((s, i) => {
        const previous = samples[i] || s;
        const next = samples[i + 2] || s;
        const nextDiff = Math.abs(Number(next.brightness || 0) - Number(s.brightness || 0)) +
          Math.abs(Number(next.contrast || 0) - Number(s.contrast || 0)) * 0.35;
        const luminanceShift = Math.abs(Number(s.brightness || 0) - Number(previous.brightness || 0));
        // Combine motion/change with nearby visual context instead of letting one cut dominate.
        const activity = Number(s.diff || 0) * 0.62 + Number(previous.diff || 0) * 0.18 + nextDiff * 0.12 + luminanceShift * 0.08;
        return { ...s, activity };
      });
      const activityValues = rankedRaw.map(x => x.activity).sort((a,b) => a-b);
      const q25 = activityValues[Math.floor((activityValues.length - 1) * 0.25)] || 0;
      const q90 = activityValues[Math.floor((activityValues.length - 1) * 0.90)] || 1;
      const spread = Math.max(0.001, q90 - q25);
      const ranked = rankedRaw.map(x => ({ ...x, score: Math.max(25, Math.min(88, Math.round(32 + (x.activity - q25) / spread * 48))) }))
        .sort((a,b) => b.score-a.score);
      const chosen = [];
      const separation = Math.max(8, Math.min(18, this.clipLength() * 0.65));
      for (const s of ranked) {
        if (chosen.every(c => Math.abs(c.t - s.t) > separation)) chosen.push(s);
        if (chosen.length >= 6) break;
      }
      return chosen.map((s, i) => {
        const w = this.safeWindow(s.t, duration, this.clipLength());
        return { id: 'frame-' + i, ...w, center: s.t, score: s.score, reason: 'Visual activity / scene-change candidate', excerpt: 'Visual activity detected near ' + this.time(s.t), source: 'frames' };
      });
    },
    async scanAudioEnergy() {
      const video = document.querySelector('#preview video');
      if (!video || !video.currentSrc || !Number.isFinite(video.duration) || !video.videoWidth) return [];
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
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
        // Lower playback rate on phones to reduce decoding pressure during audio analysis.
        const memory = Number(navigator.deviceMemory) || 4;
        const mobile = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
        video.playbackRate = memory <= 3 || mobile ? 2 : 4;
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
          if (item.source === 'transcript' && item.momentType) target.momentType = item.momentType;
          // Merge the evidence, not the time ranges: candidate windows should still
          // respect the user's selected clip length instead of growing when clues overlap.
          if (Number(item.score) > Number(target.score)) target.center = item.center;
        }
      });
      const video = document.querySelector('#preview video');
      const duration = video && Number.isFinite(video.duration) && video.duration > 0
        ? video.duration : Math.max(1, ...merged.map(item => Number(item.end) || 0));
      return merged.map(item => {
        const window = this.safeWindow(Number(item.center) || 0, duration, this.clipLength());
        const signals = item.signals || [item.source];
        const values = item.signalScores || [Number(item.score) || 0];
        const average = values.reduce((sum,value)=>sum+value,0) / values.length;
        // Agreement between independent sources helps, but these are not virality probabilities.
        const bonus = signals.length > 1 ? 7 + (signals.length - 2) * 4 : 0;
        const score = Math.min(96, Math.round(average * 0.88 + bonus));
        const labels = { frames:'visual change', audio:'audio energy', transcript:'transcript cue' };
        const evidence = signals.map(s => labels[s] || s).join(' + ');
        return { ...item, ...window, score, reason: signals.length > 1 ? 'Combined evidence: ' + evidence : item.reason, excerpt: item.excerpt || 'Review the full context and sound.', source: signals.length > 1 ? 'combined' : item.source };
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
      const video = document.querySelector('#preview video');
      const duration = video && Number.isFinite(video.duration) && video.duration > 0
        ? video.duration : Math.max(1, ...items.map(item => item.end || 0));
      const timeline = document.createElement('div');
      timeline.className = 'radar-timeline';
      const timelineHead = document.createElement('div');
      timelineHead.className = 'radar-timeline-head';
      const timelineTitle = document.createElement('strong');
      timelineTitle.textContent = 'Signal timeline';
      const timelineDuration = document.createElement('span');
      timelineDuration.textContent = this.time(duration) + ' total';
      timelineHead.append(timelineTitle, timelineDuration);
      const ruler = document.createElement('div');
      ruler.className = 'radar-ruler';
      [0, .25, .5, .75, 1].forEach(fraction => {
        const tick = document.createElement('span');
        tick.style.left = (fraction * 100) + '%';
        tick.textContent = this.time(duration * fraction);
        ruler.append(tick);
      });
      timeline.append(timelineHead, ruler);
      items.forEach((item, index) => {
        const lane = document.createElement('div');
        lane.className = 'radar-lane';
        const laneLabel = document.createElement('span');
        laneLabel.className = 'radar-lane-label';
        laneLabel.textContent = (index + 1) + ' · ' + this.time(item.start);
        const track = document.createElement('div');
        track.className = 'radar-track';
        const startPct = Math.max(0, Math.min(100, item.start / duration * 100));
        const widthPct = Math.max(1, Math.min(100 - startPct, (item.end - item.start) / duration * 100));
        const segment = document.createElement('button');
        segment.type = 'button';
        segment.className = 'radar-segment ' + ((item.signals || [item.source]).length > 1 ? 'combined' : (item.signals || [item.source])[0]);
        segment.style.left = startPct + '%';
        segment.style.width = widthPct + '%';
        segment.title = 'Candidate ' + (index + 1) + ': ' + this.time(item.start) + '–' + this.time(item.end) + '. ' + item.reason;
        segment.setAttribute('aria-label', segment.title + '. Scroll to candidate details.');
        segment.onclick = () => {
          const target = list.querySelector('[data-candidate-index="' + index + '"]');
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        track.append(segment);
        lane.append(laneLabel, track);
        timeline.append(lane);
      });
      const legend = document.createElement('div');
      legend.className = 'radar-legend';
      [['visual','Visual change'],['audio','Audio energy'],['transcript','Transcript cue'],['combined','Signals overlap']].forEach(([kind,label]) => {
        const entry = document.createElement('span');
        entry.className = 'radar-legend-item';
        const swatch = document.createElement('i');
        swatch.className = 'radar-swatch ' + kind;
        const textNode = document.createElement('span');
        textNode.textContent = label;
        entry.append(swatch, textNode);
        legend.append(entry);
      });
      timeline.append(legend);
      list.append(timeline);
      items.forEach((item, index) => {
        const card = document.createElement('div'); card.className = 'clipitem';
        const key=momentKey(item);
        const selectRow=document.createElement('label');selectRow.className='radar-select-row';
        const select=document.createElement('input');select.type='checkbox';select.checked=selectedMoments.has(key);
        const selectText=document.createElement('span');selectText.textContent='Add to multi-clip queue';
        select.addEventListener('change',()=>{
          if(select.checked){
            const conflict=[...selectedMoments.values()].find(other=>momentKey(other)!==key&&overlapRatio(item,other)>=0.5);
            if(conflict){
              select.checked=false;
              setMultiStatus('Not added: this moment overlaps too much with another selected clip ('+this.time(conflict.start)+'–'+this.time(conflict.end)+'). Choose a different moment to avoid near-duplicate exports.','error');
              return;
            }
            selectedMoments.set(key,item);loadedMomentKeys.delete(key);
            setMultiStatus('Added '+this.time(item.start)+'–'+this.time(item.end)+'. Selected moments are exported one at a time so each can keep its own title and post metadata.','success');
          }else{
            selectedMoments.delete(key);loadedMomentKeys.delete(key);
            setMultiStatus('Removed '+this.time(item.start)+'–'+this.time(item.end)+' from the multi-clip queue.','success');
          }
          updateMomentControls();
        });
        selectRow.append(select,selectText);
        card.append(selectRow);
        card.dataset.candidateIndex = String(index);
        const title = document.createElement('h4'); title.textContent = (index + 1) + '. ' + this.time(item.start) + '–' + this.time(item.end) + ' · Review candidate';
        card.append(title);
        const meta = document.createElement('p'); meta.textContent = (item.momentType ? item.momentType + ' · ' : '') + item.reason + ' · heuristic score ' + Math.round(item.score) + '/100';
        const evidence = document.createElement('div'); evidence.className = 'radar-evidence';
        const labels = { frames:'Visual change', audio:'Audio energy', transcript:'Transcript cue' };
        (item.signals || [item.source]).forEach(signal => {
          const chip = document.createElement('span');
          chip.className = 'radar-chip ' + signal;
          chip.textContent = labels[signal] || signal;
          evidence.append(chip);
        });
        if (!item.signals || item.signals.length < 2) {
          const note = document.createElement('span');
          note.className = 'radar-single-source';
          note.textContent = 'Single signal — check the moment manually';
          evidence.append(note);
        } else {
          const note = document.createElement('span');
          note.className = 'radar-single-source';
          note.textContent = 'Multiple clues align near this moment';
          evidence.append(note);
        }
        const excerpt = document.createElement('p'); excerpt.textContent = item.excerpt || 'Review the full context and sound before using this moment.';
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
        actions.append(preview, use); card.append(meta, evidence, excerpt, actions); list.append(card);
      });
      updateMomentControls();
    }
  };
  radar.scanAndRender = async function() {
    const button = $('scanVideo');
    if (button.disabled) return false;
    button.disabled = true;
    try {
      const items = await radar.scanFrames();
      const audioItems = await radar.scanAudioEnergy();
      const transcript = $('radarTranscript').value.trim();
      const transcriptItems = transcript ? radar.scoreText(transcript, document.querySelector('#preview video')?.duration || 600) : [];
      radar.candidates = radar.combineCandidates(items.concat(audioItems, transcriptItems));
      radar.render(radar.candidates.slice(0,8));
      const signalCount = [items.length ? 'visual' : '', audioItems.length ? 'audio' : '', transcriptItems.length ? 'transcript' : ''].filter(Boolean);
      radar.setStatus(radar.candidates.length ? 'AutoClip found ' + radar.candidates.length + ' candidate moment(s). The highest-ranked moments are shown below; preview each one and review context before exporting.' : 'No usable clues were found. Try another local video or add timestamped notes.', radar.candidates.length ? 'success' : 'error');
      $('radarCandidates').scrollIntoView({behavior:'smooth',block:'start'});
      return radar.candidates.length > 0;
    } catch (err) {
      radar.setStatus(err.message || 'Frame scan failed. Try another local video.', 'error');
      return false;
    } finally { button.disabled = false; }
  };
  window.mavenRadar = radar;
  $('scanVideo').addEventListener('click', () => radar.scanAndRender());
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
  window.mavenRadar = radar;
})();