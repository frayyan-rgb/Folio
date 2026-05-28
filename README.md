# Folio 📖

An AI-powered desktop PDF reading companion. Build a personal library, track your reading progress, and highlight any term to get an instant context-aware explanation.

## The Problem
Most AI explanation tools don't work on PDFs. Existing tools like Explain AI break on PDFs, and Web Highlights is too slow and bloated. Folio solves this with a clean, fast, PDF-first experience.

## Features
- 📚 Personal PDF library with persistent local storage
- 🔖 Saves reading progress per book
- ✨ Highlight any term → instant AI explanation in context
- 🖼️ Custom book cover images
- ⌨️ Arrow key page navigation
- 🔍 Zoom in/out
- 🌙 Dark mode

## Tech Stack
- React + TypeScript + Vite
- Electron
- react-pdf + PDF.js
- TailwindCSS + shadcn/ui
- OpenRouter API
- Node.js local file storage
- Electron IPC

## Installation
Download the latest release from the [Releases](https://github.com/frayyan-rgb/Folio/releases) page.

> On Mac, right-click the app and select Open if you see an unverified developer warning.
> If you see "app is damaged" on Mac:
1. Open Terminal
2. Run: xattr -d com.apple.quarantine /path/to/Folio.app (replace with file path)
3. Try opening again

## Development
```bash
npm install
npm run dev        # start Vite
npm run electron   # start Electron (in a second terminal)
```

## Building
```bash
npm run build
npm run make -- --arch arm64
```

## Environment Variables
Create a `.env` file in the root:
VITE_OPENROUTER_API_KEY=your_key_here


Get a free API key at [openrouter.ai](https://openrouter.ai/keys)

## Roadmap
- [ ] Windows support
- [ ] Intel Mac support
- [ ] Built-in API key settings screen
- [ ] Chat with book ("what was chapter 3 about?")
- [ ] Quiz mode — test yourself on what you read
- [ ] Search across your library
- [ ] Annotations and highlights saving
- [ ] Auto-update support

## Contributing
Pull requests welcome. Open an issue first to discuss what you'd like to change.

## License
MIT
