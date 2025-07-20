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
        
        if (dateStr.includes(',') && (dateStr.startsWith('Вы,') || /^[А-Яа-яA-Za-z\s]+,/.test(dateStr))) {
            // Handle chat format: "Name Surname, DD MMM YYYY в HH:MM:SS"
            const commaIndex = dateStr.indexOf(',');
            if (commaIndex === -1) throw new Error('Invalid chat date format - no comma found');
            
            const datePart = dateStr.substring(commaIndex + 1).trim();
            const parts = datePart.split(' ').filter(p => p.length > 0);
            
            if (parts.length < 4) {
                throw new Error('Incomplete chat date format');
            }
            
            // For formats like "1 дек 2017 в 10:39:04" or "1 дек 2017 10:39:04"
            day = parts[0];
            const monthStr = parts[1];
            year = parts[2];
            
            // Handle both "в HH:MM:SS" and direct "HH:MM:SS" formats
            if (parts[3] === 'в' && parts.length >= 5) {
                timeStr = parts[4];
            } else if (parts[3].includes(':')) {
                timeStr = parts[3];
            } else {
                throw new Error('Invalid time format in chat date');
            }
            
            // Validate day is numeric
            if (!/^\d{1,2}$/.test(day)) {
                throw new Error(`Invalid day format: ${day}`);
            }
            
            // Validate year is numeric
            if (!/^\d{4}$/.test(year)) {
                throw new Error(`Invalid year format: ${year}`);
            }
            
            // Parse Russian month name
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
            
            // Convert time from HH:MM:SS to HH:MM
            const timeParts = timeStr.split(':');
            if (timeParts.length >= 2) {
                timeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
            } else {
                timeStr = `${timeParts[0].padStart(2, '0')}:00`;
            }
        } else {
            // Album date format
            let parts = dateStr.split(' ').filter(p => p && p !== 'в');
            if (parts.length < 4) throw new Error('Unsupported date format');
            
            day = parts[0];
            const monthStr = parts[1];
            year = parts[2];
            timeStr = parts[3];
            
            // Try numeric month first, then Russian names
            if (/^\d+$/.test(monthStr)) {
                month = parseInt(monthStr);
                if (month < 1 || month > 12) throw new Error(`Invalid numeric month: ${month}`);
            } else {
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
            }
            
            // Handle time format
            if (timeStr.includes(':')) {
                const timeParts = timeStr.split(':');
                if (timeParts.length === 2) {
                    timeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
                } else {
                    throw new Error(`Invalid time format: ${timeStr}`);
                }
            } else {
                timeStr = `${timeStr.padStart(2, '0')}:00`;
            }
        }
        
        // Create date object
        const dayPadded = day.padStart(2, '0');
        const monthPadded = month.toString().padStart(2, '0');
        const dateTimeStr = `${dayPadded} ${monthPadded} ${year} ${timeStr}`;
        
        const parsedDate = new Date(year, month - 1, parseInt(day),
                                  parseInt(timeStr.split(':')[0]),
                                  parseInt(timeStr.split(':')[1]));
                                  
        if (isNaN(parsedDate.getTime())) {
            throw new Error(`Invalid date: ${dateTimeStr}`);
        }
        
        return parsedDate;
    } catch (error) {
        console.warn(`Failed to parse VK date: "${dateStr}" - ${error.message}`);
        return null;
    }
}