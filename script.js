/**
 * @file script.js
 * @description Основной скрипт для игры Resource Exporter Tycoon.
 * @version 4.0.1
 */


document.addEventListener('DOMContentLoaded', () => {

// =================================================================================
    // I. КОНФИГУРАЦИЯ ИГРЫ И КОНСТАНТЫ
    // =================================================================================

    // Переменные для данных, которые будут загружены из JSON
    let ICON_MAP = {};
    let RESOURCES = {};
    let BUILDING_BLUEPRINTS = {};
    let isAltPressed = false;

   // Функция загрузки конфигурации
    async function loadGameConfig() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            window.ICON_MAP = data.ICON_MAP;
            window.RESOURCES = data.RESOURCES;
            window.BUILDING_BLUEPRINTS = data.BUILDING_BLUEPRINTS;
            window.WORKER_BUFF_CONFIG = data.WORKER_BUFF_CONFIG; 
            

            // ОБНОВЛЯЕМ ЛОКАЛЬНЫЕ ССЫЛКИ
            ICON_MAP = window.ICON_MAP;
            RESOURCES = window.RESOURCES;
            BUILDING_BLUEPRINTS = window.BUILDING_BLUEPRINTS;
            
            console.log("Конфигурация успешно загружена из data.json");
            return true;
        } catch (error) {
            console.error("Не удалось загрузить data.json:", error);
            alert("Ошибка загрузки файлов игры! Проверьте консоль.");
            return false;
        }
    }


        window.renderDetailViewGlobal = () => {
            if (activeLogisticsPopupId === null) { // Чтобы не сбивать попапы
                renderDetailView();
            }
        };
    // Функция для получения HTML иконки (поддерживает FontAwesome, SVG/PNG для Ресурсов и Зданий)
    function getIconHTML(emoji, key = null, showTooltip = true) {
        let customIconPath = null;
        let name = '';
        let colorStyle = '';

        // 1. Проверяем Ресурсы
        if (key && window.RESOURCES && window.RESOURCES[key]) {
            const res = window.RESOURCES[key];
            name = res.name;
            if (res.iconPath) customIconPath = res.iconPath;
            if (res.color) colorStyle = `style="color: ${res.color};"`;
        } 
        // 2. Проверяем Здания (если не нашли в ресурсах или ключ явно от здания)
        else if (key && window.BUILDING_BLUEPRINTS && window.BUILDING_BLUEPRINTS[key]) {
            const bld = window.BUILDING_BLUEPRINTS[key];
            name = bld.name;
            if (bld.iconPath) customIconPath = bld.iconPath;
        }

        // Если нашли кастомную картинку - возвращаем IMG
        if (customIconPath) {
            const tooltipAttr = showTooltip ? `title="${name}"` : '';
            return `<img src="${customIconPath}" class="custom-icon" ${tooltipAttr} alt="${emoji}">`;
        }

        // Иначе - стандартная иконка FontAwesome
        const iconClass = (window.ICON_MAP && window.ICON_MAP[emoji]) || 'fa-vector-square';
        const tooltipAttr = (showTooltip && name) ? `title="${name}"` : '';
        
        return `<i class="fas ${iconClass}" ${colorStyle} ${tooltipAttr}></i>`;
    }
    window.getIconHTML = getIconHTML;

/**
     * Возвращает размеры постройки в тайлах.
     * @param {Object|null|undefined} blueprint - Описание постройки
     * @returns {{w: number, h: number}}
     */    
    function getBuildingSize(blueprint) {
        if (!blueprint) {
            return { w: 1, h: 1 };
        }
        const w = blueprint.tileWidth || 1;
        const h = blueprint.tileHeight || 1;
        return { w, h };
    }

    // === Функции для получения смещения якоря ===
    function getBuildingAnchorOffset(blueprint) {
        if (!blueprint) {
            return { x: 0, y: 0 };
        }
        const size = getBuildingSize(blueprint);
        if (blueprint.anchor && typeof blueprint.anchor.x === 'number' && typeof blueprint.anchor.y === 'number') {
            const ax = Math.min(Math.max(0, blueprint.anchor.x), size.w - 1);
            const ay = Math.min(Math.max(0, blueprint.anchor.y), size.h - 1);
            return { x: ax, y: ay };
        }
        return { x: 0, y: 0 };
    }

    // === Функции для получения якоря ===
    function getBuildingAnchorGridIndex(building) {
        const blueprint = BUILDING_BLUEPRINTS[building.type];
        if (!blueprint) {
            // Неизвестный тип здания: считаем якорем базовую клетку
            return building.gridIndex;
        }
        const { x: ax, y: ay } = getBuildingAnchorOffset(blueprint);
        const baseRow = Math.floor(building.gridIndex / GRID_WIDTH);
        const baseCol = building.gridIndex % GRID_WIDTH;
        const anchorRow = Math.min(baseRow + ay, GRID_HEIGHT - 1);
        const anchorCol = Math.min(baseCol + ax, GRID_WIDTH - 1);
        return anchorRow * GRID_WIDTH + anchorCol;
    }

    // === Функции для получения позиции якоря ===
    function getBuildingAnchorWorldPos(building) {
        const anchorIndex = getBuildingAnchorGridIndex(building);
        return gridIndexToWorldPos(anchorIndex);
    }
    window.getBuildingAnchorWorldPos = getBuildingAnchorWorldPos;
    // === Функции для размещения зданий на сетке ===
    function occupyGridWithBuilding(building, baseRow, baseCol) {
        const blueprint = BUILDING_BLUEPRINTS[building.type];
        const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);
        for (let r = 0; r < tileHeight; r++) {
            for (let c = 0; c < tileWidth; c++) {
                const index = (baseRow + r) * GRID_WIDTH + (baseCol + c);
                const cell = gameState.grid[index];
                if (cell) {
                    cell.building = building;
                }
            }
        }
    }
    // === Функции для очистки здания (удаление)===
    function clearBuildingFromGrid(building) { 
        const blueprint = BUILDING_BLUEPRINTS[building.type];
        const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);
        const baseRow = Math.floor(building.gridIndex / GRID_WIDTH);
        const baseCol = building.gridIndex % GRID_WIDTH;
        for (let r = 0; r < tileHeight; r++) {
            for (let c = 0; c < tileWidth; c++) {
                const index = (baseRow + r) * GRID_WIDTH + (baseCol + c);
                const cell = gameState.grid[index];
                if (cell && cell.building === building) {
                    cell.building = null;
                }
            }
        }
    }

    // === Функция для получения всех клеток здания с ресурсами ===
    function getBuildingResourceCells(building) {
        const blueprint = BUILDING_BLUEPRINTS[building.type];
        if (!blueprint) return [];
        
        const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);
        const baseRow = Math.floor(building.gridIndex / GRID_WIDTH);
        const baseCol = building.gridIndex % GRID_WIDTH;
        
        const resourceCells = [];
        let cellNumber = 1;
        
        for (let r = 0; r < tileHeight; r++) {
            for (let c = 0; c < tileWidth; c++) {
                const index = (baseRow + r) * GRID_WIDTH + (baseCol + c);
                const cell = gameState.grid[index];
                if (cell && cell.resource && cell.resource !== 'grass') {
                    resourceCells.push({
                        cellNumber: cellNumber,
                        resource: cell.resource,
                        resourceAmount: cell.resourceAmount,
                        maxAmount: RESOURCE_NODE_CONFIG[cell.resource]?.max || 1000
                    });
                }
                cellNumber++;
            }
        }
        
        return resourceCells;
    }

    const RESOURCE_NODE_CONFIG = {
        coal: { 
            min: 5000, max: 10000,    
            veins: 7,                 
            veinSize: [20, 45]        
        },
        iron_ore: { 
            min: 4000, max: 8000,
            veins: 6,                 
            veinSize: [18, 40]        
        },
        oil: { 
            min: 3000, max: 6000,
            veins: 4,                 
            veinSize: [10, 25]        
        },
        wood: { 
            min: 5000, max: 10000,    
            veins: 8,                 
            veinSize: [25, 60]        
        },
        sand: { 
            min: 5000, max: 10000,
            veins: 6,                 
            veinSize: [22, 50]        
        },
        copper: { 
            min: 3500, max: 7000,
            veins: 5,                 
            veinSize: [15, 35]        
        },
    
        grass: {
            min: 1000, max: 2000,           
            veins: 150,               
            veinSize: [10, 30] // Чуть меньше пятна, но богаче       
        }
    
    };

    const GRID_WIDTH = 100, GRID_HEIGHT = 100, CELL_SIZE = 64, MIN_ZOOM = 0.1, MAX_ZOOM = 4;
    const TICK_INTERVAL = 2000; // в миллисекундах
    const BASE_TRUCK_CAPACITY = 50;
    const BASE_TRUCK_SPEED = 0.9 * CELL_SIZE;
    
    // КОНФИГУРАЦИЯ ПРОКАЧКИ ГРУЗОВИКОВ
    const TRUCK_UPGRADE_CONFIG = {
        capacity: [
            { level: 2, cost: { money: 450, steel: 10 }, bonus: 30 }, 
            { level: 3, cost: { money: 1200, steel: 25, tools: 5 }, bonus: 45 }, 
            { level: 4, cost: { money: 5000, advanced_components: 10, plastic: 20 }, bonus: 75 }, 
            { level: 5, cost: { money: 25000, robots: 2, advanced_components: 25 }, bonus: 100 } 
        ],
        speed: [
            { level: 2, cost: { money: 800, tools: 10 }, bonus: 1.15 }, 
            { level: 3, cost: { money: 2500, copper_wire: 20, basic_circuits: 5 }, bonus: 1.20 }, 
            { level: 4, cost: { money: 12000, microchips: 5, advanced_components: 15 }, bonus: 1.25 }, 
            { level: 5, cost: { money: 60000, microchips: 20, ai_cores: 1 }, bonus: 1.40 } 
        ]
    };
    
    const MULTI_STOP_RADIUS = 30 * CELL_SIZE; 
    const PICKUP_THRESHOLD = BASE_TRUCK_CAPACITY / 2;
    const TASK_COOLDOWN_TIME = 6000; 
    const MARKET_SATURATION_CONFIG = ExportSystem.MARKET_SATURATION_CONFIG;
    
    // ---> СИСТЕМА УВЕДОМЛЕНИЙ <---

    /**
     * Показывает всплывающее уведомление в углу экрана.
     */
    function showNotification(message, type = 'info', duration = 4000) {
        const container = document.getElementById('notification-container');
        if (gameState && gameState.notificationHistory) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            gameState.notificationHistory.unshift({ message, type, time });
            
            // Оставляем только 3 последних
            if (gameState.notificationHistory.length > 25) {
                gameState.notificationHistory.pop();
            }
        }
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;

        let icon = getIconHTML('ℹ️');
        if (type === 'success') icon = getIconHTML('✅');
        if (type === 'error') icon = getIconHTML('❌');
        if (type === 'event') icon = getIconHTML('📈');

        toast.innerHTML = `
            <span class="notification-toast-icon">${icon}</span>
            <p>${message}</p>
        `;

        container.prepend(toast); 

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, duration);
    }

    document.addEventListener('show-notification', (e) => {
        let { message, type, isResourceKey } = e.detail;
        if (isResourceKey) {
            const resourceKey = message.split(' ')[4]; 
            const resourceName = RESOURCES[resourceKey]?.name.toLowerCase() || resourceKey;
            message = message.replace(resourceKey, resourceName);
        }
        showNotification(message, type);
    });

    // =================================================================================
    // II. СОСТОЯНИЕ ИГРЫ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    // =================================================================================

    let canvas, ctx, gameWorldElement;
    let gameState = {};
    let selectedBuildingType = null, isDemolishMode = false, gameInterval = null, isPaused = false;
    let camera = {};
    window.camera = camera;
    let renderCache = { resourceColors: {} };
    let hoverState = { cellIndex: -1, mouseX: 0, mouseY: 0 };

    let isDrawingBorderMode = false; // Режим рисования
    let editingHubId = null;         // ID хаба, которому рисуем границу

    let mapCacheCanvas = document.createElement('canvas');
    let mapCacheCtx = mapCacheCanvas.getContext('2d');
    let isMapDirty = true; // Флаг: если true, нужно перерисовать карту в кеш
    let truckImage = new Image();

    let truckImageLoaded = false;
    truckImage.src = 'icon/truck.png'; 
    truckImage.onload = () => {
        truckImageLoaded = true;
        console.log("Изображение грузовика успешно загружено.");
    };
    truckImage.onerror = () => {
        console.error("Не удалось загрузить изображение грузовика.");
    };
    

    let buildingImages = {};
    let buildingImagesLoaded = {};
    
    function loadBuildingImage(buildingType, imagePath) {
        if (buildingImages[buildingType]) return; 
        
        const img = new Image();
        buildingImages[buildingType] = img;
        buildingImagesLoaded[buildingType] = false;
        
        img.src = imagePath;
        img.onload = () => {
            buildingImagesLoaded[buildingType] = true;
            console.log(`Изображение здания ${buildingType} успешно загружено.`);
        };
        img.onerror = () => {
            buildingImagesLoaded[buildingType] = false;
            console.warn(`Не удалось загрузить изображение для здания ${buildingType}. Будет использован эмодзи.`);
        };
    }
    
    function initializeBuildingImages() {
        Object.entries(BUILDING_BLUEPRINTS).forEach(([type, blueprint]) => {
            if (blueprint.imagePath) {
                loadBuildingImage(type, blueprint.imagePath);
            }
        });
    }

    let lastTimestamp = 0;
    let taskCooldowns = {};
    let consumptionStats = {};

    let logisticsUpdateInterval = null; 
    let activeLogisticsPopupId = null;  
    let logisticsUIState = {
        currentTruckId: null,
        currentTab: 'settings',
        sortBy: 'id',
        filterBy: 'all',
        selectedTruckIds: new Set(),
        routeTemplates: []
    };

    function resetGameState(settings) {
        // Дефолтные настройки на случай, если игра запущена без меню
        const config = settings || {
            money: 10780,
            powerConsumptionMultiplier: 1.0,
            resourcePriceMultiplier: 1.0,
            buildingCostMultiplier: 1.0,
            startResources: 0,
            contractDeadlineMultiplier: 1.0,
            eventFrequency: 1.0
        };

        gameState = {
            money: config.money, 
            config: config,      
            
            statsHistory: [],

            lastPowerWarning: 0, 
            power: { current: 0, capacity: 0 },
            // 1. ИЗМЕНЕНИЕ: Создаем "Виртуальный склад" для стартовых ресурсов
            virtualStorage: Object.keys(RESOURCES).reduce((acc, key) => ({
                ...acc, 
                [key]: config.startResources || 0 
            }), {}),

            // resources теперь просто отображает сумму, мы его пересчитаем в первом тике
            resources: {},

            // <-- Применяем стартовое количество ресурсов (если выбрана легкая сложность/песочница)
            resources: Object.keys(RESOURCES).reduce((acc, key) => ({...acc, [key]: config.startResources || 0 }), {}),
            
            exportStorage: Object.keys(RESOURCES).reduce((acc, key) => ({...acc, [key]: 0 }), {}),
            buildings: [], 
            vehicles: [], 
            countries: [], 
            customRoutes: [], 
            isGameOver: false, 
            startTime: Date.now(), 
            notificationHistory: [], 
            salaryTimer: 0, 
            
            grid: Array(GRID_WIDTH * GRID_HEIGHT).fill(null).map(() => ({ resource: null, resourceAmount: 0, building: null })),
            
            marketConditions: Object.keys(RESOURCES).reduce((acc, key) => ({
                ...acc, 
                [key]: { 
                    globalDemandMultiplier: 1.0,      
                    playerSaturationMultiplier: 1.0   
                } 
            }), {}),
            
            resourceFlow: Object.keys(RESOURCES).reduce((acc, key) => ({...acc, [key]: { produced: 0, consumed: 0 } }), {}),
            activeEvent: null, 

            unlockedBuildings: new Set(['sawmill', 'coal_mine', 'coal_power_plant', 'transport_hub']), 
            buildingCounts: {}, 
            isOverlayMode: false, 
            productionAnimations: [], 
            exportEnabled: false, 
            totalWarehouseCapacity: 0, 
            incomingToWarehouses: 0, 
            priceHistory: {}, 
            buildingCache: { 
                warehouses: [], 
                producers: [],  
                export_depots: [],
                houses: []
            },
            moneyTransactions: [] 
        };

        window.gameState = gameState; 
        taskCooldowns = {};
        camera = { x: (GRID_WIDTH * CELL_SIZE) / 2, y: (GRID_HEIGHT * CELL_SIZE) / 2, zoom: 1.0, isDragging: false, lastX: 0, lastY: 0 };
        isMapDirty = true;
        window.camera = camera;
        
        if(window.CityManagementSystem) window.CityManagementSystem.initialize(gameState);
        
        if (window.DriverSystem) { window.DriverSystem.initialize(gameState); }
        if (window.WorkerSystem) { window.WorkerSystem.initialize(gameState); }

    }

    // =================================================================================
    // III. ФУНКЦИИ РЕНДЕРИНГА (CANVAS)
    // =================================================================================

    function renderLoop(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        
        // Получаем реальное время
        let realDeltaTime = (timestamp - lastTimestamp) / 1000; 
        lastTimestamp = timestamp;

        const MAX_DELTA_TIME = 0.25; 
        if (realDeltaTime > MAX_DELTA_TIME) {
            realDeltaTime = MAX_DELTA_TIME;
        }

        // === ИЗМЕНЕНИЕ: Умножаем на скорость игры ===
        let gameDeltaTime = isPaused ? 0 : realDeltaTime * gameSpeed;

        if (!isPaused) {
            // Передаем ускоренное время
            updateLogistics(gameDeltaTime);
            
            // --- ОБНОВЛЕНИЕ СИСТЕМЫ ЧАСТИЦ ---
            if (window.ParticleSystem) {
                // Передаем ускоренное время
                window.ParticleSystem.update(gameDeltaTime);
                
                // Эффекты зданий
                gameState.buildings.forEach(b => {
                    const bp = BUILDING_BLUEPRINTS[b.type];
                    const relevantCategory = ['power', 'processing', 'manufacturing', 'hightech'].includes(bp.category);
                    const noStatusErrors = (!b.statusFlags || b.statusFlags.length === 0);
                    const hasResources = (!b.missingResources || b.missingResources.length === 0);
                    const isWorking = relevantCategory && noStatusErrors && hasResources;

                    if (isWorking) {
                        const pos = gridIndexToWorldPos(b.gridIndex);
                        const { w, h } = getBuildingSize(bp);
                        const centerX = pos.x + (w - 1) * (CELL_SIZE / 2); 
                        const centerY = pos.y + (h - 1) * (CELL_SIZE / 2);
                        window.ParticleSystem.processBuildingEffects(b, bp, {x: centerX, y: centerY});
                    }
                });
            }
        }
        
        draw();
        requestAnimationFrame(renderLoop);
    }

    function drawOffscreenIndicators() {
        const padding = 40; 
        const indicatorRadius = 20;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        gameState.internalMarkets.forEach(market => {
            if (market.status !== 'active') return;

            const worldPos = gridIndexToWorldPos(market.gridIndex);
            const screenX = (worldPos.x - camera.x) * camera.zoom + cx;
            const screenY = (worldPos.y - camera.y) * camera.zoom + cy;

            const isOnScreen = 
                screenX >= 0 && 
                screenX <= canvas.width && 
                screenY >= 0 && 
                screenY <= canvas.height;

            if (isOnScreen) return; 

            const dx = screenX - cx;
            const dy = screenY - cy;
            const angle = Math.atan2(dy, dx);
            
            let t = Infinity;
            const borderRight = canvas.width - padding;
            const borderLeft = padding;
            const borderBottom = canvas.height - padding;
            const borderTop = padding;

            if (dx > 0) t = Math.min(t, (borderRight - cx) / dx);
            if (dx < 0) t = Math.min(t, (borderLeft - cx) / dx);
            if (dy > 0) t = Math.min(t, (borderBottom - cy) / dy);
            if (dy < 0) t = Math.min(t, (borderTop - cy) / dy);

            const indX = cx + t * dx;
            const indY = cy + t * dy;

            ctx.save();
            ctx.translate(indX, indY);
            
            let color = '#3182ce'; 
            let icon = '🛒';
            
            if (market.isSeasonal) {
                color = '#dd6b20'; 
                icon = '💰';
            }

            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 6;
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, indicatorRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.rotate(angle);
            ctx.translate(indicatorRadius, 0); 
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-8, -5);
            ctx.lineTo(-8, 5);
            ctx.closePath();
            ctx.fill();
            
            ctx.translate(-indicatorRadius, 0);
            ctx.rotate(-angle);

            ctx.shadowColor = 'transparent';
            ctx.fillStyle = '#fff';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, 0, 1); 

            ctx.restore();
        });
    }
    /**
     * ОПТИМИЗАЦИЯ: Рисует всю статичную карту (ресурсы + сетка) на отдельный холст.
     * Вызывается только при старте или изменении ландшафта (истощение шахт).
     */
    function renderMapToCache() {
        // Настраиваем размер кеш-канваса под размер мира
        const worldWidth = GRID_WIDTH * CELL_SIZE;
        const worldHeight = GRID_HEIGHT * CELL_SIZE;
        
        if (mapCacheCanvas.width !== worldWidth || mapCacheCanvas.height !== worldHeight) {
            mapCacheCanvas.width = worldWidth;
            mapCacheCanvas.height = worldHeight;
        }

        // Очищаем
        mapCacheCtx.clearRect(0, 0, worldWidth, worldHeight);

        // 1. Рисуем ресурсы (аналог drawResourceNodes, но для всего мира сразу)
        for (let i = 0; i < gameState.grid.length; i++) {
            const cell = gameState.grid[i];
            if (cell && cell.resource) {
                const row = Math.floor(i / GRID_WIDTH);
                const col = i % GRID_WIDTH;
                
                mapCacheCtx.fillStyle = renderCache.resourceColors[cell.resource] || '#ccc';
                // Прозрачность зависит от богатства жилы
                const opacity = 0.2 + (cell.resourceAmount / (RESOURCE_NODE_CONFIG[cell.resource]?.max || 1000)) * 0.8;
                mapCacheCtx.globalAlpha = opacity;
                mapCacheCtx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                mapCacheCtx.globalAlpha = 1.0;
            }
        }

        // 2. Рисуем сетку (аналог drawGridLines)
        mapCacheCtx.strokeStyle = 'rgba(160, 174, 192, 0.15)';
        mapCacheCtx.lineWidth = 1; // Тонкая линия
        mapCacheCtx.beginPath();

        // Вертикальные линии
        for (let col = 0; col <= GRID_WIDTH; col++) {
            mapCacheCtx.moveTo(col * CELL_SIZE, 0);
            mapCacheCtx.lineTo(col * CELL_SIZE, worldHeight);
        }
        // Горизонтальные линии
        for (let row = 0; row <= GRID_HEIGHT; row++) {
            mapCacheCtx.moveTo(0, row * CELL_SIZE);
            mapCacheCtx.lineTo(worldWidth, row * CELL_SIZE);
        }
        mapCacheCtx.stroke();

        isMapDirty = false;
        // console.log("Map Cache Updated"); // Для отладки
    }
    /**
     * Рисует линии маршрутов грузовиков поверх игрового мира.
     */
    function drawLogisticsOverlay() {
        // Рисуем только если активен режим оверлея ИЛИ зажата клавиша Alt
        if (!gameState.isOverlayMode && !isAltPressed && !isDrawingBorderMode) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const hubs = gameState.buildings.filter(b => b.type === 'transport_hub');

    hubs.forEach(hub => {
        // Рисуем, если нажат Alt ИЛИ если мы сейчас редактируем ЭТОТ хаб
        const isEditingThis = (isDrawingBorderMode && editingHubId === hub.id);
        if (!isAltPressed && !isEditingThis && !hub.radiusEnabled) return;

        const hubPos = getBuildingAnchorWorldPos(hub);
        const hue = ((hub.hubNumber || 1) * 137.508) % 360;
        const color = `hsl(${hue}, 70%, 50%)`;

        // --- ЛОГИКА ОТРИСОВКИ ---
        
        // 1. Если используется КАСТОМНАЯ ГРАНИЦА (Полигон)
        if (hub.useCustomBorder || isEditingThis) {
            const points = hub.customBorderPoints || [];
            
            if (points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                // Если редактируем, рисуем линию к мышке
                if (isEditingThis) {
                    const worldMouse = screenToWorld(hoverState.mouseX, hoverState.mouseY);
                    ctx.lineTo(worldMouse.x, worldMouse.y);
                } else {
                    ctx.closePath(); // Замыкаем только если не редактируем
                }

                ctx.fillStyle = color.replace(')', ', 0.15)').replace('hsl', 'hsla');
                ctx.fill();
                ctx.strokeStyle = color.replace(')', ', 0.8)').replace('hsl', 'hsla');
                ctx.lineWidth = 3 / camera.zoom;
                if (isEditingThis) ctx.setLineDash([10, 10]); // Пунктир при редактировании
                ctx.stroke();
                ctx.setLineDash([]);

                // Рисуем точки (вершины)
                if (isAltPressed || isEditingThis) {
                    points.forEach((p, index) => {
                        ctx.beginPath();
                        
                        // Логика для ПЕРВОЙ точки (цель для замыкания)
                        if (isEditingThis && index === 0 && points.length > 2) {
                            ctx.fillStyle = '#48bb78'; // Зеленый цвет
                            // Делаем её пульсирующей или просто больше
                            const pulse = 1 + Math.sin(Date.now() / 200) * 0.2;
                            ctx.arc(p.x, p.y, (8 / camera.zoom) * pulse, 0, Math.PI * 2);
                            
                            // Подпись "Финиш"
                            ctx.font = `${12/camera.zoom}px Arial`;
                            ctx.fillStyle = '#fff';
                            ctx.fillText("Замкнуть", p.x, p.y - 15/camera.zoom);
                        } else {
                            // Обычные точки
                            ctx.fillStyle = '#fff';
                            ctx.arc(p.x, p.y, 4 / camera.zoom, 0, Math.PI * 2);
                        }
                        
                        ctx.fill();
                    });
                }
            }
        } 
       // 2. Если используется РАДИУС (Круг)
        else {
            if (!hubPos) return;
            const limitRadius = getEffectiveHubRadius(hub);
            ctx.beginPath();
            
            // ИСПРАВЛЕНО:
            ctx.arc(hubPos.x, hubPos.y, limitRadius, 0, Math.PI * 2);
            
            ctx.fillStyle = color.replace(')', ', 0.15)').replace('hsl', 'hsla');
            ctx.fill();
            ctx.strokeStyle = color.replace(')', ', 0.6)').replace('hsl', 'hsla');
            ctx.lineWidth = 2 / camera.zoom;
            ctx.stroke();
        }

        // Номер хаба
        if (hubPos) {
            ctx.fillStyle = color;
            ctx.font = `bold ${20 / camera.zoom}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(`#${hub.hubNumber}`, hubPos.x, hubPos.y);
        }
    });
            

        // Проходим по всем грузовикам, у которых есть активное задание
        gameState.vehicles.forEach(vehicle => {
            const garage = gameState.buildings.find(b => b.id === vehicle.ownerBuildingId);
            
            // Если гараж существует и у него есть флаг 'no_power' (который мы поставили в updateProduction)
            if (garage && garage.statusFlags && garage.statusFlags.includes('no_power')) {
                // Если грузовик едет, он должен остановиться или вернуться
                // Для простоты: просто не обновляем его движение и меняем статус
                vehicle.state = 'IDLE'; 
                // Можно добавить визуальный статус, но пока хватит того, что он стоит
                return; // Пропускаем остальную логику для этого грузовика
            }
            // ----------------------------------------------

            if (vehicle.state === 'IDLE') return;
        
            if (vehicle.state === 'MOVING_CUSTOM' && vehicle.customTargetPos) {
             // Рисуем фиолетовую линию для кастомных маршрутов
             ctx.beginPath();
             ctx.strokeStyle = 'rgba(159, 122, 234, 0.8)'; // Фиолетовый
             ctx.lineWidth = 2 / camera.zoom;
             ctx.moveTo(vehicle.x, vehicle.y);
             ctx.lineTo(vehicle.customTargetPos.x, vehicle.customTargetPos.y);
             ctx.stroke();
             
             // Точка цели
             ctx.fillStyle = 'rgba(159, 122, 234, 1)';
             ctx.beginPath();
             ctx.arc(vehicle.customTargetPos.x, vehicle.customTargetPos.y, 4 / camera.zoom, 0, Math.PI * 2);
             ctx.fill();
             return; // Пропускаем стандартную отрисовку для этого грузовика
        }
            // Нас интересуют только грузовики в движении
            if (['IDLE', 'LOADING', 'UNLOADING'].includes(vehicle.state)) return;

            let startPos, endPos, color, lineWidth;

            // Определяем точки маршрута и цвет в зависимости от статуса
            if (vehicle.state === 'GOING_TO_PICKUP') {
                // Едет ЗА грузом (пустой)
                startPos = { x: vehicle.x, y: vehicle.y };
                endPos = vehicle.pickupTargetPos;
                color = 'rgba(66, 153, 225, 0.6)'; // Голубой (синий)
                lineWidth = 2 / camera.zoom;
                
                // Пунктирная линия для порожнего рейса
                ctx.setLineDash([10 / camera.zoom, 10 / camera.zoom]); 

            } else if (vehicle.state === 'GOING_TO_DROPOFF') {
                // Едет С грузом (полный)
                startPos = { x: vehicle.x, y: vehicle.y };
                endPos = vehicle.dropoffTargetPos;
                color = 'rgba(72, 187, 120, 0.8)'; // Зеленый
                
                // Толщина зависит от заполненности (от 2px до 6px)
                const capacityRatio = vehicle.cargo.amount / vehicle.capacity;
                lineWidth = (2 + (4 * capacityRatio)) / camera.zoom;
                
                ctx.setLineDash([]); // Сплошная линия
            } else if (vehicle.state === 'RETURNING_TO_BASE') {
                // Возврат на базу
                startPos = { x: vehicle.x, y: vehicle.y };
                endPos = vehicle.ownerGaragePos;
                color = 'rgba(160, 174, 192, 0.5)'; // Серый
                lineWidth = 2 / camera.zoom;
                ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]); 
            }

            if (startPos && endPos) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                
                ctx.moveTo(startPos.x, startPos.y);
                ctx.lineTo(endPos.x, endPos.y);
                ctx.stroke();

                // Рисуем точку назначения
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(endPos.x, endPos.y, 4 / camera.zoom, 0, Math.PI * 2);
                ctx.fill();
                
                // Опционально: стрелка направления в конце линии
                // (Можно добавить, если нужно больше деталей)
            }
        });

        ctx.restore();
    }
    function draw() {
        if (!ctx) return;
        
        // Если карта "грязная" (изменились ресурсы) или кеш не создан - перерисовываем кеш
        if (isMapDirty) {
            renderMapToCache();
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        const view = getVisibleGridRect();
        
        // --- ОПТИМИЗАЦИЯ: Рисуем карту одной командой вместо 10000 циклов ---
        // Рисуем только ту часть кеша, которая видна на экране (culling)
        // Координаты на кеше
        const sx = view.startCol * CELL_SIZE;
        const sy = view.startRow * CELL_SIZE;
        const sWidth = (view.endCol - view.startCol + 1) * CELL_SIZE;
        const sHeight = (view.endRow - view.startRow + 1) * CELL_SIZE;

        // Проверка на границы, чтобы drawImage не упал
        if (sWidth > 0 && sHeight > 0) {
            try {
                ctx.drawImage(
                    mapCacheCanvas, 
                    sx, sy, sWidth, sHeight, // Source (откуда берем с кеша)
                    sx, sy, sWidth, sHeight  // Destination (куда ставим в мир)
                );
            } catch (e) {
                // Fallback если размеры некорректны при резком зуме
                ctx.drawImage(mapCacheCanvas, 0, 0);
            }
        }
        
        drawBuildings(view);

        QuestSystem.draw(gameState, ctx, view, camera, CELL_SIZE, GRID_WIDTH);

        drawLogisticsOverlay(); 

        drawVehicles();
        // Добавляем отрисовку проводов
        if (window.PowerGridSystem) {
            window.PowerGridSystem.draw(ctx, gameState, camera);
        }

        // --- ОТРИСОВКА СИСТЕМЫ ЧАСТИЦ ---
        if (window.ParticleSystem) window.ParticleSystem.draw(ctx);

        
        drawProductionAnimations();
        drawBuildCursor();

        ctx.restore();
        drawOffscreenIndicators(); 
        drawTooltip();
    }
    
    function getVisibleGridRect() { 
        const topLeft = screenToWorld(0, 0); 
        const bottomRight = screenToWorld(canvas.width, canvas.height); 
        return { 
            startCol: Math.max(0, Math.floor(topLeft.x / CELL_SIZE)), 
            endCol: Math.min(GRID_WIDTH - 1, Math.ceil(bottomRight.x / CELL_SIZE)), 
            startRow: Math.max(0, Math.floor(topLeft.y / CELL_SIZE)), 
            endRow: Math.min(GRID_HEIGHT - 1, Math.ceil(bottomRight.y / CELL_SIZE)), 
        }; 
    }

    function drawGridLines(view) { 
        ctx.strokeStyle = 'rgba(160, 174, 192, 0.15)'; 
        ctx.lineWidth = 1 / camera.zoom; 
        for (let col = view.startCol; col <= view.endCol + 1; col++) { 
            ctx.beginPath(); 
            ctx.moveTo(col * CELL_SIZE, view.startRow * CELL_SIZE); 
            ctx.lineTo(col * CELL_SIZE, (view.endRow + 1) * CELL_SIZE); 
            ctx.stroke(); 
        } 
        for (let row = view.startRow; row <= view.endRow + 1; row++) { 
            ctx.beginPath(); 
            ctx.moveTo(view.startCol * CELL_SIZE, row * CELL_SIZE); 
            ctx.lineTo((view.endCol + 1) * CELL_SIZE, row * CELL_SIZE); 
            ctx.stroke(); 
        } 
    }

    function drawResourceNodes(view) { 
        for (let row = view.startRow; row <= view.endRow; row++) { 
            for (let col = view.startCol; col <= view.endCol; col++) { 
                const index = row * GRID_WIDTH + col; 
                const cell = gameState.grid[index]; 
                if (cell && cell.resource) { 
                    ctx.fillStyle = renderCache.resourceColors[cell.resource]; 
                    const opacity = 0.2 + (cell.resourceAmount / RESOURCE_NODE_CONFIG[cell.resource].max) * 0.8; 
                    ctx.globalAlpha = opacity; 
                    ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE); 
                    ctx.globalAlpha = 1.0; 
                } 
            } 
        } 
    }

    function drawBuildCursor() {
        if (!selectedBuildingType && !isDemolishMode) return;
        if (hoverState.cellIndex === -1) return;
        const row = Math.floor(hoverState.cellIndex / GRID_WIDTH);
        const col = hoverState.cellIndex % GRID_WIDTH;
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        
        if (isDemolishMode) {
            ctx.strokeStyle = 'rgba(229, 62, 62, 0.8)';
            ctx.lineWidth = 3 / camera.zoom;
            ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (selectedBuildingType) {
            const blueprint = BUILDING_BLUEPRINTS[selectedBuildingType];
            const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);
            const width = CELL_SIZE * tileWidth;
            const height = CELL_SIZE * tileHeight;
            const img = buildingImages[selectedBuildingType];
            const imgLoaded = buildingImagesLoaded[selectedBuildingType];
            const hasImage = img && imgLoaded;

            const isMultiTile = tileWidth > 1 || tileHeight > 1;
            const marginFactor = isMultiTile ? 0.02 : 0.1; 
            const innerX = x + width * marginFactor;
            const innerY = y + height * marginFactor;
            const innerW = width * (1 - marginFactor * 2);
            const innerH = height * (1 - marginFactor * 2);
            
            if (!hasImage) {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = 'rgba(49, 130, 206, 0.7)';
                ctx.fillRect(x, y, width, height);
            }
            
            ctx.globalAlpha = 0.7;
            if (hasImage) {
                ctx.drawImage(img, innerX, innerY, innerW, innerH);
            } else {
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(blueprint.emoji, x + width / 2, y + height / 2);
            }
            ctx.globalAlpha = 1.0;
        }
    }

    function drawProductionAnimations() { 
        const now = Date.now(); 
        gameState.productionAnimations = gameState.productionAnimations.filter(anim => now < anim.endTime); 
        for (const anim of gameState.productionAnimations) { 
            const progress = 1 - (anim.endTime - now) / anim.duration; 
            const opacity = Math.sin(progress * Math.PI); 
            const row = Math.floor(anim.gridIndex / GRID_WIDTH); 
            const col = anim.gridIndex % GRID_WIDTH; 
            const x = col * CELL_SIZE + CELL_SIZE / 2; 
            const y = row * CELL_SIZE + CELL_SIZE / 2; 
            ctx.globalAlpha = opacity * 0.7; 
            ctx.fillStyle = 'rgba(56, 161, 105, 0.8)'; 
            ctx.beginPath(); 
            ctx.arc(x, y, CELL_SIZE * 0.4, 0, 2 * Math.PI); 
            ctx.fill(); 
            ctx.globalAlpha = 1.0; 
        } 
    }

    function drawBuildings(view) {
        ctx.font = `${CELL_SIZE * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Сортировка для правильного перекрытия (простейшая по индексу, можно улучшить по Y)
        const sortedBuildings = [...gameState.buildings].sort((a, b) => a.gridIndex - b.gridIndex);

        for (const building of sortedBuildings) {
            const row = Math.floor(building.gridIndex / GRID_WIDTH);
            const col = building.gridIndex % GRID_WIDTH;
            
            if (row >= view.startRow && row <= view.endRow && col >= view.startCol && col <= view.endCol) {
                const blueprint = BUILDING_BLUEPRINTS[building.type];
                if (!blueprint) continue;
                
                const x = col * CELL_SIZE;
                const y = row * CELL_SIZE;
                const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);
                const width = CELL_SIZE * tileWidth;
                const height = CELL_SIZE * tileHeight;
                
                const img = buildingImages[building.type];
                const imgLoaded = buildingImagesLoaded[building.type];
                const hasImage = img && imgLoaded;
                
                const isMultiTile = tileWidth > 1 || tileHeight > 1;
                const marginFactor = isMultiTile ? 0.02 : 0.1; 
                const innerX = x + width * marginFactor;
                const innerY = y + height * marginFactor;
                const innerW = width * (1 - marginFactor * 2);
                const innerH = height * (1 - marginFactor * 2);

                // --- ИНДИКАТОР "НЕТ ПИТАНИЯ" ---
                // Рисуем, только если здание имеет флаг, требует энергию и режим электросети ВЫКЛЮЧЕН
                if (building.statusFlags && building.statusFlags.includes('no_power') && 
                    (blueprint.consumption?.power > 0 || blueprint.production?.outputs?.power > 0) &&
                    window.PowerGridSystem && !window.PowerGridSystem.isOverlayActive) 
                {
                    // Используем новую функцию для получения координат "якоря"
                    const anchorPos = getBuildingAnchorWorldPos(building);
                    const indX = anchorPos.x;
                    const indY = anchorPos.y;
                    const radius = 12 / camera.zoom; // Немного увеличим для видимости

                    // Рисуем красный кружок с молнией
                    ctx.beginPath();
                    ctx.arc(indX, indY, radius, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'; // Красный с прозрачностью
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.lineWidth = 2 / camera.zoom;
                    ctx.stroke();
                    ctx.index = 1000;

                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${16 / camera.zoom}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⚡', indX, indY + 1 / camera.zoom);
                }

                if (!hasImage) {
                    ctx.fillStyle = '#f0f0f0';
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2 / camera.zoom;
                    ctx.fillRect(innerX, innerY, innerW, innerH);
                    ctx.strokeRect(innerX, innerY, innerW, innerH);
                }
                
                if (hasImage) {
                    ctx.drawImage(img, innerX, innerY, innerW, innerH);
                } else {
                    ctx.fillStyle = '#000';
                    ctx.fillText(blueprint.emoji, x + width / 2, y + height / 2);
                }
                
                if (blueprint.category === 'extraction') {
                    const cell = gameState.grid[building.gridIndex];
                    if (cell && cell.resource && cell.resourceAmount > 0) {
                        const maxAmount = RESOURCE_NODE_CONFIG[cell.resource]?.max || 1000;
                        const ratio = cell.resourceAmount / maxAmount;
                        const barWidth = width * 0.08;
                        const barHeight = height * 0.6;
                        const barX = x + width * 0.95;
                        const barY = y + height * 0.2;
                        
                        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
                        ctx.fillRect(barX, barY, barWidth, barHeight);
                        
                        const filledHeight = barHeight * ratio;
                        ctx.fillStyle = ratio > 0.5 ? 'rgba(56, 161, 105, 0.9)' : ratio > 0.25 ? 'rgba(251, 191, 36, 0.9)' : 'rgba(239, 68, 68, 0.9)';
                        ctx.fillRect(barX, barY + barHeight - filledHeight, barWidth, filledHeight);
                        
                        ctx.strokeStyle = '#333';
                        ctx.lineWidth = 1 / camera.zoom;
                        ctx.strokeRect(barX, barY, barWidth, barHeight);
                    }
                }
                
                if (building.outputBuffer?.amount > 0) {
                    const ratio = building.outputBuffer.amount / (blueprint.outputCapacity || blueprint.bufferCapacity);
                    ctx.fillStyle = 'rgba(221, 107, 32, 0.9)';
                    ctx.fillRect(x + width * 0.1, y + height * 0.9, width * 0.8 * ratio, height * 0.08);
                }
                
                if (building.inputBuffer) {
                    const totalInput = Object.values(building.inputBuffer).reduce((a, b) => a + b, 0);
                    if (totalInput > 0) {
                        const ratio = totalInput / blueprint.inputCapacity;
                        ctx.fillStyle = 'rgba(49, 130, 206, 0.9)';
                        ctx.fillRect(x + width * 0.1, y, width * 0.8 * ratio, height * 0.08);
                    }
                }
            }
        }
    }

    function drawVehicles() {
        if (!truckImageLoaded) {
            ctx.font = `${CELL_SIZE * 0.4}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const vehicle of gameState.vehicles) {
                ctx.fillStyle = 'white';
                ctx.fillText('🚚', vehicle.x, vehicle.y);
                if (vehicle.cargo.amount > 0) {
                    const res = RESOURCES[vehicle.cargo.type];
                    if (res) ctx.fillText(res.emoji, vehicle.x, vehicle.y + CELL_SIZE * 0.3);
                }
            }
            return;
        }

        const imageWidth = CELL_SIZE * 0.8;
        const imageHeight = imageWidth * (truckImage.height / truckImage.width);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8 / camera.zoom;
        ctx.shadowOffsetX = 2 / camera.zoom;
        ctx.shadowOffsetY = 4 / camera.zoom;

        const ZOOM_THRESHOLD_FOR_ID = 0.7; 
        const showVehicleId = camera.zoom > ZOOM_THRESHOLD_FOR_ID;

        for (const vehicle of gameState.vehicles) {
            let directionX = 1; 

            if (['GOING_TO_PICKUP', 'GOING_TO_DROPOFF', 'RETURNING_TO_BASE'].includes(vehicle.state)) {
                let targetPos = null;
                if (vehicle.state === 'RETURNING_TO_BASE') {
                    targetPos = vehicle.ownerGaragePos;
                } else if (vehicle.state === 'GOING_TO_PICKUP') {
                    targetPos = vehicle.pickupTargetPos;
                } else {
                    targetPos = vehicle.dropoffTargetPos;
                }

                if (targetPos) {
                    const dx = targetPos.x - vehicle.x;
                    if (dx < -0.1) {
                        directionX = -1; 
                    } else if (dx > 0.1) {
                        directionX = 1; 
                    }
                }
            }

            ctx.save();
            ctx.translate(vehicle.x, vehicle.y);
            ctx.scale(directionX, 1);
            ctx.drawImage(
                truckImage,
                -imageWidth / 2,
                -imageHeight / 2,
                imageWidth,
                imageHeight
            );
            ctx.restore();

            if (vehicle.cargo.amount > 0) { 
                const res = RESOURCES [vehicle.cargo.type]; 
                if (res) { 
                    ctx.shadowColor = 'transparent'; 
                    ctx.font = `${CELL_SIZE * 0.35}px sans-serif`; 
                    ctx.textAlign = 'center'; 
                    ctx.textBaseline = 'middle'; 
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; 
                    ctx.beginPath(); 
                    ctx.arc(vehicle.x, vehicle.y - imageHeight * 0.1, CELL_SIZE * 0.2, 0, 2 * Math.PI); 
                    ctx.fill(); 
                    ctx.fillText(res.emoji, vehicle.x, vehicle.y - imageHeight * 0.1); 
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; 
                }
            }

            if (showVehicleId) { 
                const truckIdText = `#${vehicle.id.toString().slice(-4)}`; 
                const textY = vehicle.y - (imageHeight / 2) - (5 / camera.zoom); 

                ctx.font = `bold ${CELL_SIZE * 0.22}px sans-serif`; 
                ctx.textAlign = 'center'; 
                ctx.textBaseline = 'bottom'; 
                ctx.shadowColor = 'transparent'; 

                const textMetrics = ctx.measureText(truckIdText); 
                const padding = 4 / camera.zoom; 
                const rectWidth = textMetrics.width + padding * 2; 
                const rectHeight = (CELL_SIZE * 0.22) + padding * 2; 
                const rectX = vehicle.x - rectWidth / 2; 
                const rectY = textY - rectHeight + padding; 

                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; 
                ctx.fillRect(rectX, rectY, rectWidth, rectHeight); 
                
                ctx.fillStyle = 'white'; 
                ctx.fillText(truckIdText, vehicle.x, textY); 

                 ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            }
        }

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    
    function drawTooltip() {
        if (hoverState.cellIndex === -1 || selectedBuildingType || isDemolishMode) return;

        const cell = gameState.grid[hoverState.cellIndex];
        const hoveredMarket = QuestSystem.getMarketAt(gameState, hoverState.cellIndex);
        let textLines = [];

        if (hoveredMarket) {
            textLines.push(...QuestSystem.getTooltipText(hoveredMarket, RESOURCES, getIconHTML));
        }
        else if (cell.building) {
            const b = cell.building;
            const bp = BUILDING_BLUEPRINTS[b.type];
            textLines.push(`${getIconHTML(bp.emoji, b.type)} ${bp.name}`);

            // === 1. ГЛОБАЛЬНАЯ ПРОВЕРКА ОШИБОК (ДЛЯ ВСЕХ ЗДАНИЙ) ===
            // Это покажет "Нет энергии" и для складов, и для гаражей
            if (b.statusFlags && b.statusFlags.length > 0) {
                if (b.statusFlags.includes('no_power')) {
                    textLines.push(`<span style="color: #fc8181; font-weight: bold;">⚡️ Нет энергии! (Нужно: ${bp.consumption?.power || 0})</span>`);
                }
                if (b.statusFlags.includes('output_full')) {
                    textLines.push(`<span style="color: #f6e05e; font-weight: bold;">🛑 Склад переполнен!</span>`);
                }
                if (b.statusFlags.includes('depleted')) {
                    textLines.push(`<span style="color: #fc8181; font-weight: bold;">❌ Исчерпано</span>`);
                }
            }
            
            // Отображение потребления, если всё хорошо (чтобы игрок знал, сколько жрёт)
            if (bp.consumption && bp.consumption.power && (!b.statusFlags || !b.statusFlags.includes('no_power'))) {
                 textLines.push(`<span style="color: #63b3ed; font-size: 0.9em;">⚡ Потребление: -${bp.consumption.power}</span>`);
            }
            // ========================================================

            if (b.type === 'warehouse') {
                const warehouseId = gameState.buildings.filter(bld => bld.type === 'warehouse').indexOf(b) + 1;
                const storedAmount = Object.values(b.storage || {}).reduce((sum, val) => sum + val, 0);
                textLines.push(`Склад #${warehouseId} (${Math.floor(storedAmount)} / ${b.capacity})`);

                const storedItems = Object.entries(b.storage || {})
                    .filter(([, amount]) => amount > 0)
                    .map(([res, amount]) => `\t${getIconHTML(RESOURCES[res].emoji, res)} ${RESOURCES[res].name}: ${Math.floor(amount)}`);

                if (storedItems.length > 0) {
                    textLines.push(...storedItems);
                } else {
                    textLines.push("\t(Пусто)");
                }
                
                // Настройки фильтра
                if (b.allowedResources && b.allowedResources.size < Object.keys(RESOURCES).length) {
                     textLines.push(`<span style="color: #ecc94b; font-size: 0.8em;">⚙️ Настроен фильтр</span>`);
                }
            }
            else if (b.type === 'garage') {
                const vehicles = gameState.vehicles.filter(v => v.ownerBuildingId === b.id);
                // Показываем статус машин внутри гаража
                const stoppedVehicles = vehicles.filter(v => v.state === 'IDLE' && b.statusFlags && b.statusFlags.includes('no_power')).length;
                
                textLines.push(`${getIconHTML('🚚')} Грузовиков: ${vehicles.length}`);
                if (stoppedVehicles > 0) {
                    textLines.push(`<span style="color: #fc8181;">⛔ Остановлено: ${stoppedVehicles}</span>`);
                }
                textLines.push(`${getIconHTML('💡')} Кликните, чтобы открыть меню логистики`);
            }
            else if (b.type === 'export_depot') {
                textLines.push(`Статус: ${gameState.exportEnabled ? `${getIconHTML('✅')} Экспорт активен` : `${getIconHTML('❌')} Экспорт отключен`}`);
                textLines.push(`${getIconHTML('💡')} Кликните для переключения`);
            }
            else if (b.type === 'transport_hub') {
                const imgSrc = "i_look/1_look_elf.png"; 
                textLines.push(`
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 220px;">
                        <img src="${imgSrc}" style="width: 120px; height: 164px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.3);" />
                        <div>
                            <div style="font-weight: bold; color: #ffd700; margin-bottom: 4px;">Диспетчер</div>
                            <div style="font-size: 13px; color: #e2e8f0;">Работаем в штатном режиме!</div>
                            <span style="font-size: 13px; color: #e2e8f0;">${getIconHTML('💡')} Нажми для просмотра Журнала событий</span>
                        </div>
                    </div>
                `);
            }
            // === ИНФО О ГЕНЕРАТОРЕ ЭНЕРГИИ ===
            if (bp.category === 'power' && window.PowerGridSystem) {
                const myOutput = bp.production.outputs.power;
                const connections = window.PowerGridSystem.getConnectionCount(gameState, b.id);
                const maxConn = window.PowerGridSystem.MAX_CONNECTIONS;
                
                // 1. Собственная выработка
                textLines.push(`<span style="color: #f6e05e;">⚡ Выработка: +${myOutput}</span>`);
                
                // 2. Подключения
                let connColor = '#cbd5e0';
                if (connections === 0) connColor = '#fc8181'; // Красный если нет проводов
                if (connections >= maxConn) connColor = '#ecc94b'; // Желтый если предел
                
                textLines.push(`<span style="color: ${connColor}; font-size: 0.9em;">🔌 Подключений: ${connections} / ${maxConn}</span>`);

                // 3. Баланс сети (Самое важное!)
                const netStats = window.PowerGridSystem.getNetworkStats(b.id);
                if (netStats) {
                    const load = netStats.totalCons;
                    const capacity = netStats.totalGen;
                    // Рассчитываем процент нагрузки
                    const loadPct = capacity > 0 ? (load / capacity) * 100 : 0;
                    
                    let balanceColor = '#48bb78'; // Зеленый
                    if (load > capacity) balanceColor = '#fc8181'; // Перегрузка (Красный)
                    else if (loadPct > 90) balanceColor = '#ecc94b'; // Почти предел (Желтый)

                    textLines.push(`Статус Сети:`);
                    textLines.push(`Нагрузка: <span style="color: ${balanceColor}; font-weight: bold;">${load} / ${capacity}</span>`);
                    
                    if (load > capacity) {
                        textLines.push(`<span style="color: #fc8181; font-weight: bold; font-size: 0.85em;">⚠️ ПЕРЕГРУЗКА! (-${(load-capacity).toFixed(0)})</span>`);
                    } else {
                        textLines.push(`<span style="color: #a0aec0; font-size: 0.85em;">Запас: ${(capacity - load).toFixed(0)}</span>`);
                    }
                } else {
                    textLines.push(`<span style="color: #a0aec0; font-style: italic;">Не подключен к сети</span>`);
                }
            }
            else if (b.type === 'driver_house') {
                // ... (код общежития без изменений) ...
                 if (window.DriverSystem) {
                    const totalSal = window.DriverSystem.calculateTotalSalaryPreview(gameState);
                    textLines.push(`${getIconHTML('💰')} Расход: -${totalSal}$`);
                    textLines.push(`(каждые 1.5 мин)`);
                    const totalSlots = gameState.buildings.filter(bld => bld.type === 'driver_house').length * 4;
                    const hired = gameState.hiredDrivers.length;
                    const totalTrucks = gameState.vehicles.length;
                    const trucksWithDrivers = gameState.vehicles.filter(v => v.driverId).length;
                    const interns = totalTrucks - trucksWithDrivers;
                    textLines.push(`${getIconHTML('👥')} Элита: ${hired} / ${totalSlots} мест`);
                    if (interns > 0) textLines.push(`🎓 Стажеры: ${interns} (в гаражах)`);
                    textLines.push(`${getIconHTML('💡')} Кликните для управления`);
                }
            }
            else if (b.type === 'residential_house') {
                // ... (код домов без изменений) ...
                 const warehouses = gameState.buildings.filter(bld => bld.type === 'warehouse');
                const allResources = {};
                warehouses.forEach(wh => {
                    Object.entries(wh.storage || {}).forEach(([resType, amount]) => {
                        if (amount > 0) allResources[resType] = (allResources[resType] || 0) + amount;
                    });
                });
                if (Object.keys(allResources).length > 0) {
                    textLines.push(`${getIconHTML('💰')} Цены продажи в город:`);
                    Object.entries(allResources)
                        .sort(([resA], [resB]) => RESOURCES[resA].name.localeCompare(RESOURCES[resB].name))
                        .forEach(([resType, totalAmount]) => {
                            const resourceDef = RESOURCES[resType];
                            if (resourceDef && resourceDef.baseExportPrice) {
                                const cityPrice = (resourceDef.baseExportPrice / 2.6).toFixed(2);
                                textLines.push(`\t${getIconHTML(resourceDef.emoji, resType)} ${resourceDef.name}: ${cityPrice} $ за 1 ед.`);
                            }
                        });
                } else {
                    textLines.push(`${getIconHTML('📦')} На складах нет ресурсов для продажи`);
                }
            }
            else { 
                // ЗАВОДЫ И ШАХТЫ
                if (bp.category === 'extraction') {
                    // ... (код ресурсов в земле без изменений) ...
                     const resourceCells = getBuildingResourceCells(b);
                    if (resourceCells.length > 0) {
                        const resourceGroups = {};
                        resourceCells.forEach(cellInfo => {
                            if (!resourceGroups[cellInfo.resource]) resourceGroups[cellInfo.resource] = [];
                            resourceGroups[cellInfo.resource].push(cellInfo);
                        });
                        Object.entries(resourceGroups).forEach(([resType, cells]) => {
                            const resourceDef = RESOURCES[resType];
                            if (!resourceDef) return;
                            cells.sort((a, b) => a.cellNumber - b.cellNumber);
                            const activeCells = cells.filter(c => c.resourceAmount > 0);
                            let infoParts = [];
                            if (activeCells.length > 0) {
                                const cellNumbers = activeCells.map(c => c.cellNumber);
                                const totalAmount = activeCells.reduce((sum, c) => sum + c.resourceAmount, 0);
                                const totalMax = activeCells[0].maxAmount * activeCells.length;
                                infoParts.push(`${Math.floor(totalAmount).toLocaleString()}/${totalMax.toLocaleString()} (клетки ${cellNumbers.join(', ')})`);
                            }
                            if (infoParts.length > 0) {
                                textLines.push(`${getIconHTML(resourceDef.emoji, resType)} ${resourceDef.name}: ${infoParts.join(', ')}`);
                            }
                        });
                    } else {
                        textLines.push('Ресурсы исчерпаны');
                    }
                }
                
                // Проверка ингредиентов (оставлена только она, т.к. no_power и output_full вынесены наверх)
                if (b.missingResources && b.missingResources.length > 0) {
                    const missingNames = b.missingResources.map(resKey => {
                        const res = RESOURCES[resKey];
                        const rName = res?.name || resKey;
                        const rEmoji = res?.emoji || '❓';
                        return `${getIconHTML(rEmoji, resKey)} ${rName}`; 
                    }).join(', ');
                    textLines.push(`<span style="color: #fc8181; font-weight: bold;">⚠️ Не хватает: ${missingNames}</span>`);
                }
                
                // Вход/Выход
                if (b.outputBuffer && b.outputBuffer.amount > 0) {
                    const outRes = b.outputBuffer.resource;
                    const outIcon = getIconHTML(RESOURCES[outRes].emoji, outRes);
                    textLines.push(`Выход: ${outIcon} ${RESOURCES[outRes].name} ${Math.floor(b.outputBuffer.amount)}/${bp.outputCapacity || bp.bufferCapacity}`);
                }
                if (b.inputBuffer) {
                    const inputs = Object.entries(b.inputBuffer)
                        .filter(([, amount]) => amount > 0)
                        .map(([res, amount]) => `${getIconHTML(RESOURCES[res].emoji, res)} ${RESOURCES[res].name} ${amount}`)
                        .join(', ');
                    if (inputs) textLines.push(`Вход: ${inputs}`);
                }
            }
        }
        else if (cell.resource) {
            textLines.push(`${RESOURCES[cell.resource].name}: ${Math.floor(cell.resourceAmount).toLocaleString()}`);
        }

        if (textLines.length === 0) {
            const existingTooltip = document.getElementById('canvas-tooltip');
            if (existingTooltip) existingTooltip.remove();
            return;
        }

        let tooltip = document.getElementById('canvas-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'canvas-tooltip';
            tooltip.style.cssText = `
                position: absolute;
                background: rgba(26, 32, 44, 0.95);
                color: white;
                padding: 10px 15px;
                border-radius: 8px;
                border: 1px solid rgba(203, 213, 224, 0.3);
                font-size: 14px;
                font-family: 'Segoe UI', sans-serif;
                pointer-events: none;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                max-width: 300px;
                line-height: 1.5;
            `;
            document.body.appendChild(tooltip);
        }

        const tooltipContent = textLines.map(line => {
            const hasTab = line.startsWith('\t');
            const content = hasTab ? line.substring(1) : line;
            const style = hasTab ? 'padding-left: 20px;' : '';
            return `<div style="${style}">${content}</div>`;
        }).join('');

        tooltip.innerHTML = tooltipContent;

        const canvasRect = canvas.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let tooltipX = hoverState.mouseX + canvasRect.left + 15;
        let tooltipY = hoverState.mouseY + canvasRect.top + 15;

        if (tooltipX + tooltipRect.width > window.innerWidth) {
            tooltipX = hoverState.mouseX + canvasRect.left - tooltipRect.width - 15;
        }
        if (tooltipY + tooltipRect.height > window.innerHeight) {
            tooltipY = hoverState.mouseY + canvasRect.top - tooltipRect.height - 15;
        }

        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;
        tooltip.style.display = 'block';
    }

    // =================================================================================
    // IV. УПРАВЛЕНИЕ КАМЕРОЙ И СОБЫТИЯ МЫШИ
    // =================================================================================
    
    function onMouseDown(e) { 
        if (e.button === 0 || e.button === 1) { 
            camera.isDragging = true; 
            camera.lastX = e.clientX; 
            camera.lastY = e.clientY; 
        } 
    }

    function onMouseUp(e) { 
        if (e.button === 0 || e.button === 1) { 
            camera.isDragging = false; 
        } 
    }

    function onMouseMove(e) { 
        const rect = canvas.getBoundingClientRect(); 
        hoverState.mouseX = e.clientX - rect.left; 
        hoverState.mouseY = e.clientY - rect.top; 
        
        // 1. Считаем мировые координаты
        const worldPos = screenToWorld(hoverState.mouseX, hoverState.mouseY); 
        const { col, row } = worldToGrid(worldPos.x, worldPos.y); 
        
        hoverState.cellIndex = (col >= 0 && col < GRID_WIDTH && row >= 0 && row < GRID_HEIGHT) ? row * GRID_WIDTH + col : -1; 

        // === НАСТРОЙКА КАСТОМНЫХ КУРСОРОВ ===
        // 16 16 - это центр картинки 32x32 (hotspot)
        const CURSOR_GRAB     = "url('icon/cursor_grab.png') 16 16, grab";
        const CURSOR_GRABBING = "url('icon/cursor_grabbing.png') 16 16, grabbing";
        const CURSOR_POINTER  = "url('icon/cursor_pointer.png') 0 0, pointer";
        const CURSOR_CROSSHAIR= "url('icon/cursor_crosshair.png') 16 16, crosshair";

        // Указательный палец (активные зоны, кнопки). Hotspot на кончике пальца (10 2)
        const CURSOR_FINGER   = "url('icon/cursor_finger.png') 10 2, pointer"; 
        // Вопрос (можно использовать для тултипов или справочника). Hotspot (0 0)
        const CURSOR_HELP     = "url('icon/cursor_help.png') 0 0, help";
        
        // 2. Логика перетаскивания и курсора
        if (camera.isDragging) { 
            gameWorldElement.style.cursor = CURSOR_GRABBING; // Используем кастомный 'grabbing'
            
            const dx = e.clientX - camera.lastX; 
            const dy = e.clientY - camera.lastY; 
            camera.x -= dx / camera.zoom; 
            camera.y -= dy / camera.zoom; 
            camera.lastX = e.clientX; 
            camera.lastY = e.clientY; 
        } 
        // Проверка режимов строительства, сноса, рисования границ или электросетей
        else if (selectedBuildingType || isDemolishMode || isDrawingBorderMode || (window.PowerGridSystem && window.PowerGridSystem.isOverlayActive)) { 
            gameWorldElement.style.cursor = CURSOR_CROSSHAIR; // Используем кастомный 'прицел'
        } 
        else if (hoverState.cellIndex !== -1) { 
            const cell = gameState.grid[hoverState.cellIndex]; 
            
            // Если навели на здание, с которым можно взаимодействовать -> РУКА С ПАЛЬЦЕМ
            if (cell.building && (
                cell.building.type === 'garage' || 
                cell.building.type === 'export_depot' || 
                cell.building.type === 'transport_hub' || 
                cell.building.type === 'driver_house' ||
                cell.building.type === 'warehouse'
            )) { 
                gameWorldElement.style.cursor = CURSOR_FINGER; 
            } 
            // Если навели на ресурсы или просто карту -> ЛАДОНЬ
            else { 
                gameWorldElement.style.cursor = CURSOR_GRAB; 
            } 
        } else { 
            gameWorldElement.style.cursor = CURSOR_GRAB; 
        } 

        // 3. Обновление мыши для проводов
        if (window.PowerGridSystem) {
            window.PowerGridSystem.mousePos = worldPos;
        }
    }

    function onMouseLeave() { 
        hoverState.cellIndex = -1;
        const tooltip = document.getElementById('canvas-tooltip');
        if (tooltip) tooltip.remove();
    }

    function onWheel(e) { 
        e.preventDefault(); 
        const worldBeforeZoom = screenToWorld(hoverState.mouseX, hoverState.mouseY); 
        const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1; 
        camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * zoomAmount)); 
        const worldAfterZoom = screenToWorld(hoverState.mouseX, hoverState.mouseY); 
        camera.x += worldBeforeZoom.x - worldAfterZoom.x; 
        camera.y += worldBeforeZoom.y - worldAfterZoom.y; 
    }

    function onCanvasClick(e) {
        // 1. Сначала проверяем, не было ли это перетаскиванием карты
        const dist = Math.hypot(e.clientX - camera.lastX, e.clientY - camera.lastY);
        if (camera.isDragging && dist > 5 && e.button !== 1) return;

        // 2. Один раз считаем координаты для всех проверок
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const worldPos = screenToWorld(clickX, clickY); 

        // 3. Логика Электросетей
        // Удаление провода (Alt + Click)
        if (isAltPressed && window.PowerGridSystem) {
            if (window.PowerGridSystem.removeCableAt(worldPos, gameState)) return;
        }

        // Добавление провода / Клик по пину
        if (window.PowerGridSystem && window.PowerGridSystem.handleClick(worldPos, gameState)) {
            return; // Если клик обработан системой проводов, выходим
        }
    
        // 4. Логика Границ Хабов (Режим рисования)
        if (isDrawingBorderMode && editingHubId) {
            const hub = gameState.buildings.find(b => b.id === editingHubId);
    
            if (hub) {
                if (!hub.customBorderPoints) hub.customBorderPoints = [];
    
                if (hub.customBorderPoints.length > 2) {
                    const startPoint = hub.customBorderPoints[0];
                    const distToStart = Math.hypot(worldPos.x - startPoint.x, worldPos.y - startPoint.y);
    
                    // Замыкание границы
                    if (distToStart < 30 / camera.zoom) {
                        isDrawingBorderMode = false;
                        editingHubId = null;
                        showNotification("Граница успешно создана!", "success");
                        const modal = document.getElementById('dispatch-modal');
                        if (modal) {
                            modal.style.display = 'flex';
                            updateHubsList();
                        }
                        updateUI();
                        return;
                    }
                }
    
                // Добавление точки границы
                hub.customBorderPoints.push({
                    x: Math.floor(worldPos.x),
                    y: Math.floor(worldPos.y)
                });
    
                if (window.ParticleSystem) {
                    window.ParticleSystem.emitSparks(worldPos.x, worldPos.y, 1);
                }
            }
            return;
        }
    
        // 5. Стандартный клик по клетке (Выбор здания / Строительство)
        if (hoverState.cellIndex !== -1 && e.button === 0) {
            onCellClick(hoverState.cellIndex);
        }
    }

    const screenToWorld = (sx, sy) => ({ x: (sx - canvas.width / 2) / camera.zoom + camera.x, y: (sy - canvas.height / 2) / camera.zoom + camera.y });
    const worldToGrid = (wx, wy) => ({ col: Math.floor(wx / CELL_SIZE), row: Math.floor(wy / CELL_SIZE) });
    // =================================================================================
    // V. ОСНОВНАЯ ЛОГИКА ИГРЫ
    // =================================================================================
    function checkGameOver() {
    if (gameState.isGameOver) return;

    // 1. СНАЧАЛА БУНТ
    if (gameState.cityStatus && gameState.cityStatus.dissatisfaction >= 100) {
        triggerGameOver('riot'); // <-- Передаем строку 'riot'
        return;
    }

    // 2. ПОТОМ ДЕНЬГИ
    if (gameState.money < 0) {
        triggerGameOver('bankruptcy');
        return;
    }
}

function triggerGameOver(reason) {
    gameState.isGameOver = true;
    isPaused = true;
    
    // Элементы UI
    const screen = document.getElementById('game-over-screen');
    const contentBox = document.getElementById('go-content-box');
    const iconEl = document.getElementById('go-icon');
    const titleEl = document.getElementById('go-title');
    const reasonEl = document.getElementById('go-reason');
    
    // Сброс классов стилей
    contentBox.className = 'modal-content game-over-content';

    if (reason === 'bankruptcy') {
        // Настройка для банкротства
        iconEl.textContent = '💸';
        titleEl.textContent = 'БАНКРОТСТВО!';
        reasonEl.textContent = 'Ваша компания разорилась. Баланс ушел в минус.';
        // Стандартный стиль (красный) уже задан в CSS по умолчанию
    } 
    else if (reason === 'riot') {
        // Настройка для бунта
        iconEl.textContent = '🔥';
        titleEl.textContent = 'БУНТ В ГОРОДЕ!';
        reasonEl.textContent = 'Жители взбунтовались из-за дефицита ресурсов. Мэр отозвал вашу лицензию.';
        contentBox.classList.add('riot'); // Добавляем оранжевый стиль
    }

    // Заполнение статистики (общая часть)
    const finalMoneyEl = document.getElementById('go-final-money');
    const daysEl = document.getElementById('go-days-survived');
    
    if (finalMoneyEl) finalMoneyEl.textContent = Math.floor(gameState.money).toLocaleString() + "$";
    if (daysEl) {
        const secondsPlayed = (Date.now() - gameState.startTime) / 1000;
        const days = Math.floor(secondsPlayed / 60); 
        daysEl.textContent = days + " дн.";
    }

    // Показываем экран
    screen.style.display = 'flex';
}

function triggerGameOver(reason) {
    gameState.isGameOver = true;
    isPaused = true;
    
    console.log(`💀 GAME OVER triggered. Reason: ${reason}`); // Отладка в консоли

    // Получаем элементы
    const screen = document.getElementById('game-over-screen');
    const contentBox = document.getElementById('go-content-box');
    const iconEl = document.getElementById('go-icon');
    const titleEl = document.getElementById('go-title');
    const reasonEl = document.getElementById('go-reason');
    const finalMoneyEl = document.getElementById('go-final-money');
    const daysEl = document.getElementById('go-days-survived');

    // Проверка на ошибки (если забыли добавить ID в HTML)
    if (!contentBox || !iconEl || !titleEl || !reasonEl) {
        console.error("❌ ОШИБКА: Не найдены элементы Game Over в HTML! Проверьте ID: go-content-box, go-icon, go-title, go-reason");
        // Показываем экран даже если элементы не найдены, чтобы игра не зависла
        if (screen) screen.style.display = 'flex'; 
        return;
    }

    // Сброс классов (убираем старый класс riot, если был)
    contentBox.className = 'modal-content game-over-content';

    if (reason === 'riot') {
        // --- БУНТ ---
        console.log("Applying RIOT styles...");
        iconEl.textContent = '🔥';
        titleEl.textContent = 'БУНТ В ГОРОДЕ!';
        reasonEl.textContent = 'Жители взбунтовались (Недовольство 100%). Вас свергли.';
        contentBox.classList.add('riot'); // Добавляем оранжевый стиль
    } 
    else {
        // --- БАНКРОТСТВО (или любая другая причина) ---
        console.log("Applying BANKRUPTCY styles...");
        iconEl.textContent = '💸';
        titleEl.textContent = 'БАНКРОТСТВО!';
        reasonEl.textContent = 'Ваша компания разорилась. Баланс ушел в минус.';
    }

    // Обновляем статистику
    if (finalMoneyEl) finalMoneyEl.textContent = Math.floor(gameState.money).toLocaleString() + "$";
    
    if (daysEl && gameState.startTime) {
        const secondsPlayed = (Date.now() - gameState.startTime) / 1000;
        const days = Math.floor(secondsPlayed / 60);
        daysEl.textContent = days + " дн.";
    }

    // Показываем экран
    if (screen) {
        screen.style.display = 'flex';
    }
}
    function gameTick() {
        if (isPaused) return;

        // 1. Сначала сохраняем статистику предыдущего тика, если она есть
        if (Object.keys(gameState.resourceFlow || {}).length > 0) {
            // Считаем общие показатели
            const totalProd = Object.values(gameState.resourceFlow).reduce((a, b) => a + b.produced, 0);
            const totalCons = Object.values(gameState.resourceFlow).reduce((a, b) => a + b.consumed, 0);
            
            gameState.statsHistory.push({
                tick: Date.now(),
                money: gameState.money,
                production: totalProd,
                consumption: totalCons,
                 flow: gameState.resourceFlow ? JSON.parse(JSON.stringify(gameState.resourceFlow)) : {},
                consumptionDetails: JSON.parse(JSON.stringify(consumptionStats || {})) 
            });
        if (window.ReportsSystem) window.ReportsSystem.handleGameTick();
            // Храним историю за последние 50 тиков (примерно 2-3 минуты)
            if (gameState.statsHistory.length > 50) gameState.statsHistory.shift();
        }
    
        consumptionStats = {}; 
        gameState.resourceFlow = Object.keys(RESOURCES).reduce((acc, key) => ({...acc, [key]: { produced: 0, consumed: 0 } }), {});

        QuestSystem.updateSeasonalQuests(gameState, GRID_WIDTH, GRID_HEIGHT, TICK_INTERVAL);
        updateStorageAndGlobalResources();
        updatePower(consumptionStats);
        updateProduction(consumptionStats);
        updateMarket();
        checkForRandomEvents(); 
        checkNewUnlocks();
        if (window.BankSystem) window.BankSystem.update(gameState, TICK_INTERVAL);
        // Обновляем систему города (передаем deltaTime в секундах, т.к. TICK_INTERVAL в мс, делим на 1000 и умер если минус)
    if (window.CityManagementSystem) {
        window.CityManagementSystem.update(gameState, TICK_INTERVAL / 1000);
    }
    // Обновляем UI банка, если он открыт (чтобы таймеры тикали)
        if(document.getElementById('bank-modal').style.display === 'flex') {
            window.BankSystem.renderUI(gameState);
        }
     if (window.DriverSystem || window.WorkerSystem) {
	        // Увеличиваем таймер на время прошедшего тика (обычно 2000 мс)
	        gameState.salaryTimer = (gameState.salaryTimer || 0) + TICK_INTERVAL;
	        
	        // 1 минута 30 секунд = 90 000 миллисекунд
	        if (gameState.salaryTimer >= 90000) {
	            if (window.DriverSystem) {
	                window.DriverSystem.processSalaries(gameState);
	            }
	            if (window.WorkerSystem) {
	                window.WorkerSystem.processSalaries(gameState);
	            }
	            gameState.salaryTimer = 0; // Сброс таймера
	        }
	    }
    updateUI();
    checkGameOver(); 
    }
    // Возвращает итоговый радиус хаба с учетом настроек и работников
function getEffectiveHubRadius(hub) {
    let radius = hub.radius || 500;
    
    // Если есть система работников, добавляем бонус
    if (window.WorkerSystem) {
        const buff = window.WorkerSystem.getBuffStats(hub);
        if (buff.type === 'radius' && buff.absoluteBonus) {
            radius += buff.absoluteBonus;
        }
    }
    return radius;
}
    
function updatePower(stats = {}) { 
    // 1. Сбрасываем значения
    gameState.power = { current: 0, capacity: 0 };

    // 2. Обработка топлива
    const powerProducers = gameState.buildings.filter(b => 
        window.BUILDING_BLUEPRINTS[b.type].category === 'power'
    ); 
    
    powerProducers.forEach(building => { 
        const blueprint = BUILDING_BLUEPRINTS[building.type]; 
        
        // Сброс флагов
        if (building.missingResources) {
            building.missingResources = building.missingResources.filter(r => r !== 'coal');
        } else {
            building.missingResources = [];
        }

        // === БАФФЫ РАБОТНИКОВ ===
        let buffStats = { multiplier: 1.0 };
        if (window.WorkerSystem) {
            buffStats = window.WorkerSystem.getBuffStats(building);
        }
        // ========================

        if (blueprint.consumption?.coal > 0) { 
            // Масштабируем потребление, если работники увеличивают выработку (type: output/speed)
            // Если type: radius (странно для ТЭС) или efficiency, логика другая, но обычно у ТЭС 'output'
            let requiredCoal = blueprint.consumption.coal;
            if (buffStats.type === 'output' || buffStats.type === 'speed') {
                requiredCoal *= buffStats.multiplier;
            } else if (buffStats.type === 'efficiency') {
                requiredCoal /= buffStats.multiplier;
            }

            if (gameState.resources.coal >= requiredCoal) { 
                consumeFromWarehouses('coal', requiredCoal);
                if (gameState.resources.coal) gameState.resources.coal -= requiredCoal;
                
                if (!gameState.resourceFlow.coal) gameState.resourceFlow.coal = { produced: 0, consumed: 0 };
                gameState.resourceFlow.coal.consumed += requiredCoal;
            } else { 
                building.missingResources.push('coal'); // Нет угля
            } 
        } 
    }); 
    
    // 3. Расчет сетей (WorkerSystem.getBuffStats уже вызывается внутри PowerGridSystem.update для генерации)
    if (window.PowerGridSystem) {
        window.PowerGridSystem.update(gameState);
    } else {
        // Fallback (старая логика)
        gameState.buildings.forEach(b => { 
            let output = BUILDING_BLUEPRINTS[b.type].consumption?.power || 0; // Ошибка нейминга в старом коде, тут должна быть генерация
            // В фоллбеке можно не заморачиваться, так как PowerGridSystem инициализируется всегда
        }); 
    }

    // 4. Уведомление
    if (gameState.power.current > gameState.power.capacity) {
        const now = Date.now();
        if (!gameState.lastPowerWarning || (now - gameState.lastPowerWarning > 15000)) {
            showNotification(
                `⚠️ Перегрузка сети! (${gameState.power.current.toFixed(0)} / ${gameState.power.capacity.toFixed(0)})`, 
                'error', 
                6000 
            );
            gameState.lastPowerWarning = now;
        }
    } else {
        gameState.lastPowerWarning = 0;
    }
}

    function updateProduction(stats = {}) { 
    // Мы удалили powerDeficit, теперь проверяем каждое здание индивидуально через сетку
    
    gameState.buildings.forEach(b => {
        const blueprint = BUILDING_BLUEPRINTS[b.type];
        // Сброс флагов
        b.missingResources = []; 
        b.statusFlags = []; 

        // 1. ПРОВЕРКА ЭЛЕКТРИЧЕСТВА ДЛЯ ВСЕХ ЗДАНИЙ
        if (blueprint.consumption && blueprint.consumption.power > 0) {
            const isPowered = window.PowerGridSystem ? window.PowerGridSystem.hasPower(b.id) : true;
            
            if (!isPowered) {
                b.statusFlags.push('no_power');
            }
        }

        // Если это НЕ производственное здание, выходим
        if (!blueprint.production || blueprint.category === 'power') return;

        // --- ДАЛЕЕ ИДЕТ ЛОГИКА ЗАВОДОВ ---
        
        // Если нет энергии, завод стопорится
        if (b.statusFlags.includes('no_power')) return;

        // === НОВОЕ: ПОЛУЧЕНИЕ БАФФОВ ОТ СОТРУДНИКОВ ===
        let buffStats = { multiplier: 1.0, type: 'none' };
        if (window.WorkerSystem) {
            buffStats = window.WorkerSystem.getBuffStats(b);
        }
        // ===============================================

        let canProduce = true;

        // 2. Проверка переполнения выхода
        if (b.outputBuffer && b.outputBuffer.amount >= (blueprint.outputCapacity || blueprint.bufferCapacity)) {
            canProduce = false;
            b.statusFlags.push('output_full');
        }

        // 3. Проверка входных ресурсов (ингредиентов)
        // Примечание: Для простоты проверяем наличие БАЗОВОГО количества. 
        // Если из-за скорости нужно больше, consumeFromWarehouses возьмет сколько есть.
        if (blueprint.consumption && blueprint.category !== 'extraction') {
            for (const [res, amount] of Object.entries(blueprint.consumption)) {
                if (res === 'power') continue;
                
                // Рассчитываем требуемое количество с учетом баффа для проверки
                let requiredAmount = amount;
                if (buffStats.type === 'speed') requiredAmount = amount * buffStats.multiplier;
                if (buffStats.type === 'efficiency') requiredAmount = amount / buffStats.multiplier;

                if (!gameState.resources[res] || gameState.resources[res] < requiredAmount) {
                    canProduce = false;
                    b.missingResources.push(res);
                }
            }
        }

        // Получение базового выхода
        let outputResource = null;
        let outputAmount = 0;
        if (blueprint.production && blueprint.production.outputs) {
            const entries = Object.entries(blueprint.production.outputs);
            if (entries.length > 0) {
                [outputResource, outputAmount] = entries[0];
            }
        }

        // === РАСЧЕТ ИТОГОВОГО ВЫХОДА С УЧЕТОМ БАФФА ===
        let finalOutput = outputAmount;
        if (buffStats.type === 'speed' || buffStats.type === 'output') {
            finalOutput = outputAmount * buffStats.multiplier;
        }
        // ==============================================

        // 4. Проверка истощения жил (для добывающих зданий)
        if (canProduce && blueprint.category === 'extraction') {
            const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);
            const baseRow = Math.floor(b.gridIndex / GRID_WIDTH);
            const baseCol = b.gridIndex % GRID_WIDTH;
            let totalAvailable = 0;

            for (let r = 0; r < tileHeight; r++) {
                for (let c = 0; c < tileWidth; c++) {
                    const idx = (baseRow + r) * GRID_WIDTH + (baseCol + c);
                    const cell = gameState.grid[idx];
                    if (cell && cell.resource === blueprint.resourceType && cell.resourceAmount > 0) {
                        totalAvailable += cell.resourceAmount;
                    }
                }
            }

            // Проверяем, хватит ли ресурсов на УВЕЛИЧЕННУЮ добычу
            if (totalAvailable < finalOutput) {
                // Если ресурсов меньше чем надо, но больше 0, мы всё равно добываем (остатки)
                // Ставим флаг depleted только если совсем пусто
                if (totalAvailable <= 0) {
                    canProduce = false;
                    b.statusFlags.push('depleted');
                }
            }
        }

        // Если всё ок — производим
        if (canProduce) {
            // А. ПОТРЕБЛЕНИЕ
            if (blueprint.consumption && blueprint.category !== 'extraction') {
                Object.entries(blueprint.consumption).forEach(([res, amount]) => {
                    if (res !== 'power') {
                        // === ПРИМЕНЕНИЕ БАФФОВ К ПОТРЕБЛЕНИЮ ===
                        let consumedAmount = amount;
                        
                        if (buffStats.type === 'efficiency') {
                            // Эффективность: тратим МЕНЬШЕ ресурсов на то же производство
                            consumedAmount = amount / buffStats.multiplier;
                        } else if (buffStats.type === 'speed') {
                            // Скорость: тратим БОЛЬШЕ ресурсов, так как производим быстрее
                            consumedAmount = amount * buffStats.multiplier;
                        }
                        // ========================================

                        consumeFromWarehouses(res, consumedAmount);
                        if (gameState.resources[res]) gameState.resources[res] -= consumedAmount;
                        
                        // Безопасная запись в статистику
                        if (!gameState.resourceFlow[res]) gameState.resourceFlow[res] = { produced: 0, consumed: 0 };
                        gameState.resourceFlow[res].consumed += consumedAmount;

                        if (!stats[res]) stats[res] = {};
                        if (!stats[res][b.type]) stats[res][b.type] = 0;
                        stats[res][b.type] += consumedAmount;
                    }
                });
            }

            // Б. ПРОИЗВОДСТВО
            if (outputResource !== null) {
                b.outputBuffer.resource = outputResource;
                // Используем finalOutput (с учетом множителя)
                b.outputBuffer.amount += finalOutput;
                
                if (!gameState.resourceFlow[outputResource]) gameState.resourceFlow[outputResource] = { produced: 0, consumed: 0 };
                gameState.resourceFlow[outputResource].produced += finalOutput;

                // --- ЭФФЕКТ ВСПЛЫВАЮЩЕЙ ИКОНКИ ---
                if (window.ParticleSystem && Math.random() < 0.1) { 
                    const pos = getBuildingAnchorWorldPos(b);
                    const resDef = RESOURCES[outputResource];
                    if (resDef) {
                        // Если работает мощный бафф, можно добавить "+" к иконке или изменить цвет
                        window.ParticleSystem.emitFloatingIcon(pos.x, pos.y, resDef.emoji);
                    }
                }
            }

            // В. ИЗВЛЕЧЕНИЕ ИЗ ЗЕМЛИ (EXTRACTION)
            if (blueprint.category === 'extraction') {
                const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);
                const baseRow = Math.floor(b.gridIndex / GRID_WIDTH);
                const baseCol = b.gridIndex % GRID_WIDTH;
                
                // Используем finalOutput, чтобы выкапывать быстрее при баффе скорости
                let remaining = finalOutput;

                for (let r = 0; r < tileHeight && remaining > 0; r++) {
                    for (let c = 0; c < tileWidth && remaining > 0; c++) {
                        const idx = (baseRow + r) * GRID_WIDTH + (baseCol + c);
                        const cell = gameState.grid[idx];
                        if (!cell || cell.resource !== blueprint.resourceType || cell.resourceAmount <= 0) continue;

                        const take = Math.min(remaining, cell.resourceAmount);
                        cell.resourceAmount -= take;
                        remaining -= take;

                        if (cell.resourceAmount <= 0) {
                            cell.resource = null;
                            isMapDirty = true;
                        }
                    }
                }
            }

            triggerProductionAnimation(b.gridIndex);
        }
    });
}

   function updateMarket() {
        // 1. Обновляем спрос стран (это делается глобально)
        gameState.countries.forEach(c => { 
            for (const res in c.demands) { 
                c.demands[res].multiplier = Math.max(0.2, c.demands[res].multiplier + (Math.random() - 0.49) * 0.1); 
            }
        });

        // 2. Перебираем каждый ресурс на рынке
        for (const resKey in gameState.marketConditions) {
            const conditions = gameState.marketConditions[resKey];
            
            // Глобальные колебания
            let globalFluctuation = (Math.random() - 0.5) * 0.05; 
            conditions.globalDemandMultiplier += globalFluctuation;
            conditions.globalDemandMultiplier = Math.max(0.7, Math.min(1.5, conditions.globalDemandMultiplier));

            // Восстановление насыщения
            if (conditions.playerSaturationMultiplier < 1.0) {
                conditions.playerSaturationMultiplier = Math.min(1.0, conditions.playerSaturationMultiplier + MARKET_SATURATION_CONFIG.RECOVERY_RATE);
            }

            // === ИСПРАВЛЕНИЕ: Логика расчета должна быть ВНУТРИ цикла ===
            
            // 1. Получаем модификатор внутреннего спроса (зависит от resKey)
            const internalDemandModifier = ExportSystem.computeInternalDemandModifier(gameState, RESOURCES, resKey);

            // 2. Получаем множитель сложности (из настроек)
            const difficultyPriceMult = gameState.config?.resourcePriceMultiplier || 1.0;

            // 3. Считаем итоговый множитель цены
            let finalPriceMultiplier = conditions.globalDemandMultiplier * conditions.playerSaturationMultiplier * internalDemandModifier * difficultyPriceMult;
            
            // Учитываем активные события
            if (gameState.activeEvent && gameState.activeEvent.effects[resKey]) {
                finalPriceMultiplier *= gameState.activeEvent.effects[resKey];
            }
            
            // Записываем историю цен
            if (RESOURCES[resKey] && RESOURCES[resKey].baseExportPrice > 0) {
                if (!gameState.priceHistory[resKey]) gameState.priceHistory[resKey] = [];
                const currentPrice = RESOURCES[resKey].baseExportPrice * finalPriceMultiplier;
                gameState.priceHistory[resKey].push(currentPrice);
                if (gameState.priceHistory[resKey].length > 50) gameState.priceHistory[resKey].shift();
            }
        }
    }

    // =================================================================================
    // СИСТЕМА СЛУЧАЙНЫХ СОБЫТИЙ
    // =================================================================================

    const RANDOM_EVENTS = [
        {
            name: "Строительный бум",
            message: "Мировой строительный бум! Резко вырос спрос на сталь, стройматериалы и стекло.",
            duration: 60 * 1000, 
            effects: { steel: 1.5, building_kits: 1.4, glass: 1.3 }
        },
        {
            name: "Технологический прорыв",
            message: "Прорыв в электронике! Повышен спрос на микрочипы, кремний и медь.",
            duration: 90 * 1000,
            effects: { microchips: 1.8, silicon: 1.5, copper_wire: 1.4, ai_cores: 1.6 }
        },
        {
            name: "Энергетический кризис",
            message: "Наступил глобальный энергетический кризис. Цены на уголь и нефть взлетели.",
            duration: 75 * 1000,
            effects: { coal: 1.6, oil: 1.4 }
        },
        {
            name: "Промышленный спад",
            message: "Мировая экономика замедлилась. Спрос на базовые промышленные ресурсы упал.",
            duration: 120 * 1000, 
            effects: { iron_ore: 0.7, coal: 0.8, wood: 0.85 }
        },
    ];

    function checkForRandomEvents() {
        if (gameState.activeEvent) {
            gameState.activeEvent.timeLeft -= TICK_INTERVAL;
            if (gameState.activeEvent.timeLeft <= 0) {
                showNotification(`Событие "${gameState.activeEvent.name}" завершилось. Рынок стабилизируется.`, 'info');
                gameState.activeEvent = null;
            }
            return;
        }

        if (Math.random() < 0.01) {
            const eventTemplate = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
            gameState.activeEvent = {
                ...eventTemplate,
                timeLeft: eventTemplate.duration
            };
            showNotification(eventTemplate.message, 'event', 8000); 
        }
    }

    
    /**
     * Списывает указанное количество ресурса со складов ИЛИ виртуального хранилища.
     */
    function consumeFromWarehouses(resourceType, amount) {
        let amountToConsume = amount;
        
        // 1. Сначала пытаемся взять с реальных складов (ОПТИМИЗАЦИЯ: из кеша)
        const warehouses = gameState.buildingCache.warehouses;

        for (const wh of warehouses) {
            if (amountToConsume <= 0) break;
            const available = wh.storage[resourceType] || 0;
            if (available > 0) {
                const canTake = Math.min(amountToConsume, available);
                wh.storage[resourceType] -= canTake;
                amountToConsume -= canTake;
            }
        }

        // 2. ИЗМЕНЕНИЕ: Если на складах не хватило, берем из виртуального (стартового) запаса
        if (amountToConsume > 0 && gameState.virtualStorage) {
            const virtualAvailable = gameState.virtualStorage[resourceType] || 0;
            if (virtualAvailable > 0) {
                const canTake = Math.min(amountToConsume, virtualAvailable);
                gameState.virtualStorage[resourceType] -= canTake;
                // Если стало меньше 0.01, обнуляем для чистоты
                if (gameState.virtualStorage[resourceType] < 0.01) {
                    gameState.virtualStorage[resourceType] = 0;
                }
            }
        }
    }

    // =================================================================================
    // VI. ЛОГИСТИЧЕСКАЯ СИСТЕМА
    // =================================================================================

   function updateLogistics(deltaTime) {
        // Уменьшаем кулдауны задач
        for (const key in taskCooldowns) {
            taskCooldowns[key] -= deltaTime * 1000;
            if (taskCooldowns[key] <= 0) delete taskCooldowns[key];
        }
        
        // Назначаем задачи свободным
        assignVehiclesToTasks();

        gameState.vehicles.forEach(vehicle => {
            // ============================================================
            // 1. ПРОВЕРКА ЭНЕРГИИ ГАРАЖА (БАЗЫ)
            // ============================================================
            const garage = gameState.buildings.find(b => b.id === vehicle.ownerBuildingId);
            
            // Если гараж обесточен, грузовик "замирает"
            if (garage && garage.statusFlags && garage.statusFlags.includes('no_power')) {
                // Мы НЕ сбрасываем в IDLE, чтобы он не забыл задачу.
                // Мы просто выходим из цикла для этого грузовика.
                // Визуально он остановится.
                return; 
            }

            // ============================================================
            // 2. ПРОВЕРКА ЭНЕРГИИ ЦЕЛЕВОГО ЗДАНИЯ (ПРИ ПОГРУЗКЕ/РАЗГРУЗКЕ)
            // ============================================================
            if (vehicle.state === 'LOADING') {
                const sourceBuilding = gameState.buildings.find(b => b.id === vehicle.pickupTargetId);
                // Если грузимся со склада/завода, и он обесточен — пауза процесса
                if (sourceBuilding && sourceBuilding.statusFlags && sourceBuilding.statusFlags.includes('no_power')) {
                    return; // Ждем, пока дадут ток
                }
            }
            
            if (vehicle.state === 'UNLOADING') {
                const targetBuilding = gameState.buildings.find(b => b.id === vehicle.dropoffTargetId);
                // Если разгружаемся на склад, и он обесточен — пауза
                // (Для домов и экспорта проверку можно не делать, если они не требуют энергии)
                if (targetBuilding && targetBuilding.type === 'warehouse' && 
                    targetBuilding.statusFlags && targetBuilding.statusFlags.includes('no_power')) {
                    return; // Ждем, пока дадут ток
                }
            }

            // Если грузовик свободен и выключен игроком
            if (vehicle.state === 'IDLE') return;

            // ============================================================
            // ЛОГИКА ДВИЖЕНИЯ
            // ============================================================
            if (['GOING_TO_PICKUP', 'GOING_TO_DROPOFF', 'RETURNING_TO_BASE'].includes(vehicle.state)) {
                let targetPos;
                if (vehicle.state === 'RETURNING_TO_BASE') targetPos = vehicle.ownerGaragePos;
                else if (vehicle.state === 'GOING_TO_PICKUP') targetPos = vehicle.pickupTargetPos;
                else targetPos = vehicle.dropoffTargetPos;

                if (!targetPos) { vehicle.state = 'IDLE'; return; }
                const dx = targetPos.x - vehicle.x, dy = targetPos.y - vehicle.y, dist = Math.hypot(dx, dy);

                if (dist < 5) { 
                    // Прибыли в точку
                    if (vehicle.state === 'RETURNING_TO_BASE') {
                        // Логика разгрузки остатков при возврате
                        if (vehicle.cargo.amount > 0) {
                            const emergencyWarehouse = findClosestWarehouseWithSpace(
                                    vehicle.ownerBuildingId, 
                                    vehicle.cargo.amount,
                                    null,
                                    vehicle.cargo.type
                                );
                            if (emergencyWarehouse) {
                                const resType = vehicle.cargo.type;
                                emergencyWarehouse.storage[resType] = (emergencyWarehouse.storage[resType] || 0) + vehicle.cargo.amount;
                                addLog(`🚚 Грузовик #${vehicle.id.toString().slice(-4)} вернулся и сдал груз.`, 'info');
                            }
                        }
                        vehicle.cargo = { type: null, amount: 0 };
                        vehicle.state = 'IDLE';
                    }
                    else {
                        // Переход в режим погрузки/разгрузки
                        vehicle.state = vehicle.state === 'GOING_TO_PICKUP' ? 'LOADING' : 'UNLOADING';
                    }
                    vehicle.timer = 2; // Время на операцию
                } else {
                    // Движение
                    vehicle.x += (dx / dist) * vehicle.speed * deltaTime;
                    vehicle.y += (dy / dist) * vehicle.speed * deltaTime;
                }
            }

            // ============================================================
            // ЛОГИКА ОПЕРАЦИЙ (ТАЙМЕР ПОГРУЗКИ/РАЗГРУЗКИ)
            // ============================================================
            if (vehicle.timer > 0) {
                vehicle.timer -= deltaTime;
                if (vehicle.timer <= 0) {
                    
                    // --- ПОГРУЗКА ---
                    if (vehicle.state === 'LOADING') {
                        const sourceBuilding = gameState.buildings.find(b => b.id === vehicle.pickupTargetId);
                        
                        if (sourceBuilding) {
                            let resourceToLoad = null;
                            let availableAmount = 0;

                            if (sourceBuilding.type === 'warehouse') {
                                resourceToLoad = vehicle.cargo.type;
                                availableAmount = sourceBuilding.storage[resourceToLoad] || 0;
                            } else {
                                resourceToLoad = sourceBuilding.outputBuffer.resource;
                                availableAmount = sourceBuilding.outputBuffer.amount;
                                if (!vehicle.cargo.type) vehicle.cargo.type = resourceToLoad;
                            }

                            const stats = getTruckStats(vehicle);
                            const spaceLeft = stats.capacity - vehicle.cargo.amount;
                            const amountToTransfer = Math.min(availableAmount, spaceLeft, vehicle.taskedAmount);
                            
                            if(amountToTransfer > 0){
                                vehicle.cargo.amount += amountToTransfer;
                                vehicle.taskedAmount -= amountToTransfer;

                                if (sourceBuilding.type === 'warehouse') {
                                    sourceBuilding.storage[resourceToLoad] -= amountToTransfer;
                                } else {
                                    sourceBuilding.outputBuffer.amount -= amountToTransfer;
                                }
                            }
                        }
                        
                        // Дозагрузка (Multistop)
                        if (vehicle.cargo.amount < vehicle.capacity && vehicle.taskedAmount > 0) {
                             const nextStop = findNearbyProducerWithSameResource(vehicle.cargo.type, vehicle.pickupTargetId, vehicle.x, vehicle.y);
                             if (nextStop) {
                                 vehicle.pickupTargetId = nextStop.id;
                                 vehicle.pickupTargetPos = getBuildingAnchorWorldPos(nextStop);
                                 vehicle.state = 'GOING_TO_PICKUP';
                                 return;
                             }
                        }
                        vehicle.state = 'GOING_TO_DROPOFF';

                    // --- РАЗГРУЗКА ---
                    } else if (vehicle.state === 'UNLOADING') {
                        const targetBuilding = gameState.buildings.find(b => b.id === vehicle.dropoffTargetId);
                        const targetMarket = gameState.internalMarkets?.find(m => m.id === vehicle.dropoffTargetId);
                        
                        // 1. Квесты
                        if (targetMarket && targetMarket.status === 'active') {
                            const deliveredAmount = QuestSystem.handleDelivery(gameState, vehicle, targetMarket, GRID_WIDTH, GRID_HEIGHT);
                            vehicle.cargo.amount -= deliveredAmount;

                            if (vehicle.cargo.amount <= 0.1) { 
                                vehicle.cargo = { type: null, amount: 0 };
                                vehicle.state = 'IDLE'; 
                            } else {
                                // Остатки везем на склад
                                const nearestWarehouse = findClosestWarehouseWithSpace(
                                    targetMarket.gridIndex, 
                                    vehicle.cargo.amount,
                                    null,
                                    vehicle.cargo.type
                                );
                                
                                if (nearestWarehouse) {
                                    vehicle.dropoffTargetId = nearestWarehouse.id;
                                    vehicle.dropoffTargetPos = getBuildingAnchorWorldPos(nearestWarehouse);
                                    vehicle.state = 'GOING_TO_DROPOFF'; 
                                } else {
                                    vehicle.state = 'RETURNING_TO_BASE'; 
                                }
                            }
                        } 
                        // 2. Город
                        else if (targetBuilding && targetBuilding.type === 'residential_house') {
                            if (vehicle.cargo.amount > 0) {
                                const resourceDef = RESOURCES[vehicle.cargo.type];
                                let amountToProcess = vehicle.cargo.amount;
                                let profit = 0;
                            
                                if (window.CityManagementSystem) {
                                    const acceptedByContract = window.CityManagementSystem.processDelivery(gameState, vehicle.cargo.type, amountToProcess);
                                    if (acceptedByContract > 0) {
                                        amountToProcess -= acceptedByContract;
                                        profit += acceptedByContract * (resourceDef.baseExportPrice * 0.8);
                                    }
                                }
                            
                                if (amountToProcess > 0) {
                                    profit += amountToProcess * (resourceDef.baseExportPrice / 2.4);
                                }
                            
                                gameState.money += profit;
                                if (profit > 0) {
                                    recordMoneyTransaction(profit, `Поставка в город (${vehicle.cargo.amount.toFixed(0)})`);
                                    if (window.ParticleSystem) {
                                        window.ParticleSystem.emitFloatingText(vehicle.x, vehicle.y, `+${Math.floor(profit)}$`, '#48bb78');
                                    }
                                }
                                
                                vehicle.cargo = { type: null, amount: 0 };
                                vehicle.state = 'IDLE';
                            }
                        }
                        // 3. Склад / Экспорт
                        else if (targetBuilding && vehicle.cargo.type && vehicle.cargo.amount > 0) {
                            let canUnload = true;
                            
                            if (targetBuilding.type === 'warehouse') {
                                const storedAmount = Object.values(targetBuilding.storage || {}).reduce((sum, val) => sum + val, 0);
                                if (storedAmount + vehicle.cargo.amount > targetBuilding.capacity) {
                                    canUnload = false;
                                }
                            }
                    
                            if (canUnload) {
                                 if (targetBuilding.type === 'warehouse') {
                                    const resType = vehicle.cargo.type;
                                    targetBuilding.storage[resType] = (targetBuilding.storage[resType] || 0) + vehicle.cargo.amount;
                                    gameState.incomingToWarehouses -= vehicle.cargo.amount;
                                    QuestSystem.checkForFirstDeliveryTrigger(gameState, targetBuilding, GRID_WIDTH, GRID_HEIGHT);
                                } else if (targetBuilding.type === 'export_depot') {
                                    gameState.exportStorage[vehicle.cargo.type] = (gameState.exportStorage[vehicle.cargo.type] || 0) + vehicle.cargo.amount;
                                }
                                vehicle.cargo = { type: null, amount: 0 };
                                vehicle.state = 'IDLE';
                            } else {
                                // Склад переполнен, ищем другой
                                const alternativeWarehouse = findClosestWarehouseWithSpace(
                                    targetBuilding.gridIndex, 
                                    vehicle.cargo.amount, 
                                    targetBuilding.id,
                                    vehicle.cargo.type
                                );

                                if (alternativeWarehouse) {
                                    vehicle.dropoffTargetId = alternativeWarehouse.id;
                                    vehicle.dropoffTargetPos = getBuildingAnchorWorldPos(alternativeWarehouse);
                                    vehicle.state = 'GOING_TO_DROPOFF';
                                } else {
                                    gameState.incomingToWarehouses -= vehicle.cargo.amount;
                                    vehicle.state = 'RETURNING_TO_BASE';
                                }
                            }
                        } 
                        else { 
                            // Ошибка цели
                            vehicle.cargo = { type: null, amount: 0 };
                            vehicle.state = 'IDLE';
                        }
                    }
                }
            }
            // Обработка Custom Routes (для модуля custom_routes.js)
            if (vehicle.state === 'MOVING_CUSTOM' && window.CustomRouteSystem) {
                 window.CustomRouteSystem.updateVehicle(vehicle, gameState, deltaTime);
            }
        if (window.ParticleSystem) window.ParticleSystem.processVehicleEffects(vehicle);
        });
    }

    function isResourceNeededByAnyFactory(resourceType) {
        const factories = gameState.buildings.filter(b => {
            const bp = BUILDING_BLUEPRINTS[b.type];
            return bp.consumption && bp.production && !bp.production.outputs.power; 
        });
    
        for (const factory of factories) {
            const blueprint = BUILDING_BLUEPRINTS[factory.type];
            const requiredAmount = blueprint.consumption[resourceType];
            
            if (requiredAmount && (gameState.resources[resourceType] || 0) < requiredAmount) {
                return true; 
            }
        }
        return false; 
    }

    function assignVehiclesToTasks() {
        let idleVehicles = gameState.vehicles.filter(v => v.state === 'IDLE' && v.mode !== 'off');
        if (idleVehicles.length === 0) {
            const allVehicles = gameState.vehicles.map(v => `${v.id}: state=${v.state}, mode=${v.mode}`);
            return;
        }

        const warehouses = gameState.buildings.filter(b => b.type === 'warehouse');
        if (warehouses.length === 0) {
            return;
        }

        const pickupTasks = [];
        const buildingsWithOutput = gameState.buildings.filter(b =>
            b.outputBuffer && b.outputBuffer.amount > 0 && !taskCooldowns[`pickup-${b.id}`]
        );

        for (const producer of buildingsWithOutput) {
            const blueprint = BUILDING_BLUEPRINTS[producer.type];
            if (!blueprint) continue;
        
            const outputCapacity = blueprint.outputCapacity || blueprint.bufferCapacity;
            const shouldPickup = producer.outputBuffer.amount >= PICKUP_THRESHOLD || producer.outputBuffer.amount >= outputCapacity;
        
            if (!shouldPickup) continue;
        
            const warehouse = findClosestWarehouseWithSpace(
                producer.gridIndex, 
                producer.outputBuffer.amount, 
                null, 
                producer.outputBuffer.resource // <--- Передаем тип ресурса!
            );
            if (!warehouse) continue;
        
            const taskType = (blueprint.category === 'extraction') ? 'pickup' : 'supply';
        
            pickupTasks.push({
                type: taskType,
                source: producer,
                target: warehouse,
                priority: producer.outputBuffer.amount,
                resource: producer.outputBuffer.resource
            });
        }

        const exportTasks = [];
        if (gameState.exportEnabled) {
            const exportDepots = gameState.buildings.filter(b => b.type === 'export_depot');
            if (exportDepots.length > 0) {
                for (const wh of warehouses) {
                    const exportableResources = Object.entries(wh.storage).filter(([, amount]) => amount > 0);
                    for (const [resType, amount] of exportableResources) {
                        if (!taskCooldowns[`export-${wh.id}-${resType}`]) {
                            exportTasks.push({ 
                                type: 'export', 
                                source: wh, 
                                target: exportDepots[0], 
                                resource: resType, 
                                priority: amount 
                            });
                        }
                    }
                }
            }
        }
        // Собираем задачи "Склад -> Город" (city_sale)
    const citySaleTasks = [];
    // Ищем грузовики, которые переключены в этот режим и свободны
    const citySaleTrucks = idleVehicles.filter(v => v.mode === 'city_sale');
    
    if (citySaleTrucks.length > 0) {
        const houses = gameState.buildings.filter(b => b.type === 'residential_house');
        
        if (houses.length === 0) {
        } else {
            // Проходим по складам, ищем, что можно продать
            for (const wh of warehouses) {
                const storedResources = Object.entries(wh.storage).filter(([, amount]) => amount > 0);
                
                if (storedResources.length === 0) {
                }
                
                for (const [resType, amount] of storedResources) {
                    // Проверяем, есть ли хотя бы один грузовик в режиме city_sale, который может перевозить этот ресурс
                    const canCarry = citySaleTrucks.some(truck => truck.allowedCargo.has(resType));
                    
                    if (!canCarry) {
                        continue; // Пропускаем ресурсы, которые никто не может перевозить
                    }
                    
                    // Находим ближайший дом к этому складу
                    const nearestHouse = findClosestBuilding(wh.gridIndex, 'residential_house');
                    
                    if (!nearestHouse) {
                        continue;
                    }
                    
                    // Проверяем, нет ли cooldown для этой задачи
                    const cooldownKey = `city_sale-${wh.id}-${resType}`;
                    if (taskCooldowns[cooldownKey]) {
                        continue;
                    }
                    
                    citySaleTasks.push({
                        type: 'city_sale',
                        source: wh,
                        target: nearestHouse,
                        resource: resType,
                        priority: amount * 0.5 // Приоритет ниже, чем у квестов
                    });
                }
            }
        }
    } else {
    }
        const marketTasks = QuestSystem.createTasks(gameState);

        const allTasks = [...pickupTasks, ...exportTasks, ...marketTasks, ...citySaleTasks];

        allTasks.sort((a, b) => b.priority - a.priority);

        for (const task of allTasks) {
            // Для задач city_sale ищем только грузовики в режиме city_sale
            let vehicleIndex = -1;
            if (task.type === 'city_sale') {
                vehicleIndex = idleVehicles.findIndex(v =>
                    v.mode === 'city_sale' && 
                    v.allowedCargo.has(task.resource)
                );
                if (vehicleIndex === -1) {
                }
            } else {
                vehicleIndex = idleVehicles.findIndex(v =>
                    (v.mode === 'auto' || v.mode === task.type) && 
                    v.allowedCargo.has(task.resource)
                    
                );
                vehicleIndex = idleVehicles.findIndex(v => {
                    // 1. Базовые проверки (режим и груз)
                    if (!v.allowedCargo.has(task.resource)) return false;
                    if (task.type === 'city_sale') {
                        if (v.mode !== 'city_sale') return false;
                    } else {
                        if (v.mode !== 'auto' && v.mode !== task.type) return false;
                    }
                
                    // 2. ПРОВЕРКА ХАБА (НОВАЯ ЛОГИКА)
                    if (v.assignedHubId) {
                        const hub = gameState.buildings.find(b => b.id === v.assignedHubId);
                        if (hub) {
                            const sourcePos = getBuildingAnchorWorldPos(task.source);
                            
                            // ПРОВЕРКА: ПОЛИГОН ИЛИ РАДИУС?
                            if (hub.useCustomBorder && hub.customBorderPoints && hub.customBorderPoints.length > 2) {
                                // Используем функцию Точка в Многоугольнике
                                if (!isPointInPolygon(sourcePos, hub.customBorderPoints)) {
                                    return false; // Цель вне границы хаба
                                }
                            } else {
                                // Стандартная проверка по радиусу (или если полигон не задан)
                                const hubPos = getBuildingAnchorWorldPos(hub);
                                const dist = Math.hypot(sourcePos.x - hubPos.x, sourcePos.y - hubPos.y);
                                const limitRadius = hub.radius || 500;
                                
                                // Если пользователь включил галочку "Ограничить радиус" в старом UI, 
                                // или если мы используем режим "Радиус"
                                if (hub.radiusEnabled !== false && dist > limitRadius) { 
                                     return false;
                                }
                                // Примечание: если вы полностью перешли на радио-кнопки, можно упростить условие выше.
                                // Сейчас оно поддерживает обратную совместимость.
                            }
                        }
                    }
                
                    return true;
                });
            }
            
            if (vehicleIndex === -1) continue;
            const vehicle = idleVehicles.splice(vehicleIndex, 1)[0];
        
            let amountToTake = 0;
            if (task.type === 'pickup' || task.type === 'supply') {
                amountToTake = task.source.outputBuffer.amount;
            } else if (task.type === 'export' || task.type === 'internal' || task.type === 'seasonal' || task.type === 'city_sale') {
                amountToTake = task.source.storage[task.resource] || 0;
                // Для city_sale убеждаемся, что ресурс действительно доступен
                if (task.type === 'city_sale' && amountToTake <= 0) {
                    idleVehicles.push(vehicle);
                    continue;
                }
            }
            
            const stats = getTruckStats(vehicle);
            const effectiveCapacity = stats.capacity;
            
            const amount = Math.min(effectiveCapacity, amountToTake);
            
            if (amount <= 0) {
                 idleVehicles.push(vehicle);
                 continue;
            }
        
            if (setupVehicleTrip(vehicle, task.source, task.target, amount, task.resource)) {
                if (task.type === 'city_sale') {
                }
                if (task.type === 'pickup' || task.type === 'supply') {
                    taskCooldowns[`pickup-${task.source.id}`] = TASK_COOLDOWN_TIME;
                } else if (task.type === 'export') {
                    taskCooldowns[`export-${task.source.id}-${task.resource}`] = TASK_COOLDOWN_TIME;
                } else if (task.type === 'internal' || task.type === 'seasonal') {
                    taskCooldowns[`${task.type}-${task.source.id}-${task.resource}`] = TASK_COOLDOWN_TIME / 2;
                } else if (task.type === 'city_sale') {
                    taskCooldowns[`city_sale-${task.source.id}-${task.resource}`] = TASK_COOLDOWN_TIME / 2;
                }
            } else {
                if (task.type === 'city_sale') {
                }
                idleVehicles.push(vehicle);
            }
        
            if (idleVehicles.length === 0) break;
        }
    }
    
    function setupVehicleTrip(vehicle, source, target, amount, specificResource) {
       if (target.type === 'warehouse') {
        gameState.incomingToWarehouses += amount;
    }

    vehicle.state = 'GOING_TO_PICKUP';
    vehicle.pickupTargetId = source.id;
    vehicle.dropoffTargetId = target.id;
    vehicle.pickupTargetPos = getBuildingAnchorWorldPos(source);
    vehicle.dropoffTargetPos = getBuildingAnchorWorldPos(target);
    
    vehicle.cargo = { type: specificResource, amount: 0 }; 
    vehicle.taskedAmount = amount; 

    return true;
}

    const gridIndexToWorldPos = (index) => 
        ({ x: (index % GRID_WIDTH) * CELL_SIZE + CELL_SIZE / 2, y: Math.floor(index / GRID_WIDTH) * CELL_SIZE + CELL_SIZE / 2 });

    function findClosestWarehouseWithSpace(fromIndex, amountToDeliver = 1, excludeBuildingId = null, resourceType = null) {
        const fromPos = gridIndexToWorldPos(fromIndex);
        let closestWarehouse = null;
        let minDistance = Infinity;

        // ОПТИМИЗАЦИЯ: Используем кеш вместо фильтрации всего массива
        const warehouses = gameState.buildingCache.warehouses; // Берем из кеша

        for (const wh of warehouses) {
            if (wh.id === excludeBuildingId) continue;

            // === ПРОВЕРКА ЗОНИРОВАНИЯ ===
            // Если указан тип ресурса, проверяем, разрешен ли он на этом складе
            // Если поле allowedResources отсутствует (старый сейв), считаем, что разрешено все
            if (resourceType && wh.allowedResources && !wh.allowedResources.has(resourceType)) {
                continue; // Склад запрещает этот ресурс, пропускаем
            }
            // ============================

            const storedAmount = Object.values(wh.storage).reduce((sum, amount) => sum + amount, 0);
            if (storedAmount + amountToDeliver <= wh.capacity) {
                const whPos = getBuildingAnchorWorldPos(wh);
                const distance = Math.hypot(fromPos.x - whPos.x, fromPos.y - whPos.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestWarehouse = wh;
                }
            }
        }
        return closestWarehouse;
    }
    function findClosestBuilding(fromIndex, buildingType) {
        const fromPos = gridIndexToWorldPos(fromIndex);
        let closest = null;
        let minDistance = Infinity;

        // ОПТИМИЗАЦИЯ: Используем кеш для домов
        let candidates;
        if (buildingType === 'residential_house') {
             candidates = gameState.buildingCache?.houses;
             // Fallback если кеш пуст или не инициализирован
             if (!candidates || candidates.length === 0) {
                 candidates = gameState.buildings.filter(b => b.type === buildingType);
             }
        } else {
             // Fallback для других типов
             candidates = gameState.buildings.filter(b => b.type === buildingType);
        }

        if (!candidates || candidates.length === 0) {
            console.log(`[findClosestBuilding] Не найдено зданий типа ${buildingType}. Всего зданий: ${gameState.buildings.length}`);
            return null;
        }

        for (const b of candidates) {
            const bPos = getBuildingAnchorWorldPos(b);
            const distance = Math.hypot(fromPos.x - bPos.x, fromPos.y - bPos.y);
            if (distance < minDistance) {
                minDistance = distance;
                closest = b;
            }
        }
        return closest;
    }

    function findNearbyProducerWithSameResource(resourceType, excludeBuildingId, truckX, truckY) {
        let closest = null;
        let minDist = Infinity;

        const candidates = gameState.buildings.filter(b =>
            b.id !== excludeBuildingId &&
            b.outputBuffer &&
            b.outputBuffer.resource === resourceType &&
            b.outputBuffer.amount > 0
        );

        for (const producer of candidates) {
            const pos = getBuildingAnchorWorldPos(producer);
            const dist = Math.hypot(truckX - pos.x, truckY - pos.y);
            if (dist < MULTI_STOP_RADIUS && dist < minDist) {
                minDist = dist;
                closest = producer;
            }
        }
        return closest;
    }

    // =================================================================================
    // VII. УПРАВЛЕНИЕ UI И ПОЛЬЗОВАТЕЛЬСКИМ ВВОДОМ
    // =================================================================================
function updateDispatcherUI() {
        const list = document.getElementById('dispatcher-history-list');
        if (list) {
            if (!gameState.notificationHistory || gameState.notificationHistory.length === 0) {
                list.innerHTML = '<li style="color: #718096; padding: 8px 0; text-align: center;">(Тишина в эфире...)</li>';
            } else {
                list.innerHTML = gameState.notificationHistory.map(item => {
                    let color = '#e2e8f0'; // Белый по умолчанию
                    let icon = 'ℹ️';
                    if (item.type === 'success') { color = '#48bb78'; icon = '✅'; }
                    if (item.type === 'error') { color = '#f56565'; icon = '❌'; }
                    if (item.type === 'event') { color = '#ecc94b'; icon = '📈'; }

                    return `
                        <li style="
                            padding: 8px 0; 
                            border-bottom: 1px solid rgba(255,255,255,0.05); 
                            display: flex; 
                            align-items: flex-start; 
                            gap: 8px;
                        ">
                            <span style="color: #718096; font-size: 11px; white-space: nowrap; margin-top: 2px;">[${item.time}]</span>
                            <span style="color: ${color}; line-height: 1.3;">
                                ${item.message}
                            </span>
                        </li>
                    `;
                }).join('');
            }
        }

        // Обновляем список хабов
        updateHubsList();
        renderWorkersManagement();
    }

   function renderWorkersManagement() {
        const container = document.getElementById('dispatch-workers-tab');
        if (!container || !window.WorkerSystem) return;

        const buildings = (gameState.buildings || []).filter(b => b.type !== 'residential_house');

        if (buildings.length === 0) {
            container.innerHTML = '<div style="color:#718096; padding:20px; text-align:center;">Нет зданий, где нужны сотрудники.</div>';
            return;
        }

        const rowsHtml = buildings.map(b => {
            const bp = window.BUILDING_BLUEPRINTS[b.type];
            if (!bp) return '';

            window.WorkerSystem.ensureBuildingWorkers(b);
            const workers = b.workers;
            if (!workers) return '';

            // === ВАЖНО: ВОТ ЭТА СТРОКА БЫЛА ПРОПУЩЕНА ===
            // Мы должны получить данные о баффах перед тем, как использовать их в HTML
            const buffStats = window.WorkerSystem.getBuffStats(b); 
            // ============================================

            return `
                <div class="worker-row" data-building-id="${b.id}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.06); gap:10px;">
                    
                    <!-- ЛЕВАЯ КОЛОНКА -->
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${bp.emoji || '🏭'} ${bp.name}
                        </div>
                        <div style="font-size:11px; color:#94a3b8;">ID #${b.id}</div>
                    </div>

                    <!-- ПРАВАЯ КОЛОНКА -->
                    <div style="flex:0 0 220px; display:flex; flex-direction:column; gap:4px;">
                        
                        <!-- БАФФ (Теперь buffStats определен и ошибки не будет) -->
                        <div style="font-size:11px; color:#48bb78; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            <i class="fas fa-magic"></i> ${buffStats.text}
                        </div>

                        <div style="display:flex; justify-content:space-between; font-size:12px; color:#cbd5e0;">
                            <span>Сотрудники:</span>
                            <span><span class="worker-count">${workers.count}</span> / ${workers.max}</span>
                        </div>
                        
                        <input type="range" class="worker-slider" min="1" max="${workers.max}" value="${workers.count}" style="width:100%;">
                        
                        <div class="worker-salary" style="font-size:11px; color:#a0aec0; text-align:right;">
                            Зарплата: ${workers.salaryPerWorker * workers.count}$
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const totalSalary = window.WorkerSystem.calculateTotalSalaryPreview(gameState);
        
        container.innerHTML = `
            <div style="margin-bottom:10px; padding:8px 10px; background:rgba(15,23,42,0.85); border-radius:6px; border:1px solid rgba(148,163,184,0.4); font-size:12px; color:#cbd5e0; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                    <div style="font-weight:600; margin-bottom:2px;">Менеджмент сотрудников</div>
                    <div style="color:#94a3b8;">Настройте штат (1–10). Зарплаты списываются каждые 1.5 минуты.</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px; color:#94a3b8;">Фонд оплаты / тик:</div>
                    <div id="workers-total-salary" style="font-weight:600; color:#f87171;">-${totalSalary}$</div>
                </div>
            </div>
            <div style="max-height:100%; overflow-y:auto; border-radius:6px; border:1px solid rgba(148,163,184,0.3); background:rgba(15,23,42,0.7);">
                ${rowsHtml}
            </div>
        `;

        // ... код обработчиков событий (slider.addEventListener) ...
        container.querySelectorAll('.worker-slider').forEach(slider => {
             // ... ваш старый код обработчиков ...
             slider.addEventListener('input', e => {
                const row = e.target.closest('.worker-row');
                if (!row) return;
                const id = parseInt(row.dataset.buildingId, 10);
                const value = parseInt(e.target.value, 10) || 1;

                window.WorkerSystem.setWorkersForBuilding(gameState, id, value);
                const building = gameState.buildings.find(b => b.id === id);
                if (!building) return;
                const workers = building.workers;

                const countEl = row.querySelector('.worker-count');
                if (countEl) countEl.textContent = workers.count;

                const salaryRow = row.querySelector('.worker-salary');
                if (salaryRow) {
                    salaryRow.textContent = `Зарплата: ${workers.salaryPerWorker * workers.count}$`;
                }

                // === ОБНОВЛЕНИЕ ТЕКСТА БАФФА ПРИ ПЕРЕТАСКИВАНИИ ПОЛЗУНКА ===
                // Это добавит динамики, чтобы игрок сразу видел эффект
                const buffEl = row.querySelector('.fa-magic')?.parentNode;
                if (buffEl) {
                    const newStats = window.WorkerSystem.getBuffStats(building);
                    buffEl.innerHTML = `<i class="fas fa-magic"></i> ${newStats.text}`;
                }
                // ==============================================================

                const totalEl = document.getElementById('workers-total-salary');
                if (totalEl) {
                    totalEl.textContent = `-${window.WorkerSystem.calculateTotalSalaryPreview(gameState)}$`;
                }
            });
        });
    }

    function updateHubsList() {
        const container = document.getElementById('hubs-list-container');
        if (!container) return;

        const hubs = gameState.buildings.filter(b => b.type === 'transport_hub');
        
        if (hubs.length === 0) {
            container.innerHTML = '<div style="color: #718096; padding: 20px; text-align: center;">Транспортные хабы не построены</div>';
            return;
        }

        // Подсчитываем присоединенные машины для каждого хаба
        hubs.forEach(hub => {
            if (!hub.assignedVehicles) hub.assignedVehicles = [];
            // Обновляем список машин, привязанных к этому хабу
            hub.assignedVehicles = gameState.vehicles
                .filter(v => v.assignedHubId === hub.id)
                .map(v => v.id);
        });

        container.innerHTML = hubs.map(hub => {
            const hubPos = getBuildingAnchorWorldPos(hub);
            const vehicleCount = hub.assignedVehicles ? hub.assignedVehicles.length : 0;
            const radius = hub.radius || 500;
            const radiusEnabled = hub.radiusEnabled || false;
            const useCustomBorder = hub.useCustomBorder || false; 
            const borderPointsCount = hub.customBorderPoints ? hub.customBorderPoints.length : 0;
            
            // Проверка энергии хаба
            const isOffline = hub.statusFlags && hub.statusFlags.includes('no_power');

            // Если оффлайн - серый цвет, иначе - уникальный цвет
            const hue = (hub.hubNumber * 137.508) % 360;
            const color = isOffline ? '#4a5568' : `hsl(${hue}, 70%, 50%)`;
            
            // Стиль для отключенного хаба
            const offlineOverlay = isOffline ? 
                `<div style="
                    background: rgba(239, 68, 68, 0.1); 
                    border: 1px solid #ef4444; 
                    color: #ef4444; 
                    padding: 5px; 
                    text-align: center; 
                    font-weight: bold; 
                    margin-bottom: 10px; 
                    border-radius: 4px;">
                    ⚡ ОБЕСТОЧЕН
                </div>` : '';

            // Блокировка управления ползунками, если оффлайн
            const disabledAttr = isOffline ? 'disabled style="opacity: 0.5; pointer-events: none;"' : '';

            return `
                <div class="hub-card" data-hub-id="${hub.id}" style="
                    background: rgba(0,0,0,0.3); 
                    border: 1px solid ${isOffline ? '#ef4444' : 'rgba(255,255,255,0.1)'}; 
                    border-left: 3px solid ${color};
                    border-radius: 8px; 
                    padding: 15px; 
                    margin-bottom: 10px;
                    opacity: ${isOffline ? 0.7 : 1};
                ">
                    ${offlineOverlay}

                    <!-- УПРАВЛЕНИЕ ТИПОМ ГРАНИЦЫ -->
                    <div style="margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;" ${disabledAttr}>
                    
                    <!-- ... (ОСТАЛЬНОЙ КОД ГЕНЕРАЦИИ HTML ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ) ... -->
                    <!-- Просто убедитесь, что вы закрываете map и join в конце -->
            
                        <div style="margin-bottom: 8px; font-weight: bold; color: #cbd5e0;">Тип зоны действия:</div>
                        
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 5px;">
                            <input type="radio" name="border-type-${hub.id}" class="hub-border-type" value="radius" data-hub-id="${hub.id}" ${!useCustomBorder ? 'checked' : ''} ${isOffline ? 'disabled' : ''}>
                            <span>⭕ Радиус (${radius}px)</span>
                        </label>
                        
                        <div style="display: ${!useCustomBorder ? 'flex' : 'none'}; gap: 10px; align-items: center; padding-left: 24px;">
                            <input type="range" class="hub-radius-slider" data-hub-id="${hub.id}" 
                                   min="200" max="2500" step="50" value="${radius}" style="flex: 1;" ${isOffline ? 'disabled' : ''}>
                        </div>

                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 10px;">
                            <input type="radio" name="border-type-${hub.id}" class="hub-border-type" value="polygon" data-hub-id="${hub.id}" ${useCustomBorder ? 'checked' : ''} ${isOffline ? 'disabled' : ''}>
                            <span>⬠ Своя граница (${borderPointsCount} точек)</span>
                        </label>

                        <div style="display: ${useCustomBorder ? 'block' : 'none'}; padding-left: 24px; margin-top: 5px;">
                            <button class="action-button btn-draw-border" data-hub-id="${hub.id}" style="padding: 6px 12px; font-size: 0.8em; width: auto; background: #3182ce;" ${isOffline ? 'disabled' : ''}>
                                ✏️ Нарисовать новую
                            </button>
                            ${borderPointsCount > 0 ? '<span style="color:#48bb78; font-size:0.8em; margin-left:5px;">Готово</span>' : '<span style="color:#e53e3e; font-size:0.8em; margin-left:5px;">Не задана</span>'}
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <h4 style="margin: 0; color: ${color};">
                                <i class="fas fa-network-wired"></i> Хаб #${hub.hubNumber || '?'}
                            </h4>
                            <div style="font-size: 0.85em; color: #94a3b8; margin-top: 5px;">
                                Позиция: (${Math.floor(hubPos.x)}, ${Math.floor(hubPos.y)})
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.2em; color: ${isOffline ? '#ef4444' : '#48bb78'}; font-weight: bold;">
                                ${vehicleCount} <i class="fas fa-truck"></i>
                            </div>
                            <div style="font-size: 0.8em; color: #94a3b8;">машин</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div style="font-size: 0.85em; color: #94a3b8;">
                            Статус: ${isOffline ? '<span style="color:#ef4444">ОТКЛЮЧЕН</span>' : '<span style="color:#48bb78">АКТИВЕН</span>'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Добавляем обработчики событий
        container.querySelectorAll('.hub-radius-enabled').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const hubId = parseInt(e.target.dataset.hubId);
                const hub = gameState.buildings.find(b => b.id === hubId);
                if (hub) {
                    hub.radiusEnabled = e.target.checked;
                    updateHubsList();
                }
            });
        });
        // Переключение типа границы
container.querySelectorAll('.hub-border-type').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const hubId = parseInt(e.target.dataset.hubId);
        const hub = gameState.buildings.find(b => b.id === hubId);
        if (hub) {
            hub.useCustomBorder = (e.target.value === 'polygon');
            updateHubsList(); // Перерисовать UI
        }
    });
});

// Кнопка начала рисования
container.querySelectorAll('.btn-draw-border').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const hubId = parseInt(e.target.dataset.hubId);
        const hub = gameState.buildings.find(b => b.id === hubId);
        if (hub) {
            // Сбрасываем старые точки
            hub.customBorderPoints = []; 
            
            // Включаем режим
            editingHubId = hubId;
            isDrawingBorderMode = true;
            
            // Закрываем модалку, чтобы видеть карту
            document.getElementById('dispatch-modal').style.display = 'none';
            
            showNotification("Кликайте по карте, чтобы ставить точки границы!", "info", 5000);
            updateUI(); // Чтобы появилась кнопка "Завершить"
        }
    });
});
        container.querySelectorAll('.hub-radius-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const hubId = parseInt(e.target.dataset.hubId);
                const hub = gameState.buildings.find(b => b.id === hubId);
                const value = parseInt(e.target.value);
                if (hub) {
                    hub.radius = value;
                    const valueSpan = e.target.parentElement.querySelector('.hub-radius-value');
                    if (valueSpan) valueSpan.textContent = `${value}px`;
                }
            });
        });
    }
   function onCellClick(index) {
        const cellData = gameState.grid[index];

        // Обработка клика для туториала
        if (cellData.building && window.TutorialSystem && window.TutorialSystem.onBuildingClicked) {
            window.TutorialSystem.onBuildingClicked(cellData.building.type);
        }

        // --- ВЗАИМОДЕЙСТВИЕ С ПОСТРОЕННЫМИ ЗДАНИЯМИ ---
        if (!selectedBuildingType && !isDemolishMode && cellData.building) {
            
            // Логика визуального состояния кнопки логистики (не влияет на клик по зданию, но оставляем как было)
            const logBtn = document.getElementById('logistics-button');
            if (logBtn) {
                const hubs = gameState.buildings.filter(b => b.type === 'transport_hub');
                let isLogisticsOffline = false;
                
                if (hubs.length > 0) {
                    const hasActiveHub = hubs.some(hub => !hub.statusFlags || !hub.statusFlags.includes('no_power'));
                    if (!hasActiveHub) isLogisticsOffline = true;
                }

                if (isLogisticsOffline) {
                    logBtn.style.opacity = '0.5';
                    logBtn.style.filter = 'grayscale(100%)';
                    logBtn.style.cursor = 'not-allowed';
                } else {
                    logBtn.style.opacity = '1';
                    logBtn.style.filter = 'none';
                    logBtn.style.cursor = 'pointer';
                }
            }

            // 1. Экспортный терминал
            if (cellData.building.type === 'export_depot') { 
                toggleExport(); 
                return; 
            }

            // 2. Общежитие водителей (ИСПРАВЛЕНО: Вынесено из блока transport_hub)
            if (cellData.building.type === 'driver_house') {
                if (window.DriverSystem) {
                    window.DriverSystem.openHouseModal(gameState);
                }
                return;
            }

            // 3. Транспортный хаб
            if (cellData.building.type === 'transport_hub') { 
                // Проверка энергии
                if (cellData.building.statusFlags && cellData.building.statusFlags.includes('no_power')) {
                    showNotification(`⚡ Хаб обесточен! Нет связи с диспетчером.`, 'error');
                    
                    if (window.ParticleSystem) {
                        const pos = getBuildingAnchorWorldPos(cellData.building);
                        window.ParticleSystem.emitFloatingText(pos.x, pos.y, "NO POWER", "#ef4444");
                    }
                    return; 
                }

                const modal = document.getElementById('dispatch-modal');
                if (modal) {
                    updateDispatcherUI(); 
                    modal.style.display = 'flex'; 
                    const eventsTab = modal.querySelector('.dispatch-tab-btn[data-tab="events"]');
                    if (eventsTab) eventsTab.click();
                }
                return; 
            }
            
            // 4. Склад
            if (cellData.building.type === 'warehouse') { 
                openWarehouseSettings(cellData.building); 
                return; 
            }
        }

        // --- РЕЖИМ СНОСА ---
        if (isDemolishMode) {
            if (cellData.building) {
                const buildingToDemolish = cellData.building;
                const blueprint = BUILDING_BLUEPRINTS[buildingToDemolish.type];
                let totalRefund = 0;
                Object.entries(blueprint.cost).forEach(([res, cost]) => {
                    const refund = Math.floor(cost * 0.45);
                    if (res === 'money') {
                        gameState.money += refund;
                        totalRefund += refund;
                    } else {
                        gameState.resources[res] += refund; 
                    }
                
                });
                if (totalRefund > 0) {
                    recordMoneyTransaction(totalRefund, `Возврат за снос ${blueprint.name}`);
                }
                if (blueprint.providesVehicles) {
                    gameState.vehicles = gameState.vehicles.filter(v => v.ownerBuildingId !== buildingToDemolish.id);
                }
                gameState.buildings = gameState.buildings.filter(b => b.id !== buildingToDemolish.id);
                
                // Очистка кешей
                if (buildingToDemolish.type === 'warehouse') {
                    gameState.buildingCache.warehouses = gameState.buildingCache.warehouses.filter(b => b.id !== buildingToDemolish.id);
                } else if (buildingToDemolish.type === 'export_depot') {
                     gameState.buildingCache.export_depots = gameState.buildingCache.export_depots.filter(b => b.id !== buildingToDemolish.id);
                } else {
                     gameState.buildingCache.producers = gameState.buildingCache.producers.filter(b => b.id !== buildingToDemolish.id);
                }
                
                gameState.buildingCounts[buildingToDemolish.type] = (gameState.buildingCounts[buildingToDemolish.type] || 1) - 1;
                clearBuildingFromGrid(buildingToDemolish);
                showNotification(`Снесено: ${blueprint.name}`, 'info');
                updateUI();
            }
            return;
        }

        // --- РЕЖИМ СТРОИТЕЛЬСТВА ---
        if (!selectedBuildingType) return;
        
        if (selectedBuildingType === 'garage') {
            const garageCount = gameState.buildingCounts.garage || 0;
            const hubCount = gameState.buildingCounts.transport_hub || 0;
            const hubBlueprint = BUILDING_BLUEPRINTS.transport_hub;
            const totalSlots = hubCount * (hubBlueprint.providesGarageSlots || 0);
            if (garageCount >= totalSlots) {
                showNotification('Все транспортные хабы заняты! Постройте новый хаб для дополнительных гаражей.', 'error');
                return; 
            }
        }
        
        const blueprint = BUILDING_BLUEPRINTS[selectedBuildingType];
        const row = Math.floor(index / GRID_WIDTH), col = index % GRID_WIDTH;
        const { w: tileWidth, h: tileHeight } = getBuildingSize(blueprint);

        if (row < 0 || col < 0 || row + tileHeight > GRID_HEIGHT || col + tileWidth > GRID_WIDTH) {
            showNotification('Нельзя строить за пределами карты!', 'error');
            return;
        }

        if (blueprint.isEdgeBuilding) {
            const rowEnd = row + tileHeight - 1;
            const colEnd = col + tileWidth - 1;

            const touchesTop = row === 0;
            const touchesBottom = rowEnd === GRID_HEIGHT - 1;
            const touchesLeft = col === 0;
            const touchesRight = colEnd === GRID_WIDTH - 1;

            if (!touchesTop && !touchesBottom && !touchesLeft && !touchesRight) {
                showNotification('Это здание можно строить только на краю карты!', 'error');
                return;
            }
        }

        for (let r = 0; r < tileHeight; r++) {
            for (let c = 0; c < tileWidth; c++) {
                const checkIndex = (row + r) * GRID_WIDTH + (col + c);
                const checkCell = gameState.grid[checkIndex];
                if (!checkCell) {
                    showNotification('Нельзя строить за пределами карты!', 'error');
                    return;
                }
                if (checkCell.building) {
                    showNotification('Это место уже занято!', 'error');
                    return;
                }
                if (blueprint.category === 'extraction') {
                    if (checkCell.resource !== blueprint.resourceType) {
                        showNotification(`Можно строить только на месторождениях ресурса ${RESOURCES[blueprint.resourceType].name}!`, 'error');
                        return;
                    }
                } else {
                    if (checkCell.resource && checkCell.resource !== 'grass') { 
                        showNotification('Нельзя строить на месторождениях!', 'error');
                        return;
                    }
                }
            }
        }

       // 1. Получаем множитель из конфига
        const costMultiplier = gameState.config?.buildingCostMultiplier || 1.0;

        // 2. Проверяем, хватает ли ресурсов С УЧЕТОМ множителя
        let canAfford = Object.entries(blueprint.cost).every(([res, baseCost]) => {
            const finalCost = Math.ceil(baseCost * costMultiplier);
            return res === 'money' 
                ? gameState.money >= finalCost 
                : (gameState.resources[res] || 0) >= finalCost;
        });

        if (canAfford) {
            let totalCost = 0;
            Object.entries(blueprint.cost).forEach(([res, baseCost]) => {
                // 3. Считаем финальную стоимость для списания
                const finalCost = Math.ceil(baseCost * costMultiplier);

                if (res === 'money') {
                    gameState.money -= finalCost;
                    totalCost += finalCost;
                } else {
                    consumeFromWarehouses(res, finalCost);
                    if (gameState.resources[res]) gameState.resources[res] -= finalCost;
                }
            });
            
            const newBuilding = { 
                type: selectedBuildingType, 
                id: Date.now(), 
                gridIndex: index, 
                inputBuffer: (blueprint.inputCapacity || blueprint.consumption) ? {} : null, 
                outputBuffer: (blueprint.outputCapacity || blueprint.bufferCapacity) ? { resource: null, amount: 0 } : null,
                storage: selectedBuildingType === 'warehouse' ? {} : null,
                capacity: selectedBuildingType === 'warehouse' ? blueprint.storageCapacity : 0,
                allowedResources: selectedBuildingType === 'warehouse' ? new Set(Object.keys(RESOURCES)) : null
            };
            
            // Инициализация для транспортных хабов
            if (selectedBuildingType === 'transport_hub') {
                const hubCount = (gameState.buildingCounts.transport_hub || 0) + 1;
                newBuilding.hubNumber = hubCount;
                newBuilding.radius = 500; // Радиус по умолчанию
                newBuilding.assignedVehicles = []; // Массив ID машин
                newBuilding.radiusEnabled = false; // Ограничение радиуса выключено по умолчанию
            }

            occupyGridWithBuilding(newBuilding, row, col);
            gameState.buildings.push(newBuilding);
            gameState.buildingCounts[selectedBuildingType] = (gameState.buildingCounts[selectedBuildingType] || 0) + 1;
             if (newBuilding.type === 'warehouse') {
                gameState.buildingCache.warehouses.push(newBuilding);
            } else if (newBuilding.type === 'export_depot') {
                gameState.buildingCache.export_depots.push(newBuilding);
            } else if (newBuilding.type === 'residential_house') {
                if (!gameState.buildingCache.houses) {
                    gameState.buildingCache.houses = [];
                }
                gameState.buildingCache.houses.push(newBuilding);
            } else if (blueprint.outputCapacity || blueprint.bufferCapacity) {
                gameState.buildingCache.producers.push(newBuilding);
            }
            if (window.TutorialSystem && typeof window.TutorialSystem.onBuildingPlaced === 'function') {
                window.TutorialSystem.onBuildingPlaced(selectedBuildingType);
            }
            
            if (blueprint.providesVehicles) {
                const pos = getBuildingAnchorWorldPos(newBuilding);
                for (let i = 0; i < blueprint.providesVehicles; i++) {
                    gameState.vehicles.push({
                        id: Date.now() + i,
                        ownerBuildingId: newBuilding.id,
                        ownerGaragePos: pos,
                        x: pos.x, y: pos.y,
                        state: 'IDLE',
                        cargo: { type: null, amount: 0 },
                        taskedAmount: 0, 
                        timer: 0,
                        level: { capacity: 0, speed: 0 },
                        capacity: BASE_TRUCK_CAPACITY,
                        speed: BASE_TRUCK_SPEED,
                        allowedCargo: new Set(Object.keys(RESOURCES)),
                        mode: 'off',
                    });
                }
            }
            showNotification(`Построено: ${blueprint.name}`, 'success');
            checkNewUnlocks(); updateUI();
        } else {
            showNotification(`Недостаточно ресурсов на складе!`, 'error');
        }
    }
    
    function updateStorageAndGlobalResources() {
        let totalCapacity = 0;
        
        // Начинаем с нуля
        const globalResources = Object.keys(RESOURCES).reduce((acc, key) => ({...acc, [key]: 0 }), {});
    
        // 1. Считаем ресурсы на реальных складах
    const warehouses = gameState.buildings.filter(b => b.type === 'warehouse');
    warehouses.forEach(wh => {
        
        // === НОВОЕ: Обновляем вместимость от работников ===
        if (window.WorkerSystem) {
            const baseCap = window.BUILDING_BLUEPRINTS['warehouse'].storageCapacity;
            const buff = window.WorkerSystem.getBuffStats(wh);
            
            // Если есть бонус к вместимости, добавляем его к базовому значению
            if (buff.type === 'capacity') {
                wh.capacity = baseCap + buff.absoluteBonus;
            } else {
                wh.capacity = baseCap;
            }
        }
        totalCapacity += wh.capacity;
        for (const [res, amount] of Object.entries(wh.storage)) {
            globalResources[res] = (globalResources[res] || 0) + amount;
        }
    });

        // 2. ИЗМЕНЕНИЕ: Добавляем ресурсы из "Виртуального склада" (стартовый бонус)
        if (gameState.virtualStorage) {
            for (const [res, amount] of Object.entries(gameState.virtualStorage)) {
                if (amount > 0) {
                    globalResources[res] = (globalResources[res] || 0) + amount;
                }
            }
        }
    
        gameState.totalWarehouseCapacity = totalCapacity > 0 ? totalCapacity : 0; 
        gameState.resources = globalResources;
    }

    // Функция для записи транзакции денег
    function recordMoneyTransaction(amount, description) {
        if (!gameState.moneyTransactions) {
            gameState.moneyTransactions = [];
        }
        const transaction = {
            amount: amount,
            description: description,
            timestamp: Date.now(),
            balance: gameState.money
        };
        gameState.moneyTransactions.push(transaction);
        // Ограничиваем историю последними 50 транзакциями
        if (gameState.moneyTransactions.length > 50) {
            gameState.moneyTransactions.shift();
        }
    }
    
    // Делаем функцию доступной глобально для других модулей
    window.recordMoneyTransaction = recordMoneyTransaction;
   const ChartEngine = {
    // Рисует график с одной линией (например, Деньги)
    drawHistoryChart(canvasId, data, key, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Получаем размеры родителя, чтобы график был четким
        const container = canvas.parentElement;
        const w = container.clientWidth;
        const h = 200; // Фиксированная высота
        
        // Устанавливаем внутреннее разрешение canvas
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        // Если данных мало, пишем текст
        if (!data || data.length < 2) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Сбор данных...", w / 2, h / 2);
            return;
        }

        // Подготовка значений
        const values = data.map(d => d[key]);
        let min = Math.min(...values);
        let max = Math.max(...values);
        
        // Отступы, чтобы график не прилипал к краям
        const paddingY = (max - min) * 0.1;
        min -= paddingY;
        max += paddingY;
        if (min === max) { max += 1; min -= 1; } // Защита от деления на 0
        
        const range = max - min;

        // Функции для координат
        const getX = (i) => (i / (data.length - 1)) * w;
        const getY = (val) => h - ((val - min) / range) * h;

        // 1. Рисуем сетку (фон)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 5; i++) {
            const y = h - (i * h / 5);
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        // 2. Рисуем линию
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(values[0]));

        for (let i = 1; i < values.length; i++) {
            // Используем кривые Безье для плавности, или прямые линии для простоты
            ctx.lineTo(getX(i), getY(values[i]));
        }
        ctx.stroke();

        // 3. Градиент под графиком
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ', 0.2)')); 
        grad.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ', 0.0)'));
        
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        
        // 4. Текстовые метки (Максимум и Минимум)
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.floor(max).toLocaleString(), w - 5, 12);
        ctx.fillText(Math.floor(min).toLocaleString(), w - 5, h - 5);
    },

    // Рисует график с двумя линиями (Производство vs Потребление)
    drawDualChart(canvasId, data, key1, key2) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const container = canvas.parentElement;
        const w = container.clientWidth;
        const h = 200;
        
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        if (!data || data.length < 2) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Сбор данных...", w / 2, h / 2);
            return;
        }

        // Находим общий максимум для обеих линий, чтобы масштаб был один
        const allVals = [...data.map(d => d[key1]), ...data.map(d => d[key2])];
        const max = Math.max(...allVals) * 1.1 || 10; // +10% запаса сверху

        // Сетка
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 5; i++) {
            const y = h - (i * h / 5);
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Функция отрисовки одной линии
        const drawLine = (key, color) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            data.forEach((point, i) => {
                const x = (i / (data.length - 1)) * w;
                const y = h - (point[key] / max) * h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        };

        // Рисуем Производство (Зеленая)
        drawLine(key1, '#48bb78');
        // Рисуем Потребление (Красная/Оранжевая)
        drawLine(key2, '#f56565');

        // Легенда
        ctx.font = "11px sans-serif";
        ctx.textAlign = 'left';
        
        ctx.fillStyle = "#48bb78"; 
        ctx.fillText("● Производство", 10, 15);
        
        ctx.fillStyle = "#f56565"; 
        ctx.fillText("● Потребление", 10, 30);
    }
};

// Делаем доступным глобально
window.ChartEngine = ChartEngine;
    function updateUI() {
        const moneyDisplay = document.getElementById('money-display');
        moneyDisplay.textContent = Math.floor(gameState.money).toLocaleString();
        
        // Инициализация обработчиков для тултипа денег (только один раз)
        if (!moneyDisplay.dataset.tooltipInitialized) {
            const moneyContainer = moneyDisplay.closest('span');
            if (moneyContainer) {
                moneyContainer.style.cursor = 'help';
                moneyContainer.addEventListener('mouseenter', showMoneyTooltip);
                moneyContainer.addEventListener('mouseleave', hideMoneyTooltip);
                moneyDisplay.dataset.tooltipInitialized = 'true';
            }
        }
        // Отрисовка панели города
    const cityContainer = document.getElementById('city-panel-container');
    if (cityContainer && window.CityManagementSystem) {
        cityContainer.innerHTML = window.CityManagementSystem.getUIHtml(gameState);
    }
        document.getElementById('power-display').textContent = gameState.power.current.toFixed(0);
        document.getElementById('power-capacity-display').textContent = gameState.power.capacity.toFixed(0);
        
        const resourcesContainer = document.getElementById('resources');
        const totalStored = Object.values(gameState.resources).reduce((s, a) => s + a, 0);
        
        const incomingAmount = Math.floor(gameState.incomingToWarehouses);
        let totalCapacityText;
        
        if (incomingAmount > 0) {
            totalCapacityText = `${Math.floor(totalStored)} <span style="color: var(--green); font-weight: normal;">+${incomingAmount}</span> / ${gameState.totalWarehouseCapacity}`;
        } else {
            totalCapacityText = `${Math.floor(totalStored)} / ${gameState.totalWarehouseCapacity}`;
        }
    
        let warehouseItem = document.getElementById('ui-res-warehouse');
        if (!warehouseItem) {
            warehouseItem = document.createElement('div');
            warehouseItem.id = 'ui-res-warehouse';
            warehouseItem.className = 'resource-item';
            resourcesContainer.appendChild(warehouseItem);
        }
        
        if ((totalStored + gameState.incomingToWarehouses) >= gameState.totalWarehouseCapacity) {
            warehouseItem.classList.add('storage-full');
        } else {
            warehouseItem.classList.remove('storage-full');
        }
        const fillPercentage = totalStored / gameState.totalWarehouseCapacity;

        if (fillPercentage >= 1.0) {
            warehouseItem.style.color = '#ef4444'; // Красный (полный)
            warehouseItem.classList.add('storage-full'); //  для мигания
        } else if (fillPercentage > 0.85) {
            warehouseItem.style.color = '#ecc94b'; // Желтый (предупреждение)
            warehouseItem.classList.remove('storage-full');
        } else {
            warehouseItem.style.color = ''; // Нормальный
            warehouseItem.classList.remove('storage-full');
        }
        
        warehouseItem.innerHTML = `<span>${getIconHTML('📦')}</span><span>${totalCapacityText}</span>`;
        warehouseItem.title = `Общая загрузка складов (На складе: ${Math.floor(totalStored)}, В пути: ${incomingAmount})`;
        
        Object.entries(gameState.resources).forEach(([key, amount]) => {
            if (amount > 0 || (consumptionStats[key] && Object.keys(consumptionStats[key]).length > 0)) {
                const resInfo = RESOURCES[key];
                if (!resInfo) return;
            
                let resourceDiv = document.getElementById(`ui-res-${key}`);
                if (!resourceDiv) {
                    resourceDiv = document.createElement('div');
                    resourceDiv.id = `ui-res-${key}`;
                    resourceDiv.className = 'resource-item';
                    resourceDiv.dataset.resourceKey = key;
                    resourceDiv.title = resInfo.name;
                    resourceDiv.addEventListener('mouseenter', showConsumptionTooltip);
                    resourceDiv.addEventListener('mouseleave', hideConsumptionTooltip);
                    resourcesContainer.appendChild(resourceDiv);
                }
                
                resourceDiv.innerHTML = `<span>${getIconHTML(resInfo.emoji, key)}</span><span>${Math.floor(amount)}</span>`;
                resourceDiv.style.display = 'flex';
            } else {
                const resourceDiv = document.getElementById(`ui-res-${key}`);
                if (resourceDiv) resourceDiv.style.display = 'none';
            }
        });
        
        document.getElementById('pause-indicator').style.display = isPaused ? 'inline-flex' : 'none';
        const buildMenu = document.getElementById('floating-build-menu');
        if (buildMenu && !buildMenu.classList.contains('hidden')) {
            updateBuildButtons();
        }
        
        if (exportModal && exportModal.style.display === 'flex' && typeof updateExportResourceList === 'function') {
            updateExportResourceList();
        }
    }
    // --- КНОПКА ЗАВЕРШЕНИЯ РИСОВАНИЯ ---
    let stopDrawBtn = document.getElementById('stop-draw-btn');
    if (isDrawingBorderMode) {
        if (!stopDrawBtn) {
            stopDrawBtn = document.createElement('button');
            stopDrawBtn.id = 'stop-draw-btn';
            stopDrawBtn.className = 'action-button';
            stopDrawBtn.style.cssText = 'position: absolute; top: 100px; left: 50%; transform: translateX(-50%); z-index: 2000; background: #e53e3e; box-shadow: 0 4px 15px rgba(0,0,0,0.5);';
            stopDrawBtn.innerHTML = '<i class="fas fa-check"></i> Завершить границу';
            stopDrawBtn.onclick = () => {
                isDrawingBorderMode = false;
                editingHubId = null;
                // Открываем обратно окно диспетчера
                const modal = document.getElementById('dispatch-modal');
                if(modal) {
                    modal.style.display = 'flex';
                    updateHubsList();
                }
                updateUI();
            };
            document.body.appendChild(stopDrawBtn);
        }
    } else {
        if (stopDrawBtn) stopDrawBtn.remove();
    }
    function showConsumptionTooltip(event) {
        const resourceKey = event.currentTarget.dataset.resourceKey;
        const stats = consumptionStats[resourceKey];
    
        hideConsumptionTooltip();
    
        if (!stats || Object.keys(stats).length === 0) {
            return; 
        }
    
        const tooltip = document.createElement('div');
        tooltip.id = 'consumption-tooltip';
        tooltip.className = 'consumption-tooltip';
    
        let totalConsumption = 0;
        let listHTML = '';
    
        const sortedConsumers = Object.entries(stats).sort(([, a], [, b]) => b - a);
    
        sortedConsumers.forEach(([buildingType, consumedAmount]) => {
            const blueprint = BUILDING_BLUEPRINTS[buildingType];
            totalConsumption += consumedAmount;
            listHTML += `
                <li class="consumption-item">
                    <span class="consumption-item-name">
                        ${getIconHTML(blueprint.emoji)} ${blueprint.name}
                    </span>
                    <span class="consumption-item-value">
                        -${consumedAmount.toFixed(0)}/тик
                    </span>
                </li>
            `;
        });
    
        tooltip.innerHTML = `
            <h5>Затраты: ${RESOURCES[resourceKey].name} (-${totalConsumption.toFixed(0)}/тик)</h5>
            <ul class="consumption-list">${listHTML}</ul>
        `;
    
        document.body.appendChild(tooltip);
    
        const rect = event.currentTarget.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        tooltip.style.display = 'block';
    }
    
    function hideConsumptionTooltip() {
        const tooltip = document.getElementById('consumption-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    function setGameSpeed(speed) {
        gameSpeed = speed;
        
        // Обновляем UI кнопок
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
        });

        // Перезапускаем игровой тик (производство) с новым интервалом
        clearInterval(gameInterval);
        if (!isPaused) {
            // Базовый интервал (2000мс) делим на скорость.
            // При x5 тик будет проходить каждые 400мс.
            gameInterval = setInterval(gameTick, TICK_INTERVAL / gameSpeed);
        }
        
        showNotification(`Скорость игры: ${speed}x`, 'info');
    }
    function showMoneyTooltip(event) {
        hideMoneyTooltip();
        
        if (!gameState.moneyTransactions || gameState.moneyTransactions.length === 0) {
            return;
        }
        
        const tooltip = document.createElement('div');
        tooltip.id = 'money-tooltip';
        tooltip.className = 'money-tooltip';
        
        // Получаем последние 10 транзакций
        const recentTransactions = gameState.moneyTransactions.slice(-10).reverse();
        
        let transactionsHTML = '';
        recentTransactions.forEach(transaction => {
            const isPositive = transaction.amount > 0;
            const sign = isPositive ? '+' : '';
            const color = isPositive ? 'var(--green)' : 'var(--red)';
            const timeAgo = getTimeAgo(transaction.timestamp);
            
            transactionsHTML += `
                <li class="transaction-item">
                    <span class="transaction-amount" style="color: ${color};">
                        ${sign}${transaction.amount.toLocaleString()}$
                    </span>
                    <span class="transaction-description">${transaction.description}</span>
                    <span class="transaction-time">${timeAgo}</span>
                </li>
            `;
        });
        
        tooltip.innerHTML = `
            <h5>Последние транзакции</h5>
            <div class="transaction-balance">Баланс: ${Math.floor(gameState.money).toLocaleString()}$</div>
            <ul class="transaction-list">${transactionsHTML}</ul>
        `;
        
        document.body.appendChild(tooltip);
        
        const rect = event.currentTarget.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        tooltip.style.display = 'block';
        
        // Корректировка позиции, если тултип выходит за границы экрана
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
        }
        if (tooltipRect.bottom > window.innerHeight) {
            tooltip.style.top = `${rect.top - tooltipRect.height - 5}px`;
        }
    }

    function hideMoneyTooltip() {
        const tooltip = document.getElementById('money-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    function getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (seconds < 60) return `${seconds}с назад`;
        if (minutes < 60) return `${minutes}м назад`;
        if (hours < 24) return `${hours}ч назад`;
        return `${Math.floor(hours / 24)}д назад`;
    }
    
    const checkNewUnlocks = () => { 
        let hasNewUnlocks = false;
        for (const bType in BUILDING_BLUEPRINTS) { 
            if (!gameState.unlockedBuildings.has(bType) && checkUnlockRequirements(bType)) { 
                gameState.unlockedBuildings.add(bType); 
                addLog(`${getIconHTML('🔓')} Разблокировано: ${BUILDING_BLUEPRINTS[bType].name}!`, 'success');
                hasNewUnlocks = true;
            } 
        }
        if (hasNewUnlocks) {
            const buildMenu = document.getElementById('floating-build-menu');
            if (buildMenu && !buildMenu.classList.contains('hidden')) {
                populateBuildMenu();
            }
        }
    };
    const checkUnlockRequirements = (bType) => { const reqs = BUILDING_BLUEPRINTS[bType].unlockRequirements; if (!reqs) return true; if (reqs.money && gameState.money < reqs.money) return false; if (reqs.buildings) { for (const [reqB, reqC] of Object.entries(reqs.buildings)) { if ((gameState.buildingCounts[reqB] || 0) < reqC) return false; } } return true; };
    
    function updateBuildButtons() {
        const contentContainer = document.getElementById('category-content');
        if (!contentContainer) return;

        // 1. Получаем множитель стоимости (если настройки не загружены, то 1.0)
        const costMultiplier = gameState.config?.buildingCostMultiplier || 1.0;

        Object.entries(BUILDING_BLUEPRINTS).forEach(([type, blueprint]) => {
            const button = contentContainer.querySelector(`.build-button[data-building-type="${type}"]`);
            if (!button) return;

            const isUnlocked = gameState.unlockedBuildings.has(type);
            let canAfford = true;

            if (isUnlocked) {
                for (const [resKey, baseCost] of Object.entries(blueprint.cost)) {
                    // 2. Рассчитываем реальную стоимость с учетом множителя
                    const finalCost = Math.ceil(baseCost * costMultiplier);

                    if ((resKey === 'money' && gameState.money < finalCost) ||
                        (resKey !== 'money' && (gameState.resources[resKey] || 0) < finalCost)) {
                        canAfford = false;
                        break;
                    }
                }
            }

            button.classList.toggle('locked', !isUnlocked);
            button.classList.toggle('unaffordable', isUnlocked && !canAfford);
            button.classList.toggle('selected', selectedBuildingType === type);

            const costContainer = button.querySelector('.build-button-cost');
            if (costContainer) {
                const costHTML = Object.entries(blueprint.cost)
                    .map(([resKey, baseCost]) => {
                        // 3. Отображаем ту же пересчитанную стоимость
                        const finalCost = Math.ceil(baseCost * costMultiplier);

                        const hasEnough = resKey === 'money' 
                            ? gameState.money >= finalCost 
                            : (gameState.resources[resKey] || 0) >= finalCost;
                            
                        return `<span class="cost-item ${isUnlocked && !hasEnough ? 'not-enough' : ''}">${resKey === 'money' ? `${getIconHTML('💰')} ${finalCost.toLocaleString()}` : `${getIconHTML(RESOURCES[resKey]?.emoji || '?', resKey)} ${finalCost}`}</span>`;
                    }).join('');
                costContainer.innerHTML = costHTML;
            }
        });
    }
    
    function populateBuildMenu() {
    const tabsContainer = document.getElementById('category-tabs');
    const contentContainer = document.getElementById('category-content');
    if (!tabsContainer || !contentContainer) return; 

    const currentActiveTab = tabsContainer.querySelector('.active')?.dataset.target;

    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    // 1. Получаем множитель стоимости из настроек (по умолчанию 1.0)
    const costMultiplier = gameState.config?.buildingCostMultiplier || 1.0;

    const categorizedBuildings = {};
    Object.entries(BUILDING_BLUEPRINTS).forEach(([type, blueprint]) => {
        const category = blueprint.category;
        if (!categorizedBuildings[category]) categorizedBuildings[category] = [];
        categorizedBuildings[category].push({ type, blueprint });
    });

    const categoryOrder = ['logistics', 'extraction', 'power', 'processing', 'manufacturing', 'advanced', 'hightech'];
    const categoryNames = {
        logistics: `${getIconHTML('🚚')} Логистика`,
        extraction: `${getIconHTML('⛏️')} Добыча`,
        power: `${getIconHTML('⚡️')} Энергия`,
        processing: `${getIconHTML('🔥')} Переработка`,
        manufacturing: `${getIconHTML('🧱')} Производство`,
        advanced: `${getIconHTML('⚙️')} Hi-Tech`,
        hightech: `${getIconHTML('🤖')} Роботы и ИИ`
    };

    categoryOrder.forEach(category => {
        if (!categorizedBuildings[category]) return; 

        const tabButton = document.createElement('button');
        tabButton.className = 'build-tab-button';
        const categoryText = categoryNames[category] || category;
        tabButton.innerHTML = categoryText;
        tabButton.dataset.target = `pane-${category}`;
        tabsContainer.appendChild(tabButton);

        const pane = document.createElement('div');
        pane.className = 'build-tab-pane';
        pane.id = `pane-${category}`;
        contentContainer.appendChild(pane);

        for (const { type, blueprint } of categorizedBuildings[category]) {
            const isUnlocked = gameState.unlockedBuildings.has(type);
            let canAfford = true;

            if (isUnlocked) {
                for (const [resKey, baseCost] of Object.entries(blueprint.cost)) {
                    // 2. Расчет стоимости с учетом сложности
                    const finalCost = Math.ceil(baseCost * costMultiplier);

                    if ((resKey === 'money' && gameState.money < finalCost) ||
                        (resKey !== 'money' && (gameState.resources[resKey] || 0) < finalCost)) {
                        canAfford = false;
                        break;
                    }
                }
            }

            const button = document.createElement('button');
            button.className = 'build-button';
            button.dataset.buildingType = type; 
            if (!isUnlocked) button.classList.add('locked');
            if (isUnlocked && !canAfford) button.classList.add('unaffordable');
            if (selectedBuildingType === type) button.classList.add('selected');

            let detailsHTML = '';

            const { w: sizeW, h: sizeH } = getBuildingSize(blueprint);
            if (sizeW > 0 && sizeH > 0 && (sizeW !== 1 || sizeH !== 1)) {
                detailsHTML += `<div class="detail-line size"><span>${getIconHTML('📐')}</span> Размер: ${sizeW}×${sizeH} клетки</div>`;
            }
            if (blueprint.description) detailsHTML += `<div class="detail-line description"><span>${getIconHTML('ℹ️')}</span> ${blueprint.description}</div>`;
            if (blueprint.providesVehicles) detailsHTML += `<div class="detail-line"><span>${getIconHTML('🚚')}</span> +${blueprint.providesVehicles} грузовик</div>`;
            if (blueprint.storageCapacity) detailsHTML += `<div class="detail-line storage"><span>${getIconHTML('📦')}</span> +${blueprint.storageCapacity} к объему склада</div>`;
            if (blueprint.providesGarageSlots) detailsHTML += `<div class="detail-line"><span>${getIconHTML('🏢')}</span> Поддерживает ${blueprint.providesGarageSlots} гаража</div>`;
            
            if (blueprint.production?.outputs) {
                const out = Object.entries(blueprint.production.outputs).map(([res, val]) => res === 'power' ? `${getIconHTML('⚡️')}+${val}` : `${getIconHTML(RESOURCES[res].emoji, res)}+${val}`).join(', ');
                detailsHTML += `<div class="detail-line prod"><span>${getIconHTML('📈')}Даёт:</span> ${out}</div>`;
            }
            if (blueprint.consumption) {
                const inp = Object.entries(blueprint.consumption).map(([res, val]) => res === 'power' ? `${getIconHTML('⚡️')}-${val}` : `${getIconHTML(RESOURCES[res].emoji, res)}-${val}`).join(', ');
                if(inp) detailsHTML += `<div class="detail-line cons"><span>${getIconHTML('📉')}Потребляет:</span> ${inp}</div>`;
            }

            if (type === 'garage') {
                const garageCount = gameState.buildingCounts.garage || 0;
                const hubCount = gameState.buildingCounts.transport_hub || 0;
                const totalSlots = hubCount * (BUILDING_BLUEPRINTS.transport_hub.providesGarageSlots || 0);
                const hasHubCapacity = garageCount < totalSlots;
                const statusClass = hasHubCapacity || hubCount === 0 ? '' : 'cons'; 
                detailsHTML += `<div class="detail-line ${statusClass}"><span>${getIconHTML('🏢')}</span> Слоты для гаражей: ${garageCount} / ${totalSlots}</div>`;
            }
            
            let unlockHTML = '';
            if (!isUnlocked && blueprint.unlockRequirements) {
                const reqs = blueprint.unlockRequirements;
                const parts = [];
                if (reqs.money) parts.push(`${getIconHTML('💰')}${reqs.money.toLocaleString()}`);
                if (reqs.buildings) parts.push(...Object.entries(reqs.buildings).map(([b, c]) => `${getIconHTML(BUILDING_BLUEPRINTS[b].emoji)}${c}`));
                unlockHTML = `<div class="unlock-req">${getIconHTML('🔒')} Требуется: ${parts.join(', ')}</div>`;
            }

            const costHTML = Object.entries(blueprint.cost)
                .map(([resKey, baseCost]) => {
                    // 3. Отображение стоимости с учетом сложности
                    const finalCost = Math.ceil(baseCost * costMultiplier);
                    const hasEnough = resKey === 'money' ? gameState.money >= finalCost : (gameState.resources[resKey] || 0) >= finalCost;
                    return `<span class="cost-item ${isUnlocked && !hasEnough ? 'not-enough' : ''}">${resKey === 'money' ? `${getIconHTML('💰')} ${finalCost.toLocaleString()}` : `${getIconHTML(RESOURCES[resKey]?.emoji || '?')} ${finalCost}`}</span>`;
                }).join('');

            button.innerHTML = `
                <div class="build-button-header">
                    <span class="build-button-name">${getIconHTML(blueprint.emoji, type)} ${blueprint.name}</span>
                    <div class="build-button-cost">${costHTML}</div>
                </div>
                <div class="build-button-details">
                     ${detailsHTML}
                </div>
                ${unlockHTML}
            `;

            if (isUnlocked) {
                button.addEventListener('click', () => {
                    if (canAfford) {
                        selectedBuildingType = type;
                        document.getElementById("floating-build-menu").classList.add('hidden'); 
                        isDemolishMode = false;
                        // Важно: мы не списываем деньги здесь! 
                        // Деньги списываются в onCellClick при фактической постройке.
                        // Здесь мы только выбираем инструмент.
                    } else {
                        showNotification(`Недостаточно ресурсов`, 'error');
                    }
                });
            } else {
                // Tooltip logic for locked buildings...
                const tooltip = document.createElement('div');
                tooltip.className = 'unlock-tooltip';
                
                const reqs = [];
                if (blueprint.unlockRequirements) {
                    const req = blueprint.unlockRequirements;
                    if (req.money) reqs.push(`💰 ${req.money.toLocaleString()}$`);
                    if (req.buildings) {
                        Object.entries(req.buildings).forEach(([bldType, count]) => {
                            const bldName = BUILDING_BLUEPRINTS[bldType]?.name || bldType;
                            reqs.push(`${getIconHTML(BUILDING_BLUEPRINTS[bldType]?.emoji || '❓', bldType)} ${bldName} (${count})`);
                        });
                    }
                }
                
                tooltip.innerHTML = `
                    <div class="tooltip-header">Требуется для разблокировки:</div>
                    <div class="tooltip-requirements">
                        ${reqs.length > 0 ? reqs.map(req => `<div>${req}</div>`).join('') : 'Нет специальных требований'}
                    </div>
                `;
                
                button.appendChild(tooltip);
                button.style.cursor = 'not-allowed';
                button.title = ""; 
                
                button.addEventListener('mouseenter', () => {
                    tooltip.style.visibility = 'visible';
                    tooltip.style.opacity = '1';
                });
                
                button.addEventListener('mouseleave', () => {
                    tooltip.style.visibility = 'hidden';
                    tooltip.style.opacity = '0';
                });
            }
            pane.appendChild(button);
        }
    });

    const tabs = tabsContainer.querySelectorAll('.build-tab-button');
    const panes = contentContainer.querySelectorAll('.build-tab-pane');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            contentContainer.querySelector(`#${tab.dataset.target}`).classList.add('active');
        });
    });

    const tabToActivate = tabsContainer.querySelector(`[data-target="${currentActiveTab}"]`) || tabs[0];
    if (tabToActivate) tabToActivate.click();
}

    const selectBuilding = (type) => { 
        selectedBuildingType = type; 
        toggleDemolishMode(false); 
        const buildMenu = document.getElementById('floating-build-menu');
        if (buildMenu && !buildMenu.classList.contains('hidden')) {
            updateBuildButtons(); 
        }
    };
    const toggleDemolishMode = (force) => { 
        isDemolishMode = force !== undefined ? force : !isDemolishMode; 
        document.getElementById('demolish-button').classList.toggle('active', isDemolishMode); 
        if (isDemolishMode) { 
            selectedBuildingType = null; 
            const buildMenu = document.getElementById('floating-build-menu');
            if (buildMenu && !buildMenu.classList.contains('hidden')) {
                updateBuildButtons(); 
            }
        } 
    };
    const togglePause = () => { 
        isPaused = !isPaused; 
        const pauseBtn = document.getElementById('pause-button');
        pauseBtn.innerHTML = isPaused ? `${getIconHTML('▶️')}` : `${getIconHTML('⏸️')}`;
        document.getElementById('pause-indicator').style.display = isPaused ? 'inline-flex' : 'none'; 
        
        if(!isPaused) {
            lastTimestamp = performance.now(); 
            // === ИЗМЕНЕНИЕ: Перезапускаем с текущей скоростью ===
            setGameSpeed(gameSpeed);
        } else {
            clearInterval(gameInterval);
        }
    };

    const addLog = (message, type) => { console.log(`[${type.toUpperCase()}] ${message}`); };
    const triggerProductionAnimation = (gridIndex) => gameState.productionAnimations.push({ gridIndex, startTime: Date.now(), duration: 1500, endTime: Date.now() + 1500 });
    const toggleExport = () => { 
        gameState.exportEnabled = !gameState.exportEnabled; 
        const exportButton = document.getElementById('export-button'); 
        const hasExportDepot = gameState.buildings.some(b => b.type === 'export_depot');
        if (gameState.exportEnabled) { 
            exportButton.innerHTML = `${getIconHTML('📦')}`; 
            if (hasExportDepot) showNotification(`Экспорт включен.`, 'success'); 
        } else { 
            exportButton.innerHTML = `${getIconHTML('📦')}`; 
            if (hasExportDepot) showNotification(`Экспорт отключен.`, 'info'); 
        } 
    }

    // --- ЛОГИКА МОДАЛЬНЫХ ОКОН ---
    const exportModal = document.getElementById('export-modal');
    const logisticsModal = document.getElementById('logistics-modal');
    const resourceSelect = document.getElementById('resource-select'); 
    const countrySelect = document.getElementById('country-select'); 
    const amountInput = document.getElementById('amount-input'); 

    function openLogisticsModal() {
        logisticsModal.style.display = 'flex';
        populateLogisticsModal();
        if (logisticsUpdateInterval) {
            clearInterval(logisticsUpdateInterval);
        }
        logisticsUpdateInterval = setInterval(updateAndRepopulateLogistics, 500);
    }
   
    
    
    function updateExportResourceList() {
        if (exportModal.style.display !== 'flex') return; 
        
        const currentResource = resourceSelect.value;
        const currentCountry = countrySelect.value;
        const currentAmount = amountInput.value;
        
        resourceSelect.innerHTML = '';
        Object.entries(gameState.exportStorage).filter(([, amount]) => amount > 0).forEach(([k, v]) => { 
            resourceSelect.innerHTML += `<option value="${k}">${RESOURCES[k].name} (${Math.floor(v)} шт.)</option>`; 
        });
        
        countrySelect.innerHTML = '';
        gameState.countries.forEach(c => {
            countrySelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
        
        if (currentResource && gameState.exportStorage[currentResource] > 0) {
            resourceSelect.value = currentResource;
        } else if (resourceSelect.options.length > 0) {
            resourceSelect.value = resourceSelect.options[0].value;
        }
        
        if (currentCountry && Array.from(countrySelect.options).some(opt => opt.value === currentCountry)) {
            countrySelect.value = currentCountry;
        } else if (countrySelect.options.length > 0) {
            countrySelect.value = countrySelect.options[0].value;
        }
        
        if (currentAmount && resourceSelect.value) {
            const available = gameState.exportStorage[resourceSelect.value] || 0;
            amountInput.value = Math.min(parseInt(currentAmount) || 0, Math.floor(available));
        }
        
        updateExportPreview();
    }

    document.getElementById('export-button').addEventListener('click', () => { 
        exportModal.style.display = 'flex'; 
        updateExportResourceList(); 
    });
    

    // Функция для отрисовки графика цены в окне Экспорта
function drawPriceChart(resourceKey) {
    const chartCanvas = document.getElementById('price-history-chart');
    if (!chartCanvas) return;
    const chartCtx = chartCanvas.getContext('2d');
    
    const container = document.getElementById('price-chart-container');
    // Синхронизируем размер канваса с контейнером
    chartCanvas.width = container.clientWidth;
    chartCanvas.height = container.clientHeight;

    // Если ресурс не выбран или нет истории
    if (!resourceKey || !gameState.priceHistory[resourceKey]) {
        chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        chartCtx.fillStyle = '#9ca3af';
        chartCtx.font = '14px Segoe UI';
        chartCtx.textAlign = 'center';
        chartCtx.fillText('Выберите ресурс', chartCanvas.width / 2, chartCanvas.height / 2);
        return;
    }

    const history = gameState.priceHistory[resourceKey];
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

    if (history.length < 2) {
        chartCtx.fillStyle = '#9ca3af';
        chartCtx.font = '14px Segoe UI';
        chartCtx.textAlign = 'center';
        chartCtx.fillText('Недостаточно данных', chartCanvas.width / 2, chartCanvas.height / 2);
        return;
    }

    const minPrice = Math.min(...history);
    const maxPrice = Math.max(...history);
    const priceRange = maxPrice - minPrice === 0 ? 1 : maxPrice - minPrice;

    const padding = 20;
    const chartWidth = chartCanvas.width - padding * 2;
    const chartHeight = chartCanvas.height - padding;

    // Рисуем линию
    chartCtx.beginPath();
    chartCtx.lineWidth = 2;
    chartCtx.strokeStyle = '#3b82f6'; // Синий цвет

    history.forEach((price, index) => {
        const x = (index / (history.length - 1)) * chartWidth + padding;
        const y = chartHeight - ((price - minPrice) / priceRange) * (chartHeight - padding) + (padding / 2);
        if (index === 0) {
            chartCtx.moveTo(x, y);
        } else {
            chartCtx.lineTo(x, y);
        }
    });
    chartCtx.stroke();

    // Градиент под графиком
    const lastX = chartWidth + padding;
    const lastY = chartHeight - ((history[history.length - 1] - minPrice) / priceRange) * (chartHeight - padding) + (padding / 2);

    const gradient = chartCtx.createLinearGradient(0, 0, 0, chartCanvas.height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    
    chartCtx.lineTo(lastX, chartCanvas.height);
    chartCtx.lineTo(padding, chartCanvas.height);
    chartCtx.closePath();
    chartCtx.fillStyle = gradient;
    chartCtx.fill();

    // Текстовые метки (цены)
    chartCtx.fillStyle = '#9ca3af';
    chartCtx.font = '12px Segoe UI';
    chartCtx.textAlign = 'left';
    chartCtx.fillText(`$${maxPrice.toFixed(2)}`, 5, padding / 2 + 5);
    chartCtx.fillText(`$${minPrice.toFixed(2)}`, 5, chartCanvas.height - 5);
}
    function updateExportPreview() { 
        const resKey = resourceSelect.value, countryName = countrySelect.value; 
        
        const chartResourceName = document.getElementById('chart-resource-name');
        const chartPriceChange = document.getElementById('chart-price-change');

        if (!resKey || !countryName) {
            if (chartResourceName) chartResourceName.textContent = 'Выберите ресурс';
            if (chartPriceChange) {
                chartPriceChange.textContent = '--';
                chartPriceChange.className = '';
            }
            drawPriceChart(null); 
            return; 
        }
        
        if (chartResourceName) chartResourceName.textContent = RESOURCES[resKey].name;
        drawPriceChart(resKey);

        const basePrice = RESOURCES[resKey].baseExportPrice;
        const priceHistory = gameState.priceHistory[resKey] || [];
        if (priceHistory.length > 0 && basePrice > 0) {
            const currentPrice = priceHistory[priceHistory.length - 1];
            const change = currentPrice - basePrice;
            const percentChange = (change / basePrice) * 100;
            
            if (change > 0) {
                chartPriceChange.textContent = `▲ +${change.toFixed(2)}$ (+${percentChange.toFixed(1)}%)`;
                chartPriceChange.className = 'positive';
            } else if (change < 0) {
                chartPriceChange.textContent = `▼ ${change.toFixed(2)}$ (${percentChange.toFixed(1)}%)`;
                chartPriceChange.className = 'negative';
            } else {
                chartPriceChange.textContent = `— 0.00$ (0.0%)`;
                chartPriceChange.className = '';
            }
        } else {
            chartPriceChange.textContent = '--';
            chartPriceChange.className = '';
        }
    
        const amount = parseInt(amountInput.value) || 0; 
        const country = gameState.countries.find(c => c.name === countryName); 
        const availableAmount = gameState.exportStorage[resKey] || 0; 
        const finalAmount = Math.min(amount, availableAmount); 
        
        const conditions = gameState.marketConditions[resKey];
        
        const internalDemandModifier = ExportSystem.computeInternalDemandModifier(gameState, RESOURCES, resKey);

        const globalDemandMultiplier = conditions.globalDemandMultiplier;
        const playerSaturationMultiplier = conditions.playerSaturationMultiplier;
        const countryDemandMultiplier = country ? country.demands[resKey].multiplier : 1.0;
        
        let eventMultiplier = 1.0;
        if (gameState.activeEvent && gameState.activeEvent.effects[resKey]) {
            eventMultiplier = gameState.activeEvent.effects[resKey];
        }

        const profit = Math.floor(finalAmount * RESOURCES[resKey].baseExportPrice * globalDemandMultiplier * playerSaturationMultiplier * internalDemandModifier * countryDemandMultiplier * eventMultiplier); 
        
        document.getElementById('available-amount').textContent = `${Math.floor(availableAmount)}`; 
        document.getElementById('base-price').textContent = `${RESOURCES[resKey].baseExportPrice.toFixed(2)}$`; 
        document.getElementById('demand-multiplier').parentElement.innerHTML = `<span>Спрос в стране:</span> <span id="demand-multiplier">${countryDemandMultiplier.toFixed(2)}x</span>`;
        document.getElementById('market-price-multiplier').parentElement.innerHTML = `<span>Глобальный рынок:</span> <span id="market-price-multiplier">${globalDemandMultiplier.toFixed(2)}x</span>`;
        
        let previewContainer = document.querySelector('.export-summary');
        let saturationEl = document.getElementById('player-saturation-multiplier');
        if (!saturationEl) {
            const p = document.createElement('p');
            p.innerHTML = `<span>Насыщение рынка:</span> <span id="player-saturation-multiplier">1.00x</span>`;
            previewContainer.insertBefore(p, previewContainer.children[3]);
        }
        document.getElementById('player-saturation-multiplier').textContent = `${playerSaturationMultiplier.toFixed(2)}x`;
        
        let internalEl = document.getElementById('internal-demand-multiplier');
        if (!internalEl) {
            const p = document.createElement('p');
            p.innerHTML = `<span>Внутр. потребность:</span> <span id="internal-demand-multiplier">1.00x</span>`;
            previewContainer.insertBefore(p, previewContainer.children[4]);
        }
        document.getElementById('internal-demand-multiplier').textContent = `${internalDemandModifier.toFixed(2)}x`;

        document.getElementById('total-profit').textContent = `${profit.toLocaleString()}$`; 
    }
    
    document.getElementById('confirm-export-button').addEventListener('click', () => { 
        const resKey = resourceSelect.value; 
        const amount = parseInt(amountInput.value); 
        if (!resKey || !amount || amount <= 0) return addLog('Неверные данные для экспорта.', 'error'); 
        
        const availableAmount = gameState.exportStorage[resKey] || 0; 
        if (amount > availableAmount) return addLog('Недостаточно товара!', 'error'); 
        
        const { profit } = ExportSystem.finalizeExport(gameState, RESOURCES, resKey, amount, countrySelect.value);
        
        if (profit > 0) {
            recordMoneyTransaction(profit, `Экспорт ${amount} ${RESOURCES[resKey].name} в ${countrySelect.value}`);
            
            // --- ЭФФЕКТ ВСПЛЫВАЮЩИХ ДЕНЕГ ПРИ ЭКСПОРТЕ ---
            if (window.ParticleSystem) {
                // Используем координаты первого экспортного терминала или центр экрана
                const exportDepot = gameState.buildings.find(b => b.type === 'export_depot');
                if (exportDepot) {
                    const pos = getBuildingAnchorWorldPos(exportDepot);
                    window.ParticleSystem.emitFloatingText(pos.x, pos.y, `+${Math.floor(profit)}$`, '#48bb78');
                } else {
                    // Если нет терминала, используем центр экрана
                    window.ParticleSystem.emitFloatingText(camera.x, camera.y, `+${Math.floor(profit)}$`, '#48bb78');
                }
            }
        }

        addLog(`🚢 Экспортировано ${amount} ${RESOURCES[resKey].name} за ${profit.toLocaleString()}$`, 'success'); 
        updateUI(); 
        exportModal.style.display = 'none'; 
    });
    document.getElementById('max-amount-btn').addEventListener('click', () => { amountInput.value = gameState.exportStorage[resourceSelect.value] || 0; updateExportPreview(); 

    });
    
    document.getElementById('logistics-button')?.addEventListener('click', () => { logisticsModal.style.display = 'flex'; populateLogisticsModal(); });

window.ReportsSystem = {
    currentTab: 'general',
    isAutoUpdate: false, // Флаг автообновления
    tickCounter: 0,      // Счетчик тиков

    // Метод вызывается из gameTick() каждые 2 секунды
    handleGameTick() {
        // Проверяем: включено ли автообновление
        if (!this.isAutoUpdate) return;

        // Проверяем: открыто ли модальное окно и активна ли вкладка отчетов
        const modal = document.getElementById('dispatch-modal');
        const isTabActive = document.getElementById('dispatch-reports-tab')?.classList.contains('active');
        
        if (modal && modal.style.display === 'flex' && isTabActive) {
            this.tickCounter++;
            
            // Обновляем каждые 3 тика (примерно 6 секунд)
            if (this.tickCounter >= 3) {
                this.renderContent('report-content-area'); // Перерисовываем только контент
                this.tickCounter = 0;
                
                // Визуальный эффект обновления (мигание иконки)
                const refreshIcon = document.getElementById('repo-refresh-icon');
                if(refreshIcon) {
                    refreshIcon.style.color = '#48bb78';
                    setTimeout(() => refreshIcon.style.color = 'inherit', 300);
                }
            }
        }
    },

    toggleAutoUpdate(checked) {
        this.isAutoUpdate = checked;
        this.tickCounter = 0; // Сброс счетчика при переключении
    },

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Вставляем навигацию + КНОПКУ АВТО-ОБНОВЛЕНИЯ
        const navHTML = `
            <div class="report-subnav" style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; gap: 5px; flex: 1;">
                    <button class="report-sub-btn ${this.currentTab === 'general' ? 'active' : ''}" 
                            onclick="ReportsSystem.switchTab('general', '${containerId}')">
                        <i class="fas fa-chart-line"></i> Обзор
                    </button>
                    <button class="report-sub-btn ${this.currentTab === 'resources' ? 'active' : ''}" 
                            onclick="ReportsSystem.switchTab('resources', '${containerId}')">
                        <i class="fas fa-boxes"></i> Ресурсы
                    </button>
                    <button class="report-sub-btn ${this.currentTab === 'efficiency' ? 'active' : ''}" 
                            onclick="ReportsSystem.switchTab('efficiency', '${containerId}')">
                        <i class="fas fa-industry"></i> Эффективность
                    </button>
                </div>

                <div class="report-controls">
                    <label class="auto-refresh-label" title="Обновлять графики каждые 6 секунд">
                        <i class="fas fa-sync-alt" id="repo-refresh-icon"></i>
                        <span>Авто</span>
                        <input type="checkbox" class="auto-refresh-checkbox" 
                               ${this.isAutoUpdate ? 'checked' : ''} 
                               onchange="ReportsSystem.toggleAutoUpdate(this.checked)">
                    </label>
                </div>
            </div>
            <div id="report-content-area" style="flex: 1; overflow-y: auto; padding-right: 5px; margin-top: 15px;"></div>
        `;
        
        container.innerHTML = navHTML;
        this.renderContent('report-content-area');
    },

    switchTab(tab, containerId) {
        this.currentTab = tab;
        this.render(containerId); // Перерисовка нужна, чтобы обновить класс active у кнопок
    },

    renderContent(areaId) {
        const area = document.getElementById(areaId);
        if (!area) return; // Защита от ошибок, если окно закрыто

        const history = gameState.statsHistory || [];
        const current = history.length > 0 ? history[history.length - 1] : null;

        if (!current) {
            area.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:200px; color:#718096;"><i class="fas fa-spinner fa-spin"></i> Сбор данных...</div>';
            return;
        }

        if (this.currentTab === 'general') this.renderGeneral(area, history, current);
        else if (this.currentTab === 'resources') this.renderResources(area, current);
        else if (this.currentTab === 'efficiency') this.renderEfficiency(area);
    },

    renderGeneral(area, history, current) {
        // Рассчитываем тренды (сравнение с 10 тиков назад)
        const prev = history.length > 10 ? history[history.length - 10] : history[0];
        const moneyDiff = current.money - prev.money;
        const trendClass = moneyDiff >= 0 ? 'trend-up' : 'trend-down';
        const trendIcon = moneyDiff >= 0 ? '▲' : '▼';
        
        const totalVehicles = gameState.vehicles.length;
        const busyVehicles = gameState.vehicles.filter(v => v.state !== 'IDLE').length;
        
        // --- РАСЧЕТ ЗАРПЛАТ (ОБНОВЛЕННЫЙ БЛОК) ---
        const driverSalaries = window.DriverSystem ? window.DriverSystem.calculateTotalSalaryPreview(gameState) : 0;
        const workerSalaries = window.WorkerSystem ? window.WorkerSystem.calculateTotalSalaryPreview(gameState) : 0;
        
        // Суммируем зарплаты
        const totalSalaryExpenses = driverSalaries + workerSalaries;
        // ------------------------------------------

        area.innerHTML = `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <i class="fas fa-wallet kpi-icon"></i>
                    <div class="kpi-title">Финансы</div>
                    <div class="kpi-value ${moneyDiff >= 0 ? 'text-green' : 'text-red'}">
                        ${Math.floor(gameState.money).toLocaleString()}$
                    </div>
                    <div class="kpi-sub">
                        <span class="${trendClass}">${trendIcon} ${Math.abs(Math.floor(moneyDiff))}$</span>
                        <span style="color:#718096"> / за посл. время</span>
                    </div>
                </div>
                <div class="kpi-card">
                    <i class="fas fa-bolt kpi-icon"></i>
                    <div class="kpi-title">Энергосеть</div>
                    <div class="kpi-value text-blue">
                        ${gameState.power.current.toFixed(0)} <span style="font-size:0.6em; color:#a0aec0;">/ ${gameState.power.capacity.toFixed(0)}</span>
                    </div>
                    <div class="kpi-sub">
                        Загрузка: ${Math.round(gameState.power.current/Math.max(1, gameState.power.capacity)*100)}%
                    </div>
                </div>
                <div class="kpi-card">
                    <i class="fas fa-truck kpi-icon"></i>
                    <div class="kpi-title">Логистика</div>
                    <div class="kpi-value">
                        ${busyVehicles} <span style="font-size:0.6em; color:#a0aec0;">/ ${totalVehicles}</span>
                    </div>
                    <div class="kpi-sub">
                        <span style="color:${(busyVehicles/totalVehicles)>0.9 ? '#ecc94b' : '#48bb78'}">
                            ${Math.round(busyVehicles/Math.max(1, totalVehicles)*100)}% парка в работе
                        </span>
                    </div>
                </div>
                <div class="kpi-card">
                    <i class="fas fa-users-cog kpi-icon"></i>
                    <div class="kpi-title">Фонд Зарплат</div>
                    <div class="kpi-value text-red">
                        -${totalSalaryExpenses.toLocaleString()}$
                    </div>
                    <div class="kpi-sub">
                        Водители: ${driverSalaries}$ | Персонал: ${workerSalaries}$
                    </div>
                </div>
            </div>

            <div class="charts-section">
                <div class="chart-box">
                    <div class="chart-header">
                        <span>Динамика Капитала</span>
                        <i class="fas fa-chart-line" style="color:#48bb78"></i>
                    </div>
                    <canvas id="chart-money" style="width:100%; height:200px;"></canvas>
                </div>
                <div class="chart-box">
                    <div class="chart-header">
                        <span>Производство / Потребление</span>
                        <i class="fas fa-balance-scale" style="color:#63b3ed"></i>
                    </div>
                    <canvas id="chart-flow" style="width:100%; height:200px;"></canvas>
                </div>
            </div>
        `;

        // Отрисовка графиков
        requestAnimationFrame(() => {
            if (window.ChartEngine && window.ChartEngine.drawHistoryChart) {
                ChartEngine.drawHistoryChart('chart-money', history, 'money', 'rgb(72, 187, 120)');
                if (ChartEngine.drawDualChart) {
                    ChartEngine.drawDualChart('chart-flow', history, 'production', 'consumption');
                }
            }
        });
    },

    renderEfficiency(area) {
        // Группировка зданий по категориям
        const groups = {
            'Добыча': {},
            'Производство': {},
            'Энергия': {}
        };

        gameState.buildings.forEach(b => {
            const type = b.type;
            const bp = window.BUILDING_BLUEPRINTS[type];
            if (!bp.production) return; // Пропускаем дороги и декорации

            let cat = 'Производство';
            if (bp.category === 'extraction') cat = 'Добыча';
            if (bp.category === 'power') cat = 'Энергия';

            if (!groups[cat][type]) {
                groups[cat][type] = { 
                    name: bp.name, 
                    emoji: bp.emoji, 
                    total: 0, 
                    working: 0, 
                    idle: 0, // Склад полон
                    starved: 0, // Нет ресурсов
                    noPower: 0 
                };
            }

            const s = groups[cat][type];
            s.total++;

            if (b.statusFlags?.includes('no_power')) s.noPower++;
            else if (b.missingResources?.length > 0 || b.statusFlags?.includes('depleted')) s.starved++;
            else if (b.statusFlags?.includes('output_full')) s.idle++;
            else s.working++;
        });

        let html = '';

        Object.keys(groups).forEach(catName => {
            const buildings = groups[catName];
            if (Object.keys(buildings).length === 0) return;

            html += `<div class="efficiency-group">
                        <div class="group-title">${catName}</div>`;
            
            Object.values(buildings).forEach(stat => {
                const wPct = (stat.working / stat.total) * 100;
                const iPct = (stat.idle / stat.total) * 100;
                const sPct = (stat.starved / stat.total) * 100;
                const pPct = (stat.noPower / stat.total) * 100;

                // Основной статус текстом
                let statusText = `${Math.round(wPct)}% ОК`;
                let statusColor = '#48bb78';
                if (wPct < 50) {
                    if (sPct > 20) { statusText = 'Нет сырья'; statusColor = '#f56565'; }
                    else if (iPct > 20) { statusText = 'Склад полон'; statusColor = '#718096'; }
                    else if (pPct > 0) { statusText = 'Нет энергии'; statusColor = '#ecc94b'; }
                }

                html += `
                    <div class="eff-card">
                        <div class="eff-info">
                            ${window.getIconHTML(stat.emoji)} ${stat.name}
                            <span class="eff-count">x${stat.total}</span>
                        </div>
                        <div class="eff-progress-bg">
                            <div class="eff-bar bg-ok" style="width: ${wPct}%" title="Работает: ${stat.working}"></div>
                            <div class="eff-bar bg-idle" style="width: ${iPct}%" title="Склад полон (Нужен вывоз): ${stat.idle}"></div>
                            <div class="eff-bar bg-err" style="width: ${sPct}%" title="Нет ресурсов (Нужен завоз): ${stat.starved}"></div>
                            <div class="eff-bar bg-warn" style="width: ${pPct}%" title="Нет энергии: ${stat.noPower}"></div>
                        </div>
                        <div class="eff-stat" style="color: ${statusColor}">
                            ${statusText}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        });

        if (!html) html = '<div style="text-align:center; padding:20px; color:#718096">Нет активных зданий</div>';
        
        area.innerHTML = html;
    },

    renderResources(area, current) {
        const details = current.consumptionDetails || {};
        const flow = current.flow || {};
        
        // Сортируем: сначала те, где дефицит (производство < потребления)
        const sortedKeys = Object.keys(window.RESOURCES).filter(k => {
            const f = flow[k] || { produced: 0, consumed: 0 };
            return (f.produced > 0 || f.consumed > 0 || gameState.resources[k] > 0) && window.RESOURCES[k].category !== 'background';
        }).sort((a, b) => {
            const balA = (flow[a]?.produced || 0) - (flow[a]?.consumed || 0);
            const balB = (flow[b]?.produced || 0) - (flow[b]?.consumed || 0);
            return balA - balB; // Сначала дефицитные
        });

        let html = '';
        
        sortedKeys.forEach(resKey => {
            const res = window.RESOURCES[resKey];
            const f = flow[resKey] || { produced: 0, consumed: 0 };
            const balance = f.produced - f.consumed;
            const consumers = details[resKey] || {};

            let consumersHTML = '';
            // Сортируем потребителей
            Object.entries(consumers).sort(([,a], [,b]) => b - a).forEach(([bType, amt]) => {
                const bp = window.BUILDING_BLUEPRINTS[bType];
                const pct = (amt / f.consumed * 100) || 0;
                consumersHTML += `
                    <div class="flow-bar-item">
                        <span>${window.getIconHTML(bp?.emoji || '🏭')} ${bp?.name || bType}</span>
                        <span>-${amt.toFixed(1)} <span style="opacity:0.5">(${Math.round(pct)}%)</span></span>
                    </div>
                `;
            });

            if(!consumersHTML) consumersHTML = '<div style="color:#718096; font-size:0.8em; padding:5px;">Нет потребителей</div>';

            html += `
                <div class="res-flow-card">
                    <div class="res-flow-header">
                        <span style="display:flex; align-items:center; gap:8px; color: ${res.color || '#fff'}">
                            ${window.getIconHTML(res.emoji)} ${res.name}
                        </span>
                        <span style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; font-size:0.9em; color:${balance >= 0 ? '#48bb78' : '#f56565'}">
                            ${balance > 0 ? '+' : ''}${balance.toFixed(1)} / тик
                        </span>
                    </div>
                    <div class="res-flow-body">
                        <div>
                            <div class="flow-col-title" style="color:#48bb78">Производство (+${f.produced.toFixed(1)})</div>
                            <div class="flow-bar-item" style="border-left: 3px solid #48bb78;">
                                <span>Все источники</span>
                                <span>+${f.produced.toFixed(1)}</span>
                            </div>
                        </div>
                        <div>
                            <div class="flow-col-title" style="color:#f56565">Потребление (-${f.consumed.toFixed(1)})</div>
                            ${consumersHTML}
                        </div>
                    </div>
                </div>
            `;
        });

        area.innerHTML = html;
    }
};
    
    function getTruckStats(truck) {
    // 1. Базовые статы от улучшений
    let capacity = truck.capacity; // Это значение уже включает апгрейды уровня (truck.level)
    let speed = truck.speed;

    // 2. Применяем бонусы водителя, если система подключена
    if (window.DriverSystem) {
        const stats = window.DriverSystem.applyBonuses(truck, { capacity, speed });
        capacity = stats.capacity;
        speed = stats.speed;
    }

    return { capacity, speed };
}

    function canAfford(cost) {
        for (const resKey in cost) {
            const requiredAmount = cost[resKey];
            if (resKey === 'money') {
                if (gameState.money < requiredAmount) return false;
            } else {
                if ((gameState.resources[resKey] || 0) < requiredAmount) return false;
            }
        }
        return true;
    }

    function formatCost(cost) {
        return Object.entries(cost).map(([key, value]) => {
            if (key === 'money') {
                return `${getIconHTML('💰')} ${value.toLocaleString()}`;
            }
            return `${getIconHTML(RESOURCES[key].emoji, key)} ${value.toLocaleString()}`;
        }).join(', ');
    }

    function getStatusInfo(truck) {
        // 1. Проверка питания базы
        const garage = gameState.buildings.find(b => b.id === truck.ownerBuildingId);
        if (garage && garage.statusFlags && garage.statusFlags.includes('no_power')) {
             return {
                text: 'Нет энергии',
                className: 'off', // Красный/Серый цвет
                phase: 'error',
                tooltip: 'Гараж обесточен. Грузовик остановлен.'
            };
        }

        if (truck.mode === 'off') {
            return {
                text: 'Выключен',
                className: 'off',
                phase: 'off',
                tooltip: 'Грузовик выключен вручную'
            };
        }

        switch (truck.state) {
            case 'IDLE':
                return {
                    text: 'Свободен',
                    className: 'idle',
                    phase: 'waiting',
                    tooltip: 'Грузовик свободен и ждёт новую задачу'
                };
            case 'LOADING':
                return {
                    text: 'Погрузка',
                    className: 'busy',
                    phase: 'loading',
                    tooltip: 'Идёт погрузка груза в точке отправления'
                };
            case 'UNLOADING':
                return {
                    text: 'Разгрузка',
                    className: 'busy',
                    phase: 'loading',
                    tooltip: 'Идёт разгрузка груза в точке назначения'
                };
            case 'GOING_TO_PICKUP':
                return {
                    text: 'Едет за грузом',
                    className: 'busy',
                    phase: 'moving',
                    tooltip: 'Грузовик движется к источнику груза'
                };
            case 'GOING_TO_DROPOFF':
                return {
                    text: 'Доставляет груз',
                    className: 'busy',
                    phase: 'moving',
                    tooltip: 'Грузовик в пути к месту разгрузки'
                };
            case 'RETURNING_TO_BASE':
                return {
                    text: 'Возврат на базу',
                    className: 'busy',
                    phase: 'moving',
                    tooltip: 'Грузовик возвращается на базу'
                };
            default:
                return {
                    text: truck.state,
                    className: 'off',
                    phase: 'error',
                    tooltip: 'Неизвестное состояние — проверьте маршрут'
                };
        }
    }

    function renderTruckList() {
        const container = document.getElementById('truck-list-content');
        const header = document.getElementById('truck-list-header');
        
        let trucksToRender = [...gameState.vehicles];
        if (logisticsUIState.filterBy !== 'all') {
            trucksToRender = trucksToRender.filter(t => {
                const statusInfo = getStatusInfo(t);

                if (['idle', 'busy', 'off'].includes(logisticsUIState.filterBy)) {
                    return statusInfo.className === logisticsUIState.filterBy;
                }

                if (logisticsUIState.filterBy === 'overloaded') {
                    const stats = getTruckStats(t);
                    const capacity = stats.capacity || 0;
                    const cargoPercentage = capacity > 0 ? (t.cargo.amount / capacity) * 100 : 0;
                    return cargoPercentage >= 90; 
                }

                if (logisticsUIState.filterBy === 'error') {
                    return statusInfo.phase === 'error';
                }

                return true;
            });
        }

        trucksToRender.sort((a, b) => {
            if (logisticsUIState.sortBy === 'id') return a.id - b.id;
            if (logisticsUIState.sortBy === 'status') {
                const statusA = getStatusInfo(a).className;
                const statusB = getStatusInfo(b).className;
                return statusA.localeCompare(statusB);
            }
            return 0;
        });
        
        const selectedCount = logisticsUIState.selectedTruckIds.size || 0;
        header.textContent = selectedCount > 0
            ? `Грузовики (${trucksToRender.length}) · Выбрано: ${selectedCount}`
            : `Грузовики (${trucksToRender.length})`;
        
        if (trucksToRender.length === 0) {
            container.innerHTML = '<p style="padding: 1rem; color: #9ca3af;">Нет грузовиков, соответствующих фильтру.</p>';
            return;
        }

        const templatesOptions = logisticsUIState.routeTemplates.length === 0
            ? '<option value="">Нет сохранённых шаблонов</option>'
            : logisticsUIState.routeTemplates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

        const massControlsHTML = `
            <div class="fleet-controls">
                <label class="fleet-select-all">
                    <input type="checkbox" id="fleet-select-all" ${selectedCount && selectedCount === trucksToRender.length ? 'checked' : ''}>
                    <span>Выбрать все на странице</span>
                </label>
                <div class="fleet-mass-actions">
                    <div class="mass-action-group">
                        <label>Режим:</label>
                        <select id="mass-mode-select">
                            <option value="">— не менять —</option>
                            <option value="auto">Автоматический</option>
                            <option value="pickup">Добыча → Склад</option>
                            <option value="supply">Завод → Склад</option>
                            <option value="export">Экспорт</option>
                            <option value="internal">Сюжетные заказы</option>
                            <option value="seasonal">Сезонные контракты</option>
                            <option value="city_sale">Продажа в город</option>
                            <option value="off">Выключен</option>
                        </select>
                        <button type="button" class="mass-action-btn" data-action="apply-mode">Применить к выбранным</button>
                    </div>
                    <div class="mass-action-group">
                        <label>Маршрут:</label>
                        <select id="mass-template-select">
                            ${templatesOptions}
                        </select>
                        <button type="button" class="mass-action-btn" data-action="apply-template">Применить шаблон</button>
                    </div>
                </div>
            </div>`;

        const listHTML = trucksToRender.map(truck => {
            const stats = getTruckStats(truck);
            const cargoPercentage = stats.capacity > 0 ? (truck.cargo.amount / stats.capacity) * 100 : 0;
            const cargoLabel = truck.cargo.type ? `${getIconHTML(RESOURCES[truck.cargo.type].emoji, truck.cargo.type)} ${RESOURCES[truck.cargo.type].name}` : 'Пустой';
            const statusInfo = getStatusInfo(truck);

            const sourceBuilding = gameState.buildings.find(b => b.id === truck.pickupTargetId);
            const fromIcon = sourceBuilding ? getIconHTML(BUILDING_BLUEPRINTS[sourceBuilding.type].emoji) : '';
            const fromName = sourceBuilding ? BUILDING_BLUEPRINTS[sourceBuilding.type].name : 'База';
            const fromLocation = `${fromIcon} ${fromName}`;
            
            let toIcon = '';
            let toName = '---';
            const destBuilding = gameState.buildings.find(b => b.id === truck.dropoffTargetId);
            if (destBuilding) {
                toIcon = getIconHTML(BUILDING_BLUEPRINTS[destBuilding.type].emoji);
                toName = BUILDING_BLUEPRINTS[destBuilding.type].name;
            } else {
                const destMarket = gameState.internalMarkets?.find(m => m.id === truck.dropoffTargetId);
                if (destMarket) {
                    toIcon = getIconHTML('🛒');
                    toName = destMarket.name;
                }
            }
            const toLocation = `${toIcon} ${toName}`;
            const routeText = `${fromLocation} ${getIconHTML('➔')} ${toLocation}`;

            let loadClass = 'ok';
            if (cargoPercentage >= 90) {
                loadClass = 'critical';
            } else if (cargoPercentage >= 70) {
                loadClass = 'warning';
            }

            const isSelected = logisticsUIState.selectedTruckIds.has(truck.id);
            const assignedHub = truck.assignedHubId 
        ? gameState.buildings.find(b => b.id === truck.assignedHubId) 
        : null;
        const hubBadge = assignedHub 
        ? `<span style="font-size: 0.75em; background: #2d3748; border: 1px solid #4a5568; color: #90cdf4; padding: 1px 4px; border-radius: 4px; margin-left: 5px;">H#${assignedHub.hubNumber}</span>` 
        : '';
            return `
            
            <div class="truck-list-item ${truck.id === logisticsUIState.currentTruckId ? 'active' : ''}" data-id="${truck.id}">
                <div class="item-header">
                    <label class="fleet-select">
                        <input type="checkbox" class="fleet-select-checkbox" data-id="${truck.id}" ${isSelected ? 'checked' : ''}>
                    </label>
                    <span class="truck-id">#${truck.id.toString().slice(-4)} ${hubBadge}</span>
                    <span class="status-tag ${statusInfo.className}" data-phase="${statusInfo.phase}" title="${statusInfo.tooltip}">${statusInfo.text}</span>
                </div>
                <div class="cargo-bar-sm">
                    <div class="label">${cargoLabel}</div>
                    <div class="progress-track"><div class="progress-fill ${loadClass}" style="width: ${cargoPercentage}%;"></div></div>
                    <div class="route-text" style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.5rem;">${routeText}</div>
                </div>
            </div>
            `
            ;
        }).join('');

        container.innerHTML = massControlsHTML + listHTML;
    }

    function renderDetailView() {
        const container = document.getElementById('truck-detail-view');
        const truck = gameState.vehicles.find(t => t.id === logisticsUIState.currentTruckId);
        
        if (!truck) {
            container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;">Выберите грузовик из списка</div>';
            return;
        }

        // 1. Подготовка данных
        const stats = getTruckStats(truck);
        const cargoPercentage = stats.capacity > 0 ? (truck.cargo.amount / stats.capacity) : 0;
        const cargoLabel = truck.cargo.type ? `${getIconHTML(RESOURCES[truck.cargo.type].emoji, truck.cargo.type)} ${RESOURCES[truck.cargo.type].name}` : 'Пустой';
        const strokeDashOffset = 440 * (1 - cargoPercentage);
        const statusInfo = getStatusInfo(truck);

        let upgradesHTML = '';
        ['capacity', 'speed'].forEach(type => {
            const currentLevel = truck.level[type];
            const maxLevel = TRUCK_UPGRADE_CONFIG[type].length;
            const title = type === 'capacity' ? 'Вместимость' : 'Скорость';

            let pathHTML = '';
            for(let i = 0; i < maxLevel; i++) {
                    pathHTML += `<div class="path-step ${i < currentLevel ? 'completed' : ''}"></div>`;
            }

            let buttonHTML, infoHTML;
            if (currentLevel >= maxLevel) {
                buttonHTML = '<button class="upgrade-btn" disabled>Макс. уровень</button>';
                infoHTML = `<div>Текущий: ${type === 'capacity' ? stats.capacity.toFixed(0) : stats.speed.toFixed(2) + 'x'}</div>`;
            } else {
                const nextUpgrade = TRUCK_UPGRADE_CONFIG[type][currentLevel];
                const afford = canAfford(nextUpgrade.cost);
                const nextValue = type === 'capacity' ? (stats.capacity + nextUpgrade.bonus).toFixed(0) : (stats.speed * nextUpgrade.bonus).toFixed(2) + 'x';

                buttonHTML = `<button class="upgrade-btn" data-type="${type}" ${afford ? '' : 'disabled'}>${afford ? 'Улучшить' : 'Не хватает ресурсов'}</button>`;
                infoHTML = `
                    <div>Текущий: ${type === 'capacity' ? stats.capacity.toFixed(0) : stats.speed.toFixed(2) + 'x'}</div>
                    <div class="bonus">Следующий: +${nextUpgrade.bonus}${type === 'speed' ? '%' : ''} (${nextValue})</div>
                    <div>Цена: ${formatCost(nextUpgrade.cost)}</div>
                `;
            }

            upgradesHTML += `
                <div class="upgrade-card">
                    <h5>${title}</h5>
                    <div class="upgrade-path">${pathHTML}</div>
                    <div class="upgrade-info">${infoHTML}</div>
                    ${buttonHTML}
                </div>
            `;
        });

        const TRUCK_MODES_UI = {
            auto: { name: 'Автоматический', emoji: '🤖' },
            pickup: { name: 'Добыча → Склад', emoji: '📥' },
            supply: { name: 'Завод → Склад', emoji: '🏭' },
            export: { name: 'Склад → Экспорт', emoji: '🌍' },
            internal: { name: 'Сюжетные заказы', emoji: '🛒' },
            seasonal: { name: 'Сезонные контракты', emoji: '💰' },
            city_sale: { name: 'Продажа в город (Дешево)', emoji: '🏘️' },
            custom_route: { name: 'По маршруту', emoji: '🗺️' },
            off: { name: 'Выключен', emoji: '🔌' },
        };

        let modesHTML = Object.entries(TRUCK_MODES_UI).map(([key, {name, emoji}]) => `
            <label class="mode-card">
                <input type="radio" name="truck-mode" class="mode-input" value="${key}" ${truck.mode === key ? 'checked' : ''}>
                <div class="mode-content">
                    <span class="mode-icon">${getIconHTML(emoji)}</span>
                    <span class="mode-label">${name}</span>
                    <span class="mode-checkmark">✓</span>
                </div>
            </label>
        `).join('');

        const allResourceKeys = Object.keys(RESOURCES).filter(k => RESOURCES[k].baseExportPrice > 0);
        const totalResources = allResourceKeys.length;
        let allowedCargoDisplay = '';
        if (truck.allowedCargo.size >= totalResources) {
            allowedCargoDisplay = `${getIconHTML('✅')} Все ресурсы`;
        } else if (truck.allowedCargo.size === 0) {
            allowedCargoDisplay = `${getIconHTML('🚫')} Ничего не разрешено`;
        } else {
            allowedCargoDisplay = Array.from(truck.allowedCargo).slice(0, 4).map(resKey =>
                getIconHTML(RESOURCES[resKey].emoji, resKey)
            ).join(' ');
            if (truck.allowedCargo.size > 8) allowedCargoDisplay += '...';
        }

        const cargoFiltersHTML = allResourceKeys.map(resKey => `
            <label class="cargo-filter-item">
                <input type="checkbox" data-res-key="${resKey}" ${truck.allowedCargo.has(resKey) ? 'checked' : ''}>
                ${getIconHTML(RESOURCES[resKey].emoji, resKey)} ${RESOURCES[resKey].name}
            </label>
        `).join('');

        const sourceBuilding = gameState.buildings.find(b => b.id === truck.pickupTargetId);
        const fromIcon = sourceBuilding ? getIconHTML(BUILDING_BLUEPRINTS[sourceBuilding.type].emoji) : '';
        const fromName = sourceBuilding ? BUILDING_BLUEPRINTS[sourceBuilding.type].name : 'База';
        const fromLocation = `${fromIcon} ${fromName}`;
        
        let toIcon = '';
        let toName = '---';
        const destBuilding = gameState.buildings.find(b => b.id === truck.dropoffTargetId);
        if (destBuilding) {
            toIcon = getIconHTML(BUILDING_BLUEPRINTS[destBuilding.type].emoji);
            toName = BUILDING_BLUEPRINTS[destBuilding.type].name;
        } else {
            const destMarket = gameState.internalMarkets?.find(m => m.id === truck.dropoffTargetId);
            if (destMarket) {
                toIcon = getIconHTML('🛒');
                toName = destMarket.name;
            }
        }
        const toLocation = `${toIcon} ${toName}`;

        let loadClass = 'ok';
        if (cargoPercentage * 100 >= 90) {
            loadClass = 'critical';
        } else if (cargoPercentage * 100 >= 70) {
            loadClass = 'warning';
        }

        // --- 1. ПОДГОТОВКА ДАННЫХ ДЛЯ ВЫБОРА ХАБА (Вставляем перед container.innerHTML) ---
        
        // Получаем список всех хабов
        const hubs = gameState.buildings.filter(b => b.type === 'transport_hub');
        
        // Генерируем опции для select
        const hubSelectOptions = '<option value="">-- Нет привязки --</option>' + 
            hubs.map(h => {
                const isSelected = truck.assignedHubId === h.id ? 'selected' : '';
                return `<option value="${h.id}" ${isSelected}>📍 Хаб #${h.hubNumber || '?'} (R: ${h.radius || 500})</option>`;
            }).join('');

        // Генерируем красивый статус для отображения
        const assignedHubObj = truck.assignedHubId ? hubs.find(h => h.id === truck.assignedHubId) : null;
        const hubInfoDisplay = assignedHubObj 
            ? `<div style="color: #48bb78; font-size: 0.9em; margin-bottom: 10px;">🔗 Прикреплен к Хабу #${assignedHubObj.hubNumber}</div>` 
            : `<div style="color: #a0aec0; font-size: 0.9em; margin-bottom: 10px;">⚪ Нет привязки к хабу</div>`;

        // --- 2. ФОРМИРОВАНИЕ HTML ---
        container.innerHTML = `
            <header class="detail-header">
                <h2>Грузовик #${truck.id.toString().slice(-4)}</h2>
                
            </header>
            <div class="detail-content">
                <div class="cargo-status">
                    <div class="radial-progress-bar">
                        <svg width="160" height="160" viewBox="0 0 160 160">
                            <circle class="progress-bg" cx="80" cy="80" r="70" stroke-width="12"></circle>
                            <circle class="progress-value ${loadClass}" cx="80" cy="80" r="70" stroke-width="12" stroke-dasharray="440" stroke-dashoffset="${strokeDashOffset}"></circle>
                        </svg>
                        <div class="progress-text">
                            <div class="amount">${truck.cargo.amount.toFixed(0)}/${stats.capacity.toFixed(0)}</div>
                            <div class="resource">${cargoLabel}</div>
                        </div>
                    </div>
                    <span class="status-tag ${statusInfo.className}" data-phase="${statusInfo.phase}" title="${statusInfo.tooltip}">${statusInfo.text}</span>
                    <div class="route-info" style="margin-top: 1rem; text-align: center; font-size: 0.9rem; color: #9ca3af;">
                        <div style="margin-bottom: 0.25rem;">${fromLocation}</div>
                        <div style="font-size: 1.2rem; margin: 0.25rem 0;">${getIconHTML('➔')}</div>
                        <div>${toLocation}</div>
                    </div>
                    <h4>Разрешенные грузы</h4>
                            <div class="cargo-filter-container">
                                <button class="cargo-filter-btn" data-truck-id="${truck.id}">
                                    ⚙️ Настроить фильтры грузов
                                    <div class="cargo-filter-preview">${allowedCargoDisplay}</div>
                                </button>
                                <div class="cargo-filter-popup" id="filter-popup-${truck.id}">
                                    <div class="cargo-filter-header">Разрешенные грузы</div>
                                    <div class="cargo-filter-grid">
                                        ${cargoFiltersHTML}
                                    </div>
                                    <div class="cargo-filter-actions">
                                        <button data-action="toggle-all-cargo" data-truck-id="${truck.id}" data-mode="select" class="cargo-filter-action-btn select-all">Выбрать все</button>
                                        <button data-action="toggle-all-cargo" data-truck-id="${truck.id}" data-mode="deselect" class="cargo-filter-action-btn deselect-all">Снять все</button>
                                    </div>
                                </div>
                            </div>
                </div>
                <div class="tabs-and-content">
                    <nav class="detail-tabs">
                        <button class="tab-btn ${logisticsUIState.currentTab === 'task' ? 'active' : ''}" data-tab="task">Задача</button>
                        <button class="tab-btn ${logisticsUIState.currentTab === 'upgrades' ? 'active' : ''}" data-tab="upgrades">Улучшения</button>
                        <button class="tab-btn ${logisticsUIState.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">Настройки</button>
                        <button class="return-btn">↲ На базу</button>
                    </nav>
                    <div class="tab-content">
                        
                        <!-- Pane Маршрутов удален -->

                        <div id="task-pane" class="tab-pane ${logisticsUIState.currentTab === 'task' ? 'active' : ''}">
                                <div class="route-visualizer">
                                <div class="location">
                                    <div class="icon">${fromIcon}</div>
                                    <div class="name">${fromName}</div>
                                </div>
                                <div class="arrow">${getIconHTML('➔')}</div>
                                <div class="location">
                                    <div class="icon">${toIcon}</div>
                                    <div class="name">${toName}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="upgrades-pane" class="tab-pane ${logisticsUIState.currentTab === 'upgrades' ? 'active' : ''}">
                            <div class="upgrades-grid">${upgradesHTML}</div>
                        </div>
                        
                        <div id="settings-pane" class="tab-pane ${logisticsUIState.currentTab === 'settings' ? 'active' : ''}">
                            <!-- Сюда будет вставлен выбор водителя через JS (DriverSystem) -->
                            
                            <!-- === НОВЫЙ БЛОК: ПРИВЯЗКА К ХАБУ === -->
                            <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);">
                                <h4 style="margin-top: 0;">🏠 Приписка к Хабу</h4>
                                ${hubInfoDisplay}
                                <select id="truck-hub-assignor" style="width: 100%; padding: 8px; background: #1a202c; color: white; border: 1px solid #4a5568; border-radius: 4px;">
                                    ${hubSelectOptions}
                                </select>
                                <div style="font-size: 0.8em; color: #718096; margin-top: 5px;">
                                    Ограничивает поиск работы радиусом выбранного хаба.
                                </div>
                            </div>
                            <!-- =================================== -->

                            <h4>Режим работы</h4>
                            <div class="mode-selector">${modesHTML}</div>
                            
                            <!-- Кнопка шаблонов (можно оставить или убрать, если шаблоны были завязаны на custom_routes) -->
                            <!-- <button type="button" class="route-template-btn" data-action="save-route-template">Сохранить маршрут как шаблон</button> -->
                            
                            
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 3. Логика интеграции систем (DriverSystem и CustomRouteSystem)
        
        if (window.DriverSystem) {
            // ИЗМЕНЕНИЕ: Ищем теперь #upgrades-pane вместо #settings-pane
            const upgradesPane = container.querySelector('#upgrades-pane');
            if (upgradesPane) {
                // Создаем контейнер для выбора водителя
                const driverContainer = document.createElement('div');
                driverContainer.style.marginBottom = '15px'; // Немного отступа от сетки улучшений
                
                // Вставляем его в НАЧАЛО вкладки улучшений (перед сеткой .upgrades-grid)
                upgradesPane.insertBefore(driverContainer, upgradesPane.firstChild);
                
                window.DriverSystem.renderDriverSelector(truck, driverContainer, gameState);
            }
        }

        if (logisticsUIState.currentTab === 'routes') {
            const routesContainer = document.getElementById('routes-pane');
            if(routesContainer && window.CustomRouteSystem) {
                window.CustomRouteSystem.renderUI(routesContainer, gameState);

                const routeSelectHTML = `
                    <div style="padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; margin-bottom: 10px; border: 1px solid #3b82f6;">
                        <label>Активный маршрут грузовика:</label>
                        <select id="truck-route-select" style="width: 100%; padding: 8px; margin-top: 5px; background: #1a202c; color: white; border: 1px solid #4a5568; border-radius: 4px;">
                            <option value="">(Без маршрута / Стандартный режим)</option>
                            ${gameState.customRoutes.map(r => `<option value="${r.id}" ${truck.assignedRouteId === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                        </select>
                        <small style="color: #aaa; display: block; margin-top: 5px;">
                            При выборе маршрута режим грузовика автоматически переключится на "По маршруту".
                        </small>
                    </div>
                `;

                const routeControls = document.createElement('div');
                routeControls.innerHTML = routeSelectHTML;
                routesContainer.insertBefore(routeControls, routesContainer.firstChild);

                const sel = document.getElementById('truck-route-select');
                if(sel) {
                    sel.addEventListener('change', (e) => {
                        const val = e.target.value;
                        if (val) {
                            truck.assignedRouteId = parseInt(val);
                            truck.mode = 'custom_route';
                            
                            // Привязка к хабу, если маршрут имеет привязку
                            const route = gameState.customRoutes.find(r => r.id === truck.assignedRouteId);
                            if (route && route.hubLimitEnabled && route.assignedHubId) {
                                truck.assignedHubId = route.assignedHubId;
                                // Обновляем список машин в хабе
                                const hub = gameState.buildings.find(b => b.id === route.assignedHubId);
                                if (hub && hub.type === 'transport_hub') {
                                    if (!hub.assignedVehicles) hub.assignedVehicles = [];
                                    if (!hub.assignedVehicles.includes(truck.id)) {
                                        hub.assignedVehicles.push(truck.id);
                                    }
                                }
                            } else {
                                // Убираем привязку, если маршрут не имеет привязки к хабу
                                if (truck.assignedHubId) {
                                    const oldHub = gameState.buildings.find(b => b.id === truck.assignedHubId);
                                    if (oldHub && oldHub.assignedVehicles) {
                                        oldHub.assignedVehicles = oldHub.assignedVehicles.filter(id => id !== truck.id);
                                    }
                                }
                                truck.assignedHubId = null;
                            }
                            truck.state = 'IDLE'; 
                            truck.currentStepIndex = 0;
                            showNotification(`Маршрут назначен!`, 'success');
                        } else {
                            truck.assignedRouteId = null;
                            // Убираем привязку к хабу
                            if (truck.assignedHubId) {
                                const hub = gameState.buildings.find(b => b.id === truck.assignedHubId);
                                if (hub && hub.assignedVehicles) {
                                    hub.assignedVehicles = hub.assignedVehicles.filter(id => id !== truck.id);
                                }
                            }
                            truck.assignedHubId = null;
                            truck.mode = 'auto'; 
                            showNotification(`Маршрут снят.`, 'info');
                        }
                        renderDetailView(); 
                    });
                }
            }
        }
    }

    function populateLogisticsModal() {
        if (!logisticsUIState.currentTruckId && gameState.vehicles.length > 0) {
            logisticsUIState.currentTruckId = gameState.vehicles[0].id;
        }
        renderTruckList();
        renderDetailView();
    }


    function updateDetailView() {
        const container = document.getElementById('truck-detail-view');
        const truck = gameState.vehicles.find(t => t.id === logisticsUIState.currentTruckId);
        
        if (!truck || !container.querySelector('.detail-header')) {
            return;
        }

        const stats = getTruckStats(truck);
        const cargoPercentage = stats.capacity > 0 ? (truck.cargo.amount / stats.capacity) : 0;
        const cargoLabel = truck.cargo.type ? `${getIconHTML(RESOURCES[truck.cargo.type].emoji, truck.cargo.type)} ${RESOURCES[truck.cargo.type].name}` : 'Пустой';
        const strokeDashOffset = 440 * (1 - cargoPercentage);
        const statusInfo = getStatusInfo(truck);

        const progressValue = container.querySelector('.progress-value');
        if (progressValue) {
            progressValue.style.strokeDashoffset = strokeDashOffset;
        }

        const amountText = container.querySelector('.progress-text .amount');
        if (amountText) {
            amountText.textContent = `${truck.cargo.amount.toFixed(0)}/${stats.capacity.toFixed(0)}`;
        }

        const resourceText = container.querySelector('.progress-text .resource');
        if (resourceText) {
            resourceText.innerHTML = cargoLabel;
        }

        const statusTag = container.querySelector('.cargo-status .status-tag');
        if (statusTag) {
            statusTag.textContent = statusInfo.text;
            statusTag.className = `status-tag ${statusInfo.className}`;
            statusTag.setAttribute('data-phase', statusInfo.phase || '');
            if (statusInfo.tooltip) {
                statusTag.title = statusInfo.tooltip;
            }
        }

        const sourceBuilding = gameState.buildings.find(b => b.id === truck.pickupTargetId);
        const fromIcon = sourceBuilding ? getIconHTML(BUILDING_BLUEPRINTS[sourceBuilding.type].emoji) : '';
        const fromName = sourceBuilding ? BUILDING_BLUEPRINTS[sourceBuilding.type].name : 'База';
        const fromLocation = `${fromIcon} ${fromName}`;
        
        let toIcon = '';
        let toName = '---';
        const destBuilding = gameState.buildings.find(b => b.id === truck.dropoffTargetId);
        if (destBuilding) {
            toIcon = getIconHTML(BUILDING_BLUEPRINTS[destBuilding.type].emoji);
            toName = BUILDING_BLUEPRINTS[destBuilding.type].name;
        } else {
            const destMarket = gameState.internalMarkets?.find(m => m.id === truck.dropoffTargetId);
            if (destMarket) {
                toIcon = getIconHTML('🛒');
                toName = destMarket.name;
            }
        }
        const toLocation = `${toIcon} ${toName}`;

        let routeInfo = container.querySelector('.cargo-status .route-info');
        if (routeInfo) {
            const fromDiv = routeInfo.querySelector('div:first-child');
            const toDiv = routeInfo.querySelector('div:last-child');
            if (fromDiv) fromDiv.innerHTML = fromLocation;
            if (toDiv) toDiv.innerHTML = toLocation;
        } else {
            const cargoStatus = container.querySelector('.cargo-status');
            if (cargoStatus) {
                routeInfo = document.createElement('div');
                routeInfo.className = 'route-info';
                routeInfo.style.cssText = 'margin-top: 1rem; text-align: center; font-size: 0.9rem; color: #9ca3af;';
                routeInfo.innerHTML = `
                    <div style="margin-bottom: 0.25rem;">${fromLocation}</div>
                    <div style="font-size: 1.2rem; margin: 0.25rem 0;">${getIconHTML('➔')}</div>
                    <div>${toLocation}</div>
                `;
                cargoStatus.appendChild(routeInfo);
            }
        }

        const allResourceKeys = Object.keys(RESOURCES).filter(k => RESOURCES[k].baseExportPrice > 0);
        const totalResources = allResourceKeys.length;
        let allowedCargoDisplay = '';
        if (truck.allowedCargo.size >= totalResources) {
            allowedCargoDisplay = `${getIconHTML('✅')} Все ресурсы`;
        } else if (truck.allowedCargo.size === 0) {
            allowedCargoDisplay = `${getIconHTML('🚫')} Ничего не разрешено`;
        } else {
            allowedCargoDisplay = Array.from(truck.allowedCargo).slice(0, 4).map(resKey =>
                getIconHTML(RESOURCES[resKey].emoji, resKey)
            ).join(' ');
            if (truck.allowedCargo.size > 4) allowedCargoDisplay += '...';
        }
        const previewEl = container.querySelector('.cargo-filter-preview');
        if (previewEl) {
            previewEl.innerHTML = allowedCargoDisplay;
        }

        const popup = container.querySelector('.cargo-filter-popup');
        if (popup && popup.style.display !== 'none') {
            popup.querySelectorAll('input[type="checkbox"][data-res-key]').forEach(checkbox => {
                checkbox.checked = truck.allowedCargo.has(checkbox.dataset.resKey);
            });
        }

        if (logisticsUIState.currentTab === 'task') {
            const locations = container.querySelectorAll('.route-visualizer .location');
            if (locations.length >= 2) {
                const fromIconEl = locations[0].querySelector('.icon');
                const fromNameEl = locations[0].querySelector('.name');
                const toIconEl = locations[1].querySelector('.icon');
                const toNameEl = locations[1].querySelector('.name');
                
                if (fromIconEl && fromNameEl) {
                    fromIconEl.innerHTML = fromIcon;
                    fromNameEl.textContent = fromName;
                }
                if (toIconEl && toNameEl) {
                    toIconEl.innerHTML = toIcon;
                    toNameEl.textContent = toName;
                }
            }
        }

        if (logisticsUIState.currentTab === 'upgrades') {
            ['capacity', 'speed'].forEach(type => {
                const button = container.querySelector(`.upgrade-btn[data-type="${type}"]`);
                if (!button) return;

                const currentLevel = truck.level[type];
                const upgradeLevels = TRUCK_UPGRADE_CONFIG[type];

                if (currentLevel >= upgradeLevels.length) {
                    if (button.textContent !== 'Макс. уровень') {
                        button.textContent = 'Макс. уровень';
                        button.disabled = true;
                    }
                    return;
                }

                const nextUpgrade = upgradeLevels[currentLevel];
                const afford = canAfford(nextUpgrade.cost);
                const newText = afford ? 'Улучшить' : 'Не хватает ресурсов';

                if (button.textContent !== newText) {
                    button.textContent = newText;
                }
                if (button.disabled !== !afford) {
                    button.disabled = !afford;
                }
            });
        }
    }

    function updateTruckList() {
        const container = document.getElementById('truck-list-content');
        if (!container) return;

        gameState.vehicles.forEach(truck => {
            const listItem = container.querySelector(`.truck-list-item[data-id="${truck.id}"]`);
            if (!listItem) return;

            const stats = getTruckStats(truck);
            const cargoPercentage = stats.capacity > 0 ? (truck.cargo.amount / stats.capacity) * 100 : 0;
            const cargoLabel = truck.cargo.type ? `${getIconHTML(RESOURCES[truck.cargo.type].emoji, truck.cargo.type)} ${RESOURCES[truck.cargo.type].name}` : 'Пустой';
            const statusInfo = getStatusInfo(truck);

            const statusTag = listItem.querySelector('.status-tag');
            if (statusTag) {
                statusTag.textContent = statusInfo.text;
                statusTag.className = `status-tag ${statusInfo.className}`;
                statusTag.setAttribute('data-phase', statusInfo.phase || '');
                if (statusInfo.tooltip) {
                    statusTag.title = statusInfo.tooltip;
                }
            }

            const label = listItem.querySelector('.cargo-bar-sm .label');
            if (label) {
                const currentText = label.textContent || label.innerText || '';
                const newText = cargoLabel.replace(/<[^>]*>/g, '');
                if (currentText !== newText) {
                    label.innerHTML = cargoLabel;
                }
            }

            const progressFill = listItem.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = `${cargoPercentage}%`;
            }

            const sourceBuilding = gameState.buildings.find(b => b.id === truck.pickupTargetId);
            const fromIcon = sourceBuilding ? getIconHTML(BUILDING_BLUEPRINTS[sourceBuilding.type].emoji) : '';
            const fromName = sourceBuilding ? BUILDING_BLUEPRINTS[sourceBuilding.type].name : 'База';
            const fromLocation = `${fromIcon} ${fromName}`;
            
            let toIcon = '';
            let toName = '---';
            const destBuilding = gameState.buildings.find(b => b.id === truck.dropoffTargetId);
            if (destBuilding) {
                toIcon = getIconHTML(BUILDING_BLUEPRINTS[destBuilding.type].emoji);
                toName = BUILDING_BLUEPRINTS[destBuilding.type].name;
            } else {
                const destMarket = gameState.internalMarkets?.find(m => m.id === truck.dropoffTargetId);
                if (destMarket) {
                    toIcon = getIconHTML('🛒');
                    toName = destMarket.name;
                }
            }
            const toLocation = `${toIcon} ${toName}`;
            const routeText = `${fromLocation} ${getIconHTML('➔')} ${toLocation}`;
            const routeTextEl = listItem.querySelector('.route-text');
            if (routeTextEl) {
                routeTextEl.innerHTML = routeText;
            } else {
                const cargoBar = listItem.querySelector('.cargo-bar-sm');
                if (cargoBar) {
                    const routeDiv = document.createElement('div');
                    routeDiv.className = 'route-text';
                    routeDiv.style.cssText = 'font-size: 0.75rem; color: #9ca3af; margin-top: 0.5rem;';
                    routeDiv.innerHTML = routeText;
                    cargoBar.appendChild(routeDiv);
                }
            }

            if (truck.id === logisticsUIState.currentTruckId) {
                listItem.classList.add('active');
            } else {
                listItem.classList.remove('active');
            }
        });
    }

    function updateAndRepopulateLogistics() {
        if (logisticsModal.style.display !== 'flex') {
            clearInterval(logisticsUpdateInterval);
            logisticsUpdateInterval = null;
            activeLogisticsPopupId = null;
            return;
        }

        updateTruckList();
        updateDetailView();
    }


    logisticsModal.addEventListener('click', e => {
        if (e.target.closest('.cargo-filter-btn')) {
            e.stopPropagation();
            const btn = e.target.closest('.cargo-filter-btn');
            const truckId = parseInt(btn.dataset.truckId);
            const popup = document.getElementById(`filter-popup-${truckId}`);
            if (!popup) return;
            
            const isOpening = popup.style.display === 'none' || !popup.style.display;

            document.querySelectorAll('.cargo-filter-popup').forEach(p => {
                if (p.id !== `filter-popup-${truckId}`) {
                    p.style.display = 'none';
                }
            });

            if (isOpening) {
                popup.style.display = 'block';
                activeLogisticsPopupId = truckId;
            } else {
                popup.style.display = 'none';
                activeLogisticsPopupId = null;
                renderDetailView(); 
            }
            return;
        }

        if (e.target.closest('.cargo-filter-popup')) {
            if (e.target.matches('input[type="checkbox"][data-res-key]')) {
                e.stopPropagation();
                const truck = gameState.vehicles.find(t => t.id === logisticsUIState.currentTruckId);
                if (!truck) return;
                const resKey = e.target.dataset.resKey;
                if (e.target.checked) {
                    truck.allowedCargo.add(resKey);
                } else {
                    truck.allowedCargo.delete(resKey);
                }
                return;
            }
            if (e.target.dataset.action === 'toggle-all-cargo') {
                e.stopPropagation();
                const truckId = parseInt(e.target.dataset.truckId);
                const mode = e.target.dataset.mode;
                const truck = gameState.vehicles.find(t => t.id === truckId);
                if (!truck) return;
                const allResourceKeys = Object.keys(RESOURCES).filter(k => RESOURCES[k].baseExportPrice > 0);
                if (mode === 'select') {
                    truck.allowedCargo = new Set(allResourceKeys);
                } else {
                    truck.allowedCargo.clear();
                }
                const popup = document.getElementById(`filter-popup-${truckId}`);
                if (popup) {
                    popup.querySelectorAll('input[type="checkbox"][data-res-key]').forEach(checkbox => {
                        checkbox.checked = mode === 'select';
                    });
                }
                return;
            }
            return; 
        }

        if (activeLogisticsPopupId !== null && !e.target.closest('.cargo-filter-popup') && !e.target.closest('.cargo-filter-btn')) {
            document.querySelectorAll('.cargo-filter-popup').forEach(p => {
                p.style.display = 'none';
            });
            activeLogisticsPopupId = null;
            renderDetailView(); 
        }

        if (e.target.id === 'fleet-select-all') {
            const checkbox = (e.target);
            const container = document.getElementById('truck-list-content');
            if (!container) return;

            const itemNodes = container.querySelectorAll('.truck-list-item[data-id]');
            const idsOnPage = Array.from(itemNodes).map(el => parseInt(el.getAttribute('data-id')));

            if (checkbox.checked) {
                idsOnPage.forEach(id => logisticsUIState.selectedTruckIds.add(id));
            } else {
                idsOnPage.forEach(id => logisticsUIState.selectedTruckIds.delete(id));
            }

            renderTruckList();
            return;
        }

        const fleetCheckbox = e.target.closest('.fleet-select-checkbox');
        if (fleetCheckbox) {
            const id = parseInt(fleetCheckbox.dataset.id);
            if (fleetCheckbox.checked) {
                logisticsUIState.selectedTruckIds.add(id);
            } else {
                logisticsUIState.selectedTruckIds.delete(id);
            }
            renderTruckList();
            return;
        }

        const listItem = e.target.closest('.truck-list-item');
        if (listItem && !e.target.closest('.fleet-select')) {
            logisticsUIState.currentTruckId = parseInt(listItem.dataset.id);
            renderTruckList();
            renderDetailView();
            return;
        }

        const truck = gameState.vehicles.find(t => t.id === logisticsUIState.currentTruckId);
        if (e.target.matches('.route-template-btn[data-action="save-route-template"]')) {
            const sourceBuilding = gameState.buildings.find(b => b.id === truck.pickupTargetId);
            const destBuilding = gameState.buildings.find(b => b.id === truck.dropoffTargetId);
            const destMarket = gameState.internalMarkets?.find(m => m.id === truck.dropoffTargetId);

            const fromName = sourceBuilding ? BUILDING_BLUEPRINTS[sourceBuilding.type].name : 'База';
            let toName = '---';
            if (destBuilding) {
                toName = BUILDING_BLUEPRINTS[destBuilding.type].name;
            } else if (destMarket) {
                toName = destMarket.name;
            }

            const templateId = Date.now();
            const templateName = `${fromName} → ${toName}`;
            const allowedCargo = Array.from(truck.allowedCargo || []);

            logisticsUIState.routeTemplates.push({
                id: templateId,
                name: templateName,
                mode: truck.mode,
                pickupTargetId: truck.pickupTargetId,
                dropoffTargetId: truck.dropoffTargetId,
                allowedCargo
            });

            showNotification(`Шаблон маршрута "${templateName}" сохранён`, 'success');
            renderTruckList();
            return;
        }

        const massActionBtn = e.target.closest('.mass-action-btn');
        if (massActionBtn) {
            const action = massActionBtn.dataset.action;
            const selectedIds = Array.from(logisticsUIState.selectedTruckIds || []);
            if (selectedIds.length === 0) {
                showNotification('Не выбрано ни одного грузовика для массового действия', 'info');
                return;
            }

            if (action === 'apply-mode') {
                const modeSelect = document.getElementById('mass-mode-select');
                const mode = modeSelect ? modeSelect.value : '';
                if (!mode) {
                    showNotification('Выберите режим для применения', 'info');
                    return;
                }

                selectedIds.forEach(id => {
                    const t = gameState.vehicles.find(v => v.id === id);
                    if (t) {
                        t.mode = mode;
                    }
                });

                showNotification(`Режим "${mode}" применён к ${selectedIds.length} груз.`,'success');
                renderAll();
                return;
            }

            if (action === 'apply-template') {
                const templateSelect = document.getElementById('mass-template-select');
                if (!templateSelect || !templateSelect.value) {
                    showNotification('Выберите шаблон маршрута для применения', 'info');
                    return;
                }

                const templateId = parseInt(templateSelect.value);
                const template = logisticsUIState.routeTemplates.find(t => t.id === templateId);
                if (!template) {
                    showNotification('Выбранный шаблон маршрута не найден', 'error');
                    return;
                }

                selectedIds.forEach(id => {
                    const t = gameState.vehicles.find(v => v.id === id);
                    if (!t) return;
                    t.mode = template.mode;
                    t.pickupTargetId = template.pickupTargetId;
                    t.dropoffTargetId = template.dropoffTargetId;
                    t.allowedCargo = new Set(template.allowedCargo || []);
                });

                showNotification(`Шаблон "${template.name}" применён к ${selectedIds.length} груз.`, 'success');
                renderAll();
                return;
            }
        }

        if (!truck) return;

        const tab = e.target.closest('.tab-btn');
        if (tab) {
            logisticsUIState.currentTab = tab.dataset.tab;
            renderDetailView();
            return;
        }

        if (e.target.classList.contains('return-btn')) {
            if (truck.cargo.amount > 0 && truck.dropoffTargetId && gameState.buildings.find(b => b.id === truck.dropoffTargetId)?.type === 'warehouse') {
                gameState.incomingToWarehouses -= truck.cargo.amount;
            }
            truck.state = 'RETURNING_TO_BASE';
            truck.cargo = { type: null, amount: 0 };
            renderDetailView();
            return;
        }

        const upgradeBtn = e.target.closest('.upgrade-btn');
        if (upgradeBtn && !upgradeBtn.disabled) {
            const type = upgradeBtn.dataset.type;
            const currentLevel = truck.level[type];
            const upgradeLevels = TRUCK_UPGRADE_CONFIG[type];

            if (currentLevel >= upgradeLevels.length) {
                showNotification('Уже достигнут максимальный уровень!', 'info');
                return;
            }

            const nextUpgrade = upgradeLevels[currentLevel];
            const costs = nextUpgrade.cost;

            let canAfford = true;
            let missingResources = [];
            for (const [resource, requiredAmount] of Object.entries(costs)) {
                if (resource === 'money') {
                    if (gameState.money < requiredAmount) {
                        canAfford = false;
                        break;
                    }
                } else {
                    if ((gameState.resources[resource] || 0) < requiredAmount) {
                        canAfford = false;
                        missingResources.push(RESOURCES[resource].name);
                    }
                }
            }

            if (canAfford) {
                let totalCost = 0;
                for (const [resource, requiredAmount] of Object.entries(costs)) {
                    if (resource === 'money') {
                        gameState.money -= requiredAmount;
                        totalCost += requiredAmount;
                    } else {
                        consumeFromWarehouses(resource, requiredAmount);
                        // Update global immediately
                        if (gameState.resources[resource]) gameState.resources[resource] -= requiredAmount;
                    }
                }
                if (totalCost > 0) {
                    const upgradeName = type === 'capacity' ? 'вместимости' : 'скорости';
                    recordMoneyTransaction(-totalCost, `Улучшение ${upgradeName} грузовика #${truck.id}`);
                }

                truck.level[type]++;
                if (type === 'capacity') {
                    truck.capacity += nextUpgrade.bonus;
                } else if (type === 'speed') {
                    truck.speed *= nextUpgrade.bonus;
                }

                showNotification(`Грузовик #${truck.id.toString().slice(-4)} улучшен!`, 'success');
                renderAll();
                updateUI();
            } else {
                if (missingResources.length > 0) {
                    showNotification(`Недостаточно ресурсов: ${missingResources.join(', ')}`, 'error');
                } else {
                    showNotification(`Недостаточно денег!`, 'error');
                }
            }
            return;
        }
    });

    logisticsModal.addEventListener('change', e => {
        const truck = gameState.vehicles.find(t => t.id === logisticsUIState.currentTruckId);
        if (!truck) return;

        if (e.target.matches('.mode-input')) {
            truck.mode = e.target.value;
            showNotification(`Режим грузовика #${truck.id.toString().slice(-4)} изменен`, 'info');
            renderDetailView();
        }
        
        if (e.target.id === 'sort-select') {
            logisticsUIState.sortBy = e.target.value;
            renderTruckList();
        }

        if (e.target.id === 'filter-select') {
            logisticsUIState.filterBy = e.target.value;
            renderTruckList();
        }
        if (e.target.id === 'truck-hub-assignor') {
            const truck = gameState.vehicles.find(t => t.id === logisticsUIState.currentTruckId);
            if (truck) {
                const val = e.target.value;
                if (val) {
                    truck.assignedHubId = parseInt(val);
                    showNotification(`Грузовик приписан к Хабу`, 'success');
                } else {
                    truck.assignedHubId = null;
                    showNotification(`Привязка к Хабу снята`, 'info');
                }
                // Обновляем вид, чтобы обновилась надпись статуса
                renderDetailView();
            }
        }
    });

    function renderAll() {
        renderTruckList();
        renderDetailView();
    }

    // =================================================================================
    // БАНКОВСКАЯ СИСТЕМА
    // =================================================================================
    const BankSystem = {
        // Конфигурация предложений
        OFFERS: [
            {
                id: 'salary_loan',
                name: '💼 Оборотный капитал',
                desc: 'Деньги сразу, возврат частями.',
                amount: 25000,
                type: 'periodic', // Периодические платежи
                interestRate: 0.25, // 25% переплаты в сумме
                interval: 90 * 1000, // 1 мин 30 сек
                paymentsCount: 10, // 10 платежей
            },
            {
                id: 'flash_loan',
                name: '⚡ Быстрый старт',
                desc: 'На короткий срок под высокий процент.',
                amount: 10000,
                type: 'bullet', // Возврат всей суммы в конце
                interestRate: 0.40, // 40% переплаты
                duration: 7 * 60 * 1000, // 7 минут
            },
            {
                id: 'venture_loan',
                name: '🏭 Крупная инвестиция',
                desc: 'Огромная сумма на долгий срок.',
                amount: 100000,
                type: 'bullet',
                interestRate: 0.50, // 50% переплаты
                duration: 15 * 60 * 1000, // 15 минут
            }
        ],

        // Инициализация
        init(state) {
            if (!state.loans) state.loans = [];
            this.bindEvents();
        },

        // Обновление состояния (вызывать в gameTick)
        update(state, deltaTimeMs) {
            if (!state.loans) return;
            const now = Date.now();

            // Проходим по кредитам в обратном порядке, чтобы можно было удалять
            for (let i = state.loans.length - 1; i >= 0; i--) {
                const loan = state.loans[i];

                if (loan.type === 'periodic') {
                    // Проверка времени платежа
                    if (now >= loan.nextPaymentDue) {
                        this.processPeriodicPayment(state, loan, i);
                    }
                } else if (loan.type === 'bullet') {
                    // Проверка дедлайна
                    if (now >= loan.deadline) {
                        this.processBulletDeadline(state, loan, i);
                    }
                }
            }
        },

        // Взять кредит
        takeLoan(state, offerId) {
            const offer = this.OFFERS.find(o => o.id === offerId);
            if (!offer) return;

            const now = Date.now();
            const loan = {
                id: Date.now() + Math.random(), // Уникальный ID
                offerId: offer.id,
                name: offer.name,
                type: offer.type,
                principal: offer.amount, // Сколько взяли
                totalRepay: offer.amount * (1 + offer.interestRate), // Сколько вернуть всего
                startTime: now,
            };

            if (offer.type === 'periodic') {
                loan.paymentAmount = loan.totalRepay / offer.paymentsCount;
                loan.paymentsLeft = offer.paymentsCount;
                loan.interval = offer.interval;
                loan.nextPaymentDue = now + offer.interval;
            } else {
                loan.deadline = now + offer.duration;
                loan.duration = offer.duration;
            }

            state.loans.push(loan);
            state.money += offer.amount;
            
            recordMoneyTransaction(offer.amount, `Кредит: ${offer.name}`);
            showNotification(`Получен кредит: ${offer.amount.toLocaleString()}$`, 'success');
            
            // Если модалка открыта - обновить
            if(document.getElementById('bank-modal').style.display === 'flex') {
                this.renderUI(state);
            }
            updateUI(); // Обновить счетчик денег
        },

        // Досрочное погашение
        repayEarly(state, loanId) {
            const index = state.loans.findIndex(l => l.id === loanId);
            if (index === -1) return;
            
            const loan = state.loans[index];
            let amountToPay = 0;

            if (loan.type === 'periodic') {
                amountToPay = loan.paymentAmount * loan.paymentsLeft;
            } else {
                amountToPay = loan.totalRepay;
            }

            if (state.money >= amountToPay) {
                state.money -= amountToPay;
                state.loans.splice(index, 1);
                recordMoneyTransaction(-amountToPay, `Погашение кредита: ${loan.name}`);
                showNotification(`Кредит полностью погашен!`, 'success');
                this.renderUI(state);
                updateUI();
            } else {
                showNotification(`Недостаточно средств (${amountToPay.toLocaleString()}$)`, 'error');
            }
        },

        // Обработка периодического платежа
        processPeriodicPayment(state, loan, index) {
            const amount = loan.paymentAmount;
            
            // Списываем, даже если уходим в минус (банкротство обработается в main loop)
            state.money -= amount;
            recordMoneyTransaction(-amount, `Платеж по кредиту (${loan.paymentsLeft} ост.)`);
            
            loan.paymentsLeft--;
            loan.nextPaymentDue += loan.interval;

            if (loan.paymentsLeft <= 0) {
                state.loans.splice(index, 1);
                showNotification(`Кредит "${loan.name}" выплачен!`, 'success');
            } else {
                // Предупреждение о списании
                showNotification(`Списан платеж по кредиту: -${Math.floor(amount)}$`, 'info');
            }
            updateUI();
        },

        // Обработка дедлайна (Блиц/Инвест)
        processBulletDeadline(state, loan, index) {
            const amount = loan.totalRepay;
            
            if (state.money >= amount) {
                state.money -= amount;
                state.loans.splice(index, 1);
                recordMoneyTransaction(-amount, `Авто-погашение кредита: ${loan.name}`);
                showNotification(`Срок вышел! Кредит "${loan.name}" погашен.`, 'success');
            } else {
                // ДЕНЕГ НЕТ = БАНКРОТСТВО
                // Уводим в жесткий минус, чтобы сработал triggerGameOver
                state.money -= amount; 
                showNotification(`Срок вышел! Нет денег на возврат кредита!`, 'error');
                // triggerGameOver будет вызван в main loop, так как money < 0
            }
            updateUI();
        },

        // Рендер UI
        renderUI(state) {
            const offersContainer = document.getElementById('loan-offers-grid');
            const activeContainer = document.getElementById('active-loans-list');
            document.getElementById('bank-current-money').textContent = Math.floor(state.money).toLocaleString() + "$";

            // Рендер предложений
            offersContainer.innerHTML = this.OFFERS.map(offer => {
                const totalRepay = offer.amount * (1 + offer.interestRate);
                let detailText = '';
                
                if (offer.type === 'periodic') {
                    const payPerTick = totalRepay / offer.paymentsCount;
                    const intervalSec = offer.interval / 1000;
                    detailText = `
                        <span>💵 Платеж: ${Math.floor(payPerTick).toLocaleString()}$</span>
                        <span>⏱️ Каждые: ${intervalSec} сек</span>
                        <span>🔄 Всего платежей: ${offer.paymentsCount}</span>
                    `;
                } else {
                    const durMin = offer.duration / 1000 / 60;
                    detailText = `
                        <span>📅 Срок: ${durMin} мин</span>
                        <span>💰 К возврату: ${Math.floor(totalRepay).toLocaleString()}$</span>
                        <span>⚠️ Оплата в конце срока</span>
                    `;
                }

                return `
                    <div class="loan-card">
                        <div class="loan-title">${offer.name}</div>
                        <div class="loan-amount">+${offer.amount.toLocaleString()}$</div>
                        <div class="loan-details">
                            ${detailText}
                            <span style="color: #e53e3e; margin-top:5px;">Переплата: ${(offer.interestRate * 100).toFixed(0)}%</span>
                        </div>
                        <button class="loan-btn" onclick="BankSystem.takeLoan(gameState, '${offer.id}')">Взять кредит</button>
                    </div>
                `;
            }).join('');

            // Рендер активных
            if (!state.loans || state.loans.length === 0) {
                activeContainer.innerHTML = '<div style="text-align:center; color:#718096; padding:20px;">У вас нет активных кредитов.</div>';
            } else {
                activeContainer.innerHTML = state.loans.map(loan => {
                    const now = Date.now();
                    let infoHtml = '';
                    let progressPercent = 0;
                    let remainingDebt = 0;

                    if (loan.type === 'periodic') {
                        remainingDebt = loan.paymentAmount * loan.paymentsLeft;
                        const timeUntilNext = Math.max(0, loan.nextPaymentDue - now);
                        const totalInterval = loan.interval;
                        progressPercent = 100 - (timeUntilNext / totalInterval * 100);
                        
                        infoHtml = `
                            <div><strong>${loan.name}</strong></div>
                            <div>Осталось долга: ${Math.floor(remainingDebt).toLocaleString()}$</div>
                            <div>Платежей: ${loan.paymentsLeft} (след. через ${(timeUntilNext/1000).toFixed(0)}с)</div>
                        `;
                    } else {
                        remainingDebt = loan.totalRepay;
                        const timeLeft = Math.max(0, loan.deadline - now);
                        const totalDur = loan.duration;
                        progressPercent = 100 - (timeLeft / totalDur * 100); // Сколько прошло
                        
                        infoHtml = `
                            <div><strong>${loan.name}</strong></div>
                            <div>К возврату: ${Math.floor(remainingDebt).toLocaleString()}$</div>
                            <div style="color: #f6e05e;">Дедлайн через: ${Math.floor(timeLeft/1000/60)}м ${(Math.floor(timeLeft/1000)%60)}с</div>
                        `;
                    }

                    return `
                        <div class="active-loan-item">
                            <div style="flex: 1;">
                                ${infoHtml}
                                <div class="loan-progress-bar">
                                    <div class="loan-progress-fill" style="width: ${progressPercent}%"></div>
                                </div>
                            </div>
                            <button class="loan-repay-btn" onclick="BankSystem.repayEarly(gameState, ${loan.id})">
                                Погасить (${Math.floor(remainingDebt).toLocaleString()}$)
                            </button>
                        </div>
                    `;
                }).join('');
            }
        },

        bindEvents() {
            // Переключение вкладок
            const modal = document.getElementById('bank-modal');
            if (!modal) return;
            
            modal.querySelectorAll('.bank-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    modal.querySelectorAll('.bank-tab-btn').forEach(b => b.classList.remove('active'));
                    modal.querySelectorAll('.bank-tab-content').forEach(c => c.style.display = 'none');
                    
                    e.target.classList.add('active');
                    const tabId = e.target.dataset.tab;
                    document.getElementById(`bank-${tabId}-tab`).style.display = 'block';
                });
            });
        }
    };
    
// Экспортируем для HTML onclick
    window.BankSystem = BankSystem;

    // =================================================================================
    // VII. ИНИЦИАЛИЗАЦИЯ ИГРЫ
    // =================================================================================
    
    // Вспомогательная функция для задержки (чтобы UI успел обновиться)
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Функция обновления прогресс-бара
    function updateLoading(percent, text) {
        const bar = document.getElementById('loading-bar-fill');
        const txt = document.getElementById('loading-text');
        if (bar) bar.style.width = `${percent}%`;
        if (txt) txt.textContent = text;
    }

    // === ОБНОВЛЕННАЯ ИНИЦИАЛИЗАЦИЯ ===
    async function initializeGame(settings) {
        
        try {
            updateLoading(10, "Инициализация движка...");
            await wait(50); 

            canvas = document.getElementById('game-canvas'); 
            ctx = canvas.getContext('2d'); 
            gameWorldElement = document.getElementById('game-world'); 

            updateLoading(5, "Загрузка конфигурации...");
            const configLoaded = await loadGameConfig();
            if (!configLoaded) throw new Error("Config load failed");

            updateLoading(10, "Настройка экрана...");
            await wait(50); 
            
            canvas.width = gameWorldElement.clientWidth; 
            canvas.height = gameWorldElement.clientHeight;

            updateLoading(20, "Загрузка ассетов...");
            await wait(50);
            initializeBuildingImages();
            
            updateLoading(30, "Подготовка мира...");
            await wait(50);
            
            // 1. Сбрасываем состояние (создаем пустую структуру)
            resetGameState(settings); 
            
            let isLoadedGame = false;

            // 2. Пытаемся загрузить сохранение (если это не принудительная Новая Игра через settings)
            if (!settings && window.SaveSystem && window.SaveSystem.hasSave()) {
                updateLoading(40, "Загрузка сохранения...");
                await wait(100);
                
                if (window.SaveSystem.load()) {
                    isLoadedGame = true;
                    // Сбрасываем временные переменные, которые не сохраняются
                    taskCooldowns = {}; 
                    console.log("Save loaded successfully within initializeGame");
                }
            }

            // 3. Если это НОВАЯ игра (или загрузка не удалась) — генерируем мир с нуля
            if (!isLoadedGame) {
                updateLoading(50, "Генерация ландшафта...");
                await wait(50);

                // Инициализация систем с нуля
                if (window.BankSystem) window.BankSystem.init(gameState);
                QuestSystem.initialize(gameState);
                
                // Генерация стран
                gameState.countries = Array.from({length: 10}, (_, i) => ({ 
                    name: ["США", "Китай", "Япония", "Германия", "Индия", "Франция", "Бразилия", "Канада", "Россия", "Австралия"][i], 
                    demands: Object.keys(RESOURCES).reduce((acc, rk) => ({...acc, [rk]: {multiplier: (0.5 + Math.random()) }}), {}) 
                }));
                
                // Настройка хабов (для новой игры)
                const hubs = gameState.buildings.filter(b => b.type === 'transport_hub');
                let hubNumber = 1;
                hubs.forEach(hub => {
                    if (!hub.hubNumber) hub.hubNumber = hubNumber++;
                    if (!hub.radius) hub.radius = 500;
                    if (!hub.assignedVehicles) hub.assignedVehicles = [];
                    if (hub.radiusEnabled === undefined) hub.radiusEnabled = false;
                });

                // Генерация ресурсов на карте
                updateLoading(60, "Геологическая разведка...");
                generateMapResources(); 

                // Постройка города
                updateLoading(70, "Градостроительство...");
                if (typeof CityGenerator !== 'undefined') {
                    CityGenerator.generate(gameState, GRID_WIDTH, GRID_HEIGHT);
                    gameState.buildingCache.houses = gameState.buildings.filter(b => b.type === 'residential_house');
                }
            } else {
                updateLoading(80, "Восстановление систем...");
            }
            
            // 4. Общая инициализация (выполняется и для новой, и для загруженной игры)
            
            // Цвета ресурсов для рендера
            const style = getComputedStyle(document.documentElement); 
            Object.entries(RESOURCES).forEach(([key, value]) => { 
                if (value.color) { 
                    renderCache.resourceColors[key] = style.getPropertyValue(value.color.slice(4, -1)).trim(); 
                } 
            });

            // Инициализация подсистем (DriverSystem и CityManagement)
            // Они должны проверить существующие данные в gameState
            if (window.CityManagementSystem) {
                // Если новая игра — создаем структуру, если загруженная — просто инициализируем конфиг/таймеры
                if (!isLoadedGame) window.CityManagementSystem.initialize(gameState);
                else console.log("City System restored from save");
            }
            
            if (window.DriverSystem) {
                window.DriverSystem.initialize(gameState);
            }

            // Запуск автосохранения
            if (window.SaveSystem) window.SaveSystem.init();

            updateLoading(85, "Кеширование карты...");
            await wait(100); 
            
            // Принудительная перерисовка кеша карты (обязательно после загрузки grid)
            isMapDirty = true;
            if (typeof renderMapToCache === 'function') {
                renderMapToCache();
            }

            updateLoading(95, "Настройка управления...");
            await wait(50);
            if (window.HandbookSystem) window.HandbookSystem.init();
            
            // --- Event Listeners ---
            window.addEventListener('resize', () => { canvas.width = gameWorldElement.clientWidth; canvas.height = gameWorldElement.clientHeight; isMapDirty = true; }); 
            canvas.addEventListener('mousedown', onMouseDown); 
            canvas.addEventListener('mousemove', onMouseMove); 
            canvas.addEventListener('mouseup', onMouseUp); 
            canvas.addEventListener('mouseleave', onMouseLeave); 
            canvas.addEventListener('wheel', onWheel, { passive: false }); 
            canvas.addEventListener('contextmenu', (e) => { 
                e.preventDefault(); // Блокируем стандартное меню браузера
                
                // Передаем клик в систему электросетей для удаления провода
                if (window.PowerGridSystem && window.PowerGridSystem.isOverlayActive) {
                    const rect = canvas.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;
                    // Нужно вызвать screenToWorld, но она внутри области видимости script.js
                    // Скопируем её логику сюда или вызовем, если она доступна
                    const worldPos = { 
                        x: (clickX - canvas.width / 2) / camera.zoom + camera.x, 
                        y: (clickY - canvas.height / 2) / camera.zoom + camera.y 
                    };
                    
                    if (window.PowerGridSystem.handleRightClick(worldPos, gameState)) {
                        return; // Если провод удален, больше ничего не делаем
                    }
                }
                
                // Здесь можно добавить другую логику ПКМ (например, отмена строительства)
                if (selectedBuildingType) {
                    selectedBuildingType = null; // Отмена выбора здания
                    toggleDemolishMode(false);
                    // Обновить курсор
                    gameWorldElement.style.cursor = 'grab';
                }
            });
            canvas.addEventListener('click', onCanvasClick); 
            
            // Кнопки меню
            document.getElementById('pause-button')?.addEventListener('click', togglePause); 
            document.getElementById('demolish-button')?.addEventListener('click', () => toggleDemolishMode()); 
            const oldLogBtn = document.getElementById('logistics-button');
            if (oldLogBtn) {
                // Клонируем кнопку, чтобы удалить старые слушатели событий (сброс логики)
                const newLogBtn = oldLogBtn.cloneNode(true);
                oldLogBtn.parentNode.replaceChild(newLogBtn, oldLogBtn);

                newLogBtn.addEventListener('click', () => {
                    // 1. Ищем все хабы
                    const hubs = gameState.buildings.filter(b => b.type === 'transport_hub');
                    
                    // 2. Если хабы построены, проверяем их питание
                    if (hubs.length > 0) {
                        // Ищем хотя бы один хаб БЕЗ флага 'no_power'
                        const hasActiveHub = hubs.some(hub => 
                            !hub.statusFlags || !hub.statusFlags.includes('no_power')
                        );

                        if (!hasActiveHub) {
                            showNotification("🚫 Логистика недоступна! Все хабы обесточены.", "error");
                            // Звуковой эффект ошибки (опционально)
                            return; // БЛОКИРУЕМ ОТКРЫТИЕ
                        }
                    }
                    
                    // 3. Если хабов нет (начало игры) или есть живой хаб — открываем
                    openLogisticsModal();
                });
            }

            // Инициализация системы питания
            if (window.PowerGridSystem) window.PowerGridSystem.init(gameState);

            // Кнопка
            document.getElementById('power-grid-btn')?.addEventListener('click', () => {
                if (window.PowerGridSystem) window.PowerGridSystem.toggleOverlay();
            });

            // === НОВЫЕ КНОПКИ СОХРАНЕНИЯ ===
            document.getElementById('save-button')?.addEventListener('click', () => {
                if (window.SaveSystem) window.SaveSystem.save();
            });
            document.getElementById('reset-button')?.addEventListener('click', () => {
                if (window.SaveSystem) window.SaveSystem.deleteSave();
            });
            // ================================

            // Кнопки скорости
            document.getElementById('show-speed-controls')?.addEventListener('click', (e) => {
                document.querySelector('.speed-controls').classList.toggle('visible');
                e.currentTarget.classList.toggle('active');
            });
            document.querySelectorAll('.speed-btn').forEach(btn => {
                btn.addEventListener('click', (e) => setGameSpeed(parseInt(e.target.dataset.speed)));
            });

            // Кнопка банка
            document.getElementById('bank-button')?.addEventListener('click', () => {
                const modal = document.getElementById('bank-modal');
                modal.style.display = 'flex';
                if (window.BankSystem) window.BankSystem.renderUI(gameState);
            });

            // Диспетчерская
            const dispatchModal = document.getElementById('dispatch-modal');
            if (dispatchModal) {
                dispatchModal.querySelectorAll('.dispatch-tab-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const tab = btn.dataset.tab;
                        dispatchModal.querySelectorAll('.dispatch-tab-btn').forEach(b => {
                            b.classList.remove('active');
                            b.style.borderBottomColor = 'transparent';
                        });
                        dispatchModal.querySelectorAll('.dispatch-tab-content').forEach(c => {
                            c.classList.remove('active');
                            c.style.display = 'none';
                        });
                        btn.classList.add('active');
                        btn.style.borderBottomColor = '#ffd700';
                        const content = document.getElementById(`dispatch-${tab}-tab`);
                        if (content) {
                            content.classList.add('active');
                            content.style.display = 'block';
                        }
                        if (tab === 'hubs') updateHubsList();
                        else if (tab === 'reports') ReportsSystem.render('dispatch-reports-tab');
                        else if (tab === 'workers') renderWorkersManagement();
                    });
                });
            }

            // Модальные окна (общие)
            document.querySelectorAll('.modal .close-button').forEach(btn => { 
                btn.addEventListener('click', () => {
                    btn.closest('.modal').style.display = 'none';
                    clearInterval(logisticsUpdateInterval);
                    activeLogisticsPopupId = null;
                }); 
            });
            window.addEventListener('click', (e) => { 
                if (e.target.classList.contains('modal')) {
                    e.target.style.display = 'none';
                    clearInterval(logisticsUpdateInterval);
                    activeLogisticsPopupId = null;
                }
            });

            resourceSelect.addEventListener('change', updateExportPreview); 
            countrySelect.addEventListener('change', updateExportPreview); 
            amountInput.addEventListener('input', updateExportPreview);
            
            document.addEventListener('keydown', (e) => { 
               if (e.code === 'Space' && !e.target.matches('input,select')) { 
        e.preventDefault(); 
        togglePause(); 
    } 
    
    // Обработка ESCAPE
    if (e.key === 'Escape') { 
        // 1. Сброс выбора здания для строительства
        if (selectedBuildingType) {
            selectedBuildingType = null;
            // Возвращаем курсор в норму
            gameWorldElement.style.cursor = 'grab';
        }

        // 2. Выход из режима сноса
        toggleDemolishMode(false); 
        
        // 3. Закрытие меню строительства
        const buildMenu = document.getElementById("floating-build-menu");
        if (buildMenu) buildMenu.classList.add('hidden');
        
        // 4. Закрытие модальных окон
        logisticsModal.style.display = 'none'; 
        exportModal.style.display = 'none';
        const bankModal = document.getElementById('bank-modal');
        if (bankModal) bankModal.style.display = 'none';
        const dispatchModal = document.getElementById('dispatch-modal');
        if (dispatchModal) dispatchModal.style.display = 'none';

        // === ВАЖНОЕ ИСПРАВЛЕНИЕ: Выход из режима электросетей ===
        if (window.PowerGridSystem && window.PowerGridSystem.isOverlayActive) {
            window.PowerGridSystem.toggleOverlay();
        }

        // 6. Отмена рисования границы хаба (если активно)
        if (typeof isDrawingBorderMode !== 'undefined' && isDrawingBorderMode) {
            isDrawingBorderMode = false;
            editingHubId = null;
            const stopBtn = document.getElementById('stop-draw-btn');
            if(stopBtn) stopBtn.remove();
            showNotification("Рисование границы отменено", "info");
        }
    } 
});
            
            
            updateUI(); 

            setGameSpeed(1);
            requestAnimationFrame(renderLoop);
            gameInterval = setInterval(gameTick, TICK_INTERVAL);
            
            // Туториал запускаем только если это новая игра
            // (или если игрок явно нажмет кнопку справки позже)
            if (window.TutorialSystem) {
                window.TutorialSystem.setupTutorialControls();
                if (!isLoadedGame) {
                    window.TutorialSystem.startOnFirstLaunch();
                }
            }

            updateLoading(100, "Готово!");
            await wait(500);
            
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                setTimeout(() => loadingScreen.remove(), 500);
            }
            
            if (isLoadedGame) {
                showNotification('Прогресс успешно загружен!', 'success');
            } else {
                showNotification('Добро пожаловать в Resource Exporter Tycoon!', 'info'); 
            }

        } catch (error) {
            console.error("Ошибка при инициализации игры:", error);
            updateLoading(100, "Ошибка запуска! Проверьте консоль.");
            if(document.getElementById('loading-text')) document.getElementById('loading-text').style.color = '#fc8181';
        }

        // Обработчики глобальных клавиш
        document.getElementById('restart-game-btn')?.addEventListener('click', () => location.reload());
        document.addEventListener('keydown', (e) => { 
            if (e.code === 'Space' && !e.target.matches('input,select')) { e.preventDefault(); togglePause(); } 
            if (e.key === 'Alt') { e.preventDefault(); isAltPressed = true; }
        }); 
        document.addEventListener('keyup', (e) => { if (e.key === 'Alt') isAltPressed = false; });
    }

    function generateMapResources() {
        const baseMapArea = 50 * 50;
        const currentMapArea = GRID_WIDTH * GRID_HEIGHT;
        const scaleFactor = Math.max(1, currentMapArea / baseMapArea);
    
        const resourceKeys = Object.keys(RESOURCE_NODE_CONFIG);
        const orderedKeys = ['grass', ...resourceKeys.filter(key => key !== 'grass')];
    
        for (const resource of orderedKeys) {
            const config = RESOURCE_NODE_CONFIG[resource];
            if (!config) continue; 
    
            const veinsToGenerate = Math.round(config.veins * scaleFactor);
            for (let v = 0; v < veinsToGenerate; v++) {
                let startX, startY;
                let attempts = 0;
    
                do {
                    startX = Math.floor(Math.random() * GRID_WIDTH);
                    startY = Math.floor(Math.random() * GRID_HEIGHT);
                    attempts++;
                } while (
                    (gameState.grid[startY * GRID_WIDTH + startX].resource && gameState.grid[startY * GRID_WIDTH + startX].resource !== 'grass') &&
                    attempts < 100
                );
    
                if (gameState.grid[startY * GRID_WIDTH + startX].resource && gameState.grid[startY * GRID_WIDTH + startX].resource !== 'grass') {
                    continue;
                }
    
                let veinSize = Math.floor(Math.random() * (config.veinSize[1] - config.veinSize[0] + 1)) + config.veinSize[0];
                let currentX = startX, currentY = startY;
    
                for (let i = 0; i < veinSize; i++) {
                    const index = currentY * GRID_WIDTH + currentX;
                    if (index >= 0 && index < gameState.grid.length) {
                        const cell = gameState.grid[index];
    
                        if (!cell.resource || cell.resource === 'grass') {
                            cell.resource = resource;
                            cell.resourceAmount = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;
                        }
                    }
    
                    const [dx, dy] = [[0,1],[0,-1],[1,0],[-1,0]][Math.floor(Math.random()*4)];
                    currentX = Math.max(0, Math.min(GRID_WIDTH-1, currentX + dx));
                    currentY = Math.max(0, Math.min(GRID_HEIGHT-1, currentY + dy));
                }
            }
        }
    }
            
    
    // === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ТОЧКА В МНОГОУГОЛЬНИКЕ ===
function isPointInPolygon(point, vs) {
    // point = {x, y}, vs = массив точек [{x, y}, {x, y}, ...]
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        
        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}  
    
    const buildButton = document.getElementById("open-build-menu");
    const buildMenu = document.getElementById("floating-build-menu");
    const closeBuildMenu = document.getElementById("close-build-menu");
    //const categoryTabs = document.getElementById("category-tabs");
    //const categoryContent = document.getElementById("category-content");

    buildButton.addEventListener("click", () => {
        buildMenu.classList.toggle("hidden");

        if (!buildMenu.classList.contains("hidden")) {
            populateBuildMenu();
        }
    });

    closeBuildMenu.addEventListener("click", () => buildMenu.classList.add("hidden"));

    // === ЛОГИКА НАСТРОЙКИ СКЛАДА ===
    let currentConfiguringWarehouseId = null;

    function openWarehouseSettings(warehouse) {
        currentConfiguringWarehouseId = warehouse.id;
        const modal = document.getElementById('warehouse-modal');
        const titleId = document.getElementById('wh-modal-id');
        const grid = document.getElementById('warehouse-filter-grid');
        
        // Если у старых складов нет этого поля, инициализируем его
        if (!warehouse.allowedResources) {
            warehouse.allowedResources = new Set(Object.keys(RESOURCES));
        }

        titleId.textContent = `#${warehouse.id.toString().slice(-4)}`;
        grid.innerHTML = '';

        // Генерируем чекбоксы
        Object.keys(RESOURCES).forEach(resKey => {
            // Пропускаем "служебные" ресурсы, если есть (например, энергию, если она вдруг там)
            if (RESOURCES[resKey].category === 'background') return;

            const isAllowed = warehouse.allowedResources.has(resKey);
            
            const div = document.createElement('div');
            div.className = 'wh-filter-item';
            div.innerHTML = `
                <input type="checkbox" id="wh-check-${resKey}" ${isAllowed ? 'checked' : ''}>
                <span>${getIconHTML(RESOURCES[resKey].emoji, resKey)} ${RESOURCES[resKey].name}</span>
            `;
            
            // Обработчик клика
            div.addEventListener('click', (e) => {
                // Если клик не по самому чекбоксу, переключаем его
                const checkbox = div.querySelector('input');
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                }
                
                if (checkbox.checked) {
                    warehouse.allowedResources.add(resKey);
                } else {
                    warehouse.allowedResources.delete(resKey);
                }
            });

            grid.appendChild(div);
        });

        modal.style.display = 'flex';
    }

    // Слушатели кнопок модального окна склада
    document.getElementById('close-wh-modal')?.addEventListener('click', () => {
        document.getElementById('warehouse-modal').style.display = 'none';
        currentConfiguringWarehouseId = null;
    });

    document.getElementById('wh-allow-all')?.addEventListener('click', () => {
        if (!currentConfiguringWarehouseId) return;
        const wh = gameState.buildings.find(b => b.id === currentConfiguringWarehouseId);
        if (wh) {
            wh.allowedResources = new Set(Object.keys(RESOURCES));
            openWarehouseSettings(wh); // Перерисовать
        }
    });

    document.getElementById('wh-deny-all')?.addEventListener('click', () => {
        if (!currentConfiguringWarehouseId) return;
        const wh = gameState.buildings.find(b => b.id === currentConfiguringWarehouseId);
        if (wh) {
            wh.allowedResources = new Set();
            openWarehouseSettings(wh); // Перерисовать
        }
    });
    // Запускаем экран настроек. Он сам вызовет initializeGame, когда игрок нажмет "Старт"
     window.initializeGame = initializeGame;

    // Запускаем экран настроек.
    if (window.GameSettings) {
        window.GameSettings.init();
    } else {
        // Fallback, если файл настроек не подключен
        initializeGame(); 
    }

});