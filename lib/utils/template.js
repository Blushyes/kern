import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { applyTemplateConfig } from './features.js';

/**
 * Clone template repository
 * @param {string} dir - Target directory
 * @param {string} tempDir - Temporary directory
 * @param {Object} options - Options
 * @returns {Promise<void>}
 */
export async function cloneTemplate(dir, tempDir, options = {}) {
  // Default to Chrome extension template, but can be overridden through options
  const repoUrl = options.templateRepo || 'https://github.com/mubaidr/vite-vue3-browser-extension-v3.git';
  const branch = options.branch || 'master';
  
  console.log(chalk.blue(`Cloning template from ${repoUrl}...`));
  
  try {
    // Ensure temporary directory doesn't exist
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    
    // Create temporary directory
    await fs.ensureDir(tempDir);
    
    // Clone repository with specified branch
    const cloneCmd = `git clone ${branch ? `--branch ${branch}` : ''} ${repoUrl} ${tempDir}`;
    execSync(cloneCmd, { stdio: 'inherit' });
    
    // Remove .git directory
    await fs.remove(path.join(tempDir, '.git'));
    
    // Get file list (exclude node_modules and .git)
    const files = await fs.readdir(tempDir);
    
    // Copy files to target directory
    for (const file of files) {
      const srcPath = path.join(tempDir, file);
      const destPath = path.join(dir, file);
      
      // Skip unwanted directories
      if (file === 'node_modules' || file === '.git') {
        continue;
      }
      
      // Copy file or directory
      await fs.copy(srcPath, destPath);
      console.log(chalk.green(`✓ Copied ${file}`));
    }
    
    // Copy template configuration file to target directory
    await copyTemplateConfig(dir);
    
    // Clean up temporary directory
    await fs.remove(tempDir);
    
    console.log(chalk.green(`✔ Template cloned to ${dir}`));
  } catch (err) {
    console.error(chalk.red(`Clone template failed: ${err.message}`));
    
    // Clean up temporary directory
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    
    throw err;
  }
}

/**
 * Copy template configuration file to target directory
 * @param {string} dir - Target directory
 * @returns {Promise<void>}
 */
async function copyTemplateConfig(dir) {
  // Try to copy the template configuration file
  const configPath = path.join(process.cwd(), 'template.config.json');
  const targetPath = path.join(dir, 'template.config.json');
  
  if (await fs.pathExists(configPath)) {
    await fs.copy(configPath, targetPath);
    console.log(chalk.green(`✓ Copied template.config.json`));
  } else {
    console.warn(chalk.yellow('Warning: No template configuration file found, will use default configuration'));
  }
}

/**
 * Get available template list
 * @returns {Promise<Array>} Template list
 */
export async function getAvailableTemplates() {
  return [
    {
      name: 'Vue 3 Chrome Extension',
      value: 'chrome-extension',
      repo: 'https://github.com/mubaidr/vite-vue3-browser-extension-v3.git',
      description: 'Chrome Extension template with Vue 3 and Vite.'
    },
    {
      name: 'Vue 3 Application',
      value: 'vue',
      repo: 'https://github.com/vuejs/create-vue.git',
      description: 'Vue 3 application template with all the bells and whistles.'
    },
    {
      name: 'React Application',
      value: 'react',
      repo: 'https://github.com/facebook/create-react-app.git',
      description: 'Create React apps with no build configuration.'
    },
    {
      name: 'Node.js Express API',
      value: 'node',
      repo: 'https://github.com/expressjs/express.git',
      description: 'Node.js Express API template with common middleware.'
    }
  ];
}

/**
 * Update project files based on user selections
 * @param {string} dir - Project directory
 * @param {Object} options - User selected options
 * @returns {Promise<void>}
 */
export async function updateProjectFiles(dir, options) {
  console.log(chalk.blue('Updating project files...'));
  
  // Map basePages to modules to be compatible with old versions
  if (options.basePages && !options.modules) {
    options.modules = options.basePages;
    console.log(chalk.gray(`Mapped basePages to modules: [${options.modules.join(', ')}]`));
  }
  
  // Debug information
  console.log(chalk.gray(`Selected modules: ${options.modules ? options.modules.join(', ') : 'None'}`));
  console.log(chalk.gray(`Selected features: ${options.features ? options.features.join(', ') : 'None'}`));
  
  // Use new template management module to apply user selections
  await applyTemplateConfig(dir, options);
  
  // Explicitly call to remove unused directories
  await removeUnusedDirectories(dir, options);
}

/**
 * Update manifest.config.ts based on user selections
 * @param {string} dir - Target directory
 * @param {Object} options - User selected options
 * @returns {Promise<void>}
 */
async function updateManifestConfig(dir, options) {
  const manifestPath = path.join(dir, 'manifest.config.ts');
  
  if (await fs.pathExists(manifestPath)) {
    try {
      let manifestContent = await fs.readFile(manifestPath, 'utf8');
      
      // Modify manifest based on user selections
      if (!options.basePages.includes('background')) {
        manifestContent = manifestContent.replace(/background\s*:\s*{[^}]*},?/g, '');
      }
      
      if (!options.basePages.includes('popup')) {
        manifestContent = manifestContent.replace(/action\s*:\s*{[^}]*},?/g, '');
      }
      
      if (!options.basePages.includes('options')) {
        manifestContent = manifestContent.replace(/options_page\s*:\s*['"][^'"]*['"],?/g, '');
      }
      
      if (!options.basePages.includes('contentScript')) {
        manifestContent = manifestContent.replace(/content_scripts\s*:\s*\[[^\]]*\],?/g, '');
      }
      
      if (!options.basePages.includes('devtoolsPanel')) {
        manifestContent = manifestContent.replace(/devtools_page\s*:\s*['"][^'"]*['"],?/g, '');
      }
      
      if (!options.basePages.includes('sidePanel')) {
        manifestContent = manifestContent.replace(/side_panel\s*:\s*{[^}]*},?/g, '');
      }
      
      await fs.writeFile(manifestPath, manifestContent, 'utf8');
      console.log(chalk.green('✔ Updated manifest configuration'));
    } catch (err) {
      console.warn(chalk.yellow('Warning: Failed to update manifest file. You may need to modify it manually.'));
    }
  }
}

/**
 * Update package.json based on user selections
 * @param {string} dir - Target directory
 * @param {Object} options - User selected options
 * @returns {Promise<void>}
 */
async function updatePackageJson(dir, options) {
  const pkgPath = path.join(dir, 'package.json');
  
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJson(pkgPath);
      
      // Update package name to match directory name
      pkg.name = path.basename(path.resolve(dir));
      
      // Get new dependencies based on user selections
      const { dependencies, devDependencies } = processPackageDependencies(pkg, options);
      
      // Update the dependencies and devDependencies
      pkg.dependencies = dependencies;
      pkg.devDependencies = devDependencies;
      
      await fs.writeJson(pkgPath, pkg, { spaces: 2 });
      console.log(chalk.green('✔ Updated package.json'));
    } catch (err) {
      console.warn(chalk.yellow('Warning: Failed to update package.json. You may need to modify it manually.'));
    }
  }
}

/**
 * Process package dependencies based on user selections
 * @param {Object} pkg - Original package.json
 * @param {Object} options - User selected options
 * @returns {Object} - Updated dependencies and devDependencies
 */
function processPackageDependencies(pkg, options) {
  const dependencies = { ...pkg.dependencies };
  const devDependencies = { ...pkg.devDependencies };
  
  // Keep required dependencies
  const requiredDeps = ['vue', 'vue-router', 'webextension-polyfill'];
  const requiredDevDeps = [
    '@vitejs/plugin-vue',
    '@crxjs/vite-plugin',
    'vite',
    'typescript',
    'eslint',
    'eslint-plugin-vue',
    'tailwindcss',
    'postcss'
  ];
  
  // Handle features
  if (!options.features.includes('i18n')) {
    delete dependencies['vue-i18n'];
    if (devDependencies['@intlify/unplugin-vue-i18n']) {
      delete devDependencies['@intlify/unplugin-vue-i18n'];
    }
  }
  
  if (!options.features.includes('pinia')) {
    delete dependencies['pinia'];
  }
  
  if (!options.features.includes('notivue')) {
    delete dependencies['notivue'];
  }
  
  if (!options.features.includes('fileRouting')) {
    if (devDependencies['unplugin-vue-router']) {
      delete devDependencies['unplugin-vue-router'];
    }
  }
  
  // Keep only required and selected dependencies
  const filteredDeps = {};
  const filteredDevDeps = {};
  
  // Filter dependencies
  for (const dep of requiredDeps) {
    if (dependencies[dep]) {
      filteredDeps[dep] = dependencies[dep];
    }
  }
  
  // Add back feature-specific dependencies
  if (options.features.includes('i18n') && dependencies['vue-i18n']) {
    filteredDeps['vue-i18n'] = dependencies['vue-i18n'];
  }
  
  if (options.features.includes('pinia') && dependencies['pinia']) {
    filteredDeps['pinia'] = dependencies['pinia'];
  }
  
  if (options.features.includes('notivue') && dependencies['notivue']) {
    filteredDeps['notivue'] = dependencies['notivue'];
  }
  
  // Filter devDependencies
  for (const dep of requiredDevDeps) {
    if (devDependencies[dep]) {
      filteredDevDeps[dep] = devDependencies[dep];
    }
  }
  
  // Add back feature-specific devDependencies
  if (options.features.includes('i18n') && devDependencies['@intlify/unplugin-vue-i18n']) {
    filteredDevDeps['@intlify/unplugin-vue-i18n'] = devDependencies['@intlify/unplugin-vue-i18n'];
  }
  
  if (options.features.includes('fileRouting') && devDependencies['unplugin-vue-router']) {
    filteredDevDeps['unplugin-vue-router'] = devDependencies['unplugin-vue-router'];
  }
  
  return {
    dependencies: filteredDeps,
    devDependencies: filteredDevDeps
  };
}

/**
 * Remove unused directories
 * @param {string} dir - Target directory
 * @param {Object} options - User selected options
 * @returns {Promise<void>}
 */
async function removeUnusedDirectories(dir, options) {
  console.log(chalk.blue('Removing unused directories...'));
  
  // Handle feature-related directories
  if (options.features) {
    // Handle removing unused feature directories
    if (!options.features.includes('i18n')) {
      const i18nPath = path.join(dir, 'src/locales');
      if (await fs.pathExists(i18nPath)) {
        await fs.remove(i18nPath);
        console.log(chalk.gray(`Removed unused feature directory: ${i18nPath}`));
      }
    }
    
    if (!options.features.includes('themeSwitcher')) {
      const themeComponentPath = path.join(dir, 'src/components/ThemeSwitch.vue');
      if (await fs.pathExists(themeComponentPath)) {
        await fs.remove(themeComponentPath);
        console.log(chalk.gray(`Removed unused feature file: ${themeComponentPath}`));
      }
    }
    
    if (!options.features.includes('pinia')) {
      const storePath = path.join(dir, 'src/stores');
      if (await fs.pathExists(storePath)) {
        await fs.remove(storePath);
        console.log(chalk.gray(`Removed unused feature directory: ${storePath}`));
      }
    }
  }
  
  // Handle page directories
  if (options.modules || options.basePages) {
    const selectedPages = options.modules || options.basePages;
    console.log(chalk.gray(`Processing selected pages: [${selectedPages.join(', ')}]`));
    
    // Remove unused page directories
    const pageTypes = [
      { id: 'background', dir: 'src/background' },
      { id: 'popup', dir: 'src/ui/action-popup' },
      { id: 'options', dir: 'src/ui/options-page' },
      { id: 'contentScript', dir: 'src/content-script' },
      { id: 'devtoolsPanel', dirs: ['src/ui/devtools-panel', 'src/devtools'] },
      { id: 'sidePanel', dir: 'src/ui/side-panel' }
    ];
    
    for (const page of pageTypes) {
      if (!selectedPages.includes(page.id)) {
        if (page.dirs) {
          // If there are multiple directories to delete
          for (const dirPath of page.dirs) {
            const pagePath = path.join(dir, dirPath);
            if (await fs.pathExists(pagePath)) {
              await fs.remove(pagePath);
              console.log(chalk.gray(`Removed unused page directory: ${pagePath}`));
            }
          }
        } else if (page.dir) {
          const pagePath = path.join(dir, page.dir);
          if (await fs.pathExists(pagePath)) {
            await fs.remove(pagePath);
            console.log(chalk.gray(`Removed unused page directory: ${pagePath}`));
          }
        }
      }
    }
  }
  
  console.log(chalk.green('✔ Removed unused directories'));
} 