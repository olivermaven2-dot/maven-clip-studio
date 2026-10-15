# Maven Clip Studio

A mobile-friendly, GitHub Pages-first prototype for preparing short-form video clips.

## Current features
- Upload and preview local video files.
- Enter a YouTube URL to embed a YouTube preview.
- Set clip start/end timestamps and preview the selected segment.
- Export supported browser-recorded clips as WebM, with vertical 9:16 or original framing.
- Prepare post title, description, hashtags, and category.
- Keep a local review queue and copy post text.
- **Viral Radar:** scan sampled frames from a loaded local video for visual-change candidates, or analyze a pasted transcript / timestamped notes for possible hooks.
- Send a candidate moment's suggested start/end times into the existing editor for manual preview and adjustment.

## Important limitations
- A YouTube link is a preview source, not a downloadable source. The app cannot extract video from the embedded YouTube player. To edit and export, upload a video you own or are licensed/authorized to use.
- Export uses browser MediaRecorder and canvas capture; browser codec support varies. Exported clips are WebM in this prototype.
- YouTube publishing is intentionally not connected yet. Direct publishing requires a Google Cloud project, YouTube Data API v3, OAuth authorization, and a secure backend. Never put OAuth client secrets or refresh tokens in GitHub Pages client code.
- The review queue, post drafts, and Viral Radar candidates are local to the current browser tab and are not synced across devices.
- Viral Radar uses simple visual-change and text-cue heuristics. Scores are relative review priorities, not predicted virality, engagement, or a percentage chance of success. Frame scanning requires a browser-supported local video preview.
- YouTube URLs remain embed previews. Viral Radar does not extract or download YouTube video/audio; use pasted timestamped transcript or notes for text-based discovery.
- This tool does not determine copyright permission or guarantee monetization eligibility. Review YouTube policies before publishing.

## Deploy on GitHub Pages
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set the source to **GitHub Actions**.
3. The workflow at `.github/workflows/pages.yml` deploys the root folder on pushes to `main`.
4. After the workflow succeeds, open:
   https://olivermaven2-dot.github.io/maven-clip-studio/

No build step is required.
