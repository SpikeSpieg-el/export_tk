/**
 * @file mobile_controls.js
 * @description Улучшенное управление для мобильных устройств.
 */

const MobileControls = {
    canvas: null,
    isTouchDevice: false,
    
    state: {
        isDragging: false,
        isPinching: false,
        lastTouchX: 0,
        lastTouchY: 0,
        initialPinchDistance: 0,
        initialZoom: 1,
        touchStartTime: 0,
        startX: 0,
        startY: 0,
        longPressTimer: null,
        isLongPressTriggered: false
    },

    CONFIG: {
        LONG_PRESS_DELAY: 500, // Уменьшил для отзывчивости
        TAP_THRESHOLD: 15,     // Чуть больше допуск на дрожание пальца
        ZOOM_SPEED: 0.005      // Скорость зума
    },

    init() {
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) return;

        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        if (this.isTouchDevice) {
            console.log("Mobile Controls v2 Initialized");
            this.attachEvents();
            
            // Фикс для iOS, чтобы не скроллило страницу при игре
            document.body.addEventListener('touchmove', (e) => {
                if (e.target === this.canvas) e.preventDefault();
            }, { passive: false });
        }
    },

    attachEvents() {
        const c = this.canvas;
        c.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        c.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        c.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Отменяем контекстное меню браузера при долгом тапе
        c.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    },

    handleTouchStart(e) {
        if (e.target !== this.canvas) return;
        
        // Создаем визуальный эффект нажатия
        if (e.touches.length === 1) {
            this.createRipple(e.touches[0].clientX, e.touches[0].clientY);
        }

        if (e.touches.length === 1) {
            // ОДИН ПАЛЕЦ: Подготовка к Drag или Tap
            const t = e.touches[0];
            this.state.isDragging = false; // Сначала считаем, что это не драг
            this.state.isPinching = false;
            this.state.lastTouchX = t.clientX;
            this.state.lastTouchY = t.clientY;
            this.state.startX = t.clientX;
            this.state.startY = t.clientY;
            this.state.touchStartTime = Date.now();
            this.state.isLongPressTriggered = false;

            // Запускаем таймер долгого нажатия (ПКМ / Снос)
            this.state.longPressTimer = setTimeout(() => {
                if (!this.state.isDragging && !this.state.isPinching) {
                    this.triggerLongPress(t.clientX, t.clientY);
                }
            }, this.CONFIG.LONG_PRESS_DELAY);

        } else if (e.touches.length === 2) {
            // ДВА ПАЛЬЦА: Зум
            this.state.isPinching = true;
            this.state.isDragging = false;
            this.clearLongPress();

            const dist = this.getDistance(e.touches[0], e.touches[1]);
            this.state.initialPinchDistance = dist;
            if (window.camera) {
                this.state.initialZoom = window.camera.zoom;
            }
        }
    },

    handleTouchMove(e) {
        if (!window.camera) return;

        if (e.touches.length === 1 && !this.state.isPinching) {
            const t = e.touches[0];
            const dx = t.clientX - this.state.lastTouchX;
            const dy = t.clientY - this.state.lastTouchY;
            
            // Проверка: это действительно движение или просто дрожание пальца?
            const totalDist = Math.hypot(t.clientX - this.state.startX, t.clientY - this.state.startY);
            
            if (totalDist > this.CONFIG.TAP_THRESHOLD) {
                this.state.isDragging = true;
                this.clearLongPress(); // Если начал двигать - это не долгий тап
                
                // Двигаем камеру
                window.camera.x -= dx / window.camera.zoom;
                window.camera.y -= dy / window.camera.zoom;
                
                this.state.lastTouchX = t.clientX;
                this.state.lastTouchY = t.clientY;
            }

        } else if (e.touches.length === 2) {
            // Плавный ЗУМ
            const dist = this.getDistance(e.touches[0], e.touches[1]);
            const delta = dist - this.state.initialPinchDistance;
            
            // Новая логика зума: плавное приближение к центру между пальцами
            // Для упрощения зумим в центр экрана (как в script.js), но плавнее
            let newZoom = this.state.initialZoom * (1 + delta * 0.005);
            
            // Хардкод лимитов из script.js
            newZoom = Math.max(0.1, Math.min(4.0, newZoom));
            window.camera.zoom = newZoom;
        }
    },

    handleTouchEnd(e) {
        this.clearLongPress();

        // Обработка ТАПА (если не двигали и не пинчили)
        if (!this.state.isDragging && !this.state.isPinching && !this.state.isLongPressTriggered) {
            // Проверяем, что палец убрали (touches пуст или изменился)
            if (e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                this.triggerTap(t.clientX, t.clientY);
            }
        }

        if (e.touches.length === 0) {
            this.state.isDragging = false;
            this.state.isPinching = false;
        }
    },

    triggerTap(clientX, clientY) {
        // Эмулируем стандартный Click для script.js
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: clientX,
            clientY: clientY,
            button: 0
        });
        this.canvas.dispatchEvent(clickEvent);
    },

    triggerLongPress(clientX, clientY) {
        this.state.isLongPressTriggered = true;
        
        // Вибрация (Haptic Feedback)
        if (navigator.vibrate) navigator.vibrate(50);
        
        // Анимация долгого нажатия
        this.createRipple(clientX, clientY, 'red');

        // Эмулируем ContextMenu (ПКМ)
        const contextEvent = new MouseEvent('contextmenu', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: clientX,
            clientY: clientY,
            button: 2
        });
        this.canvas.dispatchEvent(contextEvent);
    },

    clearLongPress() {
        if (this.state.longPressTimer) {
            clearTimeout(this.state.longPressTimer);
            this.state.longPressTimer = null;
        }
    },

    getDistance(t1, t2) {
        return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    },
    
    createRipple(x, y, color = 'rgba(255, 255, 255, 0.5)') {
        const ripple = document.createElement('div');
        ripple.className = 'touch-ripple';
        ripple.style.left = (x - 25) + 'px'; // Центрируем (50px ширина / 2)
        ripple.style.top = (y - 25) + 'px';
        ripple.style.width = '50px';
        ripple.style.height = '50px';
        if (color === 'red') {
            ripple.style.border = '2px solid #ef4444';
            ripple.style.background = 'transparent';
        }
        document.body.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 400);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MobileControls.init();
});