# Safari Extension for Anno

This is the Safari version of the Anno web annotation extension.

## Features

- Full Safari compatibility (macOS and iOS)
- WebExtension API support via polyfill
- Type-safe message passing
- Enhanced error handling
- Safari-specific API fallbacks
- Storage quota management (10MB limit)

## Build Instructions

### Prerequisites

- Node.js 18+ 
- npm 9+
- Xcode 14+ (for Safari extension development)
- macOS 13+ (Ventura or later)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the environment file:
```bash
cp .env.sample .env
```

3. Build the extension:
```bash
npm run build
```

4. Convert to Safari extension:
```bash
npm run convert
```

### Development

- `npm run build` - Build the extension
- `npm run build:watch` - Watch mode for development
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run clean` - Clean build artifacts

### Architecture

The Safari extension has been refactored with:

1. **Enhanced Type Safety**
   - Strict TypeScript configuration
   - Unified message type definitions
   - Type-safe browser API usage

2. **Safari Compatibility**
   - WebExtension polyfill integration
   - Safari-specific API fallbacks
   - iOS compatibility checks
   - Context menu support detection

3. **Error Handling**
   - Comprehensive error wrapping
   - Retry mechanisms
   - Error reporting to background script
   - Storage quota management

4. **Performance Optimizations**
   - Tree shaking enabled
   - Code splitting
   - Lazy loading where appropriate
   - Efficient storage usage

### Safari-Specific Considerations

1. **Storage Limits**: Safari has a 10MB storage limit (vs Chrome's unlimited)
2. **Context Menus**: Not supported on iOS Safari
3. **Permissions API**: Limited support, fallbacks implemented
4. **Background Scripts**: Service worker model (non-persistent)

### Testing

After building and converting:

1. Open the generated Xcode project:
```bash
open anno/anno.xcodeproj
```

2. Select your target device (macOS or iOS)
3. Build and run (⌘R)
4. Enable the extension in Safari preferences

### Troubleshooting

- **Build errors**: Run `npm run typecheck` to check for type issues
- **Storage quota**: The extension automatically manages storage cleanup
- **iOS issues**: Check `safariCompat.isIOS()` for platform-specific code
- **API compatibility**: Unsupported APIs have fallbacks implemented

### Contributing

When making changes:
1. Follow the existing code style
2. Add proper error handling
3. Test on both macOS and iOS Safari
4. Update types when adding new features
EOF < /dev/null