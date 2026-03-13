import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import root from './config/en'
import zh from './config/zh'
import { copyright } from './utils'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title:       'NESJS',
    description: 'A modern NES emulator written in TypeScript.',

    head: [
        ['link', { rel: 'icon', href: '/favicon-32x32.png' }],
        ['link', { rel: 'icon', href: '/favicon-16x16.png' }],
        ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
        ['link', { rel: 'manifest', href: '/site.webmanifest' }],
        ['meta', { name: 'msapplication-TileColor', content: '#da532c' }],
        ['meta', { name: 'theme-color', content: '#ffffff' }],
        // Inline style for Playground button to ensure it works on first load
        ['style', {}, `
            a.VPButton[href*="playground"] {
                border-color: #f59e0b !important;
                color: #f59e0b !important;
                background: transparent !important;
            }
            a.VPButton[href*="playground"]:hover {
                border-color: #f59e0b !important;
                color: #fff !important;
                background: #f59e0b !important;
            }
            html.dark a.VPButton[href*="playground"] {
                border-color: #fbbf24 !important;
                color: #fbbf24 !important;
            }
            html.dark a.VPButton[href*="playground"]:hover {
                border-color: #fbbf24 !important;
                color: #1f2937 !important;
                background: #fbbf24 !important;
            }
        `],
    ],

    locales: {
        root,
        zh,
    },

    vite: {
        resolve: {
            dedupe: ['vue'],
            alias:  { '@nesjs/native': fileURLToPath(new URL('../../packages/native/dist/esm/index.js', import.meta.url)) },
        },
    },

    markdown: {
        theme: {
            light: 'light-plus',
            dark:  'github-dark',
        },
    },

    themeConfig: {
        logo:    '/icon.png',
        outline: { level: [2, 3] },
        footer:  {
            message:   'Released under the MIT License.',
            copyright: copyright(),
        },
        socialLinks: [
            { icon: 'github', link: 'https://github.com/taiyuuki/nesjs' },
        ],
        search: { provider: 'local' },
    },
})
