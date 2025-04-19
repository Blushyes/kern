# Create Vite Vue3 Chrome Extension V3

A scaffolding tool to quickly create Chrome Extension projects using Vite, Vue 3, and Manifest V3.

## Features

- **Modern Stack**: Built with Vite, Vue 3, TypeScript, and Manifest V3
- **Customizable**: Choose the pages and features you need for your extension
- **Feature Selection**: Select from various UI enhancements and core functionalities
- **Modular Architecture**: Clean project structure with separate background, content scripts, and UI components

## Available Pages

- **Background**: Service Worker for background tasks
- **Popup**: Browser action popup window
- **Options Page**: Extension settings page
- **Content Script**: Scripts injected into web pages
- **DevTools Panel**: Custom panel in Chrome DevTools
- **Side Panel**: Browser side panel UI

## Core Features

- **State Management**: Pinia for global state
- **File-based Routing**: Automatic Vue Router setup based on file structure

## UI Enhancements

- **Internationalization**: Support for multiple languages with vue-i18n
- **Theme Switcher**: Built-in light/dark mode toggle
- **Notifications**: Toast notification system using Notivue

## Template Configuration

The `template.config.json` file defines the structure and customizable options of your template. Here's how to configure it:

### Basic Template Information

```json
{
  "templateName": "Your Template Name",
  "templateType": "chrome-extension",
  "templateDescription": "Description of your template",
  "templateAuthor": "Your Name",
  "version": "1.0.0"
}
```

### Configuring Pages

The `pages` section defines extension pages that users can include or exclude:

```json
"pages": {
  "background": {
    "name": "Background",
    "description": "Service Worker for background tasks",
    "files": [
      "src/background/**/*"
    ],
    "manifestKeys": [
      "background"
    ],
    "defaultEnabled": true
  },
  "popup": {
    "name": "Popup",
    "description": "Browser action popup window",
    "files": [
      "src/ui/action-popup/**/*"
    ],
    "manifestKeys": [
      "action"
    ],
    "defaultEnabled": true
  }
}
```

### Configuring Features

You can define features in categories like `coreFeatures` and `uiEnhancements`:

```json
"coreFeatures": {
  "stateManagement": {
    "name": "State Management (Pinia)",
    "description": "Enable Pinia for global state",
    "files": [
      "src/stores/**/*"
    ],
    "dependencies": [
      {
        "name": "pinia",
        "dev": false
      }
    ],
    "codePatterns": [
      {
        "file": "src/ui/*/main.ts",
        "pattern": "import .* from 'pinia'",
        "action": "keep"
      }
    ],
    "defaultEnabled": true
  }
}
```

### Configuration Properties

Each page or feature can include:

- `name`: Display name
- `description`: Brief explanation
- `files`: Array of file paths that will be included/excluded
- `dependencies`: Required npm packages
- `manifestKeys`: Related manifest.json keys (for pages)
- `codePatterns`: Code patterns to keep/remove based on user choices
- `defaultEnabled`: Whether this option is enabled by default

## Quick Start

```bash
# Using npm
npm create kern

# Using pnpm
pnpm create kern

# Using yarn
yarn create kern
```

Follow the interactive prompts to configure your extension:
1. Select the extension pages you want to include
2. Choose core features (state management, routing)
3. Add UI enhancements (i18n, theme switching, notifications)

## Development

After creating your project:

```bash
# Navigate to project directory
cd your-extension-name

# Install dependencies
npm install
# or
pnpm install
# or
yarn install

# Start development server
npm run dev
# or
pnpm dev
# or
yarn dev
```

## Building for Production

```bash
npm run build
# or
pnpm build
# or
yarn build
```

The built extension will be in the `dist` directory, ready to be loaded into Chrome.

## Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the `dist` directory of your project
4. Your extension is now installed and ready for testing

## License

ISC 