/**
 * @file tutorial.js
 * @description Обновленная система обучения "Советник" с поддержкой Электросетей.
 * v4.1: Исправлено позиционирование окна при прокладке кабелей.
 */

(function () {
    const TUTORIAL_STORAGE_KEY = 'ret_tutorial_completed_v4';
    
    let tutorialSteps = [];
    let currentIndex = 0;
    let stepProgress = 0; 
    let waitingClickHandler = null;
    let arrowEl = null;
    let conditionInterval = null; 

    function buildSteps() {
        tutorialSteps = [
            {
                id: 'intro',
                title: 'Добро пожаловать!',
                text: `Приветствую, директор! Я ваш **ИИ-ассистент**.
                
                Ваша задача — создать промышленную империю, экспортировать ресурсы и поддерживать жизнь города.
                
                Начнем с основ?`,
                target: null 
            },
            {
                id: 'camera',
                title: 'Навигация',
                text: `Осмотритесь на карте.
                
                • **Зажмите ЛКМ** для перемещения.
                • **Колесико** для масштаба.
                
                Найдите участок с **домами** 🏠.
                
                Нажмите на любой **Жилой дом**, чтобы продолжить.`,
                target: '#game-world', 
                waitFor: 'interaction' 
            },
            {
                id: 'open_build',
                title: 'Строительство',
                text: `Строительство будем начинать рядом с домами.
                
                Нам нужна энергия. Нажмите кнопку **"Строить"** (молоток), чтобы открыть меню.`,
                target: '#open-build-menu',
                waitFor: 'click'
            },
            {
                id: 'energy_tab',
                title: 'Вкладка Энергия',
                text: `Сначала электричество. В меню найдите вкладку **"Энергия"** или прокрутите вниз.`,
                target: '.build-tab-button[data-target="pane-power"]', 
                fallbackTarget: '#floating-build-menu',
                waitFor: 'click'
            },
            {
                id: 'build_wind',
                title: 'Ветряная ЭС',
                text: `Выберите **Ветряную ЭС** и постройте **3 штуки** в любом месте.
                
                Постарайтесь ставить их не слишком далеко друг от друга.`,
                target: '.build-button[data-building-type="wind_power_plant"]',
                waitFor: 'construction', 
                reqCount: 3 
            },
            {
                id: 'open_build_2',
                title: 'Добыча',
                text: `Отлично! Генераторы есть. Теперь добудем **древесину**.
                
                Снова откройте меню строительства.`,
                target: '#open-build-menu',
                waitFor: 'click'
            },
            {
                id: 'build_sawmill',
                title: 'Лесопилка',
                text: `Выберите **Лесопилку** (вкладка Добыча).
                
                **Важно:** Разместите её так, чтобы зеленая зона покрывала деревья!`,
                target: '.build-button[data-building-type="sawmill"]',
                waitFor: 'construction', 
                reqCount: 1
            },
            // === БЛОК: ЭЛЕКТРОСЕТИ ===
            {
                id: 'open_power_layer',
                title: 'Подключение энергии',
                text: `Здания не работают без электричества по воздуху!
                
                Нажмите кнопку **Режим электросетей** (значок вилки/штекера), чтобы увидеть разъемы.`,
                target: '#power-grid-btn',
                waitFor: 'click'
            },
            {
                id: 'connect_cable',
                title: 'Прокладка кабелей',
                text: `Видите цветные точки на зданиях? Это разъемы.
                
                1. Нажмите на **Ветряк**.
                2. Протяните линию к **Лесопилке**.
                3. Нажмите на Лесопилку, чтобы соединить.
                
                **Задача:** Подключите Лесопилку к любому Ветряку.`,
                target: '#game-world',
                // === ВАЖНО: Принудительно ставим окно слева, чтобы не мешать ===
                placement: 'force-left', 
                // Проверяем наличие проводов в глобальном состоянии
                customCheck: () => window.gameState && window.gameState.cables && window.gameState.cables.length > 0
            },
            {
                id: 'power_logic_info',
                title: 'Логика сети',
                text: `Отлично! Энергия пошла.
                
                **Важные правила:**
                • Одно здание может иметь **максимум 3 подключения**.
                • Вы можете соединять ветряки между собой, создавая единую сеть.
                • Если провод покраснел — сеть перегружена.`,
                target: null,
                placement: 'force-left'
            },
            {
                id: 'close_power_layer',
                title: 'Выход из режима',
                text: `Теперь, когда всё подключено, выключите режим электросетей, чтобы продолжить строительство.
                
                Нажмите на кнопку **Режим электросетей** снова.`,
                target: '#power-grid-btn',
                waitFor: 'click'
            },
            // ================================
            {
                id: 'open_build_hub',
                title: 'Логистика',
                text: `Ресурсы есть, энергия есть. Теперь нужно перевезти бревна.
                
                Откройте меню строительства.`,
                target: '#open-build-menu',
                waitFor: 'click'
            },
            {
                id: 'build_hub',
                title: 'Транспортный Хаб',
                text: `Постройте **Транспортный хаб** (вкладка Логистика).
                
                Это "мозг" вашей сети. Без него нельзя строить гаражи и склады.`,
                target: '.build-button[data-building-type="transport_hub"]',
                waitFor: 'construction',
                reqCount: 1
            },
            {
                id: 'build_hub2',
                title: 'Диспетчер',
                avatar: 'i_look/1_look_elf.png',
                text: `**Работаем в штатном режиме!**
                
                Отлично, хаб построен! Теперь я в сети.
                
                На кнопку **ESC** можно снять режим размещения новых построек.

                Наведитесь на хаб, нажмите и посмотрите **последние уведомления**.`,
                target: null 
            },
            {
                id: 'dispatcher_intro',
                title: 'Диспетчер',
                avatar: 'i_look/1_look_elf.png',
                text: `Я - ваш диспетчер!
                
                Теперь, когда хаб построен, мы можем продолжить организацию перевозок.`,
                target: null
            },
            {
                id: 'build_warehouse',
                title: 'Склад',
                text: `Теперь постройте **Склад**.
                
                Грузовики будут свозить ресурсы сюда перед отправкой в город.`,
                target: '.build-button[data-building-type="warehouse"]',
                waitFor: 'construction',
                reqCount: 1
            },
            {
                id: 'build_garage',
                title: 'Гараж',
                text: `И последнее: **Гараж**.
                
                Гараж создает 1 грузовик. Он автоматически начнет возить: Лес -> Склад.`,
                target: '.build-button[data-building-type="garage"]',
                waitFor: 'construction',
                reqCount: 1
            },
            {
                id: 'build_garage2',
                title: 'Водители',
                text: `Гараж даёт машину, а с ней и водителя **Стажёра**.
                
                У **Стажёра** есть зарплата (5$ каждые 1.5 мин). 
                
                Позже вы сможете построить **Общежитие** и нанять профи с бонусами.`,
                target: null
            },
            {
                id: 'open_logistics',
                title: 'Управление флотом',
                text: `Грузовики работают автоматически, но их можно настроить.
                
                Нажмите кнопку **Логистики** (грузовик), чтобы открыть панель управления.`,
                target: '#logistics-button',
                waitFor: 'click'
            },
            {
                id: 'explain_logistics',
                title: 'Настройка грузовика',
                text: `Это панель управления. 
                Убедитесь, что выбран **Автоматический режим**. 
                
                Здесь также можно привязать грузовик к конкретному Хабу для работы в его радиусе.`,
                target: '.mode-selector .mode-card:first-child', 
                waitFor: 'click'
            },
            {
                id: 'close_logistics',
                title: 'Закрытие меню',
                text: `Отлично, грузовик настроен!
                
                Теперь **закройте окно логистики**, нажав на крестик в углу окна.`,
                target: '#logistics-modal .close-button', 
                waitFor: 'click'
            },
            {
                id: 'city_contracts_intro',
                title: 'Городские контракты',
                text: `Посмотрите на **Панель Города** вверху.
                
                Город будет просить конкретные ресурсы (например, Доски или Уголь) с таймером.
                
                • **Выполнили:** Получили бонус к деньгам и настроению.
                • **Провалили:** Штраф и недовольство жителей.`,
                target: '.city-widget'
            },
            {
                id: 'city_contracts_types',
                title: 'Типы заказов',
                text: `Так же в игре присутствуют **сюжетные** и **сезонные** заказы (метки на карте).
                
                Чтобы их выполнить, грузовикам можно назначить режим **Сюжетные** или **Сезонные** заказы в меню логистики.`,
                target: null
            },
            {
                id: 'pro_tips',
                title: 'Стратегические советы',
                text: `Прежде чем я уйду, запомните:
                
                1. **Следите за Энергией:** Проверяйте подключения кабелей.
                2. **Лимиты:** Не цепляйте больше 3 проводов на одно здание.
                3. **Экспорт:** Кнопка 📦 откроет меню продажи излишков за границу.`,
                target: null
            },
            {
                id: 'finish',
                title: 'Вы готовы!',
                text: `Теперь управление полностью в ваших руках.
                
                Развивайтесь, стройте цепочки производства (Стекло, Сталь, Пластик) и сделайте этот город процветающим!
                
                Удачи, директор!`,
                target: null
            }
        ];
    }

    function createOverlayHTML() {
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.innerHTML = `
            <div class="tutorial-card" id="tutorial-card">
                <div class="tutorial-arrow" id="tutorial-arrow"></div>
                <div class="tutorial-header-modern">
                    <div class="tutorial-avatar">🤖</div>
                    <div class="tutorial-meta">
                        <h4 class="tutorial-title-modern" id="tut-title">Заголовок</h4>
                        <div class="tutorial-progress" id="tut-progress">Шаг 1 из 5</div>
                    </div>
                </div>
                <div class="tutorial-body-modern" id="tut-text">
                    Текст обучения...
                </div>
                <div class="tutorial-footer">
                    <span class="tutorial-skip-link" id="tut-skip">Пропустить</span>
                    <button class="tutorial-btn tutorial-btn-secondary" id="tut-back">Назад</button>
                    <button class="tutorial-btn tutorial-btn-primary" id="tut-next">Далее</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        arrowEl = document.getElementById('tutorial-arrow');
    }

    function getEls() {
        return {
            overlay: document.getElementById('tutorial-overlay'),
            card: document.getElementById('tutorial-card'),
            title: document.getElementById('tut-title'),
            text: document.getElementById('tut-text'),
            progress: document.getElementById('tut-progress'),
            nextBtn: document.getElementById('tut-next'),
            backBtn: document.getElementById('tut-back'),
            skipLink: document.getElementById('tut-skip'),
            arrow: document.getElementById('tutorial-arrow'),
            avatar: document.querySelector('.tutorial-avatar')
        };
    }

    function clearHighlight() {
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
        
        if (waitingClickHandler && waitingClickHandler.el) {
            waitingClickHandler.el.removeEventListener('click', waitingClickHandler.fn);
        }
        waitingClickHandler = null;
        
        if (conditionInterval) {
            clearInterval(conditionInterval);
            conditionInterval = null;
        }
    }

    function positionCard(step) {
        const els = getEls();
        const card = els.card;
        const arrow = els.arrow;
        
        // Сброс стилей
        card.style.left = '';
        card.style.top = '';
        card.style.bottom = '';
        card.style.right = '';
        card.style.transform = '';
        arrow.style.display = 'none';

        // === ПРИНУДИТЕЛЬНОЕ ПОЗИЦИОНИРОВАНИЕ (ДЛЯ КАБЕЛЕЙ) ===
        if (step.placement === 'force-left') {
            card.style.left = '20px';
            card.style.top = '50%';
            card.style.transform = 'translateY(-50%)'; // Центрирование по вертикали у левого края
            arrow.style.display = 'none';
            return;
        }

        let targetEl = null;
        if (step.target) targetEl = document.querySelector(step.target);
        if (!targetEl && step.fallbackTarget) targetEl = document.querySelector(step.fallbackTarget);

        if (targetEl && isElementVisible(targetEl)) {
            targetEl.classList.add('tutorial-highlight');
            arrow.style.display = 'block';

            const rect = targetEl.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            const margin = 15;

            const spaceRight = window.innerWidth - rect.right;
            
            if (step.target.includes('.build-button') || step.target.includes('menu')) {
                 card.style.left = `${rect.left - cardRect.width - margin}px`;
                 let top = rect.top + (rect.height / 2) - (cardRect.height / 2);
                 top = Math.max(10, Math.min(window.innerHeight - cardRect.height - 10, top));
                 card.style.top = `${top}px`;
                 
                 arrow.style.left = 'auto'; 
                 arrow.style.right = '-6px';
                 arrow.style.top = `${Math.min(cardRect.height - 20, Math.max(10, rect.top - top + rect.height/2 - 6))}px`;
                 arrow.style.transform = 'rotate(225deg)';
            } 
            else if (spaceRight > 340) {
                card.style.left = `${rect.right + margin}px`;
                card.style.top = `${Math.max(10, rect.top)}px`;
                arrow.style.left = '-6px';
                arrow.style.top = '20px';
                arrow.style.transform = 'rotate(45deg)';
            } 
            else {
                card.style.left = '50%';
                card.style.transform = 'translateX(-50%)';
                card.style.top = 'auto';
                card.style.bottom = '120px';
                arrow.style.display = 'none';
            }

        } else {
            card.style.left = '5%';
            card.style.transform = 'translateX(-50%)';
            card.style.top = 'auto';
            card.style.bottom = '300px';
        }
    }

    function isElementVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    }

    function renderCurrentStep() {
        if (!tutorialSteps.length) buildSteps();
        const step = tutorialSteps[currentIndex];
        const els = getEls();
        
        clearHighlight();

        if (stepProgress === undefined) stepProgress = 0;

        els.title.textContent = step.title;
        els.progress.textContent = `Шаг ${currentIndex + 1} из ${tutorialSteps.length}`;
        
        if (step.avatar) {
            els.avatar.innerHTML = `<img src="${step.avatar}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%;" />`;
        } else {
            els.avatar.textContent = '🤖';
        }
        
        let displayText = step.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
        
        if (step.reqCount && step.reqCount > 1) {
            displayText += `<br><br><span style="color: #60a5fa">Построено: ${stepProgress}/${step.reqCount}</span>`;
        }
        
        els.text.innerHTML = displayText;
        
        const isLast = currentIndex === tutorialSteps.length - 1;
        els.nextBtn.innerHTML = isLast ? 'Завершить' : 'Далее';
        els.backBtn.style.display = currentIndex === 0 ? 'none' : 'block';
        els.nextBtn.classList.remove('tutorial-btn-primary');
        els.nextBtn.disabled = false; // По умолчанию включена, если нет условий

        // --- ЛОГИКА ОЖИДАНИЯ ---

        if (step.customCheck) {
            // Если есть кастомная функция проверки (например для проводов)
            els.nextBtn.disabled = true;
            els.nextBtn.innerHTML = 'Выполните задачу...';
            
            conditionInterval = setInterval(() => {
                if (step.customCheck()) {
                    clearInterval(conditionInterval);
                    conditionInterval = null;
                    els.nextBtn.disabled = false;
                    els.nextBtn.innerHTML = 'Далее (Готово!)';
                    els.nextBtn.classList.add('tutorial-btn-primary');
                }
            }, 500);
        }
        else if (step.waitFor === 'click') {
            els.nextBtn.disabled = true;
            els.nextBtn.innerHTML = 'Нажмите на элемент...';
            
            const targetEl = document.querySelector(step.target);
            if (targetEl) {
                const handler = () => {
                     setTimeout(() => nextStep(true), 100);
                };
                targetEl.addEventListener('click', handler, { once: true });
                waitingClickHandler = { el: targetEl, fn: handler };
            } else {
                els.nextBtn.disabled = false;
                els.nextBtn.innerHTML = 'Далее';
            }
        } 
        else if (step.waitFor === 'construction') {
            const checks = {
                'build_wind': 'wind_power_plant',
                'build_sawmill': 'sawmill',
                'build_hub': 'transport_hub',
                'build_warehouse': 'warehouse',
                'build_garage': 'garage'
            };
            const type = checks[step.id];
            
            const gameObj = window.gameState || (typeof gameState !== 'undefined' ? gameState : null);
            let currentCount = 0;
            if (gameObj && gameObj.buildingCounts) {
                currentCount = gameObj.buildingCounts[type] || 0;
            } else {
                currentCount = stepProgress;
            }

            const required = step.reqCount || 1;

            if (currentCount >= required) {
                els.nextBtn.disabled = false;
                els.nextBtn.innerHTML = 'Далее (Уже готово)';
                els.nextBtn.classList.add('tutorial-btn-primary'); 
            } else {
                els.nextBtn.disabled = true;
                const left = required - currentCount;
                els.nextBtn.innerHTML = `Постройте еще (${left})`;
            }
        } 
        else if (step.waitFor === 'interaction') {
            els.nextBtn.disabled = true;
            els.nextBtn.innerHTML = 'Нажмите на элемент...';
        }

        requestAnimationFrame(() => positionCard(step));
    }

    function nextStep(force = false) {
        const step = tutorialSteps[currentIndex];
        // Если кнопка заблокирована и это не принудительный переход (от события)
        if (!force && getEls().nextBtn.disabled) return;

        if (currentIndex < tutorialSteps.length - 1) {
            currentIndex++;
            stepProgress = 0; 
            renderCurrentStep();
        } else {
            finishTutorial();
        }
    }

    function prevStep() {
        if (currentIndex > 0) {
            currentIndex--;
            stepProgress = 0; 
            renderCurrentStep();
        }
    }

    function startTutorial(forced = false) {
        if (!forced && localStorage.getItem(TUTORIAL_STORAGE_KEY)) return;
        
        const existingOverlay = document.getElementById('tutorial-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        createOverlayHTML();
        buildSteps();
        currentIndex = 0;
        stepProgress = 0;
        
        const els = getEls();
        if (!els.overlay || !els.nextBtn) return;

        els.overlay.style.display = 'block'; 
        
        els.nextBtn.addEventListener('click', () => nextStep());
        els.backBtn.addEventListener('click', prevStep);
        els.skipLink.addEventListener('click', finishTutorial);

        renderCurrentStep();
    }

    function finishTutorial() {
        const els = getEls();
        if (els.overlay) els.overlay.style.display = 'none';
        clearHighlight();
        localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    }

    function onBuildingPlaced(type) {
        const overlay = document.getElementById('tutorial-overlay');
        if (!overlay || overlay.style.display === 'none') return;
        
        const step = tutorialSteps[currentIndex];
        const checks = {
            'build_wind': 'wind_power_plant',
            'build_sawmill': 'sawmill',
            'build_hub': 'transport_hub',
            'build_warehouse': 'warehouse',
            'build_garage': 'garage'
        };

        if (step && step.waitFor === 'construction' && checks[step.id] === type) {
            stepProgress++;
            if (step.reqCount && step.reqCount > 1) {
                renderCurrentStep(); // Обновляем счетчик
                if (stepProgress >= step.reqCount) {
                    setTimeout(() => nextStep(true), 500);
                }
            } else {
                nextStep(true);
            }
        }
    }

    function handleBuildingClickInTutorial(type) {
        const step = tutorialSteps[currentIndex];
        if (step && step.id === 'camera' && type === 'residential_house') {
            nextStep(true);
        }
    }

    window.TutorialSystem = {
        startOnFirstLaunch: () => setTimeout(() => startTutorial(false), 1000),
        setupTutorialControls: () => {
             const helpBtn = document.getElementById('help-button');
             if(helpBtn) helpBtn.addEventListener('click', () => startTutorial(true));
        },
        onBuildingPlaced: onBuildingPlaced,
        onBuildingClicked: handleBuildingClickInTutorial
    };
    
})();