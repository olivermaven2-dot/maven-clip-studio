# Maven Clip Studio

A mobile-friendly, GitHub Pages-first prototype for preparing short-form video clips.

## Current features
- Upload and preview local video files.
- Enter a YouTube URL to embed a YouTube preview.
- Set clip start/end timestamps and preview the selected segment.
- Export supported browser-recorded clips as WebM, with vertical 9:16 or original framing.
- Prepare post title, description, hashtags, and category.
- Keep a local review queue and copy post text.

## Important limitations
- A YouTube link is not a downloadable source. Browser security and YouTube terms mean the app cannot extract video from the embedded player. For editing, upload a video you own or are licensed/authorized to use.
- Export uses browser MediaRecorder and canvas capture; browser codec support varies. Exported clips are WebM in this prototype.
- YouTube publishing is intentionally not connected yet. Direct publishing requires a Google Cloud project, YouTube Data API v3, OAuth authorization, and a secure backend. Never put OAuth client secrets or refresh tokens in GitHub Pages client code.
- The review queue and post drafts are local to the current browser and are not synced across devices.
- This tool does not determine copyright permission or guarantee monetization eligibility. Review YouTube policies before publishing.

## Deploy on GitHub Pages
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**, then save.
4. Wait for the Pages build. The app should be available at:
   https://olivermaven2-dot.github.io/maven-clip-studio/

No build step is required.
