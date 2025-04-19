import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { applyTemplateConfig } from './features.js';

/**
 * Clones a template repository to a temporary directory.
 * @param {string} repoUrl - The Git repository URL for the template.
 * @param {string} tempDir - The temporary directory path.
 * @param {Object} options - Additional options (e.g., branch).
 * @returns {Promise<void>}
 */
export async function cloneTemplate(repoUrl, tempDir, options = {}) {
  const branch = options.branch || 'master'; 
  
  console.log(chalk.blue(`Cloning template from ${repoUrl} (branch: ${branch})...`));
  
  try {
    // Ensure temporary directory doesn't exist
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
      console.log(chalk.gray(`Removed existing temporary directory: ${tempDir}`));
    }
    
    // Create temporary directory
    await fs.ensureDir(tempDir);
    console.log(chalk.gray(`Created temporary directory: ${tempDir}`));
    
    // Clone repository with specified branch
    const cloneCmd = `git clone --depth 1 ${branch ? `--branch ${branch}` : ''} ${repoUrl} ${tempDir}`;
    console.log(chalk.gray(`Executing: ${cloneCmd}`));
    execSync(cloneCmd, { stdio: 'pipe' }); // Use 'pipe' to suppress git output unless error
    
    // Remove .git directory
    const gitDir = path.join(tempDir, '.git');
    if (await fs.pathExists(gitDir)) {
        await fs.remove(gitDir);
        console.log(chalk.gray(`Removed .git directory from ${tempDir}`));
    }
        
    console.log(chalk.green(`✔ Template successfully cloned to ${tempDir}`));
  } catch (err) {
    console.error(chalk.red(`Clone template failed: ${err.stderr ? err.stderr.toString() : err.message}`));
    // Clean up temporary directory on failure
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
      console.log(chalk.gray(`Cleaned up temporary directory due to error: ${tempDir}`));
    }
    throw err; // Re-throw the error to halt the process
  }
}

/**
 * Copies contents from the temporary directory to the final target directory.
 * @param {string} tempDir - The source temporary directory.
 * @param {string} targetDir - The destination target directory.
 * @returns {Promise<void>}
 */
export async function copyFromTempToTarget(tempDir, targetDir) {
    console.log(chalk.blue(`Copying files from ${tempDir} to ${targetDir}...`));
    try {
        // Ensure target directory exists
        await fs.ensureDir(targetDir);

        // Copy contents
        // The { overwrite: true } option ensures that if the target directory 
        // is the current working directory and already has files (e.g., .git), 
        // the template files will overwrite them if names conflict, 
        // but won't delete existing files unnecessarily.
        await fs.copy(tempDir, targetDir, { overwrite: true });

        console.log(chalk.green(`✔ Files copied successfully to ${targetDir}`));
    } catch (err) {
        console.error(chalk.red(`Error copying files from temp to target directory: ${err.message}`));
        throw err;
    }
}

// Removed functions: copyTemplateConfig, getAvailableTemplates, updateProjectFiles, 
// updateManifestConfig, updatePackageJson, processPackageDependencies, removeUnusedDirectories
// Their logic is either obsolete or handled within features.js 