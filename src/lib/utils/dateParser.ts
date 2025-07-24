/**
 * Unified date parser for VK archive HTML content
 * 
 * This utility consolidates date parsing logic that was previously duplicated
 * across messageParser.ts, imageExtractor.ts, and albumParser.ts
 */

/**
 * Parse VK-formatted date string from Russian HTML content
 * 
 * Handles various VK date formats including:
 * - "Наталья Абельдяева, 13 июн 2019 в 13:30:27" (message headers)
 * - "13 июн 2019 в 13:30:27" (direct date format)  
 * - "9 мая 2022 в 23:04" (album timestamps)
 * - "created 31 дек 2021 в 9:29" (album creation dates)
 * 
 * @param dateText - The text containing the Russian-formatted date
 * @returns Parsed Date object or null if parsing fails
 */
export function parseVkDateString(dateText: string): Date | null {
	if (!dateText || typeof dateText !== 'string' || dateText.trim() === '') {
		return null;
	}

	try {
		// Russian month names to numbers mapping (comprehensive)
		const months: { [key: string]: number } = {
			// Short forms
			'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'июн': 5,
			'июл': 6, 'авг': 7, 'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11,
			// Full forms (genitive case - used in dates)
			'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
			'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
		};

		// Primary pattern: handles most VK date formats with seconds
		// Matches: "13 июн 2019 в 13:30:27", "Имя, 13 июн 2019 в 13:30:27"
		let dateMatch = dateText.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})\s+в\s+(\d{1,2}):(\d{2}):(\d{2})/i);
		
		if (dateMatch) {
			const [, day, monthName, year, hour, minute, second] = dateMatch;
			const monthNumber = months[monthName.toLowerCase()];
			
			if (monthNumber !== undefined) {
				return new Date(
					parseInt(year),
					monthNumber,
					parseInt(day),
					parseInt(hour),
					parseInt(minute),
					parseInt(second)
				);
			}
		}

		// Secondary pattern: handles dates without seconds (album format)
		// Matches: "9 мая 2022 в 23:04", "created 31 дек 2021 в 9:29"  
		dateMatch = dateText.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})\s+в?\s*(\d{1,2}):(\d{2})/i);
		
		if (dateMatch) {
			const [, day, monthName, year, hour, minute] = dateMatch;
			const monthNumber = months[monthName.toLowerCase()];
			
			if (monthNumber !== undefined) {
				return new Date(
					parseInt(year),
					monthNumber,
					parseInt(day),
					parseInt(hour),
					parseInt(minute),
					0 // Default seconds to 0
				);
			}
		}

		// Tertiary pattern: date only without time
		// Matches: "13 июн 2019", "31 дек 2021"
		dateMatch = dateText.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
		
		if (dateMatch) {
			const [, day, monthName, year] = dateMatch;
			const monthNumber = months[monthName.toLowerCase()];
			
			if (monthNumber !== undefined) {
				return new Date(
					parseInt(year),
					monthNumber,
					parseInt(day),
					0, 0, 0 // Default time to midnight
				);
			}
		}

		// Fallback: extract year only if all other patterns fail
		const yearMatch = dateText.match(/(\d{4})/);
		if (yearMatch) {
			const year = parseInt(yearMatch[1]);
			// Only use years that make sense for VK (founded in 2006)
			if (year >= 2006 && year <= new Date().getFullYear() + 1) {
				return new Date(year, 0, 1); // January 1st of that year
			}
		}

	} catch (error) {
		// Log warning but don't throw - graceful degradation
		console.warn('Failed to parse VK date string:', dateText, error);
	}

	return null;
}

/**
 * Alternative parsing function that returns current date as fallback
 * This maintains compatibility with imageExtractor.ts behavior
 * 
 * @param dateText - The text containing the Russian-formatted date
 * @returns Parsed Date object or current date if parsing fails
 */
export function parseVkDateStringWithFallback(dateText: string): Date {
	const parsedDate = parseVkDateString(dateText);
	return parsedDate || new Date();
}

/**
 * Utility function to validate if a parsed date is reasonable for VK context
 * VK was founded in 2006, so any dates before that are likely parsing errors
 * 
 * @param date - Date to validate
 * @returns true if date is within reasonable VK timeframe
 */
export function isValidVkDate(date: Date | null): boolean {
	if (!date || isNaN(date.getTime())) {
		return false;
	}
	
	const vkFoundingYear = 2006;
	const currentYear = new Date().getFullYear();
	const dateYear = date.getFullYear();
	
	return dateYear >= vkFoundingYear && dateYear <= currentYear + 1;
}