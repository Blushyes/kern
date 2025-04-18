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
 * Prompt for extension options
 * @returns {Promise<Object>}
 */
export async function promptOptions() {
  console.log(chalk.cyan('Please select options for your Chrome extension:'));
  
  const { basePages } = await inquirer.prompt([
    {
      name: 'basePages',
      type: 'checkbox',
      message: 'Select base pages to include:',
      choices: [
        { name: 'Background (Service Worker)', value: 'background', checked: true },
        { name: 'Popup', value: 'popup', checked: true },
        { name: 'Options Page', value: 'options', checked: false },
        { name: 'Content Script', value: 'contentScript', checked: false },
        { name: 'Devtools Panel', value: 'devtoolsPanel', checked: false },
        { name: 'Side Panel', value: 'sidePanel', checked: false }
      ]
    }
  ]);

  const { features } = await inquirer.prompt([
    {
      name: 'features',
      type: 'checkbox',
      message: 'Choose features to include:',
      choices: [
        { name: 'File-based Routing', value: 'fileRouting', checked: true },
        { name: 'Internationalization (i18n)', value: 'i18n', checked: false },
        { name: 'Theme Switcher (Light/Dark)', value: 'themeSwitcher', checked: true },
        { name: 'Notification System (Notivue)', value: 'notivue', checked: false },
        { name: 'State Management (Pinia)', value: 'pinia', checked: true }
      ]
    }
  ]);

  return {
    basePages,
    features
  };
} 