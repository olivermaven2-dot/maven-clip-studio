import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js';
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';

const $ = id => document.getElementById(id);
const button = $('transcribeSpeech');
const status = $('transcriptionStatus');
let ffmpeg = null;
let transcriber = null;
let busy = false;

function showStatus(message, kind = '') {
  status.textContent = message;
  status.className = 'notice' + (kind ? ' ' + kind : '');
  status.classList.remove('hidden');
}
function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0')
    : String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}
function safeName(name) {
  const ext = String(name || '').match(/\.[a-z0-9]{1,8}$/i);
  return 'maven-input' + (ext ? ext[0].toLowerCase() : '.mp4');
}
async function ensureFFmpeg() {
  if (ffmpeg) return ffmpeg;
  showStatus('Preparing the free audio converter. This is a large first-time download…');
  ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    if (/error|invalid data|no audio/i.test(message)) console.warn('[Maven transcription]', message);
  });
  ffmpeg.on('progress', ({ progress }) => {
    if (busy && Number.isFinite(progress)) {
      const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
      showStatus('Extracting audio locally: ' + percent + '%. Keep Maven open while this device processes the video…');
    }
  });
  const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(base + '/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL(base + '/ffmpeg-core.wasm', 'application/wasm')
  });
  return ffmpeg;
}
async function ensureTranscriber() {
  if (transcriber) return transcriber;
  showStatus('Loading the free multilingual Whisper speech model. The first download is large; keep this page open…');
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  transcriber = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
    dtype: 'q8',
    device: 'wasm'
  });
  return transcriber;
}
async function audioToFloat32(wavBytes) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('This browser does not support audio decoding.');
  const context = new AudioCtx({ sampleRate: 16000 });
  try {
    const exactBuffer = wavBytes.buffer.slice(wavBytes.byteOffset, wavBytes.byteOffset + wavBytes.byteLength);
    const decoded = await context.decodeAudioData(exactBuffer);
    const channel = decoded.getChannelData(0);
    if (decoded.sampleRate === 16000) return channel.slice();
    const outputLength = Math.max(1, Math.round(channel.length * 16000 / decoded.sampleRate));
    const output = new Float32Array(outputLength);
    const ratio = decoded.sampleRate / 16000;
    for (let i = 0; i < outputLength; i++) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(channel.length - 1, left + 1);
      const mix = position - left;
      output[i] = (channel[left] || 0) * (1 - mix) + (channel[right] || 0) * mix;
    }
    return output;
  } finally {
    await context.close().catch(() => {});
  }
}
function transcriptLines(result, offsetSeconds) {
  if (Array.isArray(result.chunks) && result.chunks.length) {
    return result.chunks.map(chunk => {
      const stamp = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : 0;
      const text = String(chunk.text || '').replace(/\s+/g, ' ').trim();
      return text ? '[' + formatTime(offsetSeconds + (Number(stamp) || 0)) + '] ' + text : '';
    }).filter(Boolean);
  }
  const text = String(result.text || '').replace(/\s+/g, ' ').trim();
  return text ? '[' + formatTime(offsetSeconds) + '] ' + text : [];
}
button?.addEventListener('click', async () => {
  if (busy) return;
  const file = typeof window.getMavenCurrentFile === 'function' ? window.getMavenCurrentFile() : null;
  if (!file) {
    showStatus('Load a local video first. For a YouTube video, play it in Maven and use Record preview video; then transcribe that recording.', 'error');
    return;
  }
  if (!/^video\//i.test(file.type) && !/\.(mp4|webm|mov|m4v|mkv|avi|mpeg|mpg)$/i.test(file.name || '')) {
    showStatus('The current source does not look like a supported video file.', 'error');
    return;
  }
  busy = true;
  button.disabled = true;
  const oldLabel = button.textContent;
  button.textContent = 'Transcribing…';
  try {
    const converter = await ensureFFmpeg();
    showStatus('Preparing the video audio locally. The speech model loads after audio extraction to reduce peak memory use…');
    const inputName = safeName(file.name);
    const segmentPrefix = 'maven-audio-';
    const previous = await converter.listDir('/');
    for (const entry of previous) {
      if (/^maven-audio-\\d+\\.wav$/.test(entry.name)) await converter.deleteFile(entry.name).catch(() => {});
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await converter.writeFile(inputName, bytes);
    await converter.exec(['-i', inputName, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'segment', '-segment_time', '30', '-segment_format', 'wav', '-reset_timestamps', '1', segmentPrefix + '%03d.wav']);
    await converter.deleteFile(inputName).catch(() => {});
    const entries = await converter.listDir('/');
    const segments = entries.map(x => x.name).filter(name => /^maven-audio-\d+\.wav$/.test(name)).sort();
    if (!segments.length) throw new Error('No audio track was found. Check that the video contains audible speech.');
    const model = await ensureTranscriber();
    const allLines = [];
    let offset = 0;
    for (let i = 0; i < segments.length; i++) {
      showStatus('Transcribing audio segment ' + (i + 1) + ' of ' + segments.length + '. Keep this page open; processing runs on this device…');
      const wav = await converter.readFile(segments[i]);
      const samples = await audioToFloat32(wav);
      if (samples.length) {
        const result = await model(samples, {
          sampling_rate: 16000,
          return_timestamps: true
        });
        allLines.push(...transcriptLines(result, offset));
        offset += samples.length / 16000;
      }
      await converter.deleteFile(segments[i]).catch(() => {});
    }
    for (const name of segments) await converter.deleteFile(name).catch(() => {});
    const textarea = $('radarTranscript');
    const unique = [...new Set(allLines)];
    if (!unique.length) throw new Error('The audio was processed, but no clear speech was recognized.');
    const existing = textarea.value.trim();
    textarea.value = existing ? existing + '\n' + unique.join('\n') : unique.join('\n');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    showStatus('Transcription complete: added ' + unique.length + ' timestamped text segment(s). Review the transcript, then run AutoClip scan.', 'success');
  } catch (error) {
    if (ffmpeg) {
      const leftovers = await ffmpeg.listDir('/').catch(() => []);
      for (const entry of leftovers) {
        if (/^maven-audio-\\d+\\.wav$/.test(entry.name) || /^maven-input\\./.test(entry.name)) {
          await ffmpeg.deleteFile(entry.name).catch(() => {});
        }
      }
    }
    console.error('[Maven transcription]', error);
    showStatus((error && error.message ? error.message : 'Transcription failed.') + ' If this is a phone, try a shorter video and keep enough free storage and memory available.', 'error');
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = oldLabel;
  }
});
