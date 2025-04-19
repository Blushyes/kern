#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { init } from '../lib/commands/init.js';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version info
const pkgPath = path.resolve(__dirname, '../../package.json');
const pkg = fs.readJsonSync(pkgPath);

// Create a new commander program
const program = new Command();

// Setup basic program info
program
  .name('create-vite-vue3-chrome-extension-v3')
  .description('CLI tool to scaffold a Chrome extension project with Vue 3 and Vite')
  .version(pkg.version);

// Add the main command
program
  .argument('[directory]', 'Directory to create the extension in', '.')
  .action((directory: string) => {
    // Run the init command with the specified directory
    init(directory).catch((err: Error) => {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    });
  });

// Parse command line arguments
program.parse();