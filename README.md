# Folio 📖

Folio is a privacy-first desktop PDF reading companion built with Electron,
React, and TypeScript. It manages a personal library, remembers reading
progress, and explains highlighted passages using an on-device language model.

## Features

- Persistent local PDF library and per-book reading progress
- Custom book cover images
- Page navigation by keyboard, controls, or page number
- Zoom from 50% to 300%
- Context-aware explanations and conversational follow-up questions
- Two selectable local Qwen models with download and lifecycle management
- Dark desktop interface

## Tech stack

- Electron, React, TypeScript, and Vite
- react-pdf and PDF.js
- Tailwind CSS and shadcn/ui
- llama.cpp with Qwen GGUF models
- Local file storage through typed Electron IPC

## Installation

Download the latest build from the
[Releases](https://github.com/frayyan-rgb/Folio/releases) page.

On macOS, right-click the app and select **Open** if Gatekeeper shows an
unverified developer warning. If macOS reports that the app is damaged, remove
its quarantine attribute and try again:

```bash
xattr -d com.apple.quarantine /path/to/Folio.app
```

## Development

```bash
npm install
npm run start
```

## Building

```bash
npm run build
npm run make -- --arch arm64
```

The packaged macOS ARM64 build includes the native llama.cpp server. Model
weights are downloaded from the model selector when local AI is first enabled.
