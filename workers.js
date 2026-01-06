/**
 * @file workers.js
 * @description Система сотрудников v2: Уникальные баффы.
 */

const WorkerSystem = {
    CONFIG: {
        MAX_PER_BUILDING: 10,
        INTERN_SALARY: 5,
        WORKER_SALARY: 10
    },
    

    initialize(gameState) {
        if (!gameState || !Array.isArray(gameState.buildings)) return;
        gameState.buildings.forEach(b => {
            this.ensureBuildingWorkers(b);
        });
        console.log("Worker System initialized with Buffs.");
    },
    

    ensureBuildingWorkers(building) {
        if (!building) return;
        if (building.type === 'residential_house') return;

        // 1. Ищем настройки этого типа здания
        const blueprint = window.BUILDING_BLUEPRINTS[building.type];
        
        // 2. Определяем зарплату: если в конфиге указана workerSalary, берем её, иначе стандартную (5)
        const salary = (blueprint && blueprint.workerSalary) ? blueprint.workerSalary : this.CONFIG.INTERN_SALARY;

        if (!building.workers) {
            // Если объект работников создается впервые
            building.workers = {
                count: 1, 
                max: this.CONFIG.MAX_PER_BUILDING,
                salaryPerWorker: salary // Записываем индивидуальную зарплату
            };
        } else {
            // Если объект уже есть (загрузка сохранения), ОБНОВЛЯЕМ зарплату
            // Это важно, чтобы изменения баланса применились к уже построенным зданиям
            building.workers.salaryPerWorker = salary;
            building.workers.max = this.CONFIG.MAX_PER_BUILDING;
            if (building.workers.count < 1) building.workers.count = 1;
        }
    },

    setWorkersForBuilding(gameState, buildingId, newCount) {
        const building = gameState.buildings.find(b => b.id === buildingId);
        if (!building) return;
        this.ensureBuildingWorkers(building);
        
        let value = Math.floor(newCount || 1);
        if (value < 1) value = 1;
        if (value > this.CONFIG.MAX_PER_BUILDING) value = this.CONFIG.MAX_PER_BUILDING;
        
        building.workers.count = value;
    },

    /**
     * Возвращает текущий множитель и описание баффа для здания.
     * @returns {Object} { multiplier: number, type: string, description: string }
     */
    getBuffStats(building) {
        this.ensureBuildingWorkers(building);
        if (!building.workers) return { multiplier: 1.0, type: 'none', text: 'Нет эффекта' };

        // Берем конфиг из глобального data.json или fallback
        const buffsConfig = window.data?.WORKER_BUFF_CONFIG || window.WORKER_BUFF_CONFIG || {};
        const config = buffsConfig[building.type];

        // Базовый множитель = 1.0. Каждый работник добавляет val.
        // Пример: 5 работников, val 0.10 (10%) -> 1.0 + (5 * 0.10) = 1.5x
        
        if (!config) return { multiplier: 1.0, type: 'none', text: 'Нет бонуса' };

        // Если это радиус (абсолютное значение), формула другая
        if (config.type === 'radius') {
            const bonusPixels = building.workers.count * config.val;
            return {
                multiplier: 1.0, // Множитель производства не меняется
                absoluteBonus: bonusPixels,
                type: config.type,
                text: `${config.desc}: +${bonusPixels}${config.unit}`
            };
        }
         // ЛОГИКА ДЛЯ ВМЕСТИМОСТИ (СКЛАД)
        if (config.type === 'capacity') {
            const bonusCapacity = building.workers.count * config.val;
            return {
                multiplier: 1.0,
                absoluteBonus: bonusCapacity,
                type: 'capacity',
                text: `${config.desc}: +${bonusCapacity}`
            };
        }

        // Для процентов (speed, output, efficiency)
        const bonus = building.workers.count * config.val;
        const multiplier = 1.0 + bonus;
        
        return {
            multiplier: multiplier,
            type: config.type,
            text: `${config.desc}: +${(bonus * 100).toFixed(0)}${config.unit}`
        };
    },

    calculateTotalSalaryPreview(gameState) {
        if (!gameState || !Array.isArray(gameState.buildings)) return 0;
        let total = 0;
        gameState.buildings.forEach(b => {
            if (b.type === 'residential_house') return;
            this.ensureBuildingWorkers(b);
            const w = b.workers;
            if (!w) return;
            total += (w.count || 0) * (w.salaryPerWorker || this.CONFIG.INTERN_SALARY);
        });
        return total;
    },
    

    processSalaries(gameState) {
        const totalSalary = this.calculateTotalSalaryPreview(gameState);
        if (!gameState || totalSalary <= 0) return 0;
        gameState.money -= totalSalary;
        
        const event = new CustomEvent('show-notification', {
            detail: { message: `Зарплата сотрудников: -${Math.floor(totalSalary)}$`, type: 'info' }
        });
        document.dispatchEvent(event);

        if (window.recordMoneyTransaction) {
            window.recordMoneyTransaction(-totalSalary, 'Зарплата персонала (1.5 мин)');
        }
        return totalSalary;
    }
    
};

window.WorkerSystem = WorkerSystem;