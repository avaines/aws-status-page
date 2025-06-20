const TemplateEngine = require('../../src/utils/templateEngine');
const fs = require('fs');
const path = require('path');

jest.mock('fs');

describe('TemplateEngine', () => {
  let templateEngine;
  const mockTemplateDir = '/mock/templates';

  beforeEach(() => {
    templateEngine = new TemplateEngine(mockTemplateDir);
    fs.readFileSync.mockClear();
    fs.existsSync.mockClear();
  });

  describe('render', () => {
    it('should render template with variables', () => {
      const templateContent = '<h1>{{title}}</h1><p>{{description}}</p>';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const result = templateEngine.render('test.html', {
        title: 'Test Title',
        description: 'Test Description'
      });

      expect(result).toBe('<h1>Test Title</h1><p>Test Description</p>');
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(mockTemplateDir, 'test.html'),
        'utf8'
      );
    });

    it('should handle conditional blocks', () => {
      const templateContent = '{{#if showContent}}<div>Content</div>{{/if}}';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const resultWithContent = templateEngine.render('test.html', { showContent: true });
      const resultWithoutContent = templateEngine.render('test.html', { showContent: false });

      expect(resultWithContent).toBe('<div>Content</div>');
      expect(resultWithoutContent).toBe('');
    });

    it('should handle conditional blocks with else', () => {
      const templateContent = '{{#if hasData}}<div>{{data}}</div>{{#else}}<div>No data</div>{{/if}}';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const resultWithData = templateEngine.render('test.html', { hasData: true, data: 'Some data' });
      const resultWithoutData = templateEngine.render('test.html', { hasData: false });

      expect(resultWithData).toBe('<div>Some data</div>');
      expect(resultWithoutData).toBe('<div>No data</div>');
    });

    it('should handle each loops', () => {
      const templateContent = '{{#each items}}<li>{{name}}</li>{{/each}}';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(templateContent);

      const result = templateEngine.render('test.html', {
        items: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' }
        ]
      });

      expect(result).toBe('<li>Item 1</li><li>Item 2</li><li>Item 3</li>');
    });

    it('should auto-detect file extension', () => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.endsWith('test.html');
      });
      fs.readFileSync.mockReturnValue('<h1>{{title}}</h1>');

      const result = templateEngine.render('test', { title: 'Test' });

      expect(result).toBe('<h1>Test</h1>');
      expect(fs.existsSync).toHaveBeenCalledWith(path.join(mockTemplateDir, 'test.html'));
    });

    it('should throw error for missing template', () => {
      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => {
        templateEngine.render('nonexistent.html', {});
      }).toThrow('Template file not found');
    });
  });

  describe('caching', () => {
    it('should cache templates in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('<h1>{{title}}</h1>');

      templateEngine.render('test.html', { title: 'Test 1' });
      templateEngine.render('test.html', { title: 'Test 2' });

      expect(fs.readFileSync).toHaveBeenCalledTimes(1);

      process.env.NODE_ENV = originalEnv;
    });

    it('should not cache templates in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('<h1>{{title}}</h1>');

      templateEngine.render('test.html', { title: 'Test 1' });
      templateEngine.render('test.html', { title: 'Test 2' });

      expect(fs.readFileSync).toHaveBeenCalledTimes(2);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('clearCache', () => {
    it('should clear template cache', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('<h1>{{title}}</h1>');

      templateEngine.render('test.html', { title: 'Test' });
      templateEngine.clearCache();
      templateEngine.render('test.html', { title: 'Test' });

      expect(fs.readFileSync).toHaveBeenCalledTimes(2);

      process.env.NODE_ENV = originalEnv;
    });
  });
});