export default {
    label:       '简体中文',
    lang:        'zh-CN',
    themeConfig: {

        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: '主页', link: '/zh/index' },
            { text: 'Packages', link: '/zh/guide/start' },
            { text: '在线体验', link: '/zh/playground' },
        ],

        sidebar: [
            {
                text:  'Packages',
                items: [
                    { text: '@nesjs/core', link: '/zh/guide/core' },
                    { text: '@nesjs/native', link: '/zh/guide/native' },
                ],
            },
        ],

        outlineTitle: '目录',

    },
}
