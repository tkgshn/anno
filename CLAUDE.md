# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

anno is a web annotation tool that integrates with Scrapbox, allowing users to mark and annotate web content. It's structured as a monorepo using npm workspaces with 5 packages:

- `packages/annopatch` - Core annotation patching functionality
- `packages/chrome-extension` - Main Chrome extension (v6.0.19, Manifest V3)
- `packages/safari-extension` - Safari extension (Web Extension format)
- `packages/react-safe-translation` - React translation utilities
- `packages/scrapbox-loader` - Scrapbox integration loader
- `packages/text-quote-injection` - Text quote handling functionality

## Key Commands

### Building
```bash
# Build chrome extension (requires .env file with EXTENSION_ID)
cd packages/chrome-extension && npm run build

# Build safari extension (requires .env file with EXTENSION_ID)
cd packages/safari-extension && npm run build

# Convert to Xcode project for Safari
cd packages/safari-extension && npm run convert

# Build annopatch
cd packages/annopatch && npm run build
```

### Testing
```bash
# Run TypeScript type checking across all workspaces
npm --workspaces test

# Test specific package
npm run test -w chrome-extension
```

### Development Setup
1. Copy `.env.sample` to `.env` in `packages/chrome-extension/`
2. Set `EXTENSION_ID` in the `.env` file
3. Install dependencies: `npm install` (from root)

## Architecture

### Chrome Extension Structure
- **Entry Points**: Multiple TypeScript files compiled by ESBuild
  - `src/annotation.ts` - Main annotation functionality
  - `src/background.ts` - Service worker
  - `src/content.ts`, `src/content-gyazo.ts`, `src/content-scrapbox.ts` - Content scripts
  - `src/options.ts` - Extension options page
  - `src/popup.ts` - Extension popup interface
- **Build System**: Custom `build.js` using ESBuild with ESM format output
- **Permissions**: contextMenus, storage, tabs, unlimitedStorage
- **Content Scripts**: Runs on all URLs with specific scripts for Gyazo and Scrapbox

### Key Technologies
- **TypeScript** (v5.1.6) with strict mode
- **React** (v18.2.0) for UI components
- **ESBuild** (v0.19.5) for fast bundling
- **Chrome Extension Manifest V3**
- **Scrapbox API Integration**

### Build Process
The Chrome extension build (`packages/chrome-extension/build.js`) handles:
- Multiple entry point compilation
- Environment variable injection (EXTENSION_ID)
- Asset copying (manifest.json, images, HTML files)
- Web accessible resources configuration

## CI/CD
- **Test Workflow** (`.github/workflows/test.yml`): Runs on every push, executes TypeScript type checking
- **Build Workflow** (`.github/workflows/build.yml`): Runs on main branch, builds Chrome extension and uploads artifacts