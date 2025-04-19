import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import os from 'os';

import { confirmProceed, promptOptions, promptTemplateUrl } from '../utils/prompts.js';
import { cloneTemplate, copyFromTempToTarget } from '../utils/template.js';
import { loadTemplateConfig, applyTemplateConfig } from '../utils/features.js';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize a new project based on a user-provided template
 * @param {string} targetDir - Target directory
 * @param {Object} predefinedChoices - Predefined user choices (for testing)
 * @param {string} predefinedRepoUrl - Predefined repository URL (for testing)
 * @returns {Promise<void>}
 */
export async function init(targetDir, predefinedChoices = null, predefinedRepoUrl = null) {
  console.log(chalk.blue('Initializing project...'));
  let tempDir = ''; 

  try {
    // 1. Get absolute path for target directory
    const absoluteTargetDir = path.resolve(process.cwd(), targetDir);
    
    // 2. Confirm proceeding if target directory is not empty
    const proceed = await confirmProceed(absoluteTargetDir);
    if (!proceed) {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }

    // 3. Get Template Repository URL
    const repoUrl = predefinedRepoUrl || await promptTemplateUrl();

    // 4. Create and clone template to temporary directory
    // Use a more robust temp directory name
    tempDir = path.join(os.tmpdir(), `create-ext-template-${path.basename(repoUrl)}-${Date.now()}`);
    await cloneTemplate(repoUrl, tempDir);

    // 5. Load template configuration from the temporary directory
    const templateConfig = await loadTemplateConfig(tempDir);

    // 6. Get user configuration choices based on the loaded config
    // Pass templateConfig to promptOptions
    const options = predefinedChoices || await promptOptions(templateConfig);

    // 7. Create final target directory if needed
    if (targetDir !== '.') {
      await fs.ensureDir(absoluteTargetDir);
      console.log(chalk.gray(`Ensured target directory exists: ${absoluteTargetDir}`));
    }
    
    // 8. Copy files from temporary directory to the final target directory
    await copyFromTempToTarget(tempDir, absoluteTargetDir);

    // 9. Apply user choices (modify files, update deps, remove unused)
    // Pass loaded templateConfig to avoid reloading it
    await applyTemplateConfig(absoluteTargetDir, options, templateConfig); 

    // 10. Show success message
    console.log(chalk.green('\n✔ Scaffolding complete!'));
    const relativeTargetDir = path.relative(process.cwd(), absoluteTargetDir) || '.';
    console.log(chalk.cyan(
      `\nNext steps:\n` +
      `  1. cd ${relativeTargetDir}\n` +
      `  2. pnpm install (or npm install / yarn install)\n` +
      `  3. pnpm dev (or npm run dev / yarn dev)\n`
    ));

  } catch (err) {
    console.error(chalk.red(`\n❌ Error during initialization: ${err.message}`));
    // Ensure stack trace is printed for debugging
    if (err.stack) {
      console.error(chalk.gray(err.stack));
    }
    process.exit(1);
  } finally {
    // 11. Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      try {
        await fs.remove(tempDir);
        console.log(chalk.gray(`Cleaned up temporary directory: ${tempDir}`));
      } catch (cleanupErr) {
        console.warn(chalk.yellow(`Warning: Failed to clean up temporary directory ${tempDir}: ${cleanupErr.message}`));
      }
    }
  }
} 