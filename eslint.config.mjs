import tyk_eslint from '@taiyuuki/eslint-config'

export default tyk_eslint({
    ts: true,
    vue: true,
    rules: {
        'no-console': 'off',
        '@stylistic/array-element-newline': 'off', 
    },
    markdown: false,
    ignores: ['examples/node-example.js', '**/*.md'],
}, {
    files: ['**/*.js'],
    rules: { 'no-undef': 'off' },
})
