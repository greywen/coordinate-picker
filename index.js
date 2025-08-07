"use strict";
// 设置PDF.js worker
if (typeof window !== 'undefined' && window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
// 图片渲染器类 - 通用的图片到Canvas渲染模块
class ImageRenderer {
    constructor(canvas, options = {}) {
        this.imageData = null;
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('无法获取canvas 2d上下文');
        }
        this.ctx = context;
        this.scale = options.scale || 1.5;
        // 回调函数
        this.onRender = options.onRender || (() => { });
        this.onError =
            options.onError || ((error) => console.error('渲染错误:', error));
    }
    // 从图片数据渲染到Canvas
    async renderFromImageData(imageData, width, height) {
        try {
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx.putImageData(imageData, 0, 0);
            this.imageData = imageData;
            this.onRender();
        }
        catch (error) {
            this.onError(error);
        }
    }
    // 从图片元素渲染到Canvas
    async renderFromImage(img) {
        try {
            const width = img.width * this.scale;
            const height = img.height * this.scale;
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx.drawImage(img, 0, 0, width, height);
            this.imageData = this.ctx.getImageData(0, 0, width, height);
            this.onRender();
        }
        catch (error) {
            this.onError(error);
        }
    }
    // 从URL渲染图片
    async renderFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    await this.renderFromImage(img);
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = url;
        });
    }
    // 从File对象渲染图片
    async renderFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                var _a;
                try {
                    if ((_a = e.target) === null || _a === void 0 ? void 0 : _a.result) {
                        await this.renderFromUrl(e.target.result);
                        resolve();
                    }
                    else {
                        reject(new Error('文件读取结果为空'));
                    }
                }
                catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }
    // 获取当前渲染的图片数据
    getImageData() {
        return this.imageData;
    }
    // 清除Canvas
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.imageData = null;
    }
    // 重新绘制（用于选区操作后恢复原图）
    redraw() {
        if (this.imageData) {
            this.ctx.putImageData(this.imageData, 0, 0);
        }
    }
}
// 文件转换器类 - 将不同格式文件转换为图片数据
class FileConverter {
    constructor() {
        this.supportedTypes = {
            'application/pdf': 'pdf',
            'image/png': 'image',
            'image/jpeg': 'image',
            'image/jpg': 'image',
            'image/gif': 'image',
            'image/webp': 'image',
            'image/svg+xml': 'image',
        };
    }
    // 检查文件类型是否支持
    isSupported(file) {
        return this.supportedTypes.hasOwnProperty(file.type);
    }
    // 获取文件类型
    getFileType(file) {
        return this.supportedTypes[file.type] || 'unknown';
    }
    // 转换PDF为图片数据数组
    async convertPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfData = new Uint8Array(arrayBuffer);
        const pdfDoc = await window.pdfjsLib.getDocument(pdfData).promise;
        const pages = [];
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('无法创建canvas上下文');
            }
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
            };
            await page.render(renderContext).promise;
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            pages.push({
                imageData: imageData,
                width: canvas.width,
                height: canvas.height,
                pageNum: pageNum,
            });
        }
        return {
            type: 'pdf',
            pages: pages,
            totalPages: pdfDoc.numPages,
        };
    }
    // 转换图片文件
    async convertImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法创建canvas上下文'));
                    return;
                }
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                resolve({
                    type: 'image',
                    pages: [
                        {
                            imageData: imageData,
                            width: canvas.width,
                            height: canvas.height,
                            pageNum: 1,
                        },
                    ],
                    totalPages: 1,
                });
            };
            img.onerror = () => reject(new Error('图片加载失败'));
            const reader = new FileReader();
            reader.onload = (e) => {
                var _a;
                if ((_a = e.target) === null || _a === void 0 ? void 0 : _a.result) {
                    img.src = e.target.result;
                }
                else {
                    reject(new Error('文件读取结果为空'));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }
    // 主转换方法
    async convert(file) {
        const fileType = this.getFileType(file);
        switch (fileType) {
            case 'pdf':
                return await this.convertPDF(file);
            case 'image':
                return await this.convertImage(file);
            default:
                throw new Error(`不支持的文件类型: ${file.type}`);
        }
    }
}
// 全局变量类型定义
let documentInstance = null;
let currentPageNumber = 1;
let renderScale = 1.5;
let loadedDocument = null; // 当前文档数据
let imageRenderer = null; // 图片渲染器
let fileConverter = null; // 文件转换器
// DOM元素获取
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const fileSelector = document.getElementById('fileSelector');
const currentPageDisplay = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');
const prevButton = document.getElementById('prevPage');
const nextButton = document.getElementById('nextPage');
const fileInput = document.getElementById('fileInput');
const fileSelectorButton = document.getElementById('fileSelector');
const coordinateOutput = document.getElementById('coordinateOutput');
const selectionOutput = document.getElementById('selectionOutput');
const selectionOverlay = document.getElementById('selectionOverlay');
const canvasContainer = document.getElementById('canvasContainer');
const originSelect = document.getElementById('originSelect');
// 框选相关变量
let isSelecting = false;
let startX = 0;
let startY = 0;
let currentSelection = null;
let selectionRect = null; // 选区矩形
// 拖动选区相关变量
let isDraggingSelection = false;
let dragStartX = 0;
let dragStartY = 0;
let selectionStartX = 0;
let selectionStartY = 0;
// 调整选区大小相关变量
let isResizingSelection = false;
let resizeDirection = '';
let originalSelectionRect = null;
// 初始化模块
function initializeModules() {
    imageRenderer = new ImageRenderer(canvas, {
        scale: renderScale,
        onRender: () => {
            // 渲染完成回调
            console.log('页面渲染完成');
        },
        onError: (error) => {
            console.error('渲染错误:', error);
            fileSelector.textContent = '渲染失败: ' + error.message;
            fileSelector.style.display = 'block';
            canvas.style.display = 'none';
        },
    });
    fileConverter = new FileConverter();
}
// 加载文件（支持多种格式）
async function loadFile(file) {
    try {
        // 检查文件类型
        if (!(fileConverter === null || fileConverter === void 0 ? void 0 : fileConverter.isSupported(file))) {
            throw new Error(`不支持的文件类型: ${file.type}`);
        }
        fileSelector.style.display = 'block';
        canvas.style.display = 'none';
        fileSelector.textContent = '正在加载...';
        // 转换文件为图片数据
        loadedDocument = await fileConverter.convert(file);
        totalPagesSpan.textContent = loadedDocument.totalPages.toString();
        currentPageNumber = 1;
        fileSelector.style.display = 'none';
        // 显示页面控制（如果有多页）
        if (loadedDocument.totalPages > 1) {
            prevButton.style.display = 'block';
            nextButton.style.display = 'block';
        }
        else {
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
        }
        canvas.style.display = 'block';
        await renderPage(currentPageNumber);
        updatePageControls();
    }
    catch (error) {
        console.error('加载失败:', error);
        fileSelector.textContent = '加载失败: ' + error.message;
        fileSelector.style.display = 'block';
        canvas.style.display = 'none';
    }
}
// 渲染页面（使用新的模块化架构）
async function renderPage(pageNum) {
    if (!loadedDocument || !loadedDocument.pages[pageNum - 1]) {
        throw new Error('页面数据不存在');
    }
    const pageData = loadedDocument.pages[pageNum - 1];
    // 使用ImageRenderer渲染
    if (imageRenderer) {
        await imageRenderer.renderFromImageData(pageData.imageData, pageData.width, pageData.height);
    }
    currentPageDisplay.textContent = pageNum.toString();
    // 清除选区
    selectionRect = null;
    currentSelection = null;
    updateSelectionOutput(null);
}
// 更新页面控制按钮状态
function updatePageControls() {
    if (!loadedDocument)
        return;
    prevButton.disabled = currentPageNumber <= 1;
    nextButton.disabled = currentPageNumber >= loadedDocument.totalPages;
}
// 获取鼠标在PDF中的坐标（根据选择的起始位置）
function getPDFCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    // 获取当前选择的起始位置
    const origin = originSelect.value;
    let pdfX, pdfY;
    switch (origin) {
        case 'top-left':
            // 左上角为原点
            pdfX = Math.round(canvasX / renderScale);
            pdfY = Math.round(canvasY / renderScale);
            break;
        case 'bottom-left':
            // 左下角为原点（原始的PDF坐标系）
            pdfX = Math.round(canvasX / renderScale);
            pdfY = Math.round((canvas.height - canvasY) / renderScale);
            break;
        case 'top-right':
            // 右上角为原点
            pdfX = Math.round((canvas.width - canvasX) / renderScale);
            pdfY = Math.round(canvasY / renderScale);
            break;
        case 'bottom-right':
            // 右下角为原点
            pdfX = Math.round((canvas.width - canvasX) / renderScale);
            pdfY = Math.round((canvas.height - canvasY) / renderScale);
            break;
        default:
            // 默认为左上角
            pdfX = Math.round(canvasX / renderScale);
            pdfY = Math.round(canvasY / renderScale);
    }
    return { x: pdfX, y: pdfY, canvasX: canvasX, canvasY: canvasY };
}
// 获取相对于画布容器的坐标（用于选区覆盖层定位）
function getRelativeCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    return { x: relativeX, y: relativeY };
}
// 将画布选区坐标转换为PDF坐标（根据选择的起始位置）
function convertCanvasSelectionToPDF(canvasX, canvasY, width, height) {
    const origin = originSelect.value;
    let pdfX, pdfY, pdfWidth, pdfHeight;
    // 宽度和高度总是正值
    pdfWidth = Math.round(width / renderScale);
    pdfHeight = Math.round(height / renderScale);
    switch (origin) {
        case 'top-left':
            // 左上角为原点
            pdfX = Math.round(canvasX / renderScale);
            pdfY = Math.round(canvasY / renderScale);
            break;
        case 'bottom-left':
            // 左下角为原点（原始的PDF坐标系）
            pdfX = Math.round(canvasX / renderScale);
            pdfY = Math.round((canvas.height - canvasY - height) / renderScale);
            break;
        case 'top-right':
            // 右上角为原点
            pdfX = Math.round((canvas.width - canvasX - width) / renderScale);
            pdfY = Math.round(canvasY / renderScale);
            break;
        case 'bottom-right':
            // 右下角为原点
            pdfX = Math.round((canvas.width - canvasX - width) / renderScale);
            pdfY = Math.round((canvas.height - canvasY - height) / renderScale);
            break;
        default:
            // 默认为左上角
            pdfX = Math.round(canvasX / renderScale);
            pdfY = Math.round(canvasY / renderScale);
    }
    return { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
}
// 更新选区显示
function updateSelectionOutput(selection) {
    if (selection) {
        selectionOutput.textContent = `x: ${selection.x}, y: ${selection.y}, w: ${selection.width}, h: ${selection.height}`;
        selectionOutput.style.display = 'block';
    }
    else {
        selectionOutput.style.display = 'none';
    }
}
// 绘制选区在画布上
function drawSelection() {
    // 先恢复原始图片内容
    if (imageRenderer) {
        imageRenderer.redraw();
    }
    // 如果有选区，绘制选区
    if (selectionRect && selectionRect.width > 0 && selectionRect.height > 0) {
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
        // 绘制选区矩形
        ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
        ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
        // 重置线条样式
        ctx.setLineDash([]);
        // 绘制调整大小的控制点
        drawResizeHandles();
    }
}
// 绘制调整大小的控制点
function drawResizeHandles() {
    if (!selectionRect)
        return;
    const handleSize = 8;
    const halfHandle = handleSize / 2;
    ctx.fillStyle = '#007bff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    const rect = selectionRect;
    // 绘制8个控制点
    const handles = [
        // 四个角
        {
            x: rect.x - halfHandle,
            y: rect.y - halfHandle,
            cursor: 'nw-resize',
        },
        {
            x: rect.x + rect.width - halfHandle,
            y: rect.y - halfHandle,
            cursor: 'ne-resize',
        },
        {
            x: rect.x - halfHandle,
            y: rect.y + rect.height - halfHandle,
            cursor: 'sw-resize',
        },
        {
            x: rect.x + rect.width - halfHandle,
            y: rect.y + rect.height - halfHandle,
            cursor: 'se-resize',
        },
        // 四个边的中点
        {
            x: rect.x + rect.width / 2 - halfHandle,
            y: rect.y - halfHandle,
            cursor: 'n-resize',
        },
        {
            x: rect.x + rect.width / 2 - halfHandle,
            y: rect.y + rect.height - halfHandle,
            cursor: 's-resize',
        },
        {
            x: rect.x - halfHandle,
            y: rect.y + rect.height / 2 - halfHandle,
            cursor: 'w-resize',
        },
        {
            x: rect.x + rect.width - halfHandle,
            y: rect.y + rect.height / 2 - halfHandle,
            cursor: 'e-resize',
        },
    ];
    handles.forEach((handle) => {
        ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
        ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });
}
// 检测鼠标是否在调整大小的控制点上
function getResizeDirection(x, y) {
    if (!selectionRect)
        return '';
    const handleSize = 8;
    const halfHandle = handleSize / 2;
    const rect = selectionRect;
    // 检查各个控制点
    const handles = [
        { x: rect.x - halfHandle, y: rect.y - halfHandle, direction: 'nw' },
        {
            x: rect.x + rect.width - halfHandle,
            y: rect.y - halfHandle,
            direction: 'ne',
        },
        {
            x: rect.x - halfHandle,
            y: rect.y + rect.height - halfHandle,
            direction: 'sw',
        },
        {
            x: rect.x + rect.width - halfHandle,
            y: rect.y + rect.height - halfHandle,
            direction: 'se',
        },
        {
            x: rect.x + rect.width / 2 - halfHandle,
            y: rect.y - halfHandle,
            direction: 'n',
        },
        {
            x: rect.x + rect.width / 2 - halfHandle,
            y: rect.y + rect.height - halfHandle,
            direction: 's',
        },
        {
            x: rect.x - halfHandle,
            y: rect.y + rect.height / 2 - halfHandle,
            direction: 'w',
        },
        {
            x: rect.x + rect.width - halfHandle,
            y: rect.y + rect.height / 2 - halfHandle,
            direction: 'e',
        },
    ];
    for (let handle of handles) {
        if (x >= handle.x &&
            x <= handle.x + handleSize &&
            y >= handle.y &&
            y <= handle.y + handleSize) {
            return handle.direction;
        }
    }
    return '';
}
// 根据调整方向设置光标样式
function setCursorForResize(direction) {
    const cursorMap = {
        nw: 'nw-resize',
        ne: 'ne-resize',
        sw: 'sw-resize',
        se: 'se-resize',
        n: 'n-resize',
        s: 's-resize',
        w: 'w-resize',
        e: 'e-resize',
    };
    canvas.style.cursor = cursorMap[direction] || 'crosshair';
}
// 鼠标按下事件 - 开始框选
canvas.addEventListener('mousedown', function (event) {
    if (event.button === 0) {
        // 左键
        const coords = getRelativeCoordinates(event);
        // 首先检查是否点击在调整大小的控制点上
        const resizeDir = getResizeDirection(coords.x, coords.y);
        if (resizeDir) {
            // 开始调整选区大小
            isResizingSelection = true;
            resizeDirection = resizeDir;
            dragStartX = coords.x;
            dragStartY = coords.y;
            originalSelectionRect = selectionRect ? Object.assign({}, selectionRect) : null;
            setCursorForResize(resizeDir);
        }
        else if (selectionRect &&
            coords.x >= selectionRect.x &&
            coords.x <= selectionRect.x + selectionRect.width &&
            coords.y >= selectionRect.y &&
            coords.y <= selectionRect.y + selectionRect.height) {
            // 开始拖动选区
            isDraggingSelection = true;
            dragStartX = coords.x;
            dragStartY = coords.y;
            selectionStartX = selectionRect.x;
            selectionStartY = selectionRect.y;
            canvas.style.cursor = 'move';
        }
        else {
            // 点击选区外面，不删除选区，而是开始创建新选区
            isSelecting = true;
            startX = coords.x;
            startY = coords.y;
            // 保持现有选区，只是准备创建新的
        }
        event.preventDefault();
    }
});
// 鼠标移动事件
canvas.addEventListener('mousemove', function (event) {
    const relativeCoords = getRelativeCoordinates(event);
    const coords = getPDFCoordinates(event);
    coordinateOutput.textContent = `x: ${coords.x}, y: ${coords.y}`;
    // 如果没有任何操作进行中，检查光标样式
    if (!isSelecting && !isDraggingSelection && !isResizingSelection) {
        const resizeDir = getResizeDirection(relativeCoords.x, relativeCoords.y);
        if (resizeDir) {
            setCursorForResize(resizeDir);
        }
        else if (selectionRect &&
            relativeCoords.x >= selectionRect.x &&
            relativeCoords.x <= selectionRect.x + selectionRect.width &&
            relativeCoords.y >= selectionRect.y &&
            relativeCoords.y <= selectionRect.y + selectionRect.height) {
            canvas.style.cursor = 'move';
        }
        else {
            canvas.style.cursor = 'crosshair';
        }
    }
    if (isSelecting) {
        // 创建选区 - 显示临时选区
        const currentX = relativeCoords.x;
        const currentY = relativeCoords.y;
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        // 先恢复原始图片内容
        if (imageRenderer) {
            imageRenderer.redraw();
        }
        // 绘制现有选区（如果有）
        if (selectionRect && selectionRect.width > 0 && selectionRect.height > 0) {
            ctx.strokeStyle = '#007bff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
            ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
            ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
        }
        // 绘制临时选区
        if (width > 0 && height > 0) {
            ctx.strokeStyle = '#ff6b6b'; // 红色表示临时选区
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.fillStyle = 'rgba(255, 107, 107, 0.1)';
            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
        }
        // 重置线条样式
        ctx.setLineDash([]);
    }
    else if (isDraggingSelection && selectionRect) {
        // 拖动选区
        const deltaX = relativeCoords.x - dragStartX;
        const deltaY = relativeCoords.y - dragStartY;
        let newX = selectionStartX + deltaX;
        let newY = selectionStartY + deltaY;
        // 边界检查
        newX = Math.max(0, Math.min(newX, canvas.width - selectionRect.width));
        newY = Math.max(0, Math.min(newY, canvas.height - selectionRect.height));
        selectionRect.x = newX;
        selectionRect.y = newY;
        drawSelection();
        // 更新PDF坐标显示
        const selectionCoords = convertCanvasSelectionToPDF(newX, newY, selectionRect.width, selectionRect.height);
        currentSelection = {
            x: selectionCoords.x,
            y: selectionCoords.y,
            width: selectionCoords.width,
            height: selectionCoords.height,
        };
        updateSelectionOutput(currentSelection);
    }
    else if (isResizingSelection && originalSelectionRect) {
        // 调整选区大小
        const deltaX = relativeCoords.x - dragStartX;
        const deltaY = relativeCoords.y - dragStartY;
        let newRect = Object.assign({}, originalSelectionRect);
        // 根据调整方向更新选区
        if (resizeDirection.includes('n')) {
            // 上边
            newRect.y = originalSelectionRect.y + deltaY;
            newRect.height = originalSelectionRect.height - deltaY;
        }
        if (resizeDirection.includes('s')) {
            // 下边
            newRect.height = originalSelectionRect.height + deltaY;
        }
        if (resizeDirection.includes('w')) {
            // 左边
            newRect.x = originalSelectionRect.x + deltaX;
            newRect.width = originalSelectionRect.width - deltaX;
        }
        if (resizeDirection.includes('e')) {
            // 右边
            newRect.width = originalSelectionRect.width + deltaX;
        }
        // 确保最小尺寸和边界
        newRect.width = Math.max(10, newRect.width);
        newRect.height = Math.max(10, newRect.height);
        newRect.x = Math.max(0, Math.min(newRect.x, canvas.width - newRect.width));
        newRect.y = Math.max(0, Math.min(newRect.y, canvas.height - newRect.height));
        selectionRect = newRect;
        drawSelection();
        // 更新PDF坐标显示
        const selectionCoords = convertCanvasSelectionToPDF(newRect.x, newRect.y, newRect.width, newRect.height);
        currentSelection = {
            x: selectionCoords.x,
            y: selectionCoords.y,
            width: selectionCoords.width,
            height: selectionCoords.height,
        };
        updateSelectionOutput(currentSelection);
    }
});
// 鼠标抬起事件 - 完成框选或拖动
canvas.addEventListener('mouseup', function (event) {
    if (event.button === 0) {
        // 左键
        if (isSelecting) {
            // 完成选区创建
            isSelecting = false;
            const relativeCoords = getRelativeCoordinates(event);
            const endX = relativeCoords.x;
            const endY = relativeCoords.y;
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);
            if (width > 3 && height > 3) {
                // 创建新选区，替换现有选区
                selectionRect = { x: x, y: y, width: width, height: height };
                // 转换为PDF坐标系（使用当前选择的起始位置）
                const selectionCoords = convertCanvasSelectionToPDF(x, y, width, height);
                currentSelection = {
                    x: selectionCoords.x,
                    y: selectionCoords.y,
                    width: selectionCoords.width,
                    height: selectionCoords.height,
                };
                updateSelectionOutput(currentSelection);
            }
            // 重新绘制（清除临时选区）
            drawSelection();
        }
        else if (isDraggingSelection) {
            // 完成选区拖动
            isDraggingSelection = false;
            canvas.style.cursor = 'crosshair';
        }
        else if (isResizingSelection) {
            // 完成选区调整大小
            isResizingSelection = false;
            resizeDirection = '';
            originalSelectionRect = null;
            canvas.style.cursor = 'crosshair';
        }
    }
});
// 鼠标离开canvas时保持最后坐标，但停止所有操作
canvas.addEventListener('mouseleave', function () {
    // 不重置坐标显示，保持最后一个坐标
    if (isSelecting) {
        isSelecting = false;
        // 重新绘制，清除临时选区但保留现有选区
        drawSelection();
    }
    if (isDraggingSelection) {
        isDraggingSelection = false;
        canvas.style.cursor = 'crosshair';
    }
    if (isResizingSelection) {
        isResizingSelection = false;
        resizeDirection = '';
        originalSelectionRect = null;
        canvas.style.cursor = 'crosshair';
    }
});
// 双击清除选区
canvas.addEventListener('dblclick', function () {
    selectionRect = null;
    currentSelection = null;
    updateSelectionOutput(null);
    drawSelection();
});
// 页面控制
prevButton.addEventListener('click', async function () {
    if (loadedDocument && currentPageNumber > 1) {
        currentPageNumber--;
        await renderPage(currentPageNumber);
        updatePageControls();
    }
});
nextButton.addEventListener('click', async function () {
    if (loadedDocument && currentPageNumber < loadedDocument.totalPages) {
        currentPageNumber++;
        await renderPage(currentPageNumber);
        updatePageControls();
    }
});
// 键盘控制
document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        prevButton.click();
    }
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextButton.click();
    }
});
// 文件选择功能
fileSelectorButton.addEventListener('click', function () {
    fileInput.click();
});
fileInput.addEventListener('change', function (event) {
    var _a;
    const target = event.target;
    const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0];
    if (file) {
        loadFile(file);
    }
});
// 起始位置改变事件
originSelect.addEventListener('change', function () {
    // 如果有选区，重新计算并更新显示
    if (selectionRect && currentSelection) {
        const selectionCoords = convertCanvasSelectionToPDF(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
        currentSelection = {
            x: selectionCoords.x,
            y: selectionCoords.y,
            width: selectionCoords.width,
            height: selectionCoords.height,
        };
        updateSelectionOutput(currentSelection);
    }
});
// 复制到剪贴板功能
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch (err) {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
        catch (e) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}
// 显示复制成功提示
function showCopySuccess(element, originalText) {
    const originalBg = element.style.background;
    element.style.background = '#28a745';
    element.textContent = '已复制!';
    setTimeout(() => {
        element.style.background = originalBg;
        element.textContent = originalText;
    }, 500);
}
// 选区复制事件
selectionOutput.addEventListener('click', async function () {
    if (currentSelection) {
        const clipboardText = `{x: ${currentSelection.x}, y: ${currentSelection.y}, w: ${currentSelection.width}, h: ${currentSelection.height}}`;
        const originalText = selectionOutput.textContent || '';
        const success = await copyToClipboard(clipboardText);
        if (success) {
            showCopySuccess(selectionOutput, originalText);
        }
    }
});
// 页面加载完成后的初始化
window.addEventListener('load', function () {
    initializeModules();
    console.log('坐标工具已就绪，请选择文件');
});
//# sourceMappingURL=index.js.map