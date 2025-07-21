// Configuration file for VK Helpers
export const CONFIG = {
    // Default processing settings
    defaults: {
        batchSize: 1500,
        sleepTime: 100,
        exifEnabled: true,
        sortOrder: 'name',
        archiveBatching: false,
        archiveBatchSize: 1000
    },
    
    // Archive validation
    validation: {
        requiredFiles: [
            'index.html',
            'photos/photo-albums.html'
        ]
    },
    
    // UI settings
    ui: {
        defaultLanguage: 'en', // 'en' or 'ru'
        defaultTheme: 'dark'  // 'light' or 'dark'
    }
};