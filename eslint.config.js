import js from '@eslint/js';
import globals from 'globals';

export default js.config({
    ignores: ['dist'],
    files: ['**/*.{js,jsx}'],
    languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
    },
    plugins: {},
    rules: {},
});
