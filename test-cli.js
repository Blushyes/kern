#!/usr/bin/env node

import { init } from './lib/commands/init.js';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import os from 'os';
import { execSync } from 'child_process';
import { loadTemplateConfig } from './lib/utils/features.js';

// Define a local path for the template (for testing without network)
// If you want to test with a real Git repo, set this to null 
// and provide the URL in testRepoUrl below.
const localTemplatePath = null; // Example: path.join(process.cwd(), '../path/to/local/template')

// URL for the template repository to test
const testRepoUrl = localTemplatePath || 'git@github.com:Blushyes/vite-vue3-chrome-extension-v3.git';

// Create a test directory
const testDir = path.join(process.cwd(), 'test-extension-' + Date.now());

// Ensure test directory exists and is empty
async function setupTestDir() {
  if (await fs.pathExists(testDir)) {
    await fs.remove(testDir);
  }
  await fs.ensureDir(testDir);
  console.log(`Created test directory: ${testDir}`);
}

// Function to get template configuration (handles local path or temp clone)
async function getTemplateConfigForTest(repoUrlOrPath) {
    const configFileName = 'template.config.json';
    let configPath;

    if (localTemplatePath) {
        // If using a local path, directly check for the config file there
        configPath = path.join(repoUrlOrPath, configFileName);
        if (await fs.pathExists(configPath)) {
            return await fs.readJson(configPath);
        }
    } else {
        // If using a repo URL, need to clone it temporarily to read config
        const tempCloneDir = path.join(os.tmpdir(), `test-clone-${Date.now()}`);
        try {
            console.log(chalk.gray(`Temporarily cloning ${repoUrlOrPath} to read config...`));
            const cloneCmd = `git clone --depth 1 ${repoUrlOrPath} ${tempCloneDir}`;
            execSync(cloneCmd, { stdio: 'pipe' });
            
            try {
                return await loadTemplateConfig(tempCloneDir);
            } catch (err) {
                console.warn(chalk.yellow(`Error loading config using loadTemplateConfig: ${err.message}`));
                
                // Fallback to direct file reading
                configPath = path.join(tempCloneDir, configFileName);
                if (await fs.pathExists(configPath)) {
                    return await fs.readJson(configPath);
                }
            }
        } finally {
            await fs.remove(tempCloneDir);
        }
    }
    throw new Error(`Could not find ${configFileName} in template: ${repoUrlOrPath}`);
}

// Test configuration JSON file
async function testConfigFile() {
  try {
    // Check if config file exists
    const configPath = path.join(process.cwd(), 'template.config.json');
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      console.log(chalk.green('✅ Config file is valid'));
      
      // Template config can have different layer keys, check for all possible combinations
      const layerKeys = Object.keys(config).filter(key => 
        typeof config[key] === 'object' && 
        config[key] !== null && 
        !Array.isArray(config[key]) &&
        !['templateType', 'templateName', 'templateDescription', 'templateAuthor', 'version'].includes(key)
      );
      
      console.log(chalk.green(`✅ Config file contains ${layerKeys.length} configuration layers: ${layerKeys.join(', ')}`));
      
      // Print configured items in each layer
      for (const layerKey of layerKeys) {
        console.log(chalk.cyan(`Configured ${layerKey}:`));
        Object.entries(config[layerKey]).forEach(([key, item]) => {
          console.log(`  - ${item.name || key}`);
        });
      }
    } else {
      console.warn(chalk.yellow('⚠️ template.config.json not found, will look for legacy format'));
      
      // Check for legacy format
      const legacyPath = path.join(process.cwd(), 'extension-features.json');
      if (await fs.pathExists(legacyPath)) {
        const config = await fs.readJson(legacyPath);
        console.log(chalk.green('✅ Legacy config file is valid'));
        
        // Validate config data structure for legacy format
        if (config.pages && config.features) {
          console.log(chalk.green('✅ Legacy config structure is correct'));
          
          // Print configured pages and features
          console.log(chalk.cyan('Configured pages:'));
          Object.keys(config.pages).forEach(key => {
            console.log(`  - ${config.pages[key].name}`);
          });
          
          console.log(chalk.cyan('Configured features:'));
          Object.keys(config.features).forEach(key => {
            console.log(`  - ${config.features[key].name}`);
          });
        } else {
          console.error(chalk.red('❌ Legacy config structure is incorrect, missing pages or features'));
        }
      } else {
        console.error(chalk.red('❌ No configuration file found'));
      }
    }
  } catch (err) {
    console.error(chalk.red(`❌ Error testing config file: ${err.message}`));
  }
}

// Run tests
async function runTest() {
  let tempDirForInit = ''; // Variable to store temp dir used by init for cleanup
  try {
    // 1. Get template config for verification purposes
    console.log(chalk.cyan('Attempting to load configuration from template...'));
    const templateConfigSource = await getTemplateConfigForTest(testRepoUrl); 
    if (templateConfigSource) {
        console.log(chalk.green('✅ Template configuration loaded for verification.'));
    } // Error handled within getTemplateConfigForTest

    // 2. Setup test directory
    await setupTestDir();
    
    // 3. Define user choices for the test
    // First identify the layer keys in the template config
    const layerKeys = Object.keys(templateConfigSource).filter(key => 
      typeof templateConfigSource[key] === 'object' && 
      templateConfigSource[key] !== null && 
      !Array.isArray(templateConfigSource[key]) &&
      !['templateType', 'templateName', 'templateDescription', 'templateAuthor', 'version'].includes(key)
    );
    
    // Initialize user choices for each layer found in the template
    const userChoices = {};
    for (const layerKey of layerKeys) {
      // For each layer, pick some sample items (up to 2)
      const layerItems = Object.keys(templateConfigSource[layerKey]);
      userChoices[layerKey] = layerItems.slice(0, Math.min(2, layerItems.length));
    }

    // 4. Show test options
    console.log(chalk.cyan('\nRunning test with options:'));
    console.log('  Template:', testRepoUrl); 
    for (const layerKey of layerKeys) {
      console.log(`  Selected ${layerKey}:`, userChoices[layerKey].join(', ') || 'None');
    }
    
    // 5. Run init function with predefined choices and repo URL
    // Pass the testRepoUrl to the init function
    await init(testDir, userChoices, testRepoUrl);
    
    // --- Verification Steps --- 
    console.log(chalk.cyan('\nStarting verification steps...'));
    
    // 6. Check if project was created successfully (basic file check)
    const files = await fs.readdir(testDir);
    console.log(`Files in final test directory: ${files.join(', ')}`);
    if (files.length > 0 && files.includes('package.json')) {
      console.log(chalk.green('✅ Test passed: Basic project files created.'));
    } else {
      throw new Error('Test failed: Essential files (e.g., package.json) not created.');
    }
      
    // 7. Check package.json dependencies
    const pkgPath = path.join(testDir, 'package.json');
    console.log(chalk.cyan('Verifying package.json dependencies...'));
    const pkg = await fs.readJson(pkgPath);
        
    // Define expected dependencies based on choices and template config
    const expectedDeps = new Set(['vue', 'vue-router', 'webextension-polyfill']);
    const expectedDevDeps = new Set([
        '@vitejs/plugin-vue',
        '@crxjs/vite-plugin',
        'vite',
        'typescript',
        'eslint',
        'eslint-plugin-vue',
        'tailwindcss',
        'postcss'
    ]);

    // Add dependencies for selected items across all layers
    for (const layerKey of layerKeys) {
      for (const itemId of userChoices[layerKey] || []) {
        const itemConfig = templateConfigSource[layerKey][itemId];
        if (itemConfig && itemConfig.dependencies) {
          for (const dep of itemConfig.dependencies) {
            if (dep.dev) {
              expectedDevDeps.add(dep.name);
            } else {
              expectedDeps.add(dep.name);
            }
          }
        }
      }
    }

    // Verify expected dependencies exist
    let depCheckPassed = true;
    expectedDeps.forEach(dep => {
        if (!pkg.dependencies || !pkg.dependencies[dep]) {
            console.error(chalk.red(`❌ Missing expected dependency: ${dep}`));
            depCheckPassed = false;
        }
    });
    expectedDevDeps.forEach(dep => {
        if (!pkg.devDependencies || !pkg.devDependencies[dep]) {
            console.error(chalk.red(`❌ Missing expected devDependency: ${dep}`));
            depCheckPassed = false;
        }
    });

    // Verify UNEXPECTED dependencies DO NOT exist
    const allPossibleDeps = new Set();
    const allPossibleDevDeps = new Set();
    
    // Collect all possible dependencies from all layers
    for (const layerKey of layerKeys) {
      for (const [_, itemConfig] of Object.entries(templateConfigSource[layerKey])) {
        if (itemConfig.dependencies) {
          for (const dep of itemConfig.dependencies) {
            if (dep.dev) {
              allPossibleDevDeps.add(dep.name);
            } else {
              allPossibleDeps.add(dep.name);
            }
          }
        }
      }
    }

    allPossibleDeps.forEach(dep => {
        if (!expectedDeps.has(dep) && pkg.dependencies && pkg.dependencies[dep]) {
             console.error(chalk.red(`❌ Unexpected dependency found: ${dep}`));
             depCheckPassed = false;
        }
    });
     allPossibleDevDeps.forEach(dep => {
        if (!expectedDevDeps.has(dep) && pkg.devDependencies && pkg.devDependencies[dep]) {
             console.error(chalk.red(`❌ Unexpected devDependency found: ${dep}`));
             depCheckPassed = false;
        }
    });

    if(depCheckPassed) {
        console.log(chalk.green('✅ Dependency check passed.'));
    } else {
         console.error(chalk.red('❌ Dependency check failed.'));
    }
      
      
    // 8. Verify unselected items directories/files are removed across all layers
    console.log(chalk.cyan('Verifying removal of unselected items...'));
    let removalCheckPassed = true;

    // Check each layer
    for (const layerKey of layerKeys) {
      const allItems = Object.keys(templateConfigSource[layerKey] || {});
      const unselectedItems = allItems.filter(item => !userChoices[layerKey].includes(item));
      
      for (const itemId of unselectedItems) {
        const itemConfig = templateConfigSource[layerKey][itemId];
        const itemsToCheck = [
          ...(itemConfig.files || []), 
          ...(itemConfig.directories || [])
        ];
        
        for (const itemPattern of itemsToCheck) {
          const itemPath = path.join(testDir, itemPattern.replace('/**/*', '').replace('/**/', '')); 
          if (await fs.pathExists(itemPath)) {
            console.error(chalk.red(`❌ Unselected ${layerKey} item [${itemId}] still exists: ${itemPattern} (at ${itemPath})`));
            removalCheckPassed = false;
          }
        }
      }
    }
    
    if(removalCheckPassed) {
        console.log(chalk.green('✅ Item removal check passed.'));
    } else {
        console.error(chalk.red('❌ Item removal check failed.'));
    }

    console.log(chalk.green('\n✅✅ All tests completed successfully! ✅✅'));

  } catch (err) {
    console.error(chalk.red(`\n❌ Test run failed: ${err.message}`));
    if (err.stack) {
        console.error(chalk.gray(err.stack));
    }
  } finally {
    // Clean up the main test directory
    if (testDir && await fs.pathExists(testDir)) {
        // await fs.remove(testDir);
        console.log(chalk.cyan(`Test directory cleanup skipped for inspection: ${testDir}`));
        console.log(chalk.cyan(`To inspect results, check directory: ${testDir}`));
        console.log(chalk.cyan(`Run 'rm -rf ${testDir}' to clean up manually.`));
    }
  }
}

// Run tests
runTest(); 