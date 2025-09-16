import tyk_eslint from '@taiyuuki/eslint-config'

export default tyk_eslint({
    ts: true,
    vue: true,
    rules: {
        'no-undef': 'off',
    }
}, {
    files: ['scripts/**/*.ts'],
    rules: { 
        'no-console': 'off',
     },
})
