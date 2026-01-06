/**
 * @file custom_routes.js
 * @description Система пользовательских маршрутов для Resource Exporter Tycoon
 */

const CustomRouteSystem = {
    /**
     * Типы действий в шаге маршрута
     */
    ACTIONS: {
        LOAD: { id: 'load', name: '📥 Загрузить', icon: 'arrow-down' },
        UNLOAD: { id: 'unload', name: '📤 Выгрузить', icon: 'arrow-up' },
        VISIT: { id: 'visit', name: '🚩 Проехать через', icon: 'flag' }
    },

    /**
     * Инициализация (вызывается при старте игры)
     */
    initialize(gameState) {
        if (!gameState.customRoutes) {
            gameState.customRoutes = [];
        }
    },

    /**
     * Создать новый пустой маршрут
     */
    createRoute(gameState, name) { // <--- Добавлен gameState
        const newRoute = {
            id: Date.now(),
            name: name || `Маршрут #${gameState.customRoutes.length + 1}`,
            steps: [],
            hubLimitEnabled: false,
            assignedHubId: null
        };
        gameState.customRoutes.push(newRoute);
        return newRoute;
    },

    /**
     * Добавить шаг в маршрут
     */
    addStep(gameState, routeId, action, targetId, resource = null) { // <--- Добавлен gameState
        const route = gameState.customRoutes.find(r => r.id === routeId);
        if (route) {
            route.steps.push({
                id: Date.now() + Math.random(),
                action: action,
                targetId: parseInt(targetId),
                resource: resource,
                amount: 'all'
            });
        }
    },

    /**
     * Вспомогательная функция для получения позиции здания в мире
     * Дублирует логику из script.js для независимости
     */
    getBuildingWorldPos(building, GRID_WIDTH = 100, CELL_SIZE = 64) {
        if (!building || typeof building.gridIndex !== 'number') {
            return null;
        }
        
        // Если есть глобальная функция getBuildingAnchorWorldPos, используем её
        if (typeof window.getBuildingAnchorWorldPos === 'function') {
            return window.getBuildingAnchorWorldPos(building);
        }
        
        // Иначе вычисляем вручную
        const BUILDING_BLUEPRINTS = window.BUILDING_BLUEPRINTS || {};
        const blueprint = BUILDING_BLUEPRINTS[building.type];
        let anchorIndex = building.gridIndex;
        
        if (blueprint) {
            // Вычисляем якорь здания
            const size = { 
                w: blueprint.tileWidth || 1, 
                h: blueprint.tileHeight || 1 
            };
            const anchor = blueprint.anchor || { x: 0, y: 0 };
            const ax = Math.min(Math.max(0, anchor.x), size.w - 1);
            const ay = Math.min(Math.max(0, anchor.y), size.h - 1);
            
            const baseRow = Math.floor(building.gridIndex / GRID_WIDTH);
            const baseCol = building.gridIndex % GRID_WIDTH;
            const GRID_HEIGHT = 100; // По умолчанию
            const anchorRow = Math.min(baseRow + ay, GRID_HEIGHT - 1);
            const anchorCol = Math.min(baseCol + ax, GRID_WIDTH - 1);
            anchorIndex = anchorRow * GRID_WIDTH + anchorCol;
        }
        
        return {
            x: (anchorIndex % GRID_WIDTH) * CELL_SIZE + CELL_SIZE / 2,
            y: Math.floor(anchorIndex / GRID_WIDTH) * CELL_SIZE + CELL_SIZE / 2
        };
    },

    /**
     * Основная логика обновления грузовика, следующего по маршруту
     * Вызывается из updateLogistics вместо стандартной логики
     */
    updateVehicle(vehicle, gameState, deltaTime) {
        // 1. Проверка наличия маршрута
        if (!vehicle.assignedRouteId) {
            vehicle.mode = 'auto'; // Возвращаем в автоматический режим
            vehicle.state = 'IDLE';
            return;
        }

        const route = gameState.customRoutes.find(r => r.id === vehicle.assignedRouteId);
        if (!route || route.steps.length === 0) {
            vehicle.mode = 'auto';
            vehicle.state = 'IDLE';
            return; // Маршрут пуст или не существует
        }

        // Инициализация индекса шага
        if (typeof vehicle.currentStepIndex === 'undefined' || vehicle.currentStepIndex < 0) {
            vehicle.currentStepIndex = 0;
        }
        
        // Инициализация cargo, если его нет
        if (!vehicle.cargo) {
            vehicle.cargo = { type: null, amount: 0 };
        }

        // Инициализация позиции грузовика, если её нет
        if (typeof vehicle.x !== 'number' || typeof vehicle.y !== 'number' || isNaN(vehicle.x) || isNaN(vehicle.y)) {
            // Сначала пробуем использовать ownerGaragePos
            if (vehicle.ownerGaragePos && typeof vehicle.ownerGaragePos.x === 'number' && typeof vehicle.ownerGaragePos.y === 'number') {
                vehicle.x = vehicle.ownerGaragePos.x;
                vehicle.y = vehicle.ownerGaragePos.y;
            } else {
                // Иначе ищем здание-владельца
                const ownerBuilding = gameState.buildings.find(b => b.id === vehicle.ownerBuildingId);
                if (ownerBuilding) {
                    const pos = this.getBuildingWorldPos(ownerBuilding);
                    if (pos) {
                        vehicle.x = pos.x;
                        vehicle.y = pos.y;
                        // Сохраняем позицию гаража для будущего использования
                        if (!vehicle.ownerGaragePos) {
                            vehicle.ownerGaragePos = { x: pos.x, y: pos.y };
                        }
                    }
                }
            }
        }

        // Обработка таймера для действия 'visit'
        if (vehicle.customRouteTimer !== undefined && vehicle.customRouteTimer > 0) {
            vehicle.customRouteTimer -= deltaTime;
            if (vehicle.customRouteTimer > 0) {
                return; // Ждём окончания таймера
            }
            // Таймер закончился, продолжаем
            vehicle.customRouteTimer = undefined;
        }

        // Если мы только закончили действие и стоим IDLE, переходим к следующему шагу
        if (vehicle.state === 'IDLE' || vehicle.state === 'MOVING_CUSTOM') {
            // Если уже в движении, проверяем прибытие
            if (vehicle.state === 'MOVING_CUSTOM' && vehicle.customTargetPos) {
                const dx = vehicle.customTargetPos.x - vehicle.x;
                const dy = vehicle.customTargetPos.y - vehicle.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 5) {
                    // ПРИБЫЛИ - выполняем действие
                    const currentStep = route.steps[vehicle.currentStepIndex];
                    this.executeStepAction(vehicle, currentStep, gameState);
                    
                    // Переход к следующему шагу
                    vehicle.currentStepIndex = (vehicle.currentStepIndex + 1) % route.steps.length;
                    vehicle.state = 'IDLE'; // Сбрасываем состояние для следующего шага
                    return;
                } else {
                    // Двигаемся к цели
                    const speed = vehicle.speed || 100; // Скорость по умолчанию
                    if (speed > 0 && dist > 0) {
                        vehicle.x += (dx / dist) * speed * deltaTime;
                        vehicle.y += (dy / dist) * speed * deltaTime;
                    }
                    return;
                }
            }

            // Начинаем движение к следующей цели
            const step = route.steps[vehicle.currentStepIndex];
            const target = gameState.buildings.find(b => b.id === step.targetId) || 
                           (gameState.internalMarkets?.find(m => m.id === step.targetId));

            if (!target) {
                // Цель уничтожена, пропускаем шаг
                vehicle.currentStepIndex = (vehicle.currentStepIndex + 1) % route.steps.length;
                return;
            }

            // Получаем позицию цели
            const worldPos = this.getBuildingWorldPos(target);
            if (!worldPos) {
                // Не удалось получить позицию, пропускаем шаг
                vehicle.currentStepIndex = (vehicle.currentStepIndex + 1) % route.steps.length;
                return;
            }

            // Проверка ограничения радиуса, если включено
            if (route.hubLimitEnabled && route.assignedHubId) {
                const hub = gameState.buildings.find(b => b.id === route.assignedHubId && b.type === 'transport_hub');
                if (hub && hub.radiusEnabled) {
                    const hubPos = this.getBuildingWorldPos(hub);
                    if (hubPos) {
                        const distanceToTarget = Math.hypot(worldPos.x - hubPos.x, worldPos.y - hubPos.y);
                        const limitRadius = getEffectiveHubRadius(hub);
                        if (distanceToTarget > radius) {
                            // Цель вне радиуса, пропускаем шаг
                            vehicle.currentStepIndex = (vehicle.currentStepIndex + 1) % route.steps.length;
                            return;
                        }
                    }
                }
            }

            // Начинаем движение к цели
            vehicle.pickupTargetId = target.id;
            vehicle.dropoffTargetId = target.id; 
            vehicle.state = 'MOVING_CUSTOM'; 
            vehicle.customTargetPos = worldPos;
            vehicle.pickupTargetPos = worldPos; 
            vehicle.dropoffTargetPos = worldPos;
        }
    },

    /**
     * Выполнение действия на точке
     */
    executeStepAction(vehicle, step, gameState) {
        const building = gameState.buildings.find(b => b.id === step.targetId);
        // Также поддерживаем рынки/экспорт
        const market = gameState.internalMarkets?.find(m => m.id === step.targetId); 
        // Экспортный депо тоже здание

        if (step.action === 'load') {
            if (!building) return;
            // Логика загрузки
            let resourceToLoad = step.resource;
            
            // Если это склад
            if (building.type === 'warehouse') {
                if (resourceToLoad && building.storage && building.storage[resourceToLoad] > 0) {
                    const space = vehicle.capacity - (vehicle.cargo.amount || 0);
                    // Если в грузовике уже другой ресурс - не грузим
                    if (vehicle.cargo.type && vehicle.cargo.type !== resourceToLoad) return;

                    const amount = Math.min(space, building.storage[resourceToLoad]);
                    if (amount > 0) {
                        vehicle.cargo.type = resourceToLoad;
                        vehicle.cargo.amount = (vehicle.cargo.amount || 0) + amount;
                        building.storage[resourceToLoad] -= amount;
                    }
                }
            } 
            // Если это завод/шахта
            else if (building.outputBuffer && building.outputBuffer.amount > 0) {
                resourceToLoad = building.outputBuffer.resource;
                // Проверяем совпадение ресурса, если в шаге указан конкретный
                if (step.resource && step.resource !== resourceToLoad) return;

                const space = vehicle.capacity - (vehicle.cargo.amount || 0);
                if (vehicle.cargo.type && vehicle.cargo.type !== resourceToLoad) return;

                const amount = Math.min(space, building.outputBuffer.amount);
                if (amount > 0) {
                    vehicle.cargo.type = resourceToLoad;
                    vehicle.cargo.amount = (vehicle.cargo.amount || 0) + amount;
                    building.outputBuffer.amount -= amount;
                }
            }

        } else if (step.action === 'unload') {
            if (!vehicle.cargo || !vehicle.cargo.type || vehicle.cargo.amount <= 0) return;
            // Если указан конкретный ресурс для выгрузки, а везем другой - пропускаем
            if (step.resource && step.resource !== vehicle.cargo.type) return;

            if (building) {
                // Выгрузка на склад
                if (building.type === 'warehouse' && building.storage) {
                    const currentStorage = Object.values(building.storage).reduce((a,b)=>a+b,0);
                    const space = (building.capacity || Infinity) - currentStorage;
                    const amount = Math.min(vehicle.cargo.amount, space);
                    if (amount > 0) {
                        building.storage[vehicle.cargo.type] = (building.storage[vehicle.cargo.type] || 0) + amount;
                        vehicle.cargo.amount -= amount;
                        if (vehicle.cargo.amount <= 0.01) {
                            vehicle.cargo.type = null;
                            vehicle.cargo.amount = 0;
                        }
                    }
                }
                // Выгрузка в завод (inputBuffer) - если поддерживается игрой
                else if (building.inputBuffer && typeof building.inputBuffer[vehicle.cargo.type] !== 'undefined') {
                    // Проверяем лимиты инпута, если они есть
                    const maxInput = building.inputBuffer[`${vehicle.cargo.type}_max`] || Infinity;
                    const currentInput = building.inputBuffer[vehicle.cargo.type] || 0;
                    const space = maxInput - currentInput;
                    const amount = Math.min(vehicle.cargo.amount, space);
                    if (amount > 0) {
                        building.inputBuffer[vehicle.cargo.type] = currentInput + amount;
                        vehicle.cargo.amount -= amount;
                        if (vehicle.cargo.amount <= 0.01) {
                            vehicle.cargo.type = null;
                            vehicle.cargo.amount = 0;
                        }
                    }
                }
                // Выгрузка в экспорт
                else if (building.type === 'export_depot') {
                    if (!gameState.exportStorage) gameState.exportStorage = {};
                    gameState.exportStorage[vehicle.cargo.type] = (gameState.exportStorage[vehicle.cargo.type] || 0) + vehicle.cargo.amount;
                    vehicle.cargo = { type: null, amount: 0 };
                }
                // Выгрузка в город (жилой дом)
                else if (building.type === 'residential_house') {
                    const RESOURCES = window.RESOURCES || {};
                    if (RESOURCES[vehicle.cargo.type]) {
                        const profit = vehicle.cargo.amount * (RESOURCES[vehicle.cargo.type].baseExportPrice / 2.6);
                        gameState.money = (gameState.money || 0) + profit;
                        if(window.recordMoneyTransaction) window.recordMoneyTransaction(profit, `Продажа (Маршрут) ${vehicle.cargo.type}`);
                    }
                    vehicle.cargo = { type: null, amount: 0 };
                }
            }
        } else if (step.action === 'visit') {
            // Просто проезжаем с небольшой задержкой
            vehicle.customRouteTimer = 0.5; // Пауза полсекунды
        }

        // Состояние будет установлено в updateVehicle после обработки таймера
    },

    // --- UI GENERATION ---

    /**
     * Рисует вкладку маршрутов в модальном окне логистики
     */
    renderUI(container, gameState) {
        container.innerHTML = `
            <div class="custom-routes-panel" style="display: flex; height: 100%; gap: 1rem;">
                <div class="routes-list" style="width: 30%; border-right: 1px solid #444; padding-right: 10px; overflow-y: auto;">
                    <h4>Маршруты</h4>
                    <button id="btn-create-route" class="action-button" style="width: 100%; margin-bottom: 10px;">+ Новый маршрут</button>
                    <div id="routes-list-items"></div>
                </div>
                <div class="route-editor" style="flex: 1; display: flex; flex-direction: column;">
                    <div id="editor-header" style="display: none; border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 10px;">
                        <input type="text" id="route-name-input" style="font-size: 1.2em; background: rgba(0,0,0,0.2); border: 1px solid #555; color: white; padding: 5px; width: 60%;">
                        <button id="btn-delete-route" style="float: right; background: #e53e3e; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Удалить</button>
                    </div>
                    <div id="route-hub-settings" style="display: none; border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                        <h5 style="margin: 0 0 10px 0; color: #ffd700;">🚚 Привязка к транспортному хабу</h5>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="display: flex; align-items: center; gap: 8px; color: #cbd5e0; cursor: pointer;">
                                <input type="checkbox" id="route-hub-limit-enabled" style="cursor: pointer;">
                                <span>Ограничить радиус действия</span>
                            </label>
                            <div id="route-hub-select-container" style="display: none;">
                                <label style="color: #94a3b8; font-size: 0.9em; display: block; margin-bottom: 5px;">Выберите хаб:</label>
                                <select id="route-hub-select" style="background: #333; color: white; border: 1px solid #555; padding: 5px; width: 100%;">
                                    <option value="">-- Выберите хаб --</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div id="steps-container" style="flex: 1; overflow-y: auto; padding-right: 5px;">
                        <div style="color: #888; text-align: center; margin-top: 50px;">Выберите маршрут для редактирования</div>
                    </div>
                    <div id="step-creator" style="display: none; border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                        <h5>Добавить шаг</h5>
                        <div style="display: flex; gap: 5px;">
                            <select id="new-step-action" style="background: #333; color: white; border: 1px solid #555; padding: 5px;">
                                <option value="load">📥 Загрузить</option>
                                <option value="unload">📤 Выгрузить</option>
                                <option value="visit">🚩 Проехать</option>
                            </select>
                            <select id="new-step-target" style="background: #333; color: white; border: 1px solid #555; padding: 5px; max-width: 200px;">
                                <!-- Заполняется JS -->
                            </select>
                            <select id="new-step-resource" style="background: #333; color: white; border: 1px solid #555; padding: 5px;">
                                <option value="">(Любой ресурс)</option>
                                <!-- Заполняется JS -->
                            </select>
                            <button id="btn-add-step" class="action-button" style="margin-top:0; padding: 5px 10px;">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.updateRoutesList(gameState);
        this.attachEventListeners(gameState);
    },

    updateRoutesList(gameState) {
        const list = document.getElementById('routes-list-items');
        if (!list) return;
        list.innerHTML = gameState.customRoutes.map(r => `
            <div class="route-item" data-id="${r.id}" style="padding: 10px; background: rgba(255,255,255,0.05); margin-bottom: 5px; cursor: pointer; border-radius: 4px;">
                <div style="font-weight: bold;">${r.name}</div>
                <div style="font-size: 0.8em; color: #aaa;">Шагов: ${r.steps.length}</div>
            </div>
        `).join('');

        // Подсветка активного
        if (this.activeRouteId) {
            const el = list.querySelector(`.route-item[data-id="${this.activeRouteId}"]`);
            if (el) el.style.background = 'rgba(59, 130, 246, 0.3)';
        }
    },

    openRouteEditor(routeId, gameState) {
        this.activeRouteId = routeId;
        const route = gameState.customRoutes.find(r => r.id === routeId);
        if (!route) return;

        document.getElementById('editor-header').style.display = 'block';
        document.getElementById('step-creator').style.display = 'block';
        document.getElementById('route-name-input').value = route.name;
        
        // Настройки хаба
        const hubSettings = document.getElementById('route-hub-settings');
        hubSettings.style.display = 'block';
        
        const hubLimitEnabled = document.getElementById('route-hub-limit-enabled');
        const hubSelectContainer = document.getElementById('route-hub-select-container');
        const hubSelect = document.getElementById('route-hub-select');
        
        // Инициализируем значения из маршрута
        route.hubLimitEnabled = route.hubLimitEnabled || false;
        route.assignedHubId = route.assignedHubId || null;
        
        hubLimitEnabled.checked = route.hubLimitEnabled;
        hubSelectContainer.style.display = route.hubLimitEnabled ? 'block' : 'none';
        
        // Заполняем список хабов
        const hubs = gameState.buildings.filter(b => b.type === 'transport_hub');
        hubSelect.innerHTML = '<option value="">-- Выберите хаб --</option>' +
            hubs.map(hub => `<option value="${hub.id}" ${route.assignedHubId === hub.id ? 'selected' : ''}>Хаб #${hub.hubNumber || '?'}</option>`).join('');
        
        if (route.assignedHubId) {
            hubSelect.value = route.assignedHubId;
        }
        
        // Обработчики для настроек хаба
        hubLimitEnabled.onchange = () => {
            route.hubLimitEnabled = hubLimitEnabled.checked;
            hubSelectContainer.style.display = hubLimitEnabled.checked ? 'block' : 'none';
            if (!hubLimitEnabled.checked) {
                route.assignedHubId = null;
            }
        };
        
        hubSelect.onchange = () => {
            route.assignedHubId = hubSelect.value ? parseInt(hubSelect.value) : null;
        };
        
        this.updateStepsList(route, gameState);
        this.populateDropdowns(gameState);
        this.updateRoutesList(gameState);
    },

    updateStepsList(route, gameState) {
        const container = document.getElementById('steps-container');
        const BUILDING_BLUEPRINTS = window.BUILDING_BLUEPRINTS || {};
        const RESOURCES = window.RESOURCES || {};
        
        container.innerHTML = route.steps.map((step, index) => {
            const actionInfo = Object.values(this.ACTIONS).find(a => a.id === step.action);
            const target = gameState.buildings.find(b => b.id === step.targetId);
            const targetName = target && BUILDING_BLUEPRINTS[target.type] 
                ? `${BUILDING_BLUEPRINTS[target.type].name} #${target.id.toString().slice(-4)}` 
                : 'Неизвестно (Снесено?)';
            const resName = step.resource && RESOURCES[step.resource] 
                ? RESOURCES[step.resource].name 
                : 'Любой/Всё';
            
            // Цвет иконки
            let color = '#aaa';
            if(step.action === 'load') color = '#48bb78';
            if(step.action === 'unload') color = '#f6e05e';

            return `
                <div class="route-step" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(0,0,0,0.2); margin-bottom: 5px; border-left: 3px solid ${color};">
                    <div style="font-weight: bold; color: #fff; width: 20px;">${index + 1}.</div>
                    <div style="flex: 1;">
                        <div><span style="color:${color}">${actionInfo.name}</span> -> <b>${targetName}</b></div>
                        ${step.action !== 'visit' ? `<div style="font-size: 0.85em; color: #ccc;">Ресурс: ${resName}</div>` : ''}
                    </div>
                    <button class="btn-del-step" data-idx="${index}" style="background: none; border: none; color: #e53e3e; cursor: pointer;">✖</button>
                </div>
            `;
        }).join('');

        // Добавляем обработчики удаления шагов
        container.querySelectorAll('.btn-del-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                route.steps.splice(idx, 1);
                this.updateStepsList(route, gameState);
                this.updateRoutesList(gameState);
            });
        });
    },

    populateDropdowns(gameState) {
        const targetSel = document.getElementById('new-step-target');
        const resSel = document.getElementById('new-step-resource');
        
        // Заполняем цели (Склады, Заводы, Экспорт)
        // Группируем для удобства
        let options = '<option value="">-- Выберите цель --</option>';
        
        const warehouses = gameState.buildings.filter(b => b.type === 'warehouse');
        if(warehouses.length) {
            options += `<optgroup label="Склады">` + warehouses.map(b => `<option value="${b.id}">Склад #${b.id.toString().slice(-4)}</option>`).join('') + `</optgroup>`;
        }

        const BUILDING_BLUEPRINTS = window.BUILDING_BLUEPRINTS || {};
        const factories = gameState.buildings.filter(b => BUILDING_BLUEPRINTS[b.type] && (BUILDING_BLUEPRINTS[b.type].outputCapacity || BUILDING_BLUEPRINTS[b.type].category === 'extraction'));
        if(factories.length) {
             options += `<optgroup label="Производство">` + factories.map(b => `<option value="${b.id}">${BUILDING_BLUEPRINTS[b.type].name} #${b.id.toString().slice(-4)}</option>`).join('') + `</optgroup>`;
        }

        const exportDepots = gameState.buildings.filter(b => b.type === 'export_depot');
        if(exportDepots.length) {
             options += `<optgroup label="Экспорт">` + exportDepots.map(b => `<option value="${b.id}">Экспортный терминал</option>`).join('') + `</optgroup>`;
        }
        
        const houses = gameState.buildings.filter(b => b.type === 'residential_house');
        if(houses.length) {
             options += `<optgroup label="Город">` + houses.map(b => `<option value="${b.id}">Жилой дом #${b.id.toString().slice(-4)}</option>`).join('') + `</optgroup>`;
        }

        targetSel.innerHTML = options;

        // Заполняем ресурсы
        const RESOURCES = window.RESOURCES || {};
        resSel.innerHTML = '<option value="">(Любой ресурс)</option>' + 
            Object.keys(RESOURCES).map(k => `<option value="${k}">${RESOURCES[k].name}</option>`).join('');
    },

    attachEventListeners(gameState) {
        // Клик по списку маршрутов (без изменений)
        const listContainer = document.getElementById('routes-list-items');
        if (listContainer) {
            // Удаляем старые слушатели через клонирование (грубый, но надежный метод для прототипа)
            const newList = listContainer.cloneNode(true);
            listContainer.parentNode.replaceChild(newList, listContainer);
            
            newList.addEventListener('click', (e) => {
                const item = e.target.closest('.route-item');
                if (item) {
                    this.openRouteEditor(parseInt(item.dataset.id), gameState);
                }
            });
        }

        // Создать маршрут
        const btnCreate = document.getElementById('btn-create-route');
        if (btnCreate) {
            const newBtn = btnCreate.cloneNode(true);
            btnCreate.parentNode.replaceChild(newBtn, btnCreate);
            
            newBtn.addEventListener('click', () => {
                // ИСПРАВЛЕНО: Передаем gameState
                const r = this.createRoute(gameState); 
                this.updateRoutesList(gameState);
                this.openRouteEditor(r.id, gameState);
            });
        }

        // Удалить маршрут
        const btnDelete = document.getElementById('btn-delete-route');
        if (btnDelete) {
            const newBtn = btnDelete.cloneNode(true);
            btnDelete.parentNode.replaceChild(newBtn, btnDelete);

            newBtn.addEventListener('click', () => {
                if (this.activeRouteId) {
                    gameState.customRoutes = gameState.customRoutes.filter(r => r.id !== this.activeRouteId);
                    this.activeRouteId = null;
                    document.getElementById('editor-header').style.display = 'none';
                    document.getElementById('steps-container').innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">Выберите маршрут</div>';
                    document.getElementById('step-creator').style.display = 'none';
                    this.updateRoutesList(gameState);
                }
            });
        }

        // Изменение имени
        const nameInput = document.getElementById('route-name-input');
        if (nameInput) {
            const newInput = nameInput.cloneNode(true);
            nameInput.parentNode.replaceChild(newInput, nameInput);

            newInput.addEventListener('input', (e) => {
                if (this.activeRouteId) {
                    const r = gameState.customRoutes.find(x => x.id === this.activeRouteId);
                    if (r) {
                        r.name = e.target.value;
                        this.updateRoutesList(gameState);
                    }
                }
            });
        }

        // Добавить шаг
        const btnAddStep = document.getElementById('btn-add-step');
        if (btnAddStep) {
            const newBtn = btnAddStep.cloneNode(true);
            btnAddStep.parentNode.replaceChild(newBtn, btnAddStep);

            newBtn.addEventListener('click', () => {
                if (!this.activeRouteId) return;
                const action = document.getElementById('new-step-action').value;
                const targetId = document.getElementById('new-step-target').value;
                const resource = document.getElementById('new-step-resource').value;

                if (!targetId) {
                    // Используем alert или showNotification если доступен глобально
                    alert("Выберите цель!");
                    return;
                }

                // ИСПРАВЛЕНО: Передаем gameState
                this.addStep(gameState, this.activeRouteId, action, targetId, resource || null);
                
                const route = gameState.customRoutes.find(r => r.id === this.activeRouteId);
                this.updateStepsList(route, gameState);
                this.updateRoutesList(gameState);
            });
        }
    }
};

window.CustomRouteSystem = CustomRouteSystem;