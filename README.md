# Folio

Folio is a private desktop companion for reading PDFs. It keeps your library,
reading progress, highlights, and AI explanations on your device.

## What it does

- Import and organize PDFs in a local library
- Add custom cover images to books
- Resume reading from the last page you viewed
- Navigate pages with controls, a page-number input, or the arrow keys
- Zoom from 50% to 300%
- Highlight text and save explanations alongside the passage
- Ask follow-up questions about a selected passage
- Run explanations locally with a downloadable language model
- Manage model downloads and loading from a dedicated Settings panel

## Privacy

Folio stores your PDFs, cover images, reading progress, annotations, and model
files in Electron's local application-data directory. Explanations are handled
by a local `llama.cpp` server running on `127.0.0.1`; the reader does not send
your passages to an external AI service.

On macOS, the data is normally stored under
`~/Library/Application Support/Folio`. Books, last-read pages, highlights,
explanations, downloaded models, and the selected model remain available after
you close and reopen the app. A model must be loaded again after each launch.

The first time you enable local AI, Folio downloads your selected model. The
available models are:

| Model           | Download size | Best for                          |
| --------------- | ------------: | --------------------------------- |
| Gemma 4 E4B QAT |        4.2 GB | Higher-quality explanations       |
| Gemma 4 E2B     |        2.8 GB | Lower memory use and faster setup |

## Tech stack

- Electron, React, TypeScript, and Vite
- PDF.js through `react-pdf`
- Tailwind CSS and shadcn/ui
- `llama.cpp` with local Gemma GGUF models
- Typed Electron IPC for local storage and model management

## Install

Download a release from the
[Folio releases page](https://github.com/frayyan-rgb/Folio/releases).

### Opening Folio on macOS

Folio is an independent app and is not Apple-notarized, so macOS may show a
security warning the first time you open it. This is a one-time step:

1. Move `Folio.app` to your **Applications** folder and try to open it.
2. When macOS says it cannot verify the developer, choose **Done**.
3. Open **System Settings** → **Privacy & Security**.
4. Scroll down and click **Open Anyway** next to the Folio message.
5. Click **Open** in the confirmation dialog.

After that, Folio opens normally. You can also Control-click `Folio.app` in
Finder, choose **Open**, then confirm **Open** as an alternative.

If macOS instead says the app is damaged, remove its quarantine attribute in
Terminal and then open it again:

```bash
xattr -dr com.apple.quarantine /Applications/Folio.app
```

## Develop

Requirements:

- Node.js 20–24 and npm (Node 24 LTS is recommended)
- macOS on Apple silicon to use the bundled local-AI runtime

```bash
git clone https://github.com/frayyan-rgb/Folio.git
cd Folio
npm install
npm run start
```

`npm run start` starts Vite, waits for the development server, and then opens
the Electron app. Use `npm run dev` when you only need the browser-based UI.

Useful commands:

```bash
npm run build    # Type-check and create the production web bundle
npm test         # Run the automated behavior tests
npm run lint     # Check Folio source for lint errors
npm run package  # Build and package the Electron application locally
npm run make -- --arch arm64  # Build a macOS Apple-silicon DMG and ZIP
```

The packaged macOS ARM64 build includes the native `llama.cpp` server. Model
weights are downloaded only when the user loads a model from Settings.
Forge writes distributable files under `out/make/`.

## Project structure

```text
src/                    React renderer
  components/           Library, reader, highlights, and explanation UI
  lib/                  Reusable book, reader, and explanation logic
electron/               Testable filesystem persistence helpers
tests/                  Automated storage and UI-logic tests
scripts/start.cjs       Coordinated Vite and Electron development startup
main.cjs                Electron main process, IPC, and local AI
preload.js              Safe renderer-to-main IPC bridge
resources/llama/        Bundled local llama.cpp server
assets/                 Application and installer icons
forge.config.cjs        Electron Forge packaging configuration
```

For a walkthrough of the application architecture, data flow, IPC API, and
local-AI lifecycle, see [the technical documentation](docs/ARCHITECTURE.md).

## Current limitations

- The bundled local-AI runtime is currently provided for macOS ARM64.
- Current local builds use an ad-hoc signature rather than an Apple Developer
  ID and are not notarized, so macOS may require the manual opening step above.
- Model downloads are large and require an internet connection the first time.
