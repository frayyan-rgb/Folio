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

## Privacy

Folio stores your PDFs, cover images, reading progress, annotations, and model
files in Electron's local application-data directory. Explanations are handled
by a local `llama.cpp` server running on `127.0.0.1`; the reader does not send
your passages to an external AI service.

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

On macOS, right-click the app and choose **Open** if Gatekeeper reports that
the developer cannot be verified. If macOS says the app is damaged, remove its
quarantine attribute and open it again:

```bash
xattr -d com.apple.quarantine /path/to/Folio.app
```

## Develop

Requirements:

- Node.js and npm
- macOS on Apple silicon to use the bundled local-AI runtime

```bash
cd my-app
npm install
npm run start
```

Useful commands:

```bash
npm run build    # Type-check and create the production web bundle
npm run package  # Package the Electron application
npm run make -- --arch arm64  # Create a macOS Apple-silicon distributable
```

The packaged macOS ARM64 build includes the native `llama.cpp` server. Model
weights are downloaded only when the user loads a model from the library.

## Project structure

```text
src/                    React renderer
  components/           Library, reader, highlights, and explanation UI
main.cjs                Electron main process, IPC, persistence, and local AI
preload.js              Safe renderer-to-main IPC bridge
resources/llama/        Bundled local llama.cpp server
forge.config.cjs        Electron Forge packaging configuration
```

For a walkthrough of the application architecture, data flow, IPC API, and
local-AI lifecycle, see [the technical documentation](docs/ARCHITECTURE.md).

## Current limitations

- The bundled local-AI runtime is currently provided for macOS ARM64.
