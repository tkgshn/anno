# Safari Extension Development Guide

This guide explains how to successfully develop and deploy the anno Safari extension.

## Key Differences from Chrome Extension

### 1. Browser API Compatibility
Safari uses native `browser` API instead of `chrome` API. The extension includes a custom polyfill (`browser-polyfill.ts`) that:
- Uses Safari's native `browser` API when available
- Provides compatibility layer for Chrome-specific features
- Handles Safari-specific limitations

### 2. Manifest.json Paths
**Critical**: Safari requires different path handling than Chrome:
- ❌ Chrome: `"background": { "service_worker": "dist/background.js" }`
- ✅ Safari: `"background": { "service_worker": "background.js" }`

All script paths in manifest.json must be relative to the Resources directory, NOT include "dist/".

### 3. Content Security Policy (CSP)
Safari has stricter CSP requirements:
- No inline JavaScript in HTML files
- All scripts must be in external files with proper `type="module"` declarations
- Example fix in `options.html`:
  ```html
  <!-- Bad -->
  <script>
    document.addEventListener('DOMContentLoaded', ...);
  </script>
  
  <!-- Good -->
  <script type="module" src="options.js"></script>
  ```

### 4. Tab and Window Management
Safari's tab API has some differences:
- Use `browser.tabs.create()` instead of `chrome.tabs.create()`
- Window focus requires `browser.windows.update()`
- Tab queries work differently for pattern matching

## Development Workflow

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.sample .env
# Edit .env and set EXTENSION_ID
```

### 2. Build Process
```bash
# Build the extension
npm run build

# Convert to Xcode project (first time only)
npm run convert

# For subsequent builds, use the build script
./buildSafari.sh
```

### 3. Xcode Development
1. Open `anno/anno.xcodeproj` in Xcode
2. Select your development team in Signing & Capabilities
3. Build and run (⌘R)
4. Enable the extension in Safari Preferences > Extensions

### 4. Directory Structure
```
packages/safari-extension/
├── src/                    # Source TypeScript files
├── dist/                   # Built JavaScript files
├── anno/                   # Xcode project
│   └── Shared (Extension)/
│       └── Resources/      # Safari extension resources
├── manifest.json          # Extension manifest
└── build.ts              # Build script
```

### 5. Resource Copying
The build process must copy files to the correct Safari structure:
```bash
# Resources must be in "Shared (Extension)/Resources/"
mkdir -p "anno/Shared (Extension)/Resources"
cp -r dist/* "anno/Shared (Extension)/Resources/"
```

## Common Issues and Solutions

### Issue 1: "Extension resources not found"
**Cause**: Incorrect paths in manifest.json
**Solution**: Remove "dist/" prefix from all paths

### Issue 2: CSP Errors
**Cause**: Inline scripts in HTML files
**Solution**: Move all JavaScript to external files

### Issue 3: API not available
**Cause**: Using Chrome-specific APIs
**Solution**: Use the browser polyfill or Safari equivalents

### Issue 4: Background script not loading
**Cause**: Service worker registration issues
**Solution**: Ensure `persistent: false` in manifest.json

## Testing

### Console Debugging
1. Enable Developer menu in Safari
2. Develop > Web Extension Background Content > anno
3. Check console for logs with prefixes:
   - `[background]` - Background script logs
   - `[content]` - Content script logs
   - `[options]` - Options page logs

### Key Functionality Tests
1. **Icon Click**: Should mark selected text and open Scrapbox
2. **Settings Page**: Should save project name (fixed to "tkgshn-private")
3. **Content Script**: Should inject on all pages
4. **Tab Management**: Should reuse existing Scrapbox tabs

## Fixed Project Configuration

The Safari extension is configured with a fixed Scrapbox project:
- Project Name: `tkgshn-private`
- This is hardcoded in `background.ts` as `FIXED_PROJECT_NAME`

## Message Types

The extension uses typed messages for communication:
- `MARK_SELECTION`: Trigger text marking
- `OPEN_TAB`: Open Scrapbox with clipped content
- `PAGE_LOADED`: Notify when page loads
- `URL_CHANGED`: Handle URL changes

## Build Optimization

The build script (`build.ts`):
1. Cleans the dist directory
2. Copies static assets
3. Bundles TypeScript with ESBuild
4. Skips polyfill bundling (uses native Safari API)
5. Generates source maps for debugging

## Deployment

For production deployment:
1. Build with `npm run build`
2. Archive in Xcode (Product > Archive)
3. Upload to App Store Connect
4. Submit for review

## Maintenance Tips

1. Always test in Safari after Chrome changes
2. Keep browser polyfill updated for API changes
3. Monitor Safari Technology Preview for new APIs
4. Test on multiple macOS versions
5. Check extension permissions in Safari settings