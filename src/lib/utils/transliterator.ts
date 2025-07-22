/**
 * Transliterate Cyrillic text to Latin characters
 */
export function transliterateCyrillic(text: string): string {
	const cyrillicToLatin: { [key: string]: string } = {
		// Uppercase
		'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
		'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
		'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
		'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
		'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
		
		// Lowercase
		'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
		'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
		'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
		'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
		'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
	};

	return text
		.split('')
		.map(char => cyrillicToLatin[char] || char)
		.join('')
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim();
}

/**
 * Clean text for EXIF fields (transliterate + limit length)
 */
export function cleanForExif(text: string, maxLength: number = 100): string {
	return transliterateCyrillic(text)
		.replace(/[^\x20-\x7E]/g, '?') // Replace remaining non-printable ASCII with ?
		.substring(0, maxLength)
		.trim();
}

/**
 * Examples for testing:
 * transliterateCyrillic("Полина Дор") → "Polina Dor"
 * transliterateCyrillic("Наталья Абельдяева") → "Natalya Abeldyayeva"  
 * transliterateCyrillic("Вы") → "Vy"
 */