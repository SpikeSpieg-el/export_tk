/**
 * @file save_system.js
 * @description Система сохранения и загрузки прогресса (Исправленная версия).
 */

const SaveSystem = {
    STORAGE_KEY: 'ret_save_data_v1',
    AUTOSAVE_INTERVAL: 60000, // 1 минута

    init() {
        // Запускаем автосохранение
        setInterval(() => {
            // Проверяем существование gameState перед сохранением
            if (typeof gameState !== 'undefined' && !gameState.isGameOver && !gameState.isPaused) {
                this.save(true);
            }
        }, this.AUTOSAVE_INTERVAL);
        console.log("Save System initialized.");
    },

    save(isAuto = false) {
        if (typeof gameState === 'undefined') return;

        try {
            // Безопасное получение позиции камеры
            const camData = (window.camera) 
                ? { x: window.camera.x, y: window.camera.y, zoom: window.camera.zoom } 
                : { x: 0, y: 0, zoom: 1 };

            // === ПОДГОТОВКА ЗДАНИЙ ===
            // JSON.stringify не умеет сохранять Set (превращает в {}), поэтому конвертируем в Array
            const buildingsToSave = gameState.buildings.map(b => {
                const copy = { ...b };
                if (copy.allowedResources instanceof Set) {
                    copy.allowedResources = Array.from(copy.allowedResources);
                }
                return copy;
            });
            
            // === ПОДГОТОВКА ГРУЗОВИКОВ ===
            // То же самое для allowedCargo
            const vehiclesToSave = gameState.vehicles.map(v => {
                const copy = { ...v };
                if (copy.allowedCargo instanceof Set) {
                    copy.allowedCargo = Array.from(copy.allowedCargo);
                }
                return copy;
            });

            const dataToSave = {
                money: gameState.money,
                resources: gameState.resources,
                grid: gameState.grid, // Сетка ресурсов и ссылок
                buildings: buildingsToSave, // Используем подготовленный массив
                vehicles: vehiclesToSave,   // Используем подготовленный массив
                
                // === НОВОЕ: СОХРАНЯЕМ ПРОВОДА ===
                cables: gameState.cables || [],
                
                // Системы
                cityStatus: gameState.cityStatus,
                marketConditions: gameState.marketConditions,
                countries: gameState.countries,
                customRoutes: gameState.customRoutes,
                hiredDrivers: gameState.hiredDrivers,
                
                // Прогресс
                unlockedBuildings: Array.from(gameState.unlockedBuildings || []),
                buildingCounts: gameState.buildingCounts,
                statsHistory: gameState.statsHistory,
                exportStorage: gameState.exportStorage,
                
                // Разное
                startTime: gameState.startTime,
                config: gameState.config,
                camera: camData, 
                
                // Квесты и Банк
                internalMarkets: gameState.internalMarkets,
                completedQuests: Array.from(gameState.completedQuests || new Set()),
                isFirstDeliveryDone: gameState.isFirstDeliveryDone,
                loans: gameState.loans || [],
                
                timestamp: Date.now()
            };

            const json = JSON.stringify(dataToSave);
            localStorage.setItem(this.STORAGE_KEY, json);

            if (!isAuto) {
                const event = new CustomEvent('show-notification', { 
                    detail: { message: "Игра успешно сохранена!", type: "success" } 
                });
                document.dispatchEvent(event);
            } else {
                console.log("Autosave complete.");
            }

        } catch (e) {
            console.error("Save failed:", e);
            const event = new CustomEvent('show-notification', { 
                detail: { message: "Ошибка сохранения! (См. консоль)", type: "error" } 
            });
            document.dispatchEvent(event);
        }
    },

    load() {
        const json = localStorage.getItem(this.STORAGE_KEY);
        if (!json) return false;

        try {
            const data = JSON.parse(json);

            // 1. Восстановление базовых полей
            gameState.money = data.money;
            gameState.resources = data.resources;
            gameState.buildings = data.buildings || [];
            gameState.vehicles = data.vehicles || [];
            gameState.grid = data.grid || [];
            
            // === НОВОЕ: ВОССТАНОВЛЕНИЕ ПРОВОДОВ ===
            gameState.cables = data.cables || [];
            
            // 2. Восстановление объектов и Sets
            gameState.unlockedBuildings = new Set(data.unlockedBuildings || ['sawmill', 'coal_mine', 'coal_power_plant', 'transport_hub']);
            gameState.completedQuests = new Set(data.completedQuests || []);
            
            gameState.cityStatus = data.cityStatus || {};
            gameState.marketConditions = data.marketConditions || {};
            gameState.countries = data.countries || [];
            gameState.customRoutes = data.customRoutes || [];
            gameState.hiredDrivers = data.hiredDrivers || [];
            gameState.buildingCounts = data.buildingCounts || {};
            gameState.statsHistory = data.statsHistory || [];
            gameState.exportStorage = data.exportStorage || {};
            gameState.config = data.config || {};
            gameState.internalMarkets = data.internalMarkets || [];
            gameState.isFirstDeliveryDone = data.isFirstDeliveryDone || false;
            gameState.loans = data.loans || [];
            
            // Восстановление камеры
            if (data.camera && window.camera) {
                window.camera.x = data.camera.x;
                window.camera.y = data.camera.y;
                window.camera.zoom = data.camera.zoom;
            }

            // 3. РЕКОНСТРУКЦИЯ ССЫЛОК И ТИПОВ ДАННЫХ
            this.rebuildGridLinks();
            this.rebuildCaches();
            this.restoreSets(); // Восстановление allowedCargo у грузовиков

            console.log("Save loaded successfully.");
            return true;

        } catch (e) {
            console.error("Load failed:", e);
            alert("Ошибка загрузки сохранения. Файл поврежден или устарел.");
            // Очистка localStorage может помочь, если сохранение безнадежно сломано,
            // но лучше дать игроку выбор.
            return false;
        }
    },

    deleteSave() {
        if (confirm("Вы уверены, что хотите удалить весь прогресс? Это действие нельзя отменить.")) {
            localStorage.removeItem(this.STORAGE_KEY);
            location.reload();
        }
    },

    rebuildGridLinks() {
        // Очищаем старые ссылки
        for (let i = 0; i < gameState.grid.length; i++) {
            if (gameState.grid[i]) gameState.grid[i].building = null;
        }

        // Проставляем ссылки на существующие здания
        gameState.buildings.forEach(building => {
            const blueprint = window.BUILDING_BLUEPRINTS[building.type];
            if (!blueprint) return;

            const w = blueprint.tileWidth || 1;
            const h = blueprint.tileHeight || 1;
            const baseRow = Math.floor(building.gridIndex / 100); 
            const baseCol = building.gridIndex % 100;

            for (let r = 0; r < h; r++) {
                for (let c = 0; c < w; c++) {
                    const index = (baseRow + r) * 100 + (baseCol + c);
                    if (gameState.grid[index]) {
                        gameState.grid[index].building = building;
                    }
                }
            }
        });
    },

    restoreSets() {
        // Восстанавливаем Set allowedCargo для грузовиков
        gameState.vehicles.forEach(v => {
            if (Array.isArray(v.allowedCargo)) {
                v.allowedCargo = new Set(v.allowedCargo);
            } else if (!v.allowedCargo || typeof v.allowedCargo === 'object') { 
                // Если пусто или {} (старый сейв) - разрешаем всё
                v.allowedCargo = new Set(Object.keys(window.RESOURCES));
            }
        });
    },

    rebuildCaches() {
        // Пересоздаем кеши для оптимизации
        gameState.buildingCache = {
            warehouses: [],
            producers: [],
            export_depots: [],
            houses: []
        };

        gameState.buildings.forEach(b => {
            const blueprint = window.BUILDING_BLUEPRINTS[b.type];
            if (!blueprint) return;

            if (b.type === 'warehouse') {
                gameState.buildingCache.warehouses.push(b);
                
                // === ИСПРАВЛЕНИЕ ОШИБКИ allowedResources.has ===
                // JSON возвращает Array, нам нужен Set
                if (Array.isArray(b.allowedResources)) {
                    b.allowedResources = new Set(b.allowedResources);
                } else {
                    // Если это старое сохранение или кривой объект - сбрасываем на "Разрешить всё"
                    b.allowedResources = new Set(Object.keys(window.RESOURCES));
                }
            }
            else if (b.type === 'export_depot') gameState.buildingCache.export_depots.push(b);
            else if (b.type === 'residential_house') gameState.buildingCache.houses.push(b);
            else if (blueprint.outputCapacity || blueprint.bufferCapacity) {
                gameState.buildingCache.producers.push(b);
            }
        });
    },
    
    hasSave() {
        return !!localStorage.getItem(this.STORAGE_KEY);
    }
};

window.SaveSystem = SaveSystem;