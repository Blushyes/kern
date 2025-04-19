import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

/**
 * Check if target directory is empty
 * @param {string} dir - Target directory
 * @returns {Promise<boolean>}
 */
export async function checkTargetDir(dir) {
  if (dir === process.cwd()) return true;
  
  try {
    await fs.ensureDir(dir);
    const files = await fs.readdir(dir);
    return files.length === 0;
  } catch (err) {
    console.error(`Error checking directory: ${err.message}`);
    return false;
  }
}

/**
 * Confirm proceeding with non-empty directory
 * @param {string} dir - Target directory
 * @returns {Promise<boolean>}
 */
export async function confirmProceed(dir) {
  const isEmpty = await checkTargetDir(dir);
  
  if (!isEmpty && dir !== process.cwd()) {
    const { proceed } = await inquirer.prompt([
      {
        name: 'proceed',
        type: 'confirm',
        message: `Target directory "${path.basename(dir)}" is not empty. Continue anyway?`,
        default: false
      }
    ]);
    return proceed;
  }
  
  return true;
}

/**
 * Prompt user for the template repository URL
 * @returns {Promise<string>} The Git repository URL entered by the user
 */
export async function promptTemplateUrl() {
  const { repoUrl } = await inquirer.prompt([
    {
      name: 'repoUrl',
      type: 'input',
      message: 'Enter the Git repository URL for the template:',
      default: 'https://github.com/mubaidr/vite-vue3-browser-extension-v3.git',
      validate: function (input) {
        // Basic validation for a Git URL pattern
        const gitUrlPattern = /^(https?|git)(:\/\/|@)([^/:]+)[/:]([^/:]+)\/(.+)\.git$/i;
        if (gitUrlPattern.test(input) || /^\/.+/.test(input) || /^\.{1,2}\/.+/.test(input)) { // Allow Git URLs and local paths
          return true;
        } else {
          return 'Please enter a valid Git repository URL or a local path.';
        }
      },
    },
  ]);
  return repoUrl;
}

/**
 * Prompt for project options dynamically based on template configuration layers.
 * @param {Object} templateConfig - The loaded template configuration object.
 * @returns {Promise<Object>} An object containing selections for each layer.
 *                            Example: { pages: ['popup', 'background'], features: ['pinia'] }
 */
export async function promptOptions(templateConfig) {
  console.log(chalk.cyan('\nPlease configure your project based on the template:'));
  const allSelections = {};

  // Identify layers (top-level keys in the config that are objects)
  const layers = Object.entries(templateConfig)
    .filter(([key, value]) => 
      typeof value === 'object' && 
      value !== null && 
      !Array.isArray(value) &&
      // Exclude reserved/metadata keys if necessary (optional)
      !['templateName', 'templateType'].includes(key) 
    )
    .map(([key]) => key);

  if (layers.length === 0) {
      console.log(chalk.yellow('No configurable layers found in template.config.json'));
      return {};
  }

  // Sequentially prompt for each layer
  for (const layerKey of layers) {
    const layerConfig = templateConfig[layerKey];
    const layerItems = Object.entries(layerConfig);

    if (layerItems.length === 0) {
        console.log(chalk.gray(`Layer '${layerKey}' has no items defined, skipping.`));
        allSelections[layerKey] = []; // Ensure the key exists in the result
        continue;
    }

    console.log(chalk.blue(`\nConfiguring layer: ${layerKey}`));

    const choices = layerItems.map(([itemId, itemConfig]) => ({
      name: itemConfig.description ? `${itemConfig.name} (${itemConfig.description})` : itemConfig.name,
      value: itemId,
      checked: itemConfig.defaultEnabled !== undefined ? itemConfig.defaultEnabled : true, // Default to true if not specified
    }));

    const { selectedItems } = await inquirer.prompt([
      {
        name: 'selectedItems',
        type: 'checkbox',
        message: `Select items for the '${layerKey}' layer:`, 
        choices: choices,
      },
    ]);
    
    allSelections[layerKey] = selectedItems;
  }

  console.log(chalk.cyan('\nConfiguration selection completed.'));
  return allSelections;
} 