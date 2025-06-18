/**
 * Simple template engine for HTML and XML file processing
 * Supports variable substitution and conditional blocks, and was easier than including handlebars or EJS in the lambda
 */

const fs = require('fs');
const path = require('path');

class TemplateEngine {
  constructor(templateDir = path.join(__dirname, '../templates')) {
    this.templateDir = templateDir;
    this.cache = new Map();
  }

  /**
   * Load and process a template file
   * @param {string} templateName - Name of the template file (with extension)
   * @param {object} variables - Variables to substitute in the template
   * @returns {string} Processed template content
   */
  render(templateName, variables = {}) {
    // Determine file extension if not provided
    let templateFile = templateName;
    if (!templateName.includes('.')) {
      // Try common extensions
      const extensions = ['.html', '.xml', '.txt'];
      for (const ext of extensions) {
        const testPath = path.join(this.templateDir, `${templateName}${ext}`);
        if (fs.existsSync(testPath)) {
          templateFile = `${templateName}${ext}`;
          break;
        }
      }
    }

    const templatePath = path.join(this.templateDir, templateFile);
    
    // Load template (with caching in production)
    let template;
    if (process.env.NODE_ENV === 'production' && this.cache.has(templateFile)) {
      template = this.cache.get(templateFile);
    } else {
      try {
        template = fs.readFileSync(templatePath, 'utf8');
        if (process.env.NODE_ENV === 'production') {
          this.cache.set(templateFile, template);
        }
      } catch (error) {
        throw new Error(`Template file not found: ${templatePath}`);
      }
    }

    // Process template with variables
    return this.processTemplate(template, variables);
  }

  /**
   * Process template string with variable substitution
   * @param {string} template - Template content
   * @param {object} variables - Variables to substitute
   * @returns {string} Processed content
   */
  processTemplate(template, variables) {
    let processed = template;

    // Simple variable substitution: {{variableName}}
    processed = processed.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });

    // Conditional blocks: {{#if condition}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return variables[condition] ? content : '';
    });

    // Conditional blocks with else: {{#if condition}}...{{#else}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, ifContent, elseContent) => {
      return variables[condition] ? ifContent : elseContent;
    });

    // Loop blocks: {{#each arrayName}}...{{/each}}
    processed = processed.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, itemTemplate) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        return this.processTemplate(itemTemplate, { ...variables, ...item, item });
      }).join('');
    });

    return processed;
  }

  /**
   * Clear template cache (for dev use)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = TemplateEngine;