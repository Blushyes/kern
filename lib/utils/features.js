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
 * Apply template configuration based on user choices
 * @param {string} projectDir - Project directory path
 * @param {Object} userChoices - User choices
 * @returns {Promise<void>}
 */
export async function applyTemplateConfig(projectDir, userChoices) {
  // Load template configuration
  const templateConfig = await loadTemplateConfig(projectDir);
  
  // Get template type
  const templateType = templateConfig.templateType || 'generic';
  console.log(chalk.blue(`Applying ${templateConfig.templateName || 'template'} configuration...`));
  
  // Process module selections
  if (userChoices.modules && templateConfig.modules) {
    await processModuleSelections(projectDir, userChoices.modules, templateConfig);
  }
  
  // Process feature selections
  if (userChoices.features && templateConfig.features) {
    await processFeatureSelections(projectDir, templateConfig, userChoices.features);
  }
  
  // Update dependencies
  await updateDependencies(projectDir, templateConfig, userChoices);
  
  // Process specific configuration based on template type
  switch(templateType) {
    case 'chrome-extension':
      await processChromeExtensionConfig(projectDir, templateConfig, userChoices);
      break;
    case 'vue':
      await processVueConfig(projectDir, templateConfig, userChoices);
      break;
    case 'react':
      await processReactConfig(projectDir, templateConfig, userChoices);
      break;
    case 'node':
      await processNodeConfig(projectDir, templateConfig, userChoices);
      break;
  }
  
  // Process code patterns
  await processCodePatterns(projectDir, templateConfig, userChoices);
  
  console.log(chalk.green('✔ All template configuration applied'));
}

/**
 * Process user selected modules
 * @param {string} projectDir - Project directory
 * @param {Array<string>} selectedModules - User selected modules
 * @param {Object} templateConfig - Template configuration
 * @returns {Promise<void>}
 */
export async function processModuleSelections(projectDir, selectedModules, templateConfig) {
  console.log(chalk.blue('Processing module selection...'));
  console.log(chalk.gray(`Selected modules: [${selectedModules.join(', ')}]`));

  if (!templateConfig.modules) {
    console.log(chalk.yellow('Warning: Template configuration does not define modules section'));
    return;
  }

  // Process module files
  for (const [moduleId, moduleConfig] of Object.entries(templateConfig.modules)) {
    if (!selectedModules.includes(moduleId)) {
      console.log(chalk.gray(`Processing unselected module: ${moduleId}`));
      
      // Remove files associated with unselected modules
      if (moduleConfig.files && moduleConfig.files.length > 0) {
        for (const file of moduleConfig.files) {
          const filePath = path.join(projectDir, file);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            console.log(chalk.gray(`Deleted file: ${file}`));
          } else {
            console.log(chalk.gray(`File does not exist, skipping: ${file}`));
          }
        }
      }
      
      // Remove directories associated with unselected modules
      if (moduleConfig.directories && moduleConfig.directories.length > 0) {
        for (const dir of moduleConfig.directories) {
          const dirPath = path.join(projectDir, dir);
          if (await fs.pathExists(dirPath)) {
            await fs.remove(dirPath);
            console.log(chalk.gray(`Deleted directory: ${dir}`));
          } else {
            console.log(chalk.gray(`Directory does not exist, skipping: ${dir}`));
          }
        }
      }
      
      // Handle manifest keys for Chrome extensions
      if (templateConfig.templateType === 'chrome-extension' && moduleConfig.manifestKeys) {
        await updateManifest(projectDir, moduleConfig.manifestKeys, false);
      }
    }
  }
  
  console.log(chalk.green('✔ Module processing completed'));
}

/**
 * Process feature selections
 * @param {string} projectDir - Project directory path
 * @param {Object} templateConfig - Template configuration
 * @param {Array<string>} selectedFeatures - Selected features
 * @returns {Promise<void>}
 */
async function processFeatureSelections(projectDir, templateConfig, selectedFeatures) {
  console.log(chalk.blue('Processing feature selection...'));
  console.log(chalk.gray(`Selected features: [${selectedFeatures.join(', ')}]`));
  
  for (const [featureId, featureData] of Object.entries(templateConfig.features)) {
    // Check if this feature is selected
    if (!selectedFeatures.includes(featureId)) {
      console.log(chalk.yellow(`Removing feature: ${featureData.name}`));
      
      // Remove related files
      if (featureData.files && featureData.files.length > 0) {
        for (const filePattern of featureData.files) {
          await removeFiles(projectDir, filePattern);
        }
      }
    }
  }
  
  console.log(chalk.green('✔ Feature processing completed'));
}

/**
 * Remove files by pattern
 * @param {string} projectDir - Project directory path
 * @param {string} filePattern - File pattern to match
 * @returns {Promise<void>}
 */
async function removeFiles(projectDir, filePattern) {
  try {
    // Support wildcard patterns
    if (filePattern.endsWith('/**/*')) {
      const dirPath = path.join(projectDir, filePattern.replace('/**/*', ''));
      console.log(chalk.gray(`Attempting to remove directory: ${dirPath}`));
      if (await fs.pathExists(dirPath)) {
        await fs.remove(dirPath);
        console.log(chalk.gray(`Removed directory: ${dirPath}`));
      } else {
        console.log(chalk.yellow(`Directory does not exist: ${dirPath}`));
      }
    } else {
      const filePath = path.join(projectDir, filePattern);
      console.log(chalk.gray(`Attempting to remove file: ${filePath}`));
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.log(chalk.gray(`Removed file: ${filePath}`));
      } else {
        console.log(chalk.yellow(`File does not exist: ${filePath}`));
      }
    }
  } catch (err) {
    console.warn(chalk.yellow(`Error removing ${filePattern}: ${err.message}`));
  }
}

/**
 * Update package dependencies based on user selections
 * @param {string} projectDir - Project directory path
 * @param {Object} templateConfig - Template configuration
 * @param {Object} userChoices - User selections
 * @returns {Promise<void>}
 */
async function updateDependencies(projectDir, templateConfig, userChoices) {
  console.log(chalk.blue('Updating package dependencies...'));
  const pkgPath = path.join(projectDir, 'package.json');
  
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJson(pkgPath);
      
      // Get all required dependencies
      const requiredDeps = new Map();
      const requiredDevDeps = new Map();
      
      // Add core dependencies that should always be included
      const coreDeps = ['vue', 'vue-router', 'webextension-polyfill'];
      const coreDevDeps = [
        '@vitejs/plugin-vue',
        '@crxjs/vite-plugin',
        'vite',
        'typescript',
        'eslint',
        'eslint-plugin-vue',
        'tailwindcss',
        'postcss'
      ];
      
      // Add core dependencies
      for (const dep of coreDeps) {
        if (pkg.dependencies && pkg.dependencies[dep]) {
          requiredDeps.set(dep, pkg.dependencies[dep]);
        }
      }
      
      for (const dep of coreDevDeps) {
        if (pkg.devDependencies && pkg.devDependencies[dep]) {
          requiredDevDeps.set(dep, pkg.devDependencies[dep]);
        }
      }
      
      // Process selected module dependencies
      if (userChoices.modules) {
        const modules = templateConfig.modules || {};
        
        for (const moduleId of userChoices.modules) {
          const moduleConfig = modules[moduleId];
          if (moduleConfig && moduleConfig.dependencies) {
            for (const dep of moduleConfig.dependencies) {
              if (dep.dev) {
                requiredDevDeps.set(dep.name, dep.version || (pkg.devDependencies?.[dep.name] || 'latest'));
              } else {
                requiredDeps.set(dep.name, dep.version || (pkg.dependencies?.[dep.name] || 'latest'));
              }
            }
          }
        }
      }
      
      // Process selected feature dependencies
      if (userChoices.features) {
        for (const featureId of userChoices.features) {
          const featureData = templateConfig.features[featureId];
          if (featureData && featureData.dependencies) {
            for (const dep of featureData.dependencies) {
              if (dep.dev) {
                requiredDevDeps.set(dep.name, dep.version || (pkg.devDependencies?.[dep.name] || 'latest'));
              } else {
                requiredDeps.set(dep.name, dep.version || (pkg.dependencies?.[dep.name] || 'latest'));
              }
            }
          }
        }
      }
      
      // Handle specific features
      if (pkg.dependencies) {
        // i18n related dependencies
        if (!userChoices.features.includes('i18n')) {
          console.log(chalk.gray('Removing i18n dependencies...'));
          if (pkg.dependencies['vue-i18n']) {
            console.log(chalk.gray('- Removed vue-i18n'));
          }
          if (pkg.devDependencies && pkg.devDependencies['@intlify/unplugin-vue-i18n']) {
            console.log(chalk.gray('- Removed @intlify/unplugin-vue-i18n'));
          }
        }
        
        // Pinia store
        if (!userChoices.features.includes('pinia')) {
          console.log(chalk.gray('Removing pinia dependencies...'));
          if (pkg.dependencies['pinia']) {
            console.log(chalk.gray('- Removed pinia'));
          }
        }
        
        // Notivue notifications
        if (!userChoices.features.includes('notivue')) {
          console.log(chalk.gray('Removing notivue dependencies...'));
          if (pkg.dependencies['notivue']) {
            console.log(chalk.gray('- Removed notivue'));
          }
        }
        
        // File routing
        if (!userChoices.features.includes('fileRouting')) {
          console.log(chalk.gray('Removing file routing dependencies...'));
          if (pkg.devDependencies && pkg.devDependencies['unplugin-vue-router']) {
            console.log(chalk.gray('- Removed unplugin-vue-router'));
          }
        }
      }
      
      // Update package.json with only required dependencies
      pkg.dependencies = Object.fromEntries(requiredDeps);
      pkg.devDependencies = Object.fromEntries(requiredDevDeps);
      
      await fs.writeJson(pkgPath, pkg, { spaces: 2 });
      console.log(chalk.green('✔ Dependencies updated'));
      
    } catch (err) {
      console.warn(chalk.yellow(`Error updating dependencies: ${err.message}`));
    }
  } else {
    console.warn(chalk.yellow('package.json not found, skipping dependency updates'));
  }
}

/**
 * 处理Chrome扩展配置
 * @param {string} projectDir - 项目目录路径
 * @param {Object} templateConfig - 模板配置
 * @param {Object} userChoices - 用户选择
 * @returns {Promise<void>}
 */
async function processChromeExtensionConfig(projectDir, templateConfig, userChoices) {
  // 检查模块选择
  if (userChoices.modules) {
    console.log(chalk.blue('处理Chrome扩展特定配置...'));
    
    // 其他特定处理...
  }
}

/**
 * 处理Vue项目配置
 * @param {string} projectDir - 项目目录路径
 * @param {Object} templateConfig - 模板配置
 * @param {Object} userChoices - 用户选择
 * @returns {Promise<void>}
 */
async function processVueConfig(projectDir, templateConfig, userChoices) {
  // 检查模块选择
  if (userChoices.modules) {
    console.log(chalk.blue('处理Vue项目特定配置...'));
    
    // 其他特定处理...
  }
}

/**
 * 处理React项目配置
 * @param {string} projectDir - 项目目录路径
 * @param {Object} templateConfig - 模板配置
 * @param {Object} userChoices - 用户选择
 * @returns {Promise<void>}
 */
async function processReactConfig(projectDir, templateConfig, userChoices) {
  // 检查模块选择
  if (userChoices.modules) {
    console.log(chalk.blue('处理React项目特定配置...'));
    
    // 其他特定处理...
  }
}

/**
 * 处理Node.js项目配置
 * @param {string} projectDir - 项目目录路径
 * @param {Object} templateConfig - 模板配置
 * @param {Object} userChoices - 用户选择
 * @returns {Promise<void>}
 */
async function processNodeConfig(projectDir, templateConfig, userChoices) {
  // 检查模块选择
  if (userChoices.modules) {
    console.log(chalk.blue('处理Node.js项目特定配置...'));
    
    // 其他特定处理...
  }
}

/**
 * 更新manifest文件
 * @param {string} projectDir - 项目目录路径
 * @param {Array<string>} keys - 要删除或保留的键
 * @param {boolean} keep - 是保留(true)还是删除(false)
 * @returns {Promise<void>}
 */
async function updateManifest(projectDir, keys, keep = false) {
  // 尝试不同的manifest文件名
  const manifestPaths = [
    path.join(projectDir, 'manifest.config.ts'),
    path.join(projectDir, 'manifest.json')
  ];
  
  for (const manifestPath of manifestPaths) {
    if (await fs.pathExists(manifestPath)) {
      try {
        if (manifestPath.endsWith('.json')) {
          // 处理JSON格式的manifest
          const manifest = await fs.readJson(manifestPath);
          
          for (const key of keys) {
            if (!keep && manifest[key]) {
              delete manifest[key];
            }
          }
          
          await fs.writeJson(manifestPath, manifest, { spaces: 2 });
        } else {
          // 处理TypeScript格式的manifest
          let content = await fs.readFile(manifestPath, 'utf8');
          
          for (const key of keys) {
            // 根据页面是否被选中，移除或保留manifest中的配置
            const regex = new RegExp(`${key}\\s*:\\s*{[^}]*},?`, 'g');
            if (!keep) {
              content = content.replace(regex, '');
            }
          }
          
          await fs.writeFile(manifestPath, content, 'utf8');
        }
        
        console.log(chalk.green(`✔ 已更新 ${path.basename(manifestPath)}`));
        break; // 找到并处理一个manifest后就退出
      } catch (err) {
        console.warn(chalk.yellow(`更新 ${manifestPath} 时出错: ${err.message}`));
      }
    }
  }
}

/**
 * 处理代码模式
 * @param {string} projectDir - 项目目录路径 
 * @param {Object} templateConfig - 模板配置
 * @param {Object} userChoices - 用户选择
 * @returns {Promise<void>}
 */
async function processCodePatterns(projectDir, templateConfig, userChoices) {
  if (!userChoices.features || !templateConfig.features) return;
  
  // 获取所有未选中的功能
  const unselectedFeatures = Object.keys(templateConfig.features)
    .filter(id => !userChoices.features.includes(id));
  
  // 对于每个未选中的功能，处理其代码模式
  for (const featureId of unselectedFeatures) {
    const featureData = templateConfig.features[featureId];
    if (featureData.codePatterns && featureData.codePatterns.length > 0) {
      for (const pattern of featureData.codePatterns) {
        await processCodePattern(projectDir, pattern);
      }
    }
  }
}

/**
 * 处理单个代码模式
 * @param {string} projectDir - 项目目录路径
 * @param {Object} pattern - 代码模式
 * @returns {Promise<void>}
 */
async function processCodePattern(projectDir, pattern) {
  // Support wildcard paths
  const globby = (await import('globby')).globby;
  const filePaths = await globby(pattern.file, { cwd: projectDir });
  
  for (const filePath of filePaths) {
    const fullPath = path.join(projectDir, filePath);
    
    if (await fs.pathExists(fullPath)) {
      try {
        let content = await fs.readFile(fullPath, 'utf8');
        const regex = new RegExp(pattern.pattern, 'g');
        
        // Keep or remove matching code based on action type
        if (pattern.action === 'keep') {
          // If the action is 'keep', we need to remove features that weren't selected
          content = content.replace(regex, '');
        }
        
        await fs.writeFile(fullPath, content, 'utf8');
        console.log(chalk.gray(`Processed code pattern in: ${filePath}`));
      } catch (err) {
        console.warn(chalk.yellow(`Error processing file ${filePath}: ${err.message}`));
      }
    }
  }
} 