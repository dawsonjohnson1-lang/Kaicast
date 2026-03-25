function computeRainTotals({ hourlyItems, nowMs }) {
    const totals = { 3: 0, 6: 0, 12: 0, 24: 0, 48: 0, 72: 0 };
    const now = new Date(nowMs);
    const cutoffTimes = { 
        3: now.setHours(now.getHours() - 3),
        6: now.setHours(now.getHours() - 6),
        12: now.setHours(now.getHours() - 12),
        24: now.setHours(now.getHours() - 24),
        48: now.setHours(now.getHours() - 48),
        72: now.setHours(now.getHours() - 72)
    };

    hourlyItems.forEach(item => {
        const itemTime = item.tsMs;
        const rain = item.rainLast1hMM;

        Object.keys(cutoffTimes).forEach(hours => {
            if (itemTime >= cutoffTimes[hours]) {
                totals[hours] += rain;
            }
        });
    });

    return totals;
}

module.exports = { computeRainTotals };