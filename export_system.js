// export_system.js
// Модуль для логики экспорта и насыщения рынка

const ExportSystem = (function() {
    const MARKET_SATURATION_CONFIG = {
        RECOVERY_RATE: 0.0005,
        SATURATION_PER_UNIT: 0.0001
    };

    function computeInternalDemandModifier(gameState, RESOURCES, resKey) {
        if (!gameState || !gameState.resourceFlow || !gameState.resources) return 1.0;
        const flow = gameState.resourceFlow[resKey];
        if (!flow) return 1.0;

        const { produced, consumed } = flow;
        const netFlow = produced - consumed;
        const totalSupply = produced + (gameState.resources[resKey] || 0);

        let internalDemandModifier = 1.0;
        if (totalSupply > 10) {
            internalDemandModifier = 1 - (netFlow / totalSupply) * 0.5;
            internalDemandModifier = Math.max(0.5, Math.min(2.0, internalDemandModifier));
        }
        return internalDemandModifier;
    }

    function finalizeExport(gameState, RESOURCES, resKey, amount, countryName) {
        if (!gameState || !RESOURCES || !RESOURCES[resKey] || amount <= 0) {
            return { profit: 0 };
        }

        const country = gameState.countries.find(c => c.name === countryName);
        const conditions = gameState.marketConditions[resKey];
        if (!conditions) {
            return { profit: 0 };
        }

        const internalDemandModifier = computeInternalDemandModifier(gameState, RESOURCES, resKey);
        const countryDemandMultiplier = country ? country.demands[resKey].multiplier : 1.0;

        let eventMultiplier = 1.0;
        if (gameState.activeEvent && gameState.activeEvent.effects && gameState.activeEvent.effects[resKey]) {
            eventMultiplier = gameState.activeEvent.effects[resKey];
        }

        const profit = Math.floor(
            amount *
            RESOURCES[resKey].baseExportPrice *
            conditions.globalDemandMultiplier *
            conditions.playerSaturationMultiplier *
            internalDemandModifier *
            countryDemandMultiplier *
            eventMultiplier
        );

        gameState.money += profit;
        gameState.exportStorage[resKey] = (gameState.exportStorage[resKey] || 0) - amount;

        conditions.playerSaturationMultiplier = Math.max(
            0.1,
            conditions.playerSaturationMultiplier - (amount * MARKET_SATURATION_CONFIG.SATURATION_PER_UNIT)
        );

        return {
            profit,
            internalDemandModifier,
            countryDemandMultiplier,
            eventMultiplier
        };
    }

    return {
        MARKET_SATURATION_CONFIG,
        computeInternalDemandModifier,
        finalizeExport
    };
})();

window.ExportSystem = ExportSystem;
