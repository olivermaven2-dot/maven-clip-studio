# Maven Clip Studio

A mobile-friendly, GitHub Pages-first prototype for preparing short-form video clips.

## Current features
- Upload and preview local video files.
- Enter a YouTube URL to embed a YouTube preview.
- Set clip start/end timestamps and preview the selected segment.
- Choose target clip lengths of 8, 15, 20, 30, 45, 60, or 90 seconds, or enter a custom length (1–600 seconds); apply the target from the chosen start time and adjust boundaries manually.
- Export supported browser-recorded clips as WebM, with vertical 9:16 or original framing.
- Choose **Auto (mobile-friendly)**, Compact (480p/24 fps), Standard (720p/24 fps), or High (1080p/30 fps) export quality. Auto chooses a lighter 480p export on narrow-screen or low-memory devices and 720p on larger devices.
- Canvas drawing is throttled to the selected recording frame rate instead of repainting at the display's full refresh rate; export errors stop the drawing loop and recorder to reduce lingering CPU use.
- Show live export progress, check MediaRecorder/codec and canvas-capture support before starting, verify the canvas video track exists, report clearer recording/seek/timeout/empty-file errors, and open the exported WebM in a separate tab for review before posting. On narrow or low-memory devices, warn when a long or High-quality export may be demanding; older canvas implementations also get a simple caption-background fallback.
- Prepare post title, description, hashtags, and category.
- Keep a local review queue and copy post text.
- **Viral Radar:** rank candidates by combining sampled visual scene changes, audio-energy peaks, and optional pasted transcript / timestamped-note hooks. Candidates supported by more than one signal receive a modest agreement bonus.
- Viral Radar adapts frame-sampling density and thumbnail resolution to estimated device memory and screen size; audio scanning uses a lower playback rate on phones to reduce decoding pressure. This trades some fine-grained coverage for a lighter scan on low-memory devices.
- View a candidate timeline with clip windows, signal-source labels, and visual cues showing where candidates sit in the video; open a candidate from its timeline lane.
- See per-candidate evidence chips explaining whether a ranking uses visual changes, audio energy, transcript cues, or multiple aligned signals.
- Send a candidate moment's suggested start/end times into the existing editor for manual preview and adjustment.
- Choose a suggested clip duration (8, 15, 20, or 30 seconds) and preview each candidate in the loaded local video before sending it to the editor.
- Select several candidate moments into a multi-clip queue; strongly overlapping selections are rejected to reduce duplicate exports. Load each selected moment into the editor in score order, with its own suggested title, description, and hashtags, then export each clip separately.

## Important limitations
- A YouTube link is a preview source, not a downloadable source. The app cannot extract video from the embedded YouTube player. To edit and export, upload a video you own or are licensed/authorized to use.
- Export uses browser MediaRecorder and canvas capture; browser codec support varies. Exported clips are WebM in this prototype.
- YouTube publishing is intentionally not connected yet. Direct publishing requires a Google Cloud project, YouTube Data API v3, OAuth authorization, and a secure backend. Never put OAuth client secrets or refresh tokens in GitHub Pages client code.
- Post drafts and review status persist in local browser storage across reloads on the same browser/device; they are not synced across devices. Viral Radar candidates remain local to the current tab. Exported video files are not stored inside the draft.
- Viral Radar combines simple visual-change, decoded audio-energy, and transcript-cue heuristics. Scores are relative review priorities, not predicted virality, engagement, or a percentage chance of success. Audio decoding depends on browser support and the local video format; if it fails, visual and transcript clues can still be used.
- YouTube URLs remain embed previews. Viral Radar does not extract or download YouTube video/audio; use pasted timestamped transcript or notes for text-based discovery.
- This tool does not determine copyright permission or guarantee monetization eligibility. Review YouTube policies before publishing.

## Deploy on GitHub Pages
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set the source to **GitHub Actions**.
3. The workflow at `.github/workflows/pages.yml` deploys the root folder on pushes to `main`.
4. After the workflow succeeds, open:
   https://olivermaven2-dot.github.io/maven-clip-studio/

No build step is required.


## New creator helpers
- **Auto-pick clip + metadata** selects the highest-ranked existing Viral Radar candidate for a local uploaded video and fills clip boundaries, title, description, and category-based hashtags using transparent browser-side rules. It does not use an AI service; review and edit every suggestion.
- **YouTube Viral Video Finder** searches public video metadata with the YouTube Data API v3. It ranks recent results by approximate views per hour and displays view counts, upload age, channel, and a link to the video. This is a rough discovery signal, not a guarantee of virality.
- The finder requires a Google Cloud project with YouTube Data API v3 enabled and an API key. Restrict the key to the YouTube Data API and the intended website HTTP referrers. The key is held only in the current page memory and is not saved by the app; because this is a static GitHub Pages app, a browser key is still visible to the browser user and should be restricted.
- The finder does not download YouTube videos. Only use source files you own or are authorized to edit. Publishing still requires a properly configured secure OAuth/backend integration.


### Optional burned-in captions

The clip editor supports an optional single caption overlay that is burned into every exported frame. Edit the caption text, choose small/medium/large sizing and top/middle/bottom placement, and preview the overlay on the local video before exporting. Leave the field blank for an uncaptioned export. This is a static caption for the whole selected segment, not automatically transcribed or time-synced subtitles. Captions are rendered locally into the WebM export; no caption text or video is uploaded by this feature.


### Original Story Builder

- The **Original Story Builder** connects to the current Viral Radar candidate list and helps structure a commentary-led Short/Reel with a hook, factual context, the creator's own analysis, a viewer takeaway, and a closing line.
- It asks the creator to supply the actual event description, original interpretation, and takeaway instead of fabricating detailed facts or generating a generic reaction from a clip alone. Drafts are assembled locally in the browser; no AI service or external API is used.
- A checklist prompts review of context, meaningful original contribution, footage permission/licensing, and audio rights. The checklist is a reminder, not legal advice or a guarantee of YouTube/Facebook monetization eligibility.
- Viral Radar transcript cues now remain a heuristic. Visual changes and audio-energy peaks can flag places to inspect, but they cannot reliably identify a funny expression, sports outcome, or useful lesson without context. Review the full source and confirm the moment yourself.

### Platform-specific Viral Hashtag Studio

- Generate separate hashtag suggestions for YouTube Shorts and Facebook Reels from a specific clip topic, names / niche keywords, content category, and optional Viral Radar moment type.
- YouTube and Facebook outputs use different platform tags and a focused selection of topic/category/moment tags. The YouTube set can be copied into the existing post draft; both sets have individual copy buttons.
- This is a local, rule-based helper, not a live trend feed or a promise of virality. It does not inspect the full video or measure hashtag performance. Keep only tags that accurately describe the clip and verify names and spelling before posting.
