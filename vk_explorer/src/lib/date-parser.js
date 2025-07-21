// src/lib/date-parser.js

const MONTHS_MAP = {
    // January - январь
    "янв": 1, "января": 1, "январе": 1, "январём": 1, "январю": 1, "январь": 1,
    // February - февраль
    "фев": 2, "февраля": 2, "феврале": 2, "февралём": 2, "февралю": 2, "февраль": 2,
    // March - март
    "мар": 3, "марта": 3, "марте": 3, "мартом": 3, "марту": 3, "март": 3,
    // April - апрель
    "апр": 4, "апреля": 4, "апреле": 4, "апрелём": 4, "апрелю": 4, "апрель": 4,
    // May - май
    "май": 5, "мая": 5, "мае": 5, "маем": 5, "маю": 5,
    // June - июнь
    "июн": 6, "июня": 6, "июне": 6, "июнём": 6, "июню": 6, "июнь": 6,
    // July - июль
    "июл": 7, "июля": 7, "июле": 7, "июлём": 7, "июлю": 7, "июль": 7,
    // August - август
    "авг": 8, "августа": 8, "августе": 8, "августом": 8, "августу": 8, "август": 8,
    // September - сентябрь
    "сен": 9, "сентября": 9, "сентябре": 9, "сентябрём": 9, "сентябрю": 9, "сентябрь": 9,
    // October - октябрь
    "окт": 10, "октября": 10, "октябре": 10, "октябрём": 10, "октябрю": 10, "октябрь": 10,
    // November - ноябрь
    "ноя": 11, "ноября": 11, "ноябре": 11, "ноябрём": 11, "ноябрю": 11, "ноябрь": 11,
    // December - декабрь
    "дек": 12, "декабря": 12, "декабре": 12, "декабрём": 12, "декабрю": 12, "декабрь": 12
};

export function parseVkDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    try {
        let day, month, year, timeStr;
        let seconds = 0;

        const cleanedDateStr = dateStr.includes(',') ? dateStr.substring(dateStr.indexOf(',') + 1).trim() : dateStr.trim();
        const parts = cleanedDateStr.split(' ').filter(p => p && p !== 'в');
        
        if (parts.length < 3) {
            throw new Error(`Unsupported date format: not enough parts in "${cleanedDateStr}"`);
        }

        day = parts[0];
        const monthStr = parts[1];
        year = parts[2];
        timeStr = parts.length >= 4 ? parts[3] : '00:00'; 

        if (!/^\d{1,2}$/.test(day) || !/^\d{4}$/.test(year)) {
            throw new Error(`Invalid day or year in "${cleanedDateStr}"`);
        }

        const monthKey = monthStr.toLowerCase();
        if (monthKey in MONTHS_MAP) {
            month = MONTHS_MAP[monthKey];
        } else {
            const shortMonth = monthStr.substring(0, 3).toLowerCase();
            if (shortMonth in MONTHS_MAP) {
                month = MONTHS_MAP[shortMonth];
            } else {
                throw new Error(`Unknown month: ${monthStr}`);
            }
        }
        
        if (timeStr.includes(':')) {
            const timeParts = timeStr.split(':');
            if (timeParts.length >= 2) {
                timeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
                if (timeParts.length === 3) {
                    seconds = parseInt(timeParts[2]) || 0;
                }
            } else {
                throw new Error(`Invalid time format: ${timeStr}`);
            }
        } else {
            timeStr = '00:00';
        }
        
        const parsedDate = new Date(
            parseInt(year),
            month - 1, 
            parseInt(day),
            parseInt(timeStr.split(':')[0]),
            parseInt(timeStr.split(':')[1]),
            seconds
        );
                                      
        if (isNaN(parsedDate.getTime())) {
            throw new Error(`Could not create a valid Date object from "${dateStr}"`);
        }
        
        return parsedDate;
    } catch (error) {
        console.warn(`Failed to parse VK date: "${dateStr}" - ${error.message}`);
        return null;
    }
}