/**
 * @file power_grid.js
 * @description Система распределения электроэнергии v2 (Лимиты и скрытие).
 */

const PowerGridSystem = {
    isOverlayActive: false,
    dragStartBuildingId: null,
    mousePos: { x: 0, y: 0 },
    // Получить статистику сети, к которой подключено здание
    getNetworkStats(buildingId) {
        // Ищем сеть, в списке зданий которой есть наш ID
        const network = this.networks.find(net => net.buildings.some(b => b.id === buildingId));
        
        if (!network) {
            // Если здание не в сети (одиночка), возвращаем нули или null
            return null;
        }

        return {
            totalGen: network.totalGen,
            totalCons: network.totalCons,
            deviceCount: network.buildings.length
        };
    },
    // Лимит подключений на одно здание
    MAX_CONNECTIONS: 3,

    // Кеш состояния
    poweredBuildings: new Set(),
    networks: [],

    init(gameState) {
        if (!gameState.cables) {
            gameState.cables = []; 
        }
        console.log("Power Grid System initialized (Max connections: 3)");
    },

    toggleOverlay() {
        this.isOverlayActive = !this.isOverlayActive;
        const btn = document.getElementById('power-grid-btn');
        if (btn) btn.classList.toggle('active', this.isOverlayActive);
        
        if (!this.isOverlayActive) {
            this.dragStartBuildingId = null;
        }
        
        // Уведомление
        const msg = this.isOverlayActive ? "Режим электросетей: ВКЛЮЧЕН" : "Режим электросетей: ВЫКЛЮЧЕН";
        const event = new CustomEvent('show-notification', { detail: { message: msg, type: 'info' } });
        document.dispatchEvent(event);
    },

    update(gameState) {
        this.poweredBuildings.clear();
        this.networks = [];

        // 1. Строим граф
        const adj = {};
        gameState.buildings.forEach(b => adj[b.id] = []);
        gameState.cables.forEach(cable => {
            if (!adj[cable.from]) adj[cable.from] = [];
            if (!adj[cable.to]) adj[cable.to] = [];
            
            adj[cable.from].push(cable.to);
            adj[cable.to].push(cable.from);
        });
         if (gameState.cables) {
            const initialCount = gameState.cables.length;
            gameState.cables = gameState.cables.filter(c => 
                gameState.buildings.some(b => b.id === c.from) && 
                gameState.buildings.some(b => b.id === c.to)
            );
            // Если удалили битый провод, можно вывести лог в консоль
            if (gameState.cables.length < initialCount) {
                console.log(`PowerGrid: Removed ${initialCount - gameState.cables.length} ghost cables.`);
            }
        } 
        this.poweredBuildings.clear();
        this.networks = [];

        // 2. Источники
        const generators = gameState.buildings.filter(b => {
            const bp = window.BUILDING_BLUEPRINTS[b.type];
            const isPowerPlant = bp.category === 'power';
            // Генератор работает, если нет флага ошибки (например, кончился уголь)
            const isWorking = !b.statusFlags || !b.statusFlags.includes('no_power') && !b.statusFlags.includes('no_resources'); 
            return isPowerPlant && isWorking;
        });

        // 3. Расчет сетей (BFS)
        const visited = new Set();
        
        gameState.buildings.forEach(startNode => {
            if (visited.has(startNode.id)) return;

            const network = {
                buildings: [],
                totalGen: 0,
                totalCons: 0
            };

            const queue = [startNode.id];
            visited.add(startNode.id);

            while(queue.length > 0) {
                const currentId = queue.shift();
                const building = gameState.buildings.find(b => b.id === currentId);
                if (!building) continue;

                network.buildings.push(building);
                
                const bp = window.BUILDING_BLUEPRINTS[building.type];
                
               if (generators.includes(building)) {
                let output = bp.production.outputs.power || 0;
    
                // Применяем бафф (обычно тип 'output' для электростанций)
                if (window.WorkerSystem) {
                    const stats = window.WorkerSystem.getBuffStats(building);
                    output *= stats.multiplier;
                }
    
                network.totalGen += output;
}
                
                if (bp.consumption && bp.consumption.power) {
                    network.totalCons += bp.consumption.power;
                }

                const neighbors = adj[currentId] || [];
                neighbors.forEach(nId => {
                    if (!visited.has(nId)) {
                        visited.add(nId);
                        queue.push(nId);
                    }
                });
            }

            this.networks.push(network);
        });


        
        let uiTotalGen = 0;
        let uiTotalCons = 0;

        // 4. Распределение энергии
        this.networks.forEach(net => {
            const powerMult = gameState.config?.powerConsumptionMultiplier || 1.0;
            const required = net.totalCons * powerMult;

            // Если в этой конкретной сети есть генерация
            if (net.totalGen > 0) {
                // Добавляем в общую статистику интерфейса только АКТИВНЫЕ сети
                uiTotalGen += net.totalGen;
                uiTotalCons += required;

                // Если энергии хватает на всех
                if (net.totalGen >= required) {
                    net.buildings.forEach(b => this.poweredBuildings.add(b.id));
                }
            }
            // Если сеть без генератора (net.totalGen === 0), мы НЕ добавляем её потребление в uiTotalCons.
            // Иначе цифры в интерфейсе будут пугать игрока.
        });
        
        // Обновляем UI правильными числами
        gameState.power.current = uiTotalCons;
        gameState.power.capacity = uiTotalGen;
    },

    hasPower(buildingId) {
        return this.poweredBuildings.has(buildingId);
    },

    // Подсчет текущих соединений у здания
    getConnectionCount(gameState, buildingId) {
        return gameState.cables.filter(c => c.from === buildingId || c.to === buildingId).length;
    },

    // ЛЕВЫЙ КЛИК (Создание)
    handleClick(worldPos, gameState) {
        if (!this.isOverlayActive) return false;

        const clickedBuilding = gameState.buildings.find(b => {
            const pos = window.getBuildingAnchorWorldPos(b);
            const dist = Math.hypot(pos.x - worldPos.x, pos.y - worldPos.y);
            return dist < 45; 
        });

        if (clickedBuilding) {
            const bp = window.BUILDING_BLUEPRINTS[clickedBuilding.type];
            // Можно подключать только то, что потребляет или дает энергию
            if (!bp.production?.outputs?.power && !bp.consumption?.power) {
                 this.notify("Это здание не требует электричества", "error");
                 return true;
            }

            if (this.dragStartBuildingId === null) {
                // Старт тяги
                this.dragStartBuildingId = clickedBuilding.id;
            } else {
                // Конец тяги
                if (this.dragStartBuildingId !== clickedBuilding.id) {
                    this.tryAddCable(gameState, this.dragStartBuildingId, clickedBuilding.id);
                }
                this.dragStartBuildingId = null;
            }
            return true;
        } else {
            this.dragStartBuildingId = null;
        }
        return false;
    },
    
    // ПРАВЫЙ КЛИК (Удаление)
    handleRightClick(worldPos, gameState) {
        if (!this.isOverlayActive) return false;

        const threshold = 15; // Дистанция клика до провода
        
        const idx = gameState.cables.findIndex(c => {
            const b1 = gameState.buildings.find(b => b.id === c.from);
            const b2 = gameState.buildings.find(b => b.id === c.to);
            if (!b1 || !b2) return false; 
            
            const p1 = window.getBuildingAnchorWorldPos(b1);
            const p2 = window.getBuildingAnchorWorldPos(b2);
            
            return pointToLineDistance(worldPos, p1, p2) < threshold;
        });

        if (idx !== -1) {
            gameState.cables.splice(idx, 1);
            this.notify("Провод удален", "info");
            return true;
        }
        
        // Сброс тяги, если нажали правой кнопкой во время прокладки
        if (this.dragStartBuildingId) {
            this.dragStartBuildingId = null;
            return true;
        }

        return false;
    },

    tryAddCable(gameState, id1, id2) {
        // 1. Проверка дубликатов
        const exists = gameState.cables.some(c => 
            (c.from === id1 && c.to === id2) || (c.from === id2 && c.to === id1)
        );
        if (exists) {
            this.notify("Линия уже существует", "error");
            return;
        }

        // 2. Проверка лимитов (Максимум 3 подключения)
        const count1 = this.getConnectionCount(gameState, id1);
        const count2 = this.getConnectionCount(gameState, id2);

        if (count1 >= this.MAX_CONNECTIONS) {
            this.notify("Источник перегружен (макс. 3 соединения)!", "error");
            return;
        }
        if (count2 >= this.MAX_CONNECTIONS) {
            this.notify("Цель перегружена (макс. 3 соединения)!", "error");
            return;
        }

        // 3. Создание
        gameState.cables.push({ from: id1, to: id2 });
        
        // Звуковой эффект можно добавить тут
    },

    draw(ctx, gameState, camera) {
        // Рисуем только если режим включен
        if (!this.isOverlayActive) return;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Рисуем провода
        gameState.cables.forEach(cable => {
            const b1 = gameState.buildings.find(b => b.id === cable.from);
            const b2 = gameState.buildings.find(b => b.id === cable.to);
            if (!b1 || !b2) return;

            const p1 = window.getBuildingAnchorWorldPos(b1);
            const p2 = window.getBuildingAnchorWorldPos(b2);

            // Провод светится желтым только если ОБА здания под напряжением
            const isPowered = this.hasPower(b1.id) && this.hasPower(b2.id);
            
            ctx.strokeStyle = isPowered ? '#f6e05e' : '#2d3748'; // Желтый или темный
            ctx.lineWidth = isPowered ? 4 : 2;
            
            // Отрисовка черной подложки для видимости
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        });

        // Рисуем коннекторы (пины)
        gameState.buildings.forEach(b => {
            const bp = window.BUILDING_BLUEPRINTS[b.type];
            if (bp.production?.outputs?.power || bp.consumption?.power) {
                const pos = window.getBuildingAnchorWorldPos(b);
                const connections = this.getConnectionCount(gameState, b.id);
                
                // Цвет: Зеленый (есть место), Красный (забит), Синий (обычный)
                let color = '#3182ce';
                if (connections >= this.MAX_CONNECTIONS) color = '#e53e3e';
                else if (b.id === this.dragStartBuildingId) color = '#48bb78';

                // Круг коннектора
                ctx.fillStyle = color;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 8 / camera.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Отображение кол-ва соединений (мелким текстом)
                if (camera.zoom > 0.8) {
                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${10 / camera.zoom}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${connections}/${this.MAX_CONNECTIONS}`, pos.x, pos.y + 20/camera.zoom);
                }
            }
        });

        // Рисуем "резинку" при перетаскивании
        if (this.dragStartBuildingId) {
            const startB = gameState.buildings.find(b => b.id === this.dragStartBuildingId);
            if (startB) {
                const p1 = window.getBuildingAnchorWorldPos(startB);
                const mouseWorld = this.mousePos;

                ctx.strokeStyle = '#48bb78';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(mouseWorld.x, mouseWorld.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    },

    notify(msg, type) {
        const event = new CustomEvent('show-notification', { detail: { message: msg, type: type } });
        document.dispatchEvent(event);
    }
};

// Хелпер
function pointToLineDistance(point, v, w) {
  const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
  if (l2 === 0) return Math.hypot(point.x - v.x, point.y - v.y);
  let t = ((point.x - v.x) * (w.x - v.x) + (point.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(point.x - projX, point.y - projY);
}

window.PowerGridSystem = PowerGridSystem;