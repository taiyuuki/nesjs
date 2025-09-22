export default {
    label: 'English',
    lang: 'en',
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Packages', link: '/guide/start' },
        ],

        sidebar: [
            {
                text: 'Guide',
                items: [
                    { text: '@nesjs/core', link: '/guide/core' },
                    { text: '@nesjs/native', link: '/guide/native' },
                    { text: '@nesjs/vue3', link: '/guide/vue3' },
                    { text: '@nesjs/react', link: '/zh/guide/react' },
                ],
            },
        ],

        outlineTitle: 'Outline',
    },
}
