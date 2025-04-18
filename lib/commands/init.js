import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import os from 'os';

import { confirmProceed, promptOptions } from '../utils/prompts.js';
import { cloneTemplate, updateProjectFiles } from '../utils/template.js';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize a new project
 * @param {string} targetDir - Target directory
 * @param {Object} predefinedChoices - Predefined user choices (for testing)
 * @returns {Promise<void>}
 */
export async function init(targetDir, predefinedChoices = null) {
  console.log(chalk.blue('Initializing project...'));

  try {
    // Get absolute path for target directory
    const absoluteTargetDir = path.resolve(process.cwd(), targetDir);
    
    // Confirm proceeding with non-empty directory
    const proceed = await confirmProceed(absoluteTargetDir);
    if (!proceed) {
      console.log(chalk.yellow('Operation cancelled'));
      return;
    }

    // Get user configuration choices (either from prompts or predefined)
    const options = predefinedChoices || await promptOptions();
    
    // Ensure options contains the correct format
    if (options.basePages && !options.modules) {
      options.modules = options.basePages;
      console.log(chalk.gray(`Converting basePages to modules: [${options.modules.join(', ')}]`));
    }
    
    // Create directory (if not current directory)
    if (targetDir !== '.') {
      await fs.ensureDir(absoluteTargetDir);
    }

    // Create a unique temporary directory in the system temp folder
    const tempDir = path.join(os.tmpdir(), `template-project-${Date.now()}`);
    
    // Clone template and apply user choices
    await cloneTemplate(absoluteTargetDir, tempDir);
    await updateProjectFiles(absoluteTargetDir, options);

    // Show success message
    console.log(chalk.green('✔ Scaffolding complete!'));
    console.log(chalk.cyan(
      `→ Run ${chalk.bold(`cd ${targetDir !== '.' ? targetDir : ''} && pnpm install && pnpm dev`)}`
    ));
  } catch (err) {
    console.error(chalk.red(`Error during initialization: ${err.message}`));
    process.exit(1);
  }
} 