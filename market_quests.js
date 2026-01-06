/**
 * @file market_quests.js
 * @description Дополнение для системы внутреннего рынка и квестов.
 * @version 1.5.1
 */

// =================================================================================
// I. КОНФИГУРАЦИЯ СЮЖЕТНЫХ КВЕСТОВ
// =================================================================================

const INTERNAL_MARKET_QUESTS = {
    'start_wood': {
        name: "Поставка для стройки",
        type: 'fulfillment',
        demands: { wood: 250 },
        reward: { money: 750 },
        unlocksNextQuest: 'start_coal'
    },
    'start_coal': {
        name: "Топливо для котельной",
        type: 'fulfillment',
        demands: { coal: 300 },
        reward: { money: 1200 },
        unlocksNextQuest: 'longterm_wood_contract'
    },
    'longterm_wood_contract': {
        name: "Лесопилка: долгосрочный контракт",
        type: 'procurement',
        demands: { wood: 5000 },
        reward: { wood: 2 },
        unlocksNextQuest: 'first_kits'
    },
    'first_kits': {
        name: "Материалы для города",
        type: 'fulfillment',
        demands: { building_kits: 50 },
        reward: { money: 4000 },
        unlocksNextQuest: 'start_iron_ore'
    },
    'start_iron_ore': {
        name: "Металл для промышленности",
        type: 'fulfillment',
        demands: { iron_ore: 200 },
        reward: { money: 1800 },
        unlocksNextQuest: 'longterm_coal_contract'
    },
    'longterm_coal_contract': {
        name: "Энергетика: угольный контракт",
        type: 'procurement',
        demands: { coal: 8000 },
        reward: { coal: 3 },
        unlocksNextQuest: 'start_steel'
    },
    'start_steel': {
        name: "Сталь для инфраструктуры",
        type: 'fulfillment',
        demands: { steel: 100 },
        reward: { money: 4500 },
        unlocksNextQuest: 'start_sand'
    },
    'start_sand': {
        name: "Песок для строительства",
        type: 'fulfillment',
        demands: { sand: 400 },
        reward: { money: 1200 },
        unlocksNextQuest: 'longterm_iron_contract'
    },
    'longterm_iron_contract': {
        name: "Металлургия: железорудный контракт",
        type: 'procurement',
        demands: { iron_ore: 10000 },
        reward: { iron_ore: 4 },
        unlocksNextQuest: 'start_glass'
    },
    'start_glass': {
        name: "Стекло для окон",
        type: 'fulfillment',
        demands: { glass: 150 },
        reward: { money: 3000 },
        unlocksNextQuest: 'start_copper'
    },
    'start_copper': {
        name: "Медь для электроники",
        type: 'fulfillment',
        demands: { copper: 100 },
        reward: { money: 2500 },
        unlocksNextQuest: 'longterm_sand_contract'
    },
    'longterm_sand_contract': {
        name: "Стекло: песчаный контракт",
        type: 'procurement',
        demands: { sand: 12000 },
        reward: { sand: 2 },
        unlocksNextQuest: 'start_copper_wire'
    },
    'start_copper_wire': {
        name: "Провода для проводки",
        type: 'fulfillment',
        demands: { copper_wire: 200 },
        reward: { money: 8000 },
        unlocksNextQuest: 'start_oil'
    },
    'start_oil': {
        name: "Нефть для топлива",
        type: 'fulfillment',
        demands: { oil: 150 },
        reward: { money: 5000 },
        unlocksNextQuest: 'longterm_copper_contract'
    },
    'longterm_copper_contract': {
        name: "Электроника: медный контракт",
        type: 'procurement',
        demands: { copper: 8000 },
        reward: { copper: 6 },
        unlocksNextQuest: 'start_plastic'
    },
    'start_plastic': {
        name: "Пластик для упаковки",
        type: 'fulfillment',
        demands: { plastic: 180 },
        reward: { money: 6000 },
        unlocksNextQuest: 'start_tools'
    },
    'start_tools': {
        name: "Инструменты для рабочих",
        type: 'fulfillment',
        demands: { tools: 100 },
        reward: { money: 12000 },
        unlocksNextQuest: 'longterm_oil_contract'
    },
    'longterm_oil_contract': {
        name: "Пластмассы: нефтяной контракт",
        type: 'procurement',
        demands: { oil: 10000 },
        reward: { oil: 8 },
        unlocksNextQuest: 'start_silicon'
    },
    'start_silicon': {
        name: "Кремний для чипов",
        type: 'fulfillment',
        demands: { silicon: 80 },
        reward: { money: 15000 },
        unlocksNextQuest: 'start_basic_circuits'
    },
    'start_basic_circuits': {
        name: "Электронные схемы",
        type: 'fulfillment',
        demands: { basic_circuits: 120 },
        reward: { money: 20000 },
        unlocksNextQuest: 'longterm_silicon_contract'
    },
    'longterm_silicon_contract': {
        name: "Микроэлектроника: кремниевый контракт",
        type: 'procurement',
        demands: { silicon: 6000 },
        reward: { silicon: 50 },
        unlocksNextQuest: 'start_advanced_components'
    },
    'start_advanced_components': {
        name: "Сложные компоненты",
        type: 'fulfillment',
        demands: { advanced_components: 100 },
        reward: { money: 30000 },
        unlocksNextQuest: 'start_microchips'
    },
    'start_microchips': {
        name: "Микрочипы для вычислений",
        type: 'fulfillment',
        demands: { microchips: 50 },
        reward: { money: 50000 },
        unlocksNextQuest: 'longterm_components_contract'
    },
    'longterm_components_contract': {
        name: "Автоматизация: компонентный контракт",
        type: 'procurement',
        demands: { advanced_components: 3000 },
        reward: { advanced_components: 150 },
        unlocksNextQuest: 'start_robots'
    },
    'start_robots': {
        name: "Роботы для автоматизации",
        type: 'fulfillment',
        demands: { robots: 20 },
        reward: { money: 100000 },
        unlocksNextQuest: 'start_ai_cores'
    },
    'start_ai_cores': {
        name: "ИИ для управления",
        type: 'fulfillment',
        demands: { ai_cores: 10 },
        reward: { money: 250000 },
        unlocksNextQuest: 'final_export_contract'
    },
    'final_export_contract': {
        name: "Глобальный экспортный контракт",
        type: 'fulfillment',
        demands: { robots: 50, ai_cores: 25, microchips: 200 },
        reward: { money: 1000000 },
        unlocksNextQuest: null
    }
};

// =================================================================================
// II. КОНФИГУРАЦИЯ СЕЗОННЫХ КВЕСТОВ (ШАБЛОНЫ)
// =================================================================================

const SEASONAL_QUEST_TEMPLATES = [
    {
        id: 'seasonal_wood',
        name: 'Срочная закупка древесины',
        resource: 'wood',
        basePrice: 4,
        baseQuantity: 750,
        unlockCondition: (_gameState) => true,
        minRadius: 10,
        maxRadius: 25
    },
    {
        id: 'seasonal_coal',
        name: 'Нехватка топлива на зиму',
        resource: 'coal',
        basePrice: 6,
        baseQuantity: 600,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('coal_mine'),
        minRadius: 15,
        maxRadius: 35
    },
    {
        id: 'seasonal_kits',
        name: 'Строительный бум в соседнем городе',
        resource: 'building_kits',
        basePrice: 80,
        baseQuantity: 100,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('construction_factory'),
        minRadius: 30,
        maxRadius: 50
    },
    {
        id: 'seasonal_iron_ore',
        name: 'Металлургический завод расширяется',
        resource: 'iron_ore',
        basePrice: 5,
        baseQuantity: 800,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('iron_mine'),
        minRadius: 12,
        maxRadius: 30
    },
    {
        id: 'seasonal_steel',
        name: 'Инфраструктурный проект',
        resource: 'steel',
        basePrice: 20,
        baseQuantity: 300,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('steel_smelter'),
        minRadius: 25,
        maxRadius: 45
    },
    {
        id: 'seasonal_glass',
        name: 'Стекло для небоскребов',
        resource: 'glass',
        basePrice: 15,
        baseQuantity: 400,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('glass_furnace'),
        minRadius: 20,
        maxRadius: 40
    },
    {
        id: 'seasonal_copper_wire',
        name: 'Электромонтажные работы',
        resource: 'copper_wire',
        basePrice: 30,
        baseQuantity: 250,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('wire_mill'),
        minRadius: 18,
        maxRadius: 38
    },
    {
        id: 'seasonal_plastic',
        name: 'Пластик для медицинского оборудования',
        resource: 'plastic',
        basePrice: 15,
        baseQuantity: 500,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('plastic_factory'),
        minRadius: 22,
        maxRadius: 42
    },
    {
        id: 'seasonal_tools',
        name: 'Инструменты для ремонтных бригад',
        resource: 'tools',
        basePrice: 90,
        baseQuantity: 150,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('tool_workshop'),
        minRadius: 28,
        maxRadius: 48
    },
    {
        id: 'seasonal_microchips',
        name: 'Высокотехнологичный стартап',
        resource: 'microchips',
        basePrice: 350,
        baseQuantity: 80,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('microchip_fabricator'),
        minRadius: 35,
        maxRadius: 55
    },
    {
        id: 'seasonal_robots',
        name: 'Автоматизация крупного завода',
        resource: 'robots',
        basePrice: 1800,
        baseQuantity: 25,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('robotics_factory'),
        minRadius: 40,
        maxRadius: 60
    },
    {
        id: 'seasonal_ai_cores',
        name: 'Исследовательский центр ИИ',
        resource: 'ai_cores',
        basePrice: 6000,
        baseQuantity: 15,
        unlockCondition: (gameState) => gameState.unlockedBuildings.has('ai_lab'),
        minRadius: 45,
        maxRadius: 65
    }
];

// =================================================================================
// III. ОБЪЕКТ СИСТЕМЫ КВЕСТОВ (ОСНОВНАЯ ЛОГИКА)
// =================================================================================
const QuestSystem = {
    
    _dispatchNotification(message, type = 'info') {
        const event = new CustomEvent('show-notification', { detail: { message, type } });
        document.dispatchEvent(event);
    },

    initialize(gameState) {
        gameState.internalMarkets = [];
        gameState.completedQuests = new Set();
        gameState.unlockedQuests = new Set(['start_wood']);
        gameState.isFirstDeliveryDone = false;
        gameState.seasonalQuestTimer = 60000 + Math.random() * 60000; 
        this._dispatchNotification("Система квестов готова к работе.", "info");
    },
    
    updateSeasonalQuests(gameState, GRID_WIDTH, GRID_HEIGHT, TICK_INTERVAL) {
        // Убираем с карты выполненные сезонные контракты
        const initialCount = gameState.internalMarkets.length;
        gameState.internalMarkets = gameState.internalMarkets.filter(market => !(market.isSeasonal && market.status === 'completed'));
        if (gameState.internalMarkets.length < initialCount) {
             this._dispatchNotification("Выполненный контракт убран с карты.", "info");
        }

        // 1. Если таймер активен (является числом), уменьшаем его.
        if (typeof gameState.seasonalQuestTimer === 'number' && gameState.seasonalQuestTimer > 0) {
            gameState.seasonalQuestTimer -= TICK_INTERVAL;
        }

        // 2. Проверяем, не истек ли таймер.
        if (typeof gameState.seasonalQuestTimer === 'number' && gameState.seasonalQuestTimer <= 0) {
            const hasActiveSeasonalQuest = gameState.internalMarkets.some(m => m.isSeasonal && m.status === 'active');
            
            // Если активного контракта нет, создаем новый.
            if (!hasActiveSeasonalQuest) {
                // Сохраняем количество активных сезонных квестов до попытки создания
                const activeSeasonalCountBefore = gameState.internalMarkets.filter(m => m.isSeasonal && m.status === 'active').length;
                
                this.spawnSeasonalMarket(gameState, GRID_WIDTH, GRID_HEIGHT);
                
                // Проверяем, был ли действительно создан новый квест
                const activeSeasonalCountAfter = gameState.internalMarkets.filter(m => m.isSeasonal && m.status === 'active').length;
                const questWasCreated = activeSeasonalCountAfter > activeSeasonalCountBefore;
                
                // "Останавливаем" таймер только если квест был успешно создан.
                // Он будет снова запущен в handleDelivery после выполнения нового контракта.
                if (questWasCreated) {
                    gameState.seasonalQuestTimer = null;
                } else {
                    // Если квест не был создан, перезапускаем таймер для следующей попытки
                    gameState.seasonalQuestTimer = 30000 + Math.random() * 30000;
                }
            } else {
                // Если уже есть активный сезонный квест, останавливаем таймер
                gameState.seasonalQuestTimer = null;
            }
        }

    },

    spawnSeasonalMarket(gameState, GRID_WIDTH, GRID_HEIGHT) {
        const warehouses = gameState.buildings.filter(b => b.type === 'warehouse');
        if (warehouses.length === 0) return;

        const availableTemplates = SEASONAL_QUEST_TEMPLATES.filter(template => template.unlockCondition(gameState));
        if (availableTemplates.length === 0) {
            gameState.seasonalQuestTimer = 60000;
            return;
        }

        const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
        const resourceKey = template.resource;

        const mapCenter = { x: GRID_WIDTH / 2, y: GRID_HEIGHT / 2 };
        let furthestWarehouse = warehouses[0];
        let maxDist = 0;
        for (const wh of warehouses) {
            const pos = { x: wh.gridIndex % GRID_WIDTH, y: Math.floor(wh.gridIndex / GRID_WIDTH) };
            const dist = Math.hypot(pos.x - mapCenter.x, pos.y - mapCenter.y);
            if (dist > maxDist) { maxDist = dist; furthestWarehouse = wh; }
        }
        
        const resourceInStock = gameState.resources[resourceKey] || 0;
        const price = Math.round(template.basePrice * (1 + 3000 / (resourceInStock + 1500)));
        

        // Мы добавляем Math.max(0.1, ...), чтобы множитель спроса не падал ниже 0.1
        const demandMultiplier = Math.max(0.1, 1 + (template.basePrice * 2 - price) / template.basePrice);
        const randomBaseQuantity = template.baseQuantity + Math.random() * (template.baseQuantity * 0.5);
        // Дополнительно оборачиваем в Math.max(1, ...), чтобы гарантировать, что требуется хотя бы 1 единица.
        const quantity = Math.max(1, Math.round(randomBaseQuantity * demandMultiplier));

        const questData = {
            name: template.name,
            type: 'procurement',
            demands: { [resourceKey]: quantity },
            reward: { [resourceKey]: price },
            isSeasonal: true
        };

        const MIN_RADIUS = template.minRadius || 10;
        const MAX_RADIUS = template.maxRadius || 30;
        
        let spawnIndex = -1;
        for (let i = 0; i < 200; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
            const offsetX = Math.round(Math.cos(angle) * radius);
            const offsetY = Math.round(Math.sin(angle) * radius);
            const basePos = { x: furthestWarehouse.gridIndex % GRID_WIDTH, y: Math.floor(furthestWarehouse.gridIndex / GRID_WIDTH) };
            const checkX = basePos.x + offsetX;
            const checkY = basePos.y + offsetY;
            if (checkX >= 0 && checkX < GRID_WIDTH && checkY >= 0 && checkY < GRID_HEIGHT) {
                const index = checkY * GRID_WIDTH + checkX;
                const cell = gameState.grid[index];
                if (cell && !cell.building && (!cell.resource || cell.resource === 'grass')) { spawnIndex = index; break; }
            }
        }
        if (spawnIndex === -1) { console.error("Не удалось найти место для сезонного квеста!"); return; }

        const newMarket = { id: `market_seasonal_${Date.now()}`, gridIndex: spawnIndex, ...questData, status: 'active' };
        Object.keys(newMarket.demands).forEach(resKey => { newMarket.demands[resKey] = { required: newMarket.demands[resKey], delivered: 0 }; });
        gameState.internalMarkets.push(newMarket);

        const event = new CustomEvent('show-notification', { 
            detail: { 
                message: `Появился выгодный контракт на ${resourceKey}! Цена: ${price}$`, 
                type: 'event',
                isResourceKey: true
            }
        });
        document.dispatchEvent(event);
    },
    

    checkForFirstDeliveryTrigger(gameState,warehouseBuilding,GRID_WIDTH,GRID_HEIGHT){if(gameState.isFirstDeliveryDone)return;gameState.isFirstDeliveryDone=true;this._dispatchNotification("Первая поставка! Открыт внутренний рынок.","success");this.spawnMarket(gameState,'start_wood',warehouseBuilding.gridIndex,GRID_WIDTH,GRID_HEIGHT)},
    spawnMarket(gameState,questId,nearGridIndex,GRID_WIDTH,GRID_HEIGHT){if(!questId||!INTERNAL_MARKET_QUESTS[questId])return;const questData=INTERNAL_MARKET_QUESTS[questId];const searchRadius=15;let spawnIndex=-1;for(let i=0;i<100;i++){const angle=Math.random()*2*Math.PI;const radius=3+Math.random()*(searchRadius-3);const offsetX=Math.round(Math.cos(angle)*radius);const offsetY=Math.round(Math.sin(angle)*radius);const basePos={x:nearGridIndex%GRID_WIDTH,y:Math.floor(nearGridIndex/GRID_WIDTH)};const checkX=basePos.x+offsetX;const checkY=basePos.y+offsetY;if(checkX>=0&&checkX<GRID_WIDTH&&checkY>=0&&checkY<GRID_HEIGHT){const index=checkY*GRID_WIDTH+checkX;const cell=gameState.grid[index];if(!cell.building&&(!cell.resource||cell.resource==='grass')){spawnIndex=index;break}}}if(spawnIndex===-1){console.error("Не удалось найти место для точки интереса!");return}const newMarket={id:`market_${Date.now()}`,questId,gridIndex:spawnIndex,name:`${questData.name}`,demands:JSON.parse(JSON.stringify(questData.demands)),reward:JSON.parse(JSON.stringify(questData.reward)),type:questData.type,status:'active'};Object.keys(newMarket.demands).forEach(resKey=>{newMarket.demands[resKey]={required:newMarket.demands[resKey],delivered:0}});gameState.internalMarkets.push(newMarket);this._dispatchNotification(`Новый внутренний заказ: "${newMarket.name}"!`,"info")},
    createTasks(gameState) {
    const tasks = [];
    const warehouses = gameState.buildings.filter(b => b.type === 'warehouse');
    if (warehouses.length === 0) return tasks;
    
    const activeMarkets = gameState.internalMarkets.filter(m => m.status === 'active');
    
    for (const market of activeMarkets) {
        for (const [resKey, demand] of Object.entries(market.demands)) {
            if (demand.delivered < demand.required) {
                for (const wh of warehouses) {
                    if ((wh.storage[resKey] || 0) > 0) {
                        const taskType = market.isSeasonal ? 'seasonal' : 'internal';
                        tasks.push({ type: taskType, source: wh, target: market, resource: resKey, priority: 1000 });
                        break; 
                    }
                }
            }
        }
    }
    return tasks;
},

handleDelivery(gameState, vehicle, market, GRID_WIDTH, GRID_HEIGHT) {
    const resType = vehicle.cargo.type;
    const truckAmount = vehicle.cargo.amount;
    const demand = market.demands[resType];
    
    if (!demand) return 0;
    
    const needed = demand.required - demand.delivered;
    if (needed <= 0) return 0;
    
    const amountToDeliver = Math.min(truckAmount, needed);
    
    let payment = 0;
    if (amountToDeliver > 0) {
        demand.delivered += amountToDeliver;
        
        if (market.type === 'procurement') {
            const pricePerUnit = market.reward[resType] || 0;
            payment = amountToDeliver * pricePerUnit;
            gameState.money += payment;
            if (payment > 0 && window.recordMoneyTransaction) {
                window.recordMoneyTransaction(payment, `Доставка ${amountToDeliver} ${resType} по контракту "${market.name}"`);
            }
        }
    }
    
    const isCompleted = Object.values(market.demands).every(d => d.delivered >= d.required);
    
    if (isCompleted && market.status !== 'completed') {
        market.status = 'completed';
        
        if (!market.isSeasonal) {
            gameState.completedQuests.add(market.questId);
            
            if (market.type === 'fulfillment') {
                gameState.money += market.reward.money;
                if (market.reward.money > 0 && window.recordMoneyTransaction) {
                    window.recordMoneyTransaction(market.reward.money, `Награда за выполнение заказа "${market.name}"`);
                }
                this._dispatchNotification(
                    `Заказ "${market.name}" выполнен! Награда: ${market.reward.money.toLocaleString()}$`,
                    "success"
                );
            } else {
                this._dispatchNotification(
                    `Контракт "${market.name}" полностью выполнен!`,
                    "success"
                );
            }
            
            const nextQuestId = INTERNAL_MARKET_QUESTS[market.questId].unlocksNextQuest;
            if (nextQuestId) {
                this.spawnMarket(gameState, nextQuestId, market.gridIndex, GRID_WIDTH, GRID_HEIGHT);
            }
        } else {
            this._dispatchNotification(`Сезонный контракт "${market.name}" выполнен!`, "success");
            gameState.seasonalQuestTimer = 60000 + Math.random() * 120000; 
            this._dispatchNotification("Новый сезонный контракт появится скоро", "info");
            }
        }
        return amountToDeliver
    },

draw(gameState, ctx, view, camera, CELL_SIZE, GRID_WIDTH) {
    ctx.font = `${CELL_SIZE * 0.7}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const market of gameState.internalMarkets) {
        const row = Math.floor(market.gridIndex / GRID_WIDTH);
        const col = market.gridIndex % GRID_WIDTH;
        
        if (row >= view.startRow && row <= view.endRow && col >= view.startCol && col <= view.endCol) {
            const x = col * CELL_SIZE + CELL_SIZE / 2;
            const y = row * CELL_SIZE + CELL_SIZE / 2;
            
            let questColor = 'rgba(49, 130, 206, 0.4)';
            if (market.type === 'procurement') questColor = 'rgba(56, 161, 105, 0.4)';
            if (market.isSeasonal) questColor = 'rgba(221, 107, 32, 0.5)';
            
            ctx.fillStyle = market.status === 'completed' ? 'rgba(113, 128, 150, 0.4)' : questColor;
            ctx.beginPath();
            ctx.arc(x, y, CELL_SIZE * 0.5, 0, 2 * Math.PI);
            ctx.fill();
            
            let emoji = '🛒';
            if (market.isSeasonal) emoji = '💰';
            else if (market.type === 'procurement') emoji = '📈';
            
            ctx.fillText(market.status === 'completed' ? '✅' : emoji, x, y);
            
            if (market.status === 'active') {
                const totalRequired = Object.values(market.demands).reduce((sum, d) => sum + d.required, 0);
                const totalDelivered = Object.values(market.demands).reduce((sum, d) => sum + d.delivered, 0);
                const progress = totalRequired > 0 ? totalDelivered / totalRequired : 1;
                
                ctx.fillStyle = '#4a5568';
                ctx.fillRect(x - CELL_SIZE * 0.4, y + CELL_SIZE * 0.4, CELL_SIZE * 0.8, 8 / camera.zoom);
                
                ctx.fillStyle = '#68d391';
                ctx.fillRect(x - CELL_SIZE * 0.4, y + CELL_SIZE * 0.4, CELL_SIZE * 0.8 * progress, 8 / camera.zoom);
            }
        }
    }
},

getMarketAt(gameState, gridIndex) {
    return gameState.internalMarkets.find(m => m.gridIndex === gridIndex);
},
    

    getTooltipText(market, RESOURCES, getIconHTML = null) {
    const title = market.isSeasonal ? `Сезонный контракт: ${market.name}` : market.name;
    const lines = [`${title} (${market.status === 'active' ? 'Активен' : 'Выполнен'})`];
    
    // Функция для получения иконки ресурса
    const getResIcon = (res, resKey) => {
        if (getIconHTML && res) {
            return getIconHTML(res.emoji, resKey);
        }
        return res ? res.emoji : '';
    };

    // ИСПРАВЛЕНИЕ: Определяем иконку денег (монет)
    // Если getIconHTML передан, он вернет HTML тег <i class="fa-coins"></i> (или то, что в ICON_MAP)
    const moneyIcon = getIconHTML ? getIconHTML('💰') : '💰';
    
    if (market.status === 'active') {
        lines.push("Требуется для выполнения:");
        
        Object.entries(market.demands).forEach(([resKey, demand]) => {
            const res = RESOURCES[resKey];
            if (res) {
                lines.push(`\t${getResIcon(res, resKey)} ${res.name}: ${Math.floor(demand.delivered)} / ${demand.required}`);
            }
        });
        
        if (market.type === 'fulfillment') {
            // Разовые квесты
            lines.push(`Награда: ${moneyIcon} ${market.reward.money.toLocaleString()}$`);
        } else if (market.type === 'procurement') {
            // Контракты на закупку
            
            // 1. Если награда прописана явно как деньги (reward: {money: 100})
            if (market.reward.money) {
                lines.push(`Плата за единицу: ${moneyIcon} ${market.reward.money.toLocaleString()}$`);
            }

            // 2. Проверяем остальные ключи
            Object.entries(market.reward).forEach(([resKey, value]) => {
                if (resKey === 'money') return; // Деньги уже обработали

                // ВАЖНОЕ ИСПРАВЛЕНИЕ:
                // Если ресурс в награде совпадает с ресурсом в требованиях (как в сезонных квестах: требуют wood, награда в wood),
                // то это ЦЕНА, и мы используем иконку ДЕНЕГ (moneyIcon).
                if (market.demands[resKey]) {
                    lines.push(`Плата за единицу: ${moneyIcon} ${value.toLocaleString()}$`);
                } else {
                    // Если ресурсы разные (бартер), то показываем иконку РЕСУРСА
                    const res = RESOURCES[resKey];
                    if (res) {
                        lines.push(`\t${getResIcon(res, resKey)} ${res.name}: ${value.toLocaleString()}`);
                    }
                }
            });
        }
    } else {
        lines.push("Заказ полностью выполнен.");
    }
    
    return lines;
}
};