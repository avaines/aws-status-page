/**
 * A template engine for HTML and XML file processing
 * Supports variable substitution and conditional blocks, and was easier than including handlebars or EJS in the lambda
 * Good bit of vibe coding here, it's all the rage these days
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

    // Process loop blocks first (they can contain conditionals)
    processed = this.processLoopBlocks(processed, variables);

    // Process conditional blocks with proper nesting support
    processed = this.processConditionalBlocks(processed, variables);

    // Simple variable substitution: {{variableName}}
    processed = processed.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : '';
    });

    return processed;
  }

  /**
   * Process conditional blocks with proper nesting support using recursive parsing
   * @param {string} template - Template content
   * @param {object} variables - Variables to substitute
   * @returns {string} Processed content
   */
  processConditionalBlocks(template, variables) {
    let processed = template;

    // Keep processing until no more conditional blocks are found
    while (true) {
      const result = this.findAndProcessNextConditional(processed, variables);
      if (result.found) {
        processed = result.processed;
      } else {
        break;
      }
    }

    return processed;
  }

  /**
   * Find and process the next (innermost) conditional block
   * @param {string} template - Template content
   * @param {object} variables - Variables to substitute
   * @returns {object} Result with found flag and processed content
   */
  findAndProcessNextConditional(template, variables) {
    let pos = 0;
    let depth = 0;
    let startPos = -1;
    let condition = '';
    let hasElse = false;
    let elsePos = -1;

    while (pos < template.length) {
      // Look for opening if block
      const ifMatch = template.substring(pos).match(/^\{\{#if\s+(\w+)\}\}/);
      if (ifMatch) {
        if (depth === 0) {
          startPos = pos;
          condition = ifMatch[1];
        }
        depth++;
        pos += ifMatch[0].length;
        continue;
      }

      // Look for else block at current depth
      const elseMatch = template.substring(pos).match(/^\{\{#else\}\}/);
      if (elseMatch && depth === 1) {
        hasElse = true;
        elsePos = pos;
        pos += elseMatch[0].length;
        continue;
      }

      // Look for closing if block
      const endIfMatch = template.substring(pos).match(/^\{\{\/if\}\}/);
      if (endIfMatch) {
        depth--;
        if (depth === 0 && startPos !== -1) {
          // Found a complete conditional block
          const endPos = pos + endIfMatch[0].length;
          const fullBlock = template.substring(startPos, endPos);

          let replacement = '';
          if (hasElse) {
            const ifContent = template.substring(startPos + template.substring(startPos).indexOf('}}') + 2, elsePos);
            const elseContent = template.substring(elsePos + 9, pos); // 9 = length of "{{#else}}"
            replacement = variables[condition] ? ifContent : elseContent;
          } else {
            const content = template.substring(startPos + template.substring(startPos).indexOf('}}') + 2, pos);
            replacement = variables[condition] ? content : '';
          }

          const processed = template.substring(0, startPos) + replacement + template.substring(endPos);
          return { found: true, processed };
        }
        pos += endIfMatch[0].length;
        continue;
      }

      pos++;
    }

    return { found: false, processed: template };
  }

  /**
   * Process loop blocks
   * @param {string} template - Template content
   * @param {object} variables - Variables to substitute
   * @returns {string} Processed content
   */
  processLoopBlocks(template, variables) {
    let processed = template;

    // Process each blocks from innermost to outermost
    while (true) {
      const result = this.findAndProcessNextLoop(processed, variables);
      if (result.found) {
        processed = result.processed;
      } else {
        break;
      }
    }

    return processed;
  }

  /**
   * Find and process the next (innermost) loop block
   * @param {string} template - Template content
   * @param {object} variables - Variables to substitute
   * @returns {object} Result with found flag and processed content
   */
  findAndProcessNextLoop(template, variables) {
    let pos = 0;
    let depth = 0;
    let startPos = -1;
    let arrayName = '';

    while (pos < template.length) {
      // Look for opening each block
      const eachMatch = template.substring(pos).match(/^\{\{#each\s+(\w+)\}\}/);
      if (eachMatch) {
        if (depth === 0) {
          startPos = pos;
          arrayName = eachMatch[1];
        }
        depth++;
        pos += eachMatch[0].length;
        continue;
      }

      // Look for closing each block
      const endEachMatch = template.substring(pos).match(/^\{\{\/each\}\}/);
      if (endEachMatch) {
        depth--;
        if (depth === 0 && startPos !== -1) {
          // Found a complete loop block
          const endPos = pos + endEachMatch[0].length;
          const itemTemplate = template.substring(startPos + template.substring(startPos).indexOf('}}') + 2, pos);

          const array = variables[arrayName];
          let replacement = '';

          if (Array.isArray(array)) {
            replacement = array.map(item => {
              return this.processTemplate(itemTemplate, { ...variables, ...item, item });
            }).join('');
          }

          const processed = template.substring(0, startPos) + replacement + template.substring(endPos);
          return { found: true, processed };
        }
        pos += endEachMatch[0].length;
        continue;
      }

      pos++;
    }

    return { found: false, processed: template };
  }

  /**
   * Clear template cache (for dev use)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = TemplateEngine;