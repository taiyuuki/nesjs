# NES.js

一个用 TypeScript 开发的 NES 模拟器库，支持多种运行环境。

## 项目结构

```
nesjs/
├── packages/
│   ├── core/        # 核心模拟器逻辑
│   ├── native/      # 原生 JavaScript/TypeScript 接口
│   └── vue3/        # Vue 3 组件封装
├── scripts/         # 构建和发布脚本
└── test/           # 测试文件
```

## 包依赖关系

```
@nesjs/core (核心库)
    ↓
@nesjs/native (原生接口)
    ↓
@nesjs/vue3 (Vue 组件)
```

## 开发

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 启动所有包的开发模式（除了 vue3）
pnpm dev

# 单独启动 vue3 开发服务器
pnpm dev:vue3
```

### 构建

```bash
# 构建所有包
pnpm build

# 构建特定包
pnpm build:core
pnpm build:native
pnpm build:vue3
```

### 测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm test:core
pnpm test:native
pnpm test:vue3
```

### 代码检查

```bash
# 检查所有包
pnpm lint

# 修复代码风格问题
pnpm lint:fix
```

### 类型检查

```bash
pnpm typecheck
```

## 版本管理

使用 Changesets 进行版本管理：

```bash
# 添加变更记录
pnpm changeset

# 更新版本
pnpm changeset:version

# 发布包
pnpm changeset:publish
```

## 发布

```bash
# 发布所有公开包
pnpm publish:all
```

## 包说明

### @nesjs/core

核心 NES 模拟器引擎，包含：
- CPU 模拟
- PPU（图像处理）模拟  
- APU（音频处理）模拟
- 各种 Mapper 支持
- ROM 加载和解析

### @nesjs/native

原生 JavaScript/TypeScript 接口，提供：
- 游戏手柄输入处理
- 音频输出管理
- 动画帧管理
- 数据库存储

### @nesjs/vue3

Vue 3 组件封装，提供：
- NesVue 组件
- Vue 3 响应式集成

## 许可证

MIT
