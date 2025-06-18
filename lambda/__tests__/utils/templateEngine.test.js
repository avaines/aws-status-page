const TemplateEngine = require('../../src/utils/templateEngine');
const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

describe('TemplateEngine', () => {
  let templateEngine;
  const mockTemplateDir = '/mock/templates';

  beforeEach(() => {
    templateEngine = new TemplateEngine(mockTemplateDir);
    templateEngine.clearCache();
    jest.clearAllMocks();
  });

  describe('Variable Substitution', () => {
    test('should substitute simple variables', () => {
      const template = '<h1>{{title}}</h1><p>{{content}}</p>';
      const variables = { title: 'Test Title', content: 'Test Content' };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('<h1>Test Title</h1><p>Test Content</p>');
    });

    test('should leave unmatched variables unchanged', () => {
      const template = '<h1>{{title}}</h1><p>{{missing}}</p>';
      const variables = { title: 'Test Title' };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('<h1>Test Title</h1><p>{{missing}}</p>');
    });

    test('should handle empty variables object', () => {
      const template = '<h1>{{title}}</h1>';
      
      const result = templateEngine.processTemplate(template, {});
      
      expect(result).toBe('<h1>{{title}}</h1>');
    });
  });

  describe('Conditional Blocks', () => {
    test('should render if block when condition is truthy', () => {
      const template = '{{#if showContent}}<p>Visible content</p>{{/if}}';
      const variables = { showContent: true };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('<p>Visible content</p>');
    });

    test('should not render if block when condition is falsy', () => {
      const template = '{{#if showContent}}<p>Hidden content</p>{{/if}}';
      const variables = { showContent: false };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('');
    });

    test('should handle if-else blocks correctly', () => {
      const template = '{{#if hasData}}<p>Has data</p>{{#else}}<p>No data</p>{{/if}}';
      
      const resultWithData = templateEngine.processTemplate(template, { hasData: true });
      const resultWithoutData = templateEngine.processTemplate(template, { hasData: false });
      
      expect(resultWithData).toBe('<p>Has data</p>');
      expect(resultWithoutData).toBe('<p>No data</p>');
    });

    test('should handle nested conditions', () => {
      const template = '{{#if outer}}{{#if inner}}<p>Both true</p>{{/if}}{{/if}}';
      
      const resultBothTrue = templateEngine.processTemplate(template, { outer: true, inner: true });
      const resultOuterOnly = templateEngine.processTemplate(template, { outer: true, inner: false });
      const resultNeitherTrue = templateEngine.processTemplate(template, { outer: false, inner: true });
      
      expect(resultBothTrue).toBe('<p>Both true</p>');
      expect(resultOuterOnly).toBe('');
      expect(resultNeitherTrue).toBe('');
    });
  });

  describe('Loop Blocks', () => {
    test('should render each block for array items', () => {
      const template = '{{#each items}}<li>{{name}}</li>{{/each}}';
      const variables = {
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' }
        ]
      };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('<li>Item 1</li><li>Item 2</li><li>Item 3</li>');
    });

    test('should handle empty arrays', () => {
      const template = '{{#each items}}<li>{{name}}</li>{{/each}}';
      const variables = { items: [] };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('');
    });

    test('should handle non-array values', () => {
      const template = '{{#each items}}<li>{{name}}</li>{{/each}}';
      const variables = { items: 'not an array' };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('');
    });

    test('should provide access to parent variables in loops', () => {
      const template = '{{#each items}}<li>{{title}}: {{name}}</li>{{/each}}';
      const variables = {
        title: 'Service',
        items: [
          { name: 'API' },
          { name: 'Database' }
        ]
      };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toBe('<li>Service: API</li><li>Service: Database</li>');
    });
  });

  describe('File Operations', () => {
    test('should load and render template from file', () => {
      const templateContent = '<h1>{{title}}</h1>';
      const expectedPath = path.join(mockTemplateDir, 'test.html');
      
      fs.readFileSync.mockReturnValue(templateContent);
      
      const result = templateEngine.render('test', { title: 'File Template' });
      
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');
      expect(result).toBe('<h1>File Template</h1>');
    });

    test('should throw error for missing template file', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      expect(() => {
        templateEngine.render('missing');
      }).toThrow('Template file not found');
    });

    test('should cache templates in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const templateContent = '<h1>{{title}}</h1>';
      fs.readFileSync.mockReturnValue(templateContent);
      
      // First call
      templateEngine.render('cached', { title: 'First' });
      // Second call
      templateEngine.render('cached', { title: 'Second' });
      
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should not cache templates in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const templateContent = '<h1>{{title}}</h1>';
      fs.readFileSync.mockReturnValue(templateContent);
      
      // First call
      templateEngine.render('uncached', { title: 'First' });
      // Second call
      templateEngine.render('uncached', { title: 'Second' });
      
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Complex Templates', () => {
    test('should handle mixed template features', () => {
      const template = `
        <h1>{{title}}</h1>
        {{#if hasServices}}
          <ul>
            {{#each services}}
              <li class="{{status}}">{{name}}: {{description}}</li>
            {{/each}}
          </ul>
        {{#else}}
          <p>No services available</p>
        {{/if}}
      `;
      
      const variables = {
        title: 'Service Status',
        hasServices: true,
        services: [
          { name: 'API', description: 'REST API', status: 'operational' },
          { name: 'DB', description: 'Database', status: 'degraded' }
        ]
      };
      
      const result = templateEngine.processTemplate(template, variables);
      
      expect(result).toContain('<h1>Service Status</h1>');
      expect(result).toContain('<li class="operational">API: REST API</li>');
      expect(result).toContain('<li class="degraded">DB: Database</li>');
      expect(result).not.toContain('No services available');
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const templateContent = '<h1>{{title}}</h1>';
      fs.readFileSync.mockReturnValue(templateContent);
      
      // Load template into cache
      templateEngine.render('test', { title: 'Test' });
      
      // Clear cache
      templateEngine.clearCache();
      
      // Should reload from file
      templateEngine.render('test', { title: 'Test' });
      
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});