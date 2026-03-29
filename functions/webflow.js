function toWindowFieldData(data) {
    const result = {};

    // Existing mappings...
    // (1) Send wave-height-ft instead of wave-height-f
    if (data['wave-height-f'] !== undefined) {
        result['wave-height-ft'] = data['wave-height-f'];
    }

    // (2) Keep wave-ft for backward compatibility
    if (data['wave-ft'] !== undefined) {
        result['wave-ft'] = data['wave-ft'];
    }

    // (3) Add wind-mph and gust-mph derived from wind-kt and gust-kt
    if (data['wind-kt'] !== undefined) {
        result['wind-mph'] = data['wind-kt'] * 1.15078; // conversion factor
    }
    if (data['gust-kt'] !== undefined) {
        result['gust-mph'] = data['gust-kt'] * 1.15078; // conversion factor
    }

    // (4) Add runoff-score-penalty mapped from runoff.scorePenalty when present
    if (data['runoff'] && data['runoff'].scorePenalty !== undefined) {
        result['runoff-score-penalty'] = data['runoff'].scorePenalty;
    }

    // (5) Send wind-direction as both numeric and string
    if (data['wind-direction'] !== undefined) {
        result['wind-direction'] = data['wind-direction'];
        result['wind-direction-deg'] = data['wind-direction']; // assuming it is in degrees
    }

    // Existing schema filtering code...

    return result;
}