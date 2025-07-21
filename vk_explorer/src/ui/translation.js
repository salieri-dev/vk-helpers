// src/ui/translation.js
import { TRANSLATIONS_EN } from '../translations/en.js';
import { TRANSLATIONS_RU } from '../translations/ru.js';

let translations;

export function initializeTranslations(language) {
    translations = language === 'ru' ? TRANSLATIONS_RU : TRANSLATIONS_EN;
}

export function t(key, replacements = {}) {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`Translation missing: ${key}`);
            return key;
        }
    }
    
    // Replace placeholders like {count}, {name}, etc.
    if (typeof value === 'string' && Object.keys(replacements).length > 0) {
        return value.replace(/\{(\w+)\}/g, (match, placeholder) => {
            return replacements[placeholder] !== undefined ? replacements[placeholder] : match;
        });
    }
    
    return value;
}

export function applyTranslationsToDOM() {
    // Update text content with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key);
    });
    
    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
    });
    
    // Update document title
    document.title = t('title');
}