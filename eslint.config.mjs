import tyk_eslint from '@taiyuuki/eslint-config'

export default tyk_eslint({
    ts: true,
    vue: true,
}, {
    files: ['scripts/**/*.ts'],
    rules: { 
        'no-console': 'off',
     },
})
