/**
 * @file city_management.js
 * @description Система управления городом v3.1: Исправленные тайминги и динамическая сложность.
 */

const CityManagementSystem = {
    CONFIG: {
        // --- ТАЙМИНГИ ЗАКАЗОВ ---
        CONTRACT_BASE_DURATION: 180 * 1000, // Базовое время: 3 минуты (было 120с)
        TIME_PER_UNIT: 2000,                // +2 секунды за каждую единицу товара (Динамическое время)
        
        // --- ТАЙМИНГИ ПЕРЕРЫВОВ ---
        COOLDOWN_NORMAL: 120 * 1000,        // Обычный перерыв: 2 минуты (было 30с)
        COOLDOWN_LONG: 600 * 1000,          // Долгий перерыв (насыщение): 10 минут
        
        // --- БАЛАНС ---
        DISSATISFACTION_CHECK_INTERVAL: 5000,
        HOUSE_BASE_VALUE: 500,              
        PENALTY_MULTIPLIER: 3.0,            
        MAX_DISSATISFACTION: 100,
        MIN_RESOURCE_STOCK: 50              
    },

    initialize(gameState) {
        gameState.cityStatus = {
            state: 'cooldown',              
            dissatisfaction: 0,
            // Ставим 1 секунду при старте, чтобы сразу запустить логику
            timer: 1000, 
            dissatisfactionTimer: this.CONFIG.DISSATISFACTION_CHECK_INTERVAL,
            activeContract: null,           
            lastResource: null,
            repeatCount: 0,
            housesCount: 0,
            // Максимальное время текущей фазы (для прогресс-бара и расчетов)
            currentPhaseMaxTime: 1000 
        };
        console.log("City System v3.1 (Rebalanced) initialized.");
    },

    update(gameState, deltaTime) {
        if (!gameState.cityStatus) return;

        // Кешируем кол-во домов
        const houses = gameState.buildingCache?.houses || gameState.buildings.filter(b => b.type === 'residential_house');
        gameState.cityStatus.housesCount = houses.length;

        if (gameState.cityStatus.housesCount === 0) return;
        
        // --- ЛОГИКА ТАЙМЕРА ---
        const status = gameState.cityStatus;
        // Обновляем таймер
        status.timer -= deltaTime * 1000; 

        // --- ЛОГИКА СОСТОЯНИЙ ---
        if (status.state === 'active') {
            // ИДЕТ КОНТРАКТ
            if (status.timer <= 0) {
                this.resolveContract(gameState);
            }
        } 
        else if (status.state === 'cooldown') {
            // ПЕРЕРЫВ (ОЖИДАНИЕ)
            
            // Если это долгий перерыв, проверяем, не появились ли новые ресурсы
            if (status.timer > this.CONFIG.COOLDOWN_NORMAL && status.repeatCount >= 2) {
                if (this.findNewResourceAvailable(gameState)) {
                    // Если появился новый ресурс, сокращаем ожидание
                    status.timer = Math.min(status.timer, 5000); 
                }
            }

            if (status.timer <= 0) {
                const started = this.tryGenerateNewContract(gameState);
                if (started) {
                    status.state = 'active';
                    // Таймер устанавливается внутри tryGenerateNewContract
                } else {
                    // Ресурсов нет, проверяем снова через минуту
                    status.timer = 60000;
                    status.currentPhaseMaxTime = 60000;
                }
            }
        }

        // Недовольство
        status.dissatisfactionTimer -= deltaTime * 1000;
        if (status.dissatisfactionTimer <= 0) {
            this.updateDissatisfaction(gameState);
            status.dissatisfactionTimer = this.CONFIG.DISSATISFACTION_CHECK_INTERVAL;
        }
    },

    tryGenerateNewContract(gameState) {
        const status = gameState.cityStatus;
        
        // Фильтр ресурсов
        const availableResources = Object.keys(gameState.resources).filter(key => {
            const resDef = window.RESOURCES[key];
            const amount = gameState.resources[key];
            return resDef.baseExportPrice > 0 && 
                   resDef.category !== 'background' &&
                   amount >= this.CONFIG.MIN_RESOURCE_STOCK;
        });

        if (availableResources.length === 0) return false;

        // Сортировка: дешевые в приоритете
        availableResources.sort((a, b) => window.RESOURCES[a].baseExportPrice - window.RESOURCES[b].baseExportPrice);

        // Выбор (топ 3)
        const candidatePool = availableResources.slice(0, 3);
        let selectedResource = candidatePool[Math.floor(Math.random() * candidatePool.length)];

        // Проверка на повторы
        if (selectedResource === status.lastResource) {
            status.repeatCount++;
        } else {
            status.lastResource = selectedResource;
            status.repeatCount = 1;
        }

        if (status.repeatCount > 2) {
            status.state = 'cooldown';
            status.timer = this.CONFIG.COOLDOWN_LONG;
            status.currentPhaseMaxTime = this.CONFIG.COOLDOWN_LONG;
            status.repeatCount = 0;
            this.notify(`Жители насытились ресурсом "${window.RESOURCES[selectedResource].name}". Им нужно время.`, 'info');
            return false; 
        }

        // Расчет количества
        const price = window.RESOURCES[selectedResource].baseExportPrice || 1;
        const houseFactor = Math.max(1, 20 / Math.sqrt(price));
        let requiredAmount = Math.floor(status.housesCount * 5 * houseFactor);
        
        // Корректировка под склад (не больше 90% от наличия)
        const playerStock = gameState.resources[selectedResource];
        if (requiredAmount > playerStock) requiredAmount = Math.floor(playerStock * 0.9);
        requiredAmount = Math.max(10, requiredAmount);

        // === РАСЧЕТ ДИНАМИЧЕСКОГО ВРЕМЕНИ ===
        // База + (Кол-во * Время на единицу)
        const dynamicTime = this.CONFIG.CONTRACT_BASE_DURATION + (requiredAmount * this.CONFIG.TIME_PER_UNIT);
        
        status.timer = dynamicTime;
        status.currentPhaseMaxTime = dynamicTime;

        status.activeContract = {
            resource: selectedResource,
            required: requiredAmount,
            delivered: 0
        };

        // Форматируем время для уведомления (в минутах)
        const mins = Math.floor(dynamicTime / 60000);
        const secs = Math.floor((dynamicTime % 60000) / 1000);
        const timeStr = secs > 0 ? `${mins}м ${secs}с` : `${mins}м`;

        this.notify(`🏙️ Новый заказ: ${window.RESOURCES[selectedResource].name} (${requiredAmount} шт.) Время: ${timeStr}`, 'event');
        return true;
    },

    findNewResourceAvailable(gameState) {
        const status = gameState.cityStatus;
        for (let key in gameState.resources) {
            if (key === status.lastResource) continue;
            if (window.RESOURCES[key].baseExportPrice <= 0) continue;
            if (gameState.resources[key] >= this.CONFIG.MIN_RESOURCE_STOCK * 1.5) return key;
        }
        return null;
    },

    resolveContract(gameState) {
        const status = gameState.cityStatus;
        const contract = status.activeContract;
        if (!contract) return;

        const missing = contract.required - contract.delivered;

        if (missing > 0) {
            // Расчет штрафа
            const resDef = window.RESOURCES[contract.resource];
            const basePrice = resDef ? resDef.baseExportPrice : 0;
            const cityPrice = basePrice / 2.4;
            const penalty = Math.floor(missing * cityPrice * this.CONFIG.PENALTY_MULTIPLIER);
            
            gameState.money -= penalty;
            if(window.recordMoneyTransaction) window.recordMoneyTransaction(-penalty, `Штраф (недопоставка ${contract.resource})`);
            this.notify(`❌ Заказ провален! Штраф: ${penalty}$.`, 'error');
            status.dissatisfaction = Math.min(this.CONFIG.MAX_DISSATISFACTION, status.dissatisfaction + 15);
        } else {
            this.notify(`✅ Заказ выполнен!`, 'success');
            status.dissatisfaction = Math.max(0, status.dissatisfaction - 10);
        }

        status.activeContract = null;
        status.state = 'cooldown';
        status.timer = this.CONFIG.COOLDOWN_NORMAL;
        status.currentPhaseMaxTime = this.CONFIG.COOLDOWN_NORMAL;
    },

    processDelivery(gameState, resource, amount) {
        const status = gameState.cityStatus;
        if (status.state !== 'active' || !status.activeContract || status.activeContract.resource !== resource) return 0;

        const contract = status.activeContract;
        const needed = contract.required - contract.delivered;
        if (needed <= 0) return 0;

        const accepted = Math.min(amount, needed);
        contract.delivered += accepted;
        return accepted;
    },

    updateDissatisfaction(gameState) {
        const status = gameState.cityStatus;
        if (status.state === 'active' && status.activeContract) {
            // Используем динамическое время текущего контракта для расчета прогресса
            const totalDuration = status.currentPhaseMaxTime;
            const progressTime = 1 - (status.timer / totalDuration); // 0..1 (прошло времени)
            const progressDelivery = status.activeContract.delivered / status.activeContract.required;

            // Если прошло 70% времени, а доставлено меньше 30% -> растет недовольство
            if (progressTime > 0.7 && progressDelivery < 0.3) {
                status.dissatisfaction += 0.5;
            }
        } else {
            status.dissatisfaction = Math.max(0, status.dissatisfaction - 0.2);
        }
    },

    // === UI (с встроенным генератором иконок) ===
    getUIHtml(gameState) {
        if (!gameState.cityStatus || gameState.cityStatus.housesCount === 0) return '';

        const status = gameState.cityStatus;
        const contract = status.activeContract;
        
        const getIcon = (emoji) => {
            const map = window.ICON_MAP || {};
            const cls = map[emoji] || 'fa-vector-square';
            return `<i class="fas ${cls}"></i>`;
        };
        
        let moodIcon = '😊';
        let moodColor = '#48bb78'; 
        if (status.dissatisfaction > 30) { moodIcon = '😐'; moodColor = '#f6e05e'; }
        if (status.dissatisfaction > 70) { moodIcon = '😠'; moodColor = '#fc8181'; }

        let contentHtml = '';

        if (status.state === 'cooldown') {
            const waitProgress = Math.max(0, (status.timer / status.currentPhaseMaxTime) * 100);
            contentHtml = `
                <div class="city-status-row" title="Таймер потребности в ресурсах">
                    <span class="city-status-text">Жители обеспечены</span>
                    <div class="city-wait-bar">
                        <div class="city-wait-fill" style="width: ${waitProgress}%"></div>
                    </div>
                </div>
            `;
        } 
        else if (contract) {
            const res = window.RESOURCES[contract.resource];
            const percent = Math.min(100, Math.floor((contract.delivered / contract.required) * 100));
            
            // Форматирование времени
            const totalSecs = Math.ceil(status.timer / 1000);
            const m = Math.floor(totalSecs / 60);
            const s = totalSecs % 60;
            const timeStr = m > 0 ? `${m}м ${s}с` : `${s}с`;

            contentHtml = `
                <div class="city-contract-active">
                    <div class="contract-info">
                        <span class="contract-res">${getIcon(res.emoji)} ${res.name}</span>
                        <span class="contract-nums">${Math.floor(contract.delivered)}/${contract.required}</span>
                    </div>
                    <div class="contract-progress-bg">
                        <div class="contract-progress-fill" style="width: ${percent}%;"></div>
                    </div>
                    <div class="contract-timer ${totalSecs < 30 ? 'urgent' : ''}">
                        <i class="fas fa-stopwatch"></i> ${timeStr}
                    </div>
                </div>
            `;
        }

        return `
            <div class="city-widget">
                <div class="city-left-col">
                    <div class="city-icon">🏘️</div>
                    <div class="city-pop">${status.housesCount}</div>
                </div>
                <div class="city-main-col">
                    <div class="city-mood-row" title="Недовольство растет при срыве поставок">
                        <span style="color:${moodColor}">${moodIcon} Настроение</span>
                        <span style="color:${moodColor}; font-size:0.8em">(${status.dissatisfaction.toFixed(0)}%)</span>
                    </div>
                    ${contentHtml}
                </div>
            </div>
        `;
    },

    notify(msg, type) {
        const event = new CustomEvent('show-notification', { detail: { message: msg, type: type } });
        document.dispatchEvent(event);
    }
};

window.CityManagementSystem = CityManagementSystem;