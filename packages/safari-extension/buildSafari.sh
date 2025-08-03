#!/bin/bash

# Safari extension build and setup script

echo "Building Safari extension..."

# Build the extension
npm run build

# Remove old Xcode project
rm -rf anno

# Generate new Xcode project
xcrun safari-web-extension-converter \
  --bundle-identifier jp.anno.safari \
  --app-name "Anno" \
  --force \
  --no-open \
  dist

# Create proper Resources directory for the extension
mkdir -p "anno/Shared (Extension)/Resources"

# Copy all extension files to the Resources directory
cp -r dist/* "anno/Shared (Extension)/Resources/"

echo "Safari extension setup complete!"
echo "Next steps:"
echo "1. Open anno.xcodeproj in Xcode"
echo "2. Build and run the project (Command + R)"
echo "3. Enable the extension in Safari"