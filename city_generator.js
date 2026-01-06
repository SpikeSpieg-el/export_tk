// city_generator.js
const CityGenerator = {
    /**
     * Генерирует небольшой город (3-6 домов) на карте.
     * @param {object} gameState - Состояние игры.
     * @param {number} GRID_WIDTH - Ширина сетки.
     * @param {number} GRID_HEIGHT - Высота сетки.
     */
    generate(gameState, GRID_WIDTH, GRID_HEIGHT) {
        console.log("Генерация города...");

        // 1. Определяем количество домов (от 3 до 6)
        const houseCount = Math.floor(Math.random() * 4) + 3;

        // 2. Ищем подходящее место (центр города)
        // Пытаемся найти место, где нет важных ресурсов (угля, железа и т.д.), только трава
        let centerX = -1;
        let centerY = -1;
        let foundSpot = false;

        // Делаем до 50 попыток найти поляну
        for (let attempt = 0; attempt < 50; attempt++) {
            const r = Math.floor(Math.random() * (GRID_HEIGHT - 10)) + 5;
            const c = Math.floor(Math.random() * (GRID_WIDTH - 10)) + 5;
            const index = r * GRID_WIDTH + c;
            const cell = gameState.grid[index];

            // Проверяем центр и небольшую область вокруг
            if (!cell.building && (!cell.resource || cell.resource === 'grass')) {
                // Простая проверка: свободно ли место
                foundSpot = true;
                centerX = c;
                centerY = r;
                break;
            }
        }

        if (!foundSpot) {
            console.warn("Не удалось найти место для города.");
            return;
        }

        // 3. Паттерн размещения (смещения относительно центра)
        // Чтобы дома стояли кучкой, а не линией
        const offsets = [
            {x:0, y:0}, {x:1, y:0}, {x:0, y:1}, {x:1, y:1},
            {x:-1, y:0}, {x:0, y:-1}, {x:-1, y:1}, {x:-1, y:-1},
            {x:2, y:0}, {x:0, y:2} 
        ];

        let housesPlaced = 0;

        for (let i = 0; i < offsets.length; i++) {
            if (housesPlaced >= houseCount) break;

            const offset = offsets[i];
            const r = centerY + offset.y;
            const c = centerX + offset.x;
            
            // Проверка границ карты
            if (r < 0 || r >= GRID_HEIGHT || c < 0 || c >= GRID_WIDTH) continue;

            const idx = r * GRID_WIDTH + c;
            const cell = gameState.grid[idx];

            // Проверяем, что клетка свободна для строительства
            if (!cell.building && (!cell.resource || cell.resource === 'grass')) {
                
                // Создаем объект здания "Дом"
                const house = {
                    type: 'residential_house',
                    id: Date.now() + Math.random(), // Уникальный ID
                    gridIndex: idx,
                    inputBuffer: null, // Дома пока ничего не потребляют
                    outputBuffer: null
                };

                // Размещаем на сетке
                cell.building = house;
                gameState.buildings.push(house);
                
                // Удаляем траву под домом для чистоты
                if (cell.resource === 'grass') {
                    cell.resource = null;
                }

                housesPlaced++;
            }
        }

        console.log(`Город построен: ${housesPlaced} домов в координатах [${centerX}, ${centerY}]`);
    }
};