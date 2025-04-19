# create-kern

A modular project scaffolding tool powered by Git repository configurations. This tool allows you to create customizable project templates that can be easily initialized with specific features selected by the user.

## Features

- **Repository-based templates**: Use any Git repository as a template source
- **Modular configuration**: Define layers of features that can be enabled/disabled
- **Interactive CLI**: User-friendly prompts to select desired components
- **Extensible design**: Supports various project types through configuration

## Installation

```bash
# Using npm
npm install -g create-kern

# Using yarn
yarn global add create-kern

# Using pnpm
pnpm add -g create-kern
```

## Usage

### Creating a new project

```bash
# Basic usage (interactive mode)
npm create kern

# Specifying a target directory
npm create kern my-project

# Direct call if globally installed
create-kern my-project
```

The CLI will guide you through selecting a template repository and choosing which features to include in your project.

## Template Repository Configuration

To use a Git repository as a template source, you need to add a `template.config.json` file to the root of your repository with the following structure:

```json
{
  "templateName": "Your Template Name",
  "templateType": "project-type", // e.g., "chrome-extension", "vue", "react", etc.
  
  "layerOne": {
    "item1": {
      "name": "Item 1 Display Name",
      "description": "Description of this item",
      "files": ["path/to/files/**/*"],
      "defaultEnabled": true
    },
    "item2": {
      "name": "Item 2 Display Name",
      "description": "Description of this item",
      "files": ["path/to/other/files/**/*"],
      "defaultEnabled": false
    }
  },
  
  "layerTwo": {
    "featureA": {
      "name": "Feature A Display Name",
      "description": "Description of this feature",
      "files": ["src/featureA/**/*"],
      "dependencies": [
        {
          "name": "package-name",
          "dev": false
        }
      ],
      "defaultEnabled": true
    }
  }
}
```

### Configuration Options

| Field | Description |
|-------|-------------|
| `templateName` | Display name of your template |
| `templateType` | Type of project (e.g., "chrome-extension", "vue", "react") |
| `[layerKey]` | Custom categories of features (e.g., "pages", "features", "uiEnhancements") |

#### Item Configuration

Each item within a layer can have the following properties:

| Property | Description |
|----------|-------------|
| `name` | Display name shown in the CLI |
| `description` | Description of the feature |
| `defaultEnabled` | Whether this item is enabled by default |
| `files` | Array of glob patterns for files associated with this item |
| `directories` | Array of directory patterns to include/exclude |
| `dependencies` | NPM dependencies required for this item |
| `manifestKeys` | For extensions: manifest.json keys to include/exclude |
| `codePatterns` | Code modifications based on feature selection |

### Example: Chrome Extension Template

```json
{
  "templateName": "Chrome Extension Template",
  "templateType": "chrome-extension",
  
  "pages": {
    "popup": {
      "name": "Popup Page",
      "description": "Browser action popup window",
      "files": ["src/ui/popup/**/*"],
      "manifestKeys": ["action"],
      "defaultEnabled": true
    },
    "options": {
      "name": "Options Page",
      "description": "Extension settings page",
      "files": ["src/ui/options/**/*"],
      "manifestKeys": ["options_page"],
      "defaultEnabled": false
    }
  },
  
  "features": {
    "i18n": {
      "name": "Internationalization",
      "description": "Support for multiple languages",
      "files": ["src/locales/**/*"],
      "dependencies": [
        {
          "name": "vue-i18n",
          "dev": false
        }
      ],
      "defaultEnabled": false
    }
  }
}
```

## Creating Your Own Template

1. Create a Git repository with your project structure
2. Add a `template.config.json` file to define configurable components
3. Organize files to match your configuration
4. Test your template using: `npm create kern my-test-project`