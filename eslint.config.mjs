import tyk_eslint from '@taiyuuki/eslint-config'

export default tyk_eslint({
    ts: true,
    vue: true,
    jsx: true,
    reactVersion: "19.1.1",
    rules: {
        'no-console': 'off',
        'no-undef': 'off',
        '@stylistic/array-element-newline': 'off', 
    },
    markdown: false,
    ignores: ['examples/node-example.js', '**/*.md', '**/*.css', '**/cache/**'],
}, {
    files: ['**/*.js'],
    rules: { 'no-undef': 'off' },
})
