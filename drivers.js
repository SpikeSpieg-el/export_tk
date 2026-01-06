/**
 * @file drivers.js
 * @description Система найма эльфиек-водителей с бонусами. (Исправленная версия v2)
 */

const DriverSystem = {
    // База данных водителей (10 уникальных эльфиек)
    DRIVERS_DB: [
        { id: 'elf_speed_1', name: 'Аэлиана Ветрокрылая', description: 'Бывшая гонщица на вивернах. Не любит тормоза.', image: 'i_look/drivers/elf_1.png', salary: 50, bonuses: { speed: 1.3, capacity: 1.0 }, rarity: 'rare' },
        { id: 'elf_capacity_1', name: 'Бром "Тягач" Оккен', description: 'Умеет упаковывать груз так, что влезает вдвое больше.', image: 'i_look/drivers/elf_2.png', salary: 60, bonuses: { speed: 0.9, capacity: 1.4 }, rarity: 'rare' },
        { id: 'elf_balanced_1', name: 'Лира Лунный Свет', description: 'Надежность — ее второе имя. Всегда вовремя.', image: 'i_look/drivers/elf_3.png', salary: 40, bonuses: { speed: 1.15, capacity: 1.15 }, rarity: 'common' },
        { id: 'elf_elite_1', name: 'Сильвана Золотая', description: 'Легенда логистики. Стоит дорого, но работает за троих.', image: 'i_look/drivers/elf_4.png', salary: 150, bonuses: { speed: 1.5, capacity: 1.5 }, rarity: 'legendary' },
        { id: 'elf_eco_1', name: 'Мирабель Росток', description: 'Новичок, старается изо всех сил.', image: 'i_look/drivers/elf_5.png', salary: 20, bonuses: { speed: 1.1, capacity: 1.0 }, rarity: 'common' },
        { id: 'elf_heavy_2', name: 'Тариэль Железная', description: 'Возит руду голыми руками, если сломается грузовик.', image: 'i_look/drivers/elf_6.png', salary: 70, bonuses: { speed: 0.85, capacity: 1.6 }, rarity: 'rare' },
        { id: 'elf_speed_2', name: 'Зефира Искра', description: 'Кофеин в чистом виде.', image: 'i_look/drivers/elf_7.png', salary: 55, bonuses: { speed: 1.35, capacity: 0.9 }, rarity: 'rare' },
        { id: 'elf_tech_1', name: 'Веатрикс Шестеренка', description: 'Техно-эльф. Оптимизирует двигатель на ходу.', image: 'i_look/drivers/elf_8.png', salary: 80, bonuses: { speed: 1.25, capacity: 1.25 }, rarity: 'rare' },
        { id: 'elf_mystic_1', name: 'Элара Пустота', description: 'Использует короткие пути через подпространство.', image: 'i_look/drivers/elf_9.png', salary: 100, bonuses: { speed: 1.6, capacity: 0.8 }, rarity: 'epic' },
        { id: 'elf_grand_1', name: 'Матриарх Идриль', description: 'Глава гильдии перевозчиков. Безупречна.', image: 'i_look/drivers/elf_10.png', salary: 200, bonuses: { speed: 1.4, capacity: 1.8 }, rarity: 'legendary' }
    ],

    DEFAULT_DRIVER: { id: null, name: 'Обычный стажер', salary: 5, bonuses: { speed: 1.0, capacity: 1.0 } },

    initialize(gameState) {
        if (!gameState.hiredDrivers) {
            gameState.hiredDrivers = [];
        }
        this.injectStyles();
        console.log("DriverSystem initialized");
    },

    getDriverForTruck(truck) {
        if (!truck.driverId) return this.DEFAULT_DRIVER;
        const driverDef = this.DRIVERS_DB.find(d => d.id === truck.driverId);
        return driverDef || this.DEFAULT_DRIVER;
    },

    applyBonuses(truck, baseStats) {
        const driver = this.getDriverForTruck(truck);
        return {
            speed: baseStats.speed * driver.bonuses.speed,
            capacity: Math.floor(baseStats.capacity * driver.bonuses.capacity)
        };
    },

    processSalaries(gameState) {
        let totalSalary = 0;
        let hiredCount = 0;
        
        // Считаем зарплату эльфиек
        gameState.hiredDrivers.forEach(hired => {
            const def = this.DRIVERS_DB.find(d => d.id === hired.id);
            if (def) {
                totalSalary += def.salary;
                hiredCount++;
            }
        });

        // Считаем стажеров (Все грузовики МИНУС грузовики с назначенными водителями)
        const totalTrucks = gameState.vehicles.length;
        const trucksWithDrivers = gameState.vehicles.filter(v => v.driverId).length;
        const internsCount = Math.max(0, totalTrucks - trucksWithDrivers);
        
        const internsCost = internsCount * this.DEFAULT_DRIVER.salary;
        totalSalary += internsCost;

        if (totalSalary > 0) {
            gameState.money -= totalSalary;
            
            const msg = `Выплата зарплат: -${totalSalary}$ (Эльфы: ${hiredCount}, Стажеры: ${internsCount})`;
            const event = new CustomEvent('show-notification', { 
                detail: { message: msg, type: 'info' } 
            });
            document.dispatchEvent(event);
            
            if (window.recordMoneyTransaction) {
                window.recordMoneyTransaction(-totalSalary, "Зарплата водителей (1.5 мин)");
            }
        }
        
        return totalSalary;
    },

    // --- UI ЛОГИКА ---

    openHouseModal(gameState) {
        console.log("Opening Driver House Modal");
        const existing = document.getElementById('driver-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'driver-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.style.zIndex = '10005'; // Строкой, чтобы наверняка

        modal.innerHTML = `
            <div class="driver-modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-users"></i> Биржа водителей</h3>
                    <button class="close-button" id="close-driver-modal"><i class="fas fa-times"></i></button>
                </div>
                <div class="driver-ui-body modal-body">
                    <div class="driver-stats-panel">
                        <div class="stat-box">
                            <span>Нанято:</span>
                            <span id="drivers-count">0</span> / <span id="drivers-limit">0</span>
                        </div>
                        <div class="stat-box">
                             <span>Бюджет зарплат:</span>
                            <span id="drivers-salary-total" style="color: #ef4444">0$ / тик</span>
                        </div>
                    </div>
                    <div class="driver-lists-container">
                        <div class="driver-column">
                            <h4>Доступны для найма</h4>
                            <div id="available-drivers-list" class="drivers-grid"></div>
                        </div>
                        <div class="driver-column">
                            <h4>Ваш штат</h4>
                            <div id="hired-drivers-list" class="drivers-grid"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Надежный обработчик закрытия
        const closeBtn = document.getElementById('close-driver-modal');
        if(closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                modal.remove();
            };
        }

        this.renderDriverLists(gameState);
    },

    renderDriverLists(gameState) {
        const availableContainer = document.getElementById('available-drivers-list');
        const hiredContainer = document.getElementById('hired-drivers-list');
        if (!availableContainer) return;

        availableContainer.innerHTML = '';
        hiredContainer.innerHTML = '';

        // Считаем количество общежитий
        // Используем filter для надежности, чтобы не брать удаленные
        const houses = gameState.buildings.filter(b => b.type === 'driver_house');
        console.log(`Found ${houses.length} driver houses.`); 

        const totalSlots = houses.length * 4;
        const hiredCount = gameState.hiredDrivers.length;

        document.getElementById('drivers-count').textContent = hiredCount;
        document.getElementById('drivers-limit').textContent = totalSlots;
        
        // Основной цикл рендера
        this.DRIVERS_DB.forEach(driver => {
            const isHired = gameState.hiredDrivers.some(h => h.id === driver.id);
            const canHire = hiredCount < totalSlots;
            
            const card = this.createDriverCard(driver, isHired, gameState, canHire, hiredCount, totalSlots);
            
            if (isHired) {
                hiredContainer.appendChild(card);
            } else {
                availableContainer.appendChild(card);
            }
        });
        
        const totalSal = this.calculateTotalSalaryPreview(gameState);
        document.getElementById('drivers-salary-total').textContent = `-${totalSal}$`;
    },

    createDriverCard(driver, isHired, gameState, canHire, currentHired, maxSlots) {
        const div = document.createElement('div');
        div.className = `driver-card ${driver.rarity}`;
        
        let statusHtml = '';
        
        if (isHired) {
            const hiredInfo = gameState.hiredDrivers.find(h => h.id === driver.id);
            if (hiredInfo.assignedTruckId) {
                statusHtml = `<div class="driver-status busy">🚛 На грузовике #${hiredInfo.assignedTruckId.toString().slice(-4)}</div>`;
            } else {
                statusHtml = `<div class="driver-status free">💤 В резерве</div>`;
            }
        } else {
            statusHtml = `<div class="driver-status hireable">Зарплата: ${driver.salary}$</div>`;
        }

        // Вставляем HTML структуру
        div.innerHTML = `
            <div class="driver-img-container">
                <img src="${driver.image}" alt="${driver.name}" onerror="this.src='https://via.placeholder.com/320x180?text=Elf+Driver'">
                <div class="driver-rarity-badge">${driver.rarity.toUpperCase()}</div>
            </div>
            <div class="driver-info">
                <div class="driver-name">${driver.name}</div>
                <div class="driver-desc">${driver.description}</div>
                <div class="driver-bonuses">
                    <span class="bonus-tag speed">⚡ ${(driver.bonuses.speed * 100 - 100).toFixed(0)}% Скор.</span>
                    <span class="bonus-tag capacity">📦 ${(driver.bonuses.capacity * 100 - 100).toFixed(0)}% Вмест.</span>
                </div>
                ${statusHtml}
                <div class="driver-actions"></div> 
            </div>
        `;

        // === СОЗДАЕМ КНОПКУ ЧЕРЕЗ JS (БЕЗОПАСНЫЙ МЕТОД) ===
        const actionsDiv = div.querySelector('.driver-actions');
        const btn = document.createElement('button');
        btn.className = 'driver-btn';

        if (isHired) {
            btn.textContent = "Уволить";
            btn.classList.add('fire-btn');
            btn.onclick = (e) => {
                e.stopPropagation(); // Остановить всплытие
                this.fireDriver(driver.id, gameState);
            };
        } else {
            if (canHire) {
                btn.textContent = "Нанять";
                btn.classList.add('hire-btn');
                btn.onclick = (e) => {
                    e.stopPropagation(); // Остановить всплытие
                    // Проверка денег перед наймом (опционально, если есть плата за вход)
                    this.hireDriver(driver.id, gameState);
                };
            } else {
                // Более информативный текст
                btn.textContent = `Нет мест (${currentHired}/${maxSlots})`;
                btn.classList.add('disabled');
                btn.disabled = true;
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
            }
        }

        actionsDiv.appendChild(btn);
        return div;
    },

    hireDriver(driverId, gameState) {
        console.log('Hiring driver ACTION:', driverId);
        // Добавляем в массив
        gameState.hiredDrivers.push({ id: driverId, assignedTruckId: null });
        
        // Уведомление
        const event = new CustomEvent('show-notification', { detail: { message: `Водитель нанят!`, type: 'success' } });
        document.dispatchEvent(event);
        
        // Перерисовываем список
        this.renderDriverLists(gameState);
        
        // Если открыто окно логистики, обновляем его (чтобы водитель появился в списке выбора)
        if (window.renderDetailViewGlobal) window.renderDetailViewGlobal();
    },

    fireDriver(driverId, gameState) {
        console.log('Firing driver ACTION:', driverId);
        const index = gameState.hiredDrivers.findIndex(h => h.id === driverId);
        if (index !== -1) {
            const hired = gameState.hiredDrivers[index];
            // Если назначен, снимаем с грузовика
            if (hired.assignedTruckId) {
                const truck = gameState.vehicles.find(v => v.id === hired.assignedTruckId);
                if (truck) truck.driverId = null;
            }
            gameState.hiredDrivers.splice(index, 1);
            
            const event = new CustomEvent('show-notification', { detail: { message: `Водитель уволен.`, type: 'info' } });
            document.dispatchEvent(event);

            this.renderDriverLists(gameState);
            
            if (window.renderDetailViewGlobal) window.renderDetailViewGlobal();
        }
    },

    calculateTotalSalaryPreview(gameState) {
        let total = 0;
        gameState.hiredDrivers.forEach(h => {
             const d = this.DRIVERS_DB.find(x => x.id === h.id);
             if(d) total += d.salary;
        });
        const trucksWithDrivers = gameState.vehicles.filter(v => v.driverId).length;
        const trainees = Math.max(0, gameState.vehicles.length - trucksWithDrivers);
        total += trainees * this.DEFAULT_DRIVER.salary;
        return total;
    },

    renderDriverSelector(truck, container, gameState) {
        const existing = container.querySelector('.driver-selector-area');
        if(existing) existing.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'driver-selector-area';
        
        const currentDriver = this.getDriverForTruck(truck);
        
        // Фильтруем: свободные + тот, кто уже сидит в этом грузовике
        const options = gameState.hiredDrivers
            .filter(h => h.assignedTruckId === null || h.assignedTruckId === truck.id)
            .map(h => {
                const def = this.DRIVERS_DB.find(d => d.id === h.id);
                return `<option value="${h.id}" ${truck.driverId === h.id ? 'selected' : ''}>${def.name} (Зп: ${def.salary}$)</option>`;
            }).join('');

        wrapper.innerHTML = `
            <h4>👨‍✈️ Водитель</h4>
            <div class="driver-assign-box">
                <div class="current-driver-info">
                    <img src="${currentDriver.image || ''}" onerror="this.style.display='none'" class="mini-avatar">
                    <div>
                        <div class="d-name">${currentDriver.name}</div>
                        <div class="d-stats">
                            ⚡ x${currentDriver.bonuses.speed} | 📦 x${currentDriver.bonuses.capacity}
                        </div>
                    </div>
                </div>
                <div class="assign-controls">
                    <select id="truck-driver-select">
                        <option value="">-- Стажер (5$) --</option>
                        ${options}
                    </select>
                    <button id="assign-driver-btn">Назначить</button>
                </div>
            </div>
        `;

        container.appendChild(wrapper);

        const btn = wrapper.querySelector('#assign-driver-btn');
        btn.onclick = () => {
            const select = wrapper.querySelector('#truck-driver-select');
            const newDriverId = select.value || null;

            // Если меняем водителя, старого освобождаем
            if (truck.driverId && truck.driverId !== newDriverId) {
                const oldHired = gameState.hiredDrivers.find(h => h.id === truck.driverId);
                if (oldHired) oldHired.assignedTruckId = null;
            }

            truck.driverId = newDriverId;
            
            // Нового назначаем
            if (newDriverId) {
                const newHired = gameState.hiredDrivers.find(h => h.id === newDriverId);
                // Если он где-то был (теоретически), снимаем
                if (newHired.assignedTruckId && newHired.assignedTruckId !== truck.id) {
                     const oldTruck = gameState.vehicles.find(v => v.id === newHired.assignedTruckId);
                     if(oldTruck) oldTruck.driverId = null;
                }
                newHired.assignedTruckId = truck.id;
            }

            const event = new CustomEvent('show-notification', { detail: { message: `Водитель обновлен`, type: 'info' } });
            document.dispatchEvent(event);
            
            if (window.renderDetailViewGlobal) window.renderDetailViewGlobal();
        };
    },

    injectStyles() {
        if (document.getElementById('driver-css')) return;
        const style = document.createElement('style');
        style.id = 'driver-css';
        style.textContent = `
            .driver-ui-body { display: flex; flex-direction: column; gap: 15px; height: 100%; min-height: 400px; } 
            .driver-stats-panel { display: flex; gap: 20px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; flex-shrink: 0; }
            .driver-lists-container { display: flex; gap: 20px; flex: 1; overflow: hidden; min-height: 0; }
            .driver-column { flex: 1; display: flex; flex-direction: column; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px; min-width: 0; }
            .driver-column h4 { margin-top: 0; margin-bottom: 10px; color: #cbd5e0; flex-shrink: 0; }
            .drivers-grid { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; padding-right: 5px; }
            .driver-card { background: #2d3748; border: 1px solid #4a5568; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 320px; position: relative; }
            .driver-card.rare { border-color: #4299e1; }
            .driver-card.epic { border-color: #9f7aea; box-shadow: 0 0 5px rgba(159, 122, 234, 0.5); }
            .driver-card.legendary { border-color: #ecc94b; box-shadow: 0 0 8px rgba(236, 201, 75, 0.6); }
            .driver-img-container { position: relative; width: 100%; height: 150px; background: #000; flex-shrink: 0; }
            .driver-img-container img { width: 100%; height: 100%; object-fit: cover; }
            .driver-rarity-badge { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); padding: 2px 6px; font-size: 10px; border-radius: 4px; font-weight: bold; }
            .driver-info { padding: 10px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
            .driver-name { font-weight: bold; font-size: 1.05em; line-height: 1.2; }
            .driver-desc { font-size: 0.8em; color: #a0aec0; font-style: italic; line-height: 1.3; }
            .driver-bonuses { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
            .bonus-tag { font-size: 0.75em; padding: 2px 4px; border-radius: 3px; background: #2d3748; border: 1px solid #555; }
            .bonus-tag.speed { color: #63b3ed; }
            .bonus-tag.capacity { color: #f6e05e; }
            .driver-status { font-size: 0.85em; margin-top: auto; padding-top: 8px; font-weight: 500; }
            .driver-status.hireable { color: #68d391; }
            .driver-status.busy { color: #f6ad55; }
            .driver-status.free { color: #63b3ed; }
            .driver-actions { margin-top: 8px; }
            .driver-btn { width: 100%; padding: 8px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
            .hire-btn { background: #48bb78; color: #fff; }
            .hire-btn:hover { background: #38a169; transform: translateY(-1px); }
            .fire-btn { background: #e53e3e; color: #fff; }
            .fire-btn:hover { background: #c53030; transform: translateY(-1px); }
            .disabled { background: #4a5568; color: #a0aec0; cursor: not-allowed; border: 1px solid #2d3748; }
            
            .driver-selector-area { margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; border: 1px solid #4a5568; }
            .driver-assign-box { display: flex; align-items: center; gap: 15px; margin-top: 5px; }
            .current-driver-info { display: flex; align-items: center; gap: 10px; flex: 1; }
            .mini-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #718096; }
            .assign-controls { display: flex; flex-direction: column; gap: 5px; }
            .assign-controls select { background: #2d3748; color: white; border: 1px solid #4a5568; padding: 5px; max-width: 150px; }
            .assign-controls button { background: #3182ce; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer; }
        `;
        document.head.appendChild(style);
    }
};

window.DriverSystem = DriverSystem;