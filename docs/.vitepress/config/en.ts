export default {
    label:       'English',
    lang:        'en',
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Packages', link: '/guide/start' },
            { text: 'Playground', link: '/playground' },
        ],

        sidebar: [
            {
                text:  'Guide',
                items: [
                    { text: '@nesjs/core', link: '/guide/core' },
                    { text: '@nesjs/native', link: '/guide/native' },
                ],
            },
        ],

        outlineTitle: 'Outline',
    },
}
