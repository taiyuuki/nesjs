export default {
    label: '简体中文',
    lang: 'zh-CN',
    themeConfig: {

        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: '主页', link: '/zh/index' },
            { text: 'Packages', link: '/zh/guide/start' },
        ],

        sidebar: [
            {
                text: 'Packages',
                items: [
                    { text: '@nesjs/core', link: '/zh/guide/core' },
                    { text: '@nesjs/native', link: '/zh/guide/native' },
                    { text: '@nesjs/vue3', link: '/zh/guide/vue3' },
                    { text: '@nesjs/react', link: '/zh/guide/react' },
                ],
            },
        ],

        outlineTitle: '目录',

    },
}
