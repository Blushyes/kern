import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Load the template configuration file from the project directory
 * @param {string} projectDir - Project directory path
 * @returns {Promise<Object>} Template configuration object
 * @throws {Error} If template.config.json is not found
 */
export async function loadTemplateConfig(projectDir) {
  try {
    const configPath = path.join(projectDir, 'template.config.json');

    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      console.log(chalk.green('✔ Template configuration loaded successfully.'));
      return config;
    } else {
      // Throw an error if the configuration file is not found
      throw new Error(
        `Configuration file 'template.config.json' not found in the template repository at ${projectDir}. Please ensure the template includes this file.`
      );
    }
  } catch (err) {
    // Log the specific error and re-throw to halt execution
    console.error(chalk.red(`Error loading or validating template configuration: ${err.message}`));
    throw err;
  }
}

/**
 * Apply template configuration based on user choices across multiple layers.
 * @param {string} projectDir - Project directory path
 * @param {Object} userSelections - User choices per layer (e.g., { pages: ['popup'], features: ['pinia'] }).
 * @param {Object} templateConfig - The pre-loaded template configuration object.
 * @returns {Promise<void>}
 */
export async function applyTemplateConfig(projectDir, userSelections, templateConfig) {
  console.log(chalk.blue(`\nApplying template configuration based on selections...`));

  // --- 1. Process removals based on unselected items per layer --- 
  console.log(chalk.cyan('Processing removals for unselected items...'));
  for (const layerKey in templateConfig) {
    // Ensure the key represents a configurable layer (an object)
    if (typeof templateConfig[layerKey] === 'object' && templateConfig[layerKey] !== null && !Array.isArray(templateConfig[layerKey])) {
      const layerItems = templateConfig[layerKey];
      const selectedInLayer = userSelections[layerKey] || []; // Get user selections for this layer

      console.log(chalk.gray(`Processing layer: ${layerKey}, Selected: [${selectedInLayer.join(', ')}]`));

      for (const [itemId, itemConfig] of Object.entries(layerItems)) {
        if (!selectedInLayer.includes(itemId)) {
          console.log(chalk.gray(`  Item '${itemConfig.name || itemId}' in layer '${layerKey}' was not selected. Processing removals...`));

          // Remove associated files
          if (itemConfig.files && itemConfig.files.length > 0) {
            for (const filePattern of itemConfig.files) {
              await removeFiles(projectDir, filePattern);
            }
          }
          // Remove associated directories
          if (itemConfig.directories && itemConfig.directories.length > 0) {
            for (const dirPattern of itemConfig.directories) {
              // Assuming removeFiles handles directory patterns like 'src/locales/**/*' correctly
              await removeFiles(projectDir, dirPattern);
            }
          }
          // Update manifest (if applicable)
          if (itemConfig.manifestKeys && templateConfig.templateType === 'chrome-extension') {
            await updateManifest(projectDir, itemConfig.manifestKeys, false); // false = remove
          }
          // Process code patterns for removal (if applicable)
          if (itemConfig.codePatterns && itemConfig.codePatterns.length > 0) {
            for (const pattern of itemConfig.codePatterns) {
              // Assuming processCodePattern correctly handles removing code associated with unselected features
              await processCodePattern(projectDir, pattern);
            }
          }
        }
      }
    }
  }
  console.log(chalk.green('✔ Removals processed.'));

  // --- 2. Update dependencies based on ALL selected items across layers --- 
  await updateDependencies(projectDir, templateConfig, userSelections);

  // --- 3. Process specific configurations based on template type (optional) --- 
  const templateType = templateConfig.templateType || 'generic';
  console.log(chalk.cyan(`Processing type-specific configuration for: ${templateType}`));
  switch (templateType) {
    case 'chrome-extension':
      await processChromeExtensionConfig(projectDir, templateConfig, userSelections);
      break;
    // Add other cases (vue, react, node) if needed, 
    // they might need access to userSelections and templateConfig
    default:
      console.log(chalk.gray(`No specific processing needed for template type: ${templateType}`));
      break;
  }

  console.log(chalk.green('\n✔ All template configuration applied successfully!'));
}

/**
 * Remove files or directories by pattern.
 * Handles specific files and directory patterns.
 * Example patterns: "src/locales", "src/components/MyComp.vue", "src/assets"
 * @param {string} projectDir - Project directory path
 * @param {string} itemPattern - File or directory pattern to remove
 * @returns {Promise<void>}
 */
async function removeFiles(projectDir, itemPattern) {
  // Normalize pattern: remove trailing slashes and /**/* patterns for path.join
  // Treat /**/* or /**/ at the end as targeting the directory itself for removal.
  const isDirectoryPattern = itemPattern.endsWith('/**/') || itemPattern.endsWith('/**/*');
  const normalizedPattern = itemPattern.replace('/**/*', '').replace('/**/', '');
  const fullPath = path.join(projectDir, normalizedPattern);
  console.log(chalk.gray(`  Removing ${fullPath}`));

  try {
    if (await fs.pathExists(fullPath)) {
      const stats = await fs.lstat(fullPath);
      if (stats.isDirectory()) {
        // It's a directory, remove it.
        console.log(chalk.gray(`  Attempting to remove directory: ${fullPath}`));
        await fs.remove(fullPath);
        console.log(chalk.gray(`    Removed directory: ${fullPath}`));
      } else if (stats.isFile() && !isDirectoryPattern) {
        // It's a file and the pattern didn't explicitly target a directory.
        console.log(chalk.gray(`  Attempting to remove file: ${fullPath}`));
        await fs.remove(fullPath);
        console.log(chalk.gray(`    Removed file: ${fullPath}`));
      } else {
        // Exists but is not what we expected or should not be removed based on pattern type.
        console.log(chalk.yellow(`  Item exists but type mismatch or ambiguous pattern, skipping removal: ${fullPath} (Pattern: ${itemPattern})`));
      }
    } else {
      // Path does not exist
      console.log(chalk.yellow(`  Item not found, skipping removal: ${itemPattern} (at ${fullPath})`));
    }
  } catch (err) {
    console.warn(chalk.yellow(`  Error removing ${itemPattern}: ${err.message}`));
  }
}

/**
 * Update package dependencies based on all selected items across layers.
 * @param {string} projectDir - Project directory path
 * @param {Object} templateConfig - The template configuration object.
 * @param {Object} userSelections - User selections per layer (e.g., { pages: ['popup'], features: ['pinia'] }).
 * @returns {Promise<void>}
 */
async function updateDependencies(projectDir, templateConfig, userSelections) {
  console.log(chalk.cyan('Updating package dependencies based on selections...'));
  const pkgPath = path.join(projectDir, 'package.json');

  if (!await fs.pathExists(pkgPath)) {
    console.warn(chalk.yellow('package.json not found, skipping dependency updates.'));
    return;
  }

  try {
    const pkg = await fs.readJson(pkgPath);
    
    // Ensure dependencies objects exist
    if (!pkg.dependencies) pkg.dependencies = {};
    if (!pkg.devDependencies) pkg.devDependencies = {};
    
    // Get all required dependencies based on selected items
    const requiredDeps = new Set();
    const requiredDevDeps = new Set();
    
    // Define core dependencies (adjust as needed, could also be in config)
    // These will always be kept regardless of selections
    const coreDeps = ['vue', 'vue-router', 'webextension-polyfill'];
    const coreDevDeps = ['vite', '@vitejs/plugin-vue', '@crxjs/vite-plugin', 'typescript'];
    
    // Add core deps to required sets
    coreDeps.forEach(dep => requiredDeps.add(dep));
    coreDevDeps.forEach(dep => requiredDevDeps.add(dep));

    // Collect required dependencies from selected items
    for (const layerKey in userSelections) {
      const selectedItems = userSelections[layerKey] || [];
      const layerConfig = templateConfig[layerKey]; // Get config for this layer

      if (!layerConfig) continue; // Skip if layer doesn't exist in config

      // Add dependencies for selected items in this layer
      for (const itemId of selectedItems) {
        const itemConfig = layerConfig[itemId];
        if (itemConfig && itemConfig.dependencies) {
          for (const dep of itemConfig.dependencies) {
            if (dep.dev) {
              requiredDevDeps.add(dep.name);
            } else {
              requiredDeps.add(dep.name);
            }
          }
        }
      }
    }
    
    // Identify all dependencies that could be in the template
    const allPossibleDeps = new Set();
    const allPossibleDevDeps = new Set();
    
    // Iterate through all layers to find all possible dependencies
    for (const layerKey in templateConfig) {
      // Skip non-layer properties
      if (
        typeof templateConfig[layerKey] !== 'object' || 
        templateConfig[layerKey] === null || 
        Array.isArray(templateConfig[layerKey]) ||
        ['templateType', 'templateName', 'templateDescription', 'templateAuthor', 'version'].includes(layerKey)
      ) {
        continue;
      }
      
      const layerItems = templateConfig[layerKey];
      for (const itemId in layerItems) {
        const itemConfig = layerItems[itemId];
        if (itemConfig && itemConfig.dependencies) {
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
    
    // Remove unneeded template-specific dependencies
    console.log(chalk.gray('  Checking for dependencies to remove...'));
    for (const dep of allPossibleDeps) {
      if (!requiredDeps.has(dep) && pkg.dependencies[dep]) {
        console.log(chalk.gray(`    - Removing dependency: ${dep}`));
        delete pkg.dependencies[dep];
      }
    }
    
    for (const dep of allPossibleDevDeps) {
      if (!requiredDevDeps.has(dep) && pkg.devDependencies[dep]) {
        console.log(chalk.gray(`    - Removing devDependency: ${dep}`));
        delete pkg.devDependencies[dep];
      }
    }
    
    // Make sure required dependencies have correct versions
    for (const layerKey in userSelections) {
      const selectedItems = userSelections[layerKey] || [];
      const layerConfig = templateConfig[layerKey];
      
      if (!layerConfig) continue;
      
      for (const itemId of selectedItems) {
        const itemConfig = layerConfig[itemId];
        if (itemConfig && itemConfig.dependencies) {
          for (const dep of itemConfig.dependencies) {
            if (dep.version) { // Only update if explicit version specified
              if (dep.dev) {
                pkg.devDependencies[dep.name] = dep.version;
              } else {
                pkg.dependencies[dep.name] = dep.version;
              }
            }
          }
        }
      }
    }

    await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    console.log(chalk.green('✔ Dependencies updated successfully.'));

  } catch (err) {
    console.warn(chalk.yellow(`Error updating dependencies: ${err.message}`));
  }
}

/**
 * Process Chrome Extension specific configurations.
 * (This function might need adjustments based on how config is structured)
 */
async function processChromeExtensionConfig(projectDir, templateConfig, userSelections) {
  console.log(chalk.gray('Processing Chrome Extension specific configurations (if any)...'));
  // Example: Maybe check for a specific layer like 'chromeSettings' in userSelections
  // Or iterate through all selected items and check for chrome-specific keys
}

/**
 * Update manifest file (JSON or TS)
 */
async function updateManifest(projectDir, keys, keep = false) {
  // Try different manifest filenames
  const manifestPaths = [
    path.join(projectDir, 'manifest.config.ts'),
    path.join(projectDir, 'manifest.json')
  ];

  console.log(chalk.gray(`  Updating manifest: ${keep ? 'Keeping' : 'Removing'} keys [${keys.join(', ')}]`));

  for (const manifestPath of manifestPaths) {
    if (await fs.pathExists(manifestPath)) {
      try {
        if (manifestPath.endsWith('.json')) {
          // Handle JSON manifest
          const manifest = await fs.readJson(manifestPath);

          for (const key of keys) {
            if (!keep && manifest[key]) {
              console.log(chalk.gray(`    - Removing key '${key}' from ${path.basename(manifestPath)}`));
              delete manifest[key];
            }
          }

          await fs.writeJson(manifestPath, manifest, { spaces: 2 });
        } else {
          // Handle TypeScript manifest (using string replacement)
          let content = await fs.readFile(manifestPath, 'utf8');
          let changed = false;
          for (const key of keys) {
            // More powerful regex that can match configuration items and their commas before and after
            // Matching three situations: 1. Items at the beginning 2. Middle items (comma before) 3. Middle items (comma after)
            const leadingCommaRegex = new RegExp(`(,\\s*)(${key}\\s*:\\s*([^,}]*?({[^{}]*(?:\\{[^{}]*\\}[^{}]*)*})|\\[[^\\[\\]]*(?:\\[[^\\[\\]]*\\][^\\[\\]]*)*\\]|"[^"]*"|'[^']*'|[^,}\\]\\r\\n]*))(?=\\s*[,}]|\\s*$|\\r?\\n)`, 'gms');
            const trailingCommaRegex = new RegExp(`(${key}\\s*:\\s*([^,}]*?({[^{}]*(?:\\{[^{}]*\\}[^{}]*)*})|\\[[^\\[\\]]*(?:\\[[^\\[\\]]*\\][^\\[\\]]*)*\\]|"[^"]*"|'[^']*'|[^,}\\]\\r\\n]*))(?=\\s*,)`, 'gms');
            const standardRegex = new RegExp(`(${key}\\s*:\\s*([^,}]*?({[^{}]*(?:\\{[^{}]*\\}[^{}]*)*})|\\[[^\\[\\]]*(?:\\[[^\\[\\]]*\\][^\\[\\]]*)*\\]|"[^"]*"|'[^']*'|[^,}\\]\\r\\n]*))(?=\\s*[}]|\\s*$|\\r?\\n)`, 'gms');
            
            if (!keep) {
              // First try to match and remove cases with leading comma
              if (content.match(leadingCommaRegex)) {
                console.log(chalk.gray(`    - Removing block with leading comma for key '${key}' from ${path.basename(manifestPath)}`));
                content = content.replace(leadingCommaRegex, '');
                changed = true;
              } 
              // Then try to match and remove cases with trailing comma
              else if (content.match(trailingCommaRegex)) {
                console.log(chalk.gray(`    - Removing block with trailing comma for key '${key}' from ${path.basename(manifestPath)}`));
                content = content.replace(trailingCommaRegex, '');
                changed = true;
              }
              // Finally try standard cases
              else if (content.match(standardRegex)) {
                console.log(chalk.gray(`    - Removing standard block for key '${key}' from ${path.basename(manifestPath)}`));
                content = content.replace(standardRegex, '');
                changed = true;
              }
              
              // Clean up standalone commas in the file
              const cleanupRegex = /,(\s*,|\s*\}|\s*\])/g;
              if (content.match(cleanupRegex)) {
                content = content.replace(cleanupRegex, '$1');
              }
            }
          }
          if (changed) {
            await fs.writeFile(manifestPath, content, 'utf8');
          }
        }

        console.log(chalk.green(`  ✔ Successfully updated ${path.basename(manifestPath)}`));
        return; // Exit after successfully processing one manifest file
      } catch (err) {
        console.warn(chalk.yellow(`  ⚠️ Error updating ${manifestPath}: ${err.message}`));
      }
    }
  }
  console.log(chalk.gray(`  No manifest file found or updated.`));
}

/**
 * Process code patterns for removal when an item is unselected.
 */
async function processCodePatterns(projectDir, templateConfig, userSelections) {
  // This function as originally written processes patterns for UNSELECTED features.
  // The removal logic is now handled within the main applyTemplateConfig loop.
  // We might need a different function or logic if we need to ADD code for SELECTED items.
  // For now, let's assume the main loop handles removal correctly and comment this out or remove.
  console.log(chalk.gray('Skipping standalone processCodePatterns (logic integrated into main loop).'));
}

/**
 * Process a single code pattern (likely for removal).
 */
async function processCodePattern(projectDir, pattern) {
  // Support wildcard paths
  console.log(chalk.gray(`  Processing code pattern: Action='${pattern.action || 'remove'}', Pattern='${pattern.pattern}', Files='${pattern.file}'`));
  try {
    const globby = (await import('globby')).globby;
    // Log the CWD and pattern being used
    console.log(chalk.gray(`    Globby search CWD: ${projectDir}`));
    console.log(chalk.gray(`    Globby search pattern: ${pattern.file}`));

    const filePaths = await globby(pattern.file, {
      cwd: projectDir,
      gitignore: true, // Respect .gitignore
      absolute: false, // Get relative paths from cwd
      onlyFiles: true // We only want to process files
    });

    console.log(chalk.gray(`    Globby found ${filePaths.length} file(s): [${filePaths.join(', ')}]`));

    let processedCount = 0;
    for (const relativeFilePath of filePaths) { // Use relative path from globby
      const fullPath = path.join(projectDir, relativeFilePath);

      // Double check existence, although globby should only return existing files
      if (await fs.pathExists(fullPath)) {
        try {
          let content = await fs.readFile(fullPath, 'utf8');
          const regex = new RegExp(pattern.pattern, 'g'); // Assume global replacement

          // Current logic only supports removal (implied by action='keep' in the UNSELECTED item)
          // If action is keep, we remove the matched pattern when the feature IS NOT selected.
          if (pattern.action === 'keep') {
            if (content.match(regex)) {
              console.log(chalk.gray(`    - Applying REMOVAL pattern to ${relativeFilePath}`));
              content = content.replace(regex, '');
              await fs.writeFile(fullPath, content, 'utf8');
              processedCount++;
            } else {
              // console.log(chalk.gray(`    - Pattern not found in ${relativeFilePath}, skipping.`));
            }
          } else {
            console.log(chalk.gray(`    - Action '${pattern.action}' not implemented for code patterns yet, skipping.`));
          }
        } catch (err) {
          console.warn(chalk.yellow(`    ⚠️ Error processing file ${relativeFilePath}: ${err.message}`));
        }
      }
    }
    if (processedCount > 0) {
      console.log(chalk.gray(`    Processed ${processedCount} file(s) for this pattern.`));
    }

  } catch (err) {
    console.warn(chalk.yellow(`  ⚠️ Error during globby search or processing for pattern '${pattern.file}': ${err.message}`));
  }
}

// --- Functions for other template types (Vue, React, Node) --- 
// --- Ensure they are compatible if kept --- 
async function processVueConfig(projectDir, templateConfig, userSelections) { /* ... */ }
async function processReactConfig(projectDir, templateConfig, userSelections) { /* ... */ }
async function processNodeConfig(projectDir, templateConfig, userSelections) { /* ... */ } 