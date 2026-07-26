# Folio architecture

This document explains how Folio is organized and how its main features work.

## Overview

Folio is an Electron application with a React user interface. The renderer
displays the library and PDF reader; Electron's main process handles local
files, persistent data, model downloads, and the local AI server.

```text
React renderer
    │
    │ typed calls on window.electron
    ▼
preload.js (context bridge)
    │
    │ Electron IPC
    ▼
main.cjs
    ├── local application data: books, images, progress, annotations, models
    └── llama.cpp server: local explanations and follow-up answers
```

The renderer has no direct Node.js or filesystem access. `preload.js` exposes
only the specific IPC methods used by the interface, while `main.cjs` performs
the underlying work.

## Entry points

| File                | Responsibility                                                                   |
| ------------------- | -------------------------------------------------------------------------------- |
| `src/main.tsx`      | Mounts the React application.                                                    |
| `src/App.tsx`       | Switches between the library and PDF-reader views; configures the PDF.js worker. |
| `main.cjs`          | Creates Electron windows and registers every IPC handler.                        |
| `preload.js`        | Exposes the safe `window.electron` API to the renderer.                          |
| `src/electron.d.ts` | TypeScript definitions for the preload API and annotations.                      |

## User interface

### Library

`src/components/HomeScreen.tsx` is the landing screen. It:

- Lists locally stored PDF books and their optional cover images.
- Imports a selected PDF, then asks the main process to save it.
- Opens a book by reading it through IPC and recreating it as a browser `File`.
- Deletes books and their cover images.
- Displays local-AI model state and lets the user download, load, unload, or
  delete a model.

### PDF reader

`src/components/ReaderView.tsx` renders a single PDF page with `react-pdf`.
It restores the saved page for a book on open and saves the current page after
navigation. It also extracts the current page's text, which the annotation
system uses to construct explanation context.

### Highlights and explanations

`src/components/SaveHighlighted.tsx` watches for selections in the PDF text
layer. A selection is stored as offsets into the PDF.js text spans rather than
as screen coordinates. That lets Folio find the range again after reopening a
page and redraw it with the browser Custom Highlight API.

The component sends the selected text to `ExplainButton.tsx`, which:

1. Lets the reader choose a selection-only or surrounding-context explanation.
2. Calls the local explanation endpoint through IPC.
3. Saves the explanation and text-range anchor as an annotation.
4. Supports a short follow-up conversation about the passage.

## Persistence

All persistent data is stored under Electron's `app.getPath("userData")`
directory. Folio creates these paths as needed:

| Path                      | Contents                                                                 |
| ------------------------- | ------------------------------------------------------------------------ |
| `books/`                  | Imported PDF files.                                                      |
| `images/`                 | Cover images, keyed by book filename.                                    |
| `progress.json`           | Last viewed page per book filename.                                      |
| `annotations/<book>.json` | Saved highlights and explanations for a book.                            |
| `models/`                 | Downloaded GGUF model files.                                             |
| `local-ai-settings.json`  | Selected model ID.                                                       |

Deleting a book also deletes its annotation file. The current implementation
does not remove its saved progress or cover image automatically.

## IPC API

The complete renderer API is defined in `preload.js` and typed in
`src/electron.d.ts`.

| Area         | Renderer calls                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Books        | `saveBook`, `getBooks`, `readBook`, `deleteBook`                                                                        |
| Progress     | `savePage`, `getPage`                                                                                                   |
| Covers       | `saveImage`, `getImage`, `deleteImage`                                                                                  |
| Annotations  | `saveAnnotation`, `getAnnotations`, `deleteAnnotation`                                                                  |
| Explanations | `explainText`, `askFollowUp`                                                                                            |
| Local AI     | `getLocalAIStatus`, `getLocalAIModels`, `setSelectedLocalAIModel`, `loadLocalAI`, `unloadLocalAI`, `deleteLocalAIModel` |

## Local AI lifecycle

The local-model configuration lives near the top of `main.cjs`. Each model
declares its GGUF filename, download URL, display name, and size.

When a reader loads a model, Folio:

1. Downloads the GGUF file to `models/` if it is missing, while reporting
   progress to the renderer.
2. Starts the bundled `llama-server` executable on `127.0.0.1:8080`.
3. Waits for the server's `/v1/models` endpoint to respond.
4. Sends explanation and follow-up requests to its
   `/v1/chat/completions` endpoint.
5. Stops the server when the model is unloaded or the app quits.

Only one model can be loaded at a time. The AI server is intentionally bound
to the local loopback address, so it is not exposed to the local network.

## Build and packaging

Vite builds the React renderer into `dist/`. Electron Forge packages the
application and includes `resources/llama` as an extra runtime resource. The
included native server is currently laid out for macOS Apple silicon.

```bash
npm run build
npm run start
npm run make -- --arch arm64
```
