# 开发指南

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- pnpm >= 8

### 安装
```bash
pnpm install
```

## 📦 项目结构

```
nesjs/
├── packages/
│   ├── core/        # 核心 NES 模拟器逻辑
│   ├── native/      # 原生 JavaScript/TypeScript 接口  
│   └── vue3/        # Vue 3 组件封装
├── scripts/         # 构建和发布脚本
├── test/           # 测试文件
└── .vscode/        # VS Code 配置
```

## 🔄 开发工作流

### 1. 开发模式

```bash
# 启动所有包的开发模式（core + native）
pnpm dev

# 单独启动 Vue3 开发服务器
pnpm dev:vue3
```

### 2. 构建

```bash
# 按依赖顺序构建所有包
pnpm build

# 构建特定包
pnpm build:core     # 首先构建 core
pnpm build:native   # 然后构建 native（依赖 core）
pnpm build:vue3     # 最后构建 vue3（依赖 native）
```

### 3. 测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm test:core
pnpm test:native  
pnpm test:vue3
```

### 4. 代码质量

```bash
# 代码检查
pnpm lint

# 自动修复代码风格
pnpm lint:fix

# 类型检查
pnpm typecheck

# 项目健康检查（一键检查所有）
pnpm health
```

## 📋 开发规范

### 代码风格
- 使用 ESLint + @taiyuuki/eslint-config
- 所有代码必须通过 TypeScript 类型检查
- 提交前自动运行 lint 检查

### 依赖管理
- 使用 pnpm workspace 管理 monorepo
- 包间依赖使用 `workspace:*` 协议
- 共享 DevDependencies 在根目录统一管理

### 版本管理
- 使用 Changesets 进行版本管理
- 所有包版本保持同步
- 遵循语义化版本规范

## 🔧 包开发

### @nesjs/core
核心模拟器引擎，其他包的基础依赖。

**主要功能：**
- CPU/PPU/APU 模拟
- ROM 加载和解析
- Mapper 支持

**开发要点：**
- 纯 TypeScript 实现，无外部运行时依赖
- 需要保持跨平台兼容性
- 性能优先，避免不必要的对象创建

### @nesjs/native
原生 JavaScript/TypeScript 接口层。

**主要功能：**
- 游戏手柄输入处理
- 音频输出管理
- 动画帧管理
- 数据存储

**开发要点：**
- 依赖 @nesjs/core
- 提供浏览器 API 封装
- 支持 Node.js 和浏览器环境

### @nesjs/vue3
Vue 3 组件封装。

**主要功能：**
- NesVue 组件
- Vue 3 响应式集成
- 开发示例和文档

**开发要点：**
- 依赖 @nesjs/native
- 遵循 Vue 3 组合式 API 设计
- 提供 TypeScript 类型支持

## 🎯 常见任务

### 添加新功能
1. 确定功能属于哪个包
2. 在对应包中添加代码
3. 编写测试
4. 更新文档
5. 创建 changeset

### 修复 Bug
1. 在对应包中修复问题
2. 添加回归测试
3. 验证修复不影响其他功能
4. 创建 changeset

### 发布新版本
```bash
# 1. 创建变更记录
pnpm changeset

# 2. 更新版本号
pnpm changeset:version

# 3. 构建和测试
pnpm build
pnpm test

# 4. 发布（仅 core 和 native 包）
pnpm publish:all
```

## 🐛 调试

### VS Code 配置
项目包含预配置的 VS Code 任务：
- `Build All` - 构建所有包
- `Dev Mode` - 启动开发模式
- `Test All` - 运行所有测试

### 常见问题

**构建失败**
- 检查 TypeScript 错误：`pnpm typecheck`
- 检查依赖安装：`pnpm install`
- 检查构建顺序：core -> native -> vue3

**测试失败**
- 确保先构建：`pnpm build`
- 检查测试环境：`pnpm test --reporter=verbose`

**依赖问题**
- 清理缓存：`pnpm store prune`
- 重新安装：`rm -rf node_modules && pnpm install`

## 📚 参考资源

- [pnpm workspace](https://pnpm.io/workspaces)
- [Changesets](https://github.com/changesets/changesets)
- [TypeScript 配置](https://www.typescriptlang.org/tsconfig)
- [ESLint 配置](https://eslint.org/docs/latest/user-guide/configuring/)
