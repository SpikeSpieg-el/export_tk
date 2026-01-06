// handbook.js
const HandbookSystem = {
    init() {
        this.modal = document.getElementById('handbook-modal');
        this.content = document.getElementById('handbook-content');
        this.tabs = document.querySelectorAll('.handbook-tab');
        
        this.setupListeners();
    },

    setupListeners() {
        // Открытие
        document.getElementById('handbook-button')?.addEventListener('click', () => {
            this.open();
        });

        // Закрытие
        this.modal.querySelectorAll('.close-button').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Переключение вкладок
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.renderCategory(e.target.dataset.category);
            });
        });
    },

    open() {
        this.modal.style.display = 'flex';
        // По умолчанию открываем первую вкладку
        const activeTab = document.querySelector('.handbook-tab.active') || this.tabs[0];
        activeTab.click();
    },

    close() {
        this.modal.style.display = 'none';
    },

    renderCategory(category) {
        this.content.innerHTML = '';
        
        if (category === 'resources') {
            this.renderResources();
        } else if (category === 'buildings') {
            this.renderBuildings();
        }
    },

    // === РЕНДЕР РЕСУРСОВ ===
    renderResources() {
        const grid = document.createElement('div');
        grid.className = 'handbook-grid';

        // Группировка по категориям из data.json (raw, processed и т.д.)
        const grouped = {};
        Object.entries(window.RESOURCES).forEach(([key, res]) => {
            if(key === 'grass') return; // Скрываем траву
            const cat = res.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ key, ...res });
        });

        // Порядок категорий
        const order = ['raw', 'processed', 'components', 'advanced', 'hightech'];
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        sortedKeys.forEach(cat => {
            // Заголовок категории
            const header = document.createElement('h4');
            header.className = 'handbook-section-title';
            header.textContent = this.getCategoryName(cat);
            grid.appendChild(header);

            grouped[cat].forEach(res => {
                const card = document.createElement('div');
                card.className = 'handbook-card';
                
                // Поиск: Где производится?
                const producedIn = [];
                Object.entries(window.BUILDING_BLUEPRINTS).forEach(([bKey, bVal]) => {
                    if (bVal.production?.outputs?.[res.key] || (bVal.category === 'extraction' && bVal.resourceType === res.key)) {
                        producedIn.push({ ...bVal, key: bKey });
                    }
                });

                // Поиск: Где используется?
                const usedIn = [];
                Object.entries(window.BUILDING_BLUEPRINTS).forEach(([bKey, bVal]) => {
                    if (bVal.consumption?.[res.key]) {
                        usedIn.push({ ...bVal, key: bKey });
                    }
                });

                const iconHtml = window.getIconHTML(res.emoji, res.key);

                card.innerHTML = `
                    <div class="hb-card-header">
                        <div class="hb-icon-large">${iconHtml}</div>
                        <div class="hb-title">
                            <div class="hb-name">${res.name}</div>
                            <div class="hb-price" title="Базовая цена экспорта">💰 ${res.baseExportPrice}$</div>
                        </div>
                    </div>
                    <div class="hb-details">
                        <div class="hb-row">
                            <span class="hb-label">Производится в:</span>
                            <div class="hb-tags">
                                ${producedIn.length ? producedIn.map(b => `
                                    <span class="hb-tag prod">${window.getIconHTML(b.emoji, b.key)} ${b.name}</span>
                                `).join('') : '<span class="hb-tag none">Природный ресурс</span>'}
                            </div>
                        </div>
                        <div class="hb-row">
                            <span class="hb-label">Используется в:</span>
                            <div class="hb-tags">
                                ${usedIn.length ? usedIn.map(b => `
                                    <span class="hb-tag cons">${window.getIconHTML(b.emoji, b.key)} ${b.name}</span>
                                `).join('') : '<span class="hb-tag none">Только экспорт</span>'}
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        });

        this.content.appendChild(grid);
    },

    // === РЕНДЕР ЗДАНИЙ ===
    renderBuildings() {
        const grid = document.createElement('div');
        grid.className = 'handbook-grid';

        // Группировка
        const grouped = {};
        Object.entries(window.BUILDING_BLUEPRINTS).forEach(([key, build]) => {
            if(key === 'residential_house') return; 
            const cat = build.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ key, ...build });
        });

        const order = ['extraction', 'power', 'processing', 'manufacturing', 'advanced', 'hightech', 'logistics'];
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
             const ia = order.indexOf(a);
             const ib = order.indexOf(b);
             return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        sortedKeys.forEach(cat => {
            const header = document.createElement('h4');
            header.className = 'handbook-section-title';
            header.textContent = this.getCategoryName(cat);
            grid.appendChild(header);

            grouped[cat].forEach(build => {
                const card = document.createElement('div');
                card.className = 'handbook-card building-card';

                // Входы
                let inputsHtml = '';
                if (build.consumption) {
                    inputsHtml = Object.entries(build.consumption).map(([rKey, amt]) => {
                        if (rKey === 'power') return `<span class="hb-res-item power">⚡ ${amt}</span>`;
                        const r = window.RESOURCES[rKey];
                        return `<span class="hb-res-item">${window.getIconHTML(r?.emoji, rKey)} ${r?.name} x${amt}</span>`;
                    }).join('');
                }

                // Выходы
                let outputsHtml = '';
                if (build.production?.outputs) {
                    outputsHtml = Object.entries(build.production.outputs).map(([rKey, amt]) => {
                         if (rKey === 'power') return `<span class="hb-res-item power">⚡ ${amt}</span>`;
                         const r = window.RESOURCES[rKey];
                         return `<span class="hb-res-item">${window.getIconHTML(r?.emoji, rKey)} ${r?.name} x${amt}</span>`;
                    }).join('');
                }

                // Цена
                let costHtml = Object.entries(build.cost).map(([rKey, amt]) => {
                     if (rKey === 'money') return `<span class="hb-cost money">💰 ${amt}</span>`;
                     const r = window.RESOURCES[rKey];
                     return `<span class="hb-cost">${window.getIconHTML(r?.emoji, rKey)} ${amt}</span>`;
                }).join(' ');

                card.innerHTML = `
                     <div class="hb-card-header">
                        <div class="hb-icon-large building">${window.getIconHTML(build.emoji)}</div>
                        <div class="hb-title">
                            <div class="hb-name">${build.name}</div>
                            <div class="hb-desc">${build.description || ''}</div>
                        </div>
                    </div>
                    <div class="hb-details">
                        ${inputsHtml ? `
                        <div class="hb-recipe-row">
                            <span class="hb-mini-label">Вход:</span>
                            <div class="hb-res-list">${inputsHtml}</div>
                        </div>` : ''}
                        
                        ${outputsHtml ? `
                        <div class="hb-recipe-row">
                             <span class="hb-mini-label">Выход:</span>
                            <div class="hb-res-list">${outputsHtml}</div>
                        </div>` : ''}

                         <div class="hb-footer-row">
                            <span class="hb-mini-label">Цена:</span>
                            <div class="hb-cost-list">${costHtml}</div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        });

        this.content.appendChild(grid);
    },

    getCategoryName(cat) {
        const map = {
            'raw': 'Сырье', 'processed': 'Обработанные материалы', 'components': 'Компоненты',
            'advanced': 'Продвинутые', 'hightech': 'Хай-тек', 'extraction': 'Добыча',
            'power': 'Энергетика', 'processing': 'Переработка', 'manufacturing': 'Сборка',
            'logistics': 'Логистика'
        };
        return map[cat] || cat.toUpperCase();
    }
};

// Автозапуск при загрузке, но нужно вызвать init() в script.js
window.HandbookSystem = HandbookSystem;