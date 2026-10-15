# Maven Clip Studio

A mobile-friendly, GitHub Pages-first prototype for preparing short-form video clips.

## Current features
- Upload and preview local video files.
- Enter a YouTube URL to embed a YouTube preview.
- Set clip start/end timestamps and preview the selected segment.
- Export supported browser-recorded clips as WebM, with vertical 9:16 or original framing.
- Show live export progress, report clearer recording/seek/timeout/empty-file errors, and open the exported WebM in a separate tab for review before posting.
- Prepare post title, description, hashtags, and category.
- Keep a local review queue and copy post text.
- **Viral Radar:** rank candidates by combining sampled visual scene changes, audio-energy peaks, and optional pasted transcript / timestamped-note hooks. Candidates supported by more than one signal receive a modest agreement bonus.
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
