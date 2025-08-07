# 坐标拾取器 (Coordinate Picker)

一个用于从 PDF 文档/图片中精确拾取坐标的 Web 工具。

## 功能特点

- 📄 支持 PDF 文件和图片文件的加载
- 🎯 精确的坐标拾取功能
- 📏 支持区域选择和调整
- 📋 坐标信息一键复制
- 💻 纯前端实现，无需后端服务

## 技术栈

- TypeScript
- PDF.js
- HTML5 Canvas
- 原生 JavaScript

## 安装

```bash
# 使用 pnpm 安装依赖
pnpm install
```

## 开发

```bash
# 启动开发模式，支持实时编译
pnpm dev

# 构建项目
pnpm build
```

## 使用方法

1. 打开 `index.html` 文件
2. 点击"选择文件"按钮上传 PDF 或图片
3. 在文档上点击或拖动以选择区域
4. 坐标信息会实时显示在界面上
5. 点击复制按钮可复制坐标信息

## 支持的文件类型

- PDF 文件 (.pdf)
- 图片文件 (.jpg, .jpeg, .png, .gif, .bmp)

## 注意事项

- PDF 文件处理依赖于 PDF.js，需要确保能访问 CDN 资源

## 许可证

ISC License