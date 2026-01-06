/**
@file particles.js
@description Система визуальных эффектов.
v2.1: Добавлены следы от шин и оптимизированы эффекты ветряков.
*/
const ParticleSystem = {
particles: [],

// Конфигурация цветов и параметров
CONFIG: {
    GRAVITY: 150, 
    WIND_X: 30,   
    
    // Индустриальные эффекты
    SMOKE_COAL: 'rgba(80, 80, 80, [alpha])', 
    SMOKE_STEAM: 'rgba(220, 220, 220, [alpha])',
    SPARK_COLOR: 'rgba(255, 200, 50, [alpha])',
    
    // Эффекты для ветряков (Clean Energy)
    WIND_STREAK_COLOR: 'rgba(255, 255, 255, [alpha])', 
    LEAF_COLOR: 'rgba(104, 211, 145, [alpha])',         

    // Следы от шин
    TIRE_TRACK_COLOR: 'rgba(30, 30, 30, [alpha])',

    TEXT_MONEY: '#48bb78',
    TEXT_ITEM: '#ecc94b'
},

/**
 * Обновляет состояние всех частиц.
 */
update(dt) {
    // Фильтруем мертвые частицы
    this.particles = this.particles.filter(p => p.life > 0);

    this.particles.forEach(p => {
        p.life -= dt;
        
        // Базовое движение (если есть скорость)
        if (p.vx) p.x += p.vx * dt;
        if (p.vy) p.y += p.vy * dt;

        // --- ФИЗИКА ДЛЯ РАЗНЫХ ТИПОВ ---

        // 1. Искры (падают вниз)
        if (p.type === 'spark') {
            p.vy += this.CONFIG.GRAVITY * dt;
        }

        // 2. Дым (расширяется и замедляется)
        if (p.type === 'smoke') {
            p.size += 10 * dt; 
            p.vx += (Math.random() - 0.5) * 10 * dt; 
        }

        // 3. Листья (порхают по синусоиде)
        if (p.type === 'leaf') {
            p.y += Math.sin(p.life * 10) * 1.5; 
            p.vx -= 5 * dt; 
        }

        // 4. Текст (всплывает и тормозит)
        if (p.type === 'text' || p.type === 'icon') {
            p.vy *= 0.95; 
        }
        
        // 5. Следы от шин (не двигаются, просто существуют)
        if (p.type === 'tire_track') {
            // Можно добавить легкое расширение, если хочется эффекта пыли
            // p.size += 0.5 * dt;
        }
    });
},

/**
 * Рисует частицы.
 */
draw(ctx) {
    this.particles.forEach(p => {
        const lifeRatio = p.life / p.maxLife;
        const alpha = Math.max(0, lifeRatio); 
        
        ctx.save();
        
        // --- СЛЕДЫ ОТ ШИН ---
        if (p.type === 'tire_track') {
            // Они должны быть под всем остальным, но Canvas рисует по порядку.
            // alpha * 0.3 делает их полупрозрачными черными следами
            ctx.globalAlpha = alpha * 0.3; 
            ctx.fillStyle = this.CONFIG.TIRE_TRACK_COLOR.replace('[alpha]', 1);
            
            // Рисуем прямоугольник или круг, повернутый по углу движения
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle || 0);
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        }
        // --- ПОТОКИ ВЕТРА ---
        else if (p.type === 'wind_streak') {
            ctx.globalAlpha = alpha * 0.15; // Очень прозрачные
            ctx.strokeStyle = this.CONFIG.WIND_STREAK_COLOR.replace('[alpha]', 1);
            ctx.lineWidth = p.size;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            const tailLength = p.vx * 0.15;
            ctx.lineTo(p.x - tailLength, p.y);
            ctx.stroke();
        }
        // --- ЛИСТЬЯ ---
        else if (p.type === 'leaf') {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.CONFIG.LEAF_COLOR.replace('[alpha]', 1);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.size, p.size / 2, p.life * 5, 0, Math.PI * 2);
            ctx.fill();
        }
        // --- ТЕКСТ ---
        else if (p.type === 'text') {
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${p.size}px sans-serif`;
            ctx.fillStyle = p.color;
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillText(p.text, p.x, p.y);
        } 
        // --- ИКОНКИ ---
        else if (p.type === 'icon') {
            ctx.globalAlpha = alpha;
            ctx.font = `${p.size}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 4;
            ctx.fillText(p.text, p.x, p.y);
        }
        // --- ДЫМ ---
        else if (p.type === 'smoke') {
            const color = p.color.replace('[alpha]', alpha * 0.7); 
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        } 
        // --- ИСКРЫ ---
        else if (p.type === 'spark') {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.CONFIG.SPARK_COLOR.replace('[alpha]', 1); 
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }

        ctx.restore();
    });
},

// --- ГЕНЕРАТОРЫ ---

/**
 * Создает две полоски следов позади движения.
 * @param {number} x - Текущая X координата центра машины
 * @param {number} y - Текущая Y координата центра машины
 * @param {number} angle - Угол движения в радианах
 */
emitTireTracks(x, y, angle) {
    // Смещение назад (чтобы следы были у задних колес)
    // Допустим, длина грузовика ~40px, смещаем на 15px назад
    const backOffset = 12;
    const widthOffset = 7; // Половина ширины колесной базы

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Центр задней оси
    const backX = x - cos * backOffset;
    const backY = y - sin * backOffset;

    // Координаты левого колеса (перпендикулярно движению)
    const leftX = backX + sin * widthOffset;
    const leftY = backY - cos * widthOffset;

    // Координаты правого колеса
    const rightX = backX - sin * widthOffset;
    const rightY = backY + cos * widthOffset;

    // Добавляем частицы (они не двигаются, vx=0, vy=0)
    const createTrack = (tx, ty) => ({
        type: 'tire_track',
        x: tx,
        y: ty,
        vx: 0,
        vy: 0,
        life: 2.0,    // След держится 2 секунды
        maxLife: 2.0,
        size: 3,      // Толщина следа
        angle: angle  // Для поворота прямоугольника частицы
    });

    this.particles.push(createTrack(leftX, leftY));
    this.particles.push(createTrack(rightX, rightY));
},

emitSmoke(x, y, isDark = false) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5); 
    const speed = 20 + Math.random() * 30;
    this.particles.push({
        type: 'smoke',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed + this.CONFIG.WIND_X,
        vy: Math.sin(angle) * speed,
        life: 1.5 + Math.random() * 1.5,
        maxLife: 3,
        size: 12 + Math.random() * 8, 
        color: isDark ? this.CONFIG.SMOKE_COAL : this.CONFIG.SMOKE_STEAM
    });
},

emitSparks(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2; 
        const speed = 60 + Math.random() * 80;
        this.particles.push({
            type: 'spark',
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.4 + Math.random() * 0.4,
            maxLife: 0.8,
            size: 4 + Math.random() * 3,
            color: '' 
        });
    }
},

emitWind(x, y) {
    // Уменьшенная скорость ветра
    const speed = 90 + Math.random() * 30; 
    this.particles.push({
        type: 'wind_streak',
        x: x - 40,
        y: y + (Math.random() - 0.5) * 60,
        vx: speed,
        vy: (Math.random() - 0.5) * 10,
        life: 0.8,
        maxLife: 0.8,
        size: 2 + Math.random() * 2
    });
},

emitLeaves(x, y) {
    this.particles.push({
        type: 'leaf',
        x: x - 40,
        y: y + (Math.random() - 0.5) * 50,
        vx: 80 + Math.random() * 20,
        vy: 20 + Math.random() * 10,
        life: 2.0,
        maxLife: 2.0,
        size: 3 + Math.random() * 3
    });
},

emitFloatingText(x, y, text, color = '#fff') {
    this.particles.push({
        type: 'text',
        x: x, y: y - 20, vx: 0, vy: -40,
        life: 2.0, maxLife: 2.0, size: 24, text: text, color: color
    });
},

emitFloatingIcon(x, y, emoji) {
    this.particles.push({
        type: 'icon',
        x: x + (Math.random() - 0.5) * 20, y: y - 20,
        vx: (Math.random() - 0.5) * 15, vy: -30 - Math.random() * 15,
        life: 1.5, maxLife: 1.5, size: 28, text: emoji
    });
},

/**
 * ЛОГИКА ЭФФЕКТОВ ЗДАНИЙ
 */
processBuildingEffects(building, blueprint, worldPos) {
    if (!building || !blueprint) return;

    // 1. ВЕТРЯКИ (Сниженная интенсивность)
    if (building.type === 'wind_power_plant') {
        if (Math.random() < 0.03) { // 3% шанс
            this.emitWind(worldPos.x, worldPos.y);
        }
        if (Math.random() < 0.005) { // 0.5% шанс
            this.emitLeaves(worldPos.x, worldPos.y);
        }
        return;
    }

    // 2. Дым (Остальные)
    if (blueprint.category === 'power' || blueprint.category === 'processing') {
        if (Math.random() < 0.05) { 
            const isCoal = building.type === 'coal_power_plant' || building.type === 'steel_smelter';
            const offsetX = (Math.random() - 0.5) * 10;
            const offsetY = -(blueprint.tileHeight * 64 * 0.3);
            this.emitSmoke(worldPos.x + offsetX, worldPos.y + offsetY, isCoal);
        }
    }

    // 3. Искры
    if (building.type === 'steel_smelter' || building.type === 'wire_mill' || building.type === 'robotics_factory') {
        if (Math.random() < 0.03) {
            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;
            this.emitSparks(worldPos.x + offsetX, worldPos.y + offsetY);
        }
    }
},

/**
 * ЛОГИКА ЭФФЕКТОВ ТРАНСПОРТА
 * Вызывается из основного цикла игры для каждого грузовика
 */
processVehicleEffects(vehicle) {
    // Эффект только если машина едет
    const movingStates = ['GOING_TO_PICKUP', 'GOING_TO_DROPOFF', 'RETURNING_TO_BASE'];
    if (!movingStates.includes(vehicle.state)) return;

    // Не спамим следами каждый кадр, делаем промежутки
    // Используем случайность как простой таймер (30% шанс на кадр)
    if (Math.random() > 0.3) return;

    let targetPos = null;
    if (vehicle.state === 'RETURNING_TO_BASE') targetPos = vehicle.ownerGaragePos;
    else if (vehicle.state === 'GOING_TO_PICKUP') targetPos = vehicle.pickupTargetPos;
    else targetPos = vehicle.dropoffTargetPos;

    if (targetPos) {
        const dx = targetPos.x - vehicle.x;
        const dy = targetPos.y - vehicle.y;
        // Рисуем следы только если машина реально двигается
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            const angle = Math.atan2(dy, dx);
            this.emitTireTracks(vehicle.x, vehicle.y, angle);
        }
    }
}
};
window.ParticleSystem = ParticleSystem;