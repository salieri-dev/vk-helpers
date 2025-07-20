// Configuration file for VK Helpers
const CONFIG = {
    // Default processing settings
    defaults: {
        batchSize: 5,
        sleepTime: 100,
        exifEnabled: true,
        sortOrder: 'name',
        archiveBatching: false,
        archiveBatchSize: 1000
    },
    
    // Time estimation parameters
    estimation: {
        avgImagesPerAlbum: 50,
        avgImagesPerChat: 20,
        downloadTimePerImage: 500, // milliseconds
        exifTimePerImage: 50,      // milliseconds  
        zipTimePerImage: 20        // milliseconds
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
        defaultTheme: 'light'  // 'light' or 'dark'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}