// English translations
const TRANSLATIONS_EN = {
    // Page title and main headers
    title: "VK Photo Archive Downloader",
    subtitle: "Extract and download photos from your VK archive with EXIF metadata",
    
    // Upload screen
    upload: {
        title: "Select VK Archive",
        dropText: "Drop ZIP file here or click to select",
        analyzing: "Analyzing ZIP file, please wait...",
        dragOver: "Release to upload file",
        invalidFile: "Please select a valid ZIP file."
    },
    
    // Selection screen
    selection: {
        title: "Select Content to Download",
        albums: "Albums",
        chats: "Chats",
        albumsCount: "albums found",
        chatsCount: "chats found",
        search: "Search...",
        selectAll: "Select All",
        deselectAll: "Deselect All",
        configuration: "Configuration",
        estimatedTime: "Estimated {count} images in {time}",
        processButton: "Download Selected Images",
        calculating: "Calculating...",
        noSelection: "No content selected"
    },
    
    // Configuration options
    config: {
        exifMetadata: "Add EXIF metadata from VK dates",
        batchSize: "Download batch size",
        sleepTime: "Delay between batches (ms)",
        sortOrder: "Sort images by",
        sortOptions: {
            name: "Name",
            date: "Date",
            size: "Size"
        },
        archiveBatching: "Create multiple ZIP files for large downloads",
        archiveBatchSize: "Images per ZIP file",
        batchSizeHelp: "Number of images to download simultaneously. Lower values reduce memory usage.",
        sleepTimeHelp: "Delay between download batches to avoid rate limiting."
    },
    
    // Progress screen
    progress: {
        title: "Downloading Images",
        status: "Status",
        downloadReady: "Download Ready",
        initializing: "Initializing..."
    },
    
    // Status messages
    status: {
        buildingList: "Building file list...",
        queuedImages: "Queued {count} images from {type} \"{name}\".",
        foundTotal: "Found a total of {count} images to download.",
        noImages: "No images selected or found. Nothing to do.",
        downloadComplete: "Download complete. Successfully got {success} of {total} images.",
        creatingZip: "Creating ZIP archive with metadata...",
        zipReady: "ZIP file with metadata is ready for download!",
        exifSummary: "EXIF Processing Summary:",
        imagesWithDates: "Images with parsed VK dates: {count}/{total}",
        imagesWithExif: "Images with EXIF data added: {count}/{total} (JPEG only)",
        fileTimestampNote: "Note: File timestamps cannot be set due to browser limitations.",
        checkMetadata: "Check download_metadata.json for detailed processing information.",
        batchComplete: "BATCH PROCESSING COMPLETE",
        totalDownloaded: "Total images downloaded: {count}",
        totalFailed: "Total images failed: {count}",
        zipFilesCreated: "Number of ZIP files created: {count}",
        cleaningMemory: "Cleaning up memory before next batch...",
        summaryCreated: "Download summary page created with links to all ZIP files.",
        downloadSummaryFirst: "IMPORTANT: Download the summary page first, then use it to download all ZIP files."
    },
    
    // Error messages
    errors: {
        invalidArchive: "Invalid VK archive. Required files not found:",
        fileNotFound: "File not found: {file}",
        parseError: "Failed to parse VK date: \"{date}\" - {error}",
        downloadError: "Failed to download {url}: {error}",
        zipError: "Error creating ZIP file: {error}",
        exifError: "Failed to add EXIF data to {name}: {error}"
    },
    
    // Analysis messages
    analysis: {
        loading: "Loading archive...",
        validating: "Validating archive structure...",
        analyzing: "Analyzing contents...",
        estimatingImages: "Estimating image counts...",
        error: "Analysis error",
        found: "Found {albums} albums and {chats} chats",
        foundWithCounts: "Found {albums} albums ({albumImages} images) and {chats} chats ({chatImages} images) - Total: {totalImages} images"
    },
    
    // Validation messages
    validation: {
        missingFile: "Missing required file: {file}",
        invalidArchive: "Invalid VK archive"
    },
    
    // Buttons and controls
    buttons: {
        returnToStart: "Return to Start",
        downloadZip: "Download Your ZIP File",
        downloadSummary: "Download Summary Page (with all ZIP links)",
        processing: "Processing...",
        selectFile: "Select File"
    },
    
    // Theme and language
    ui: {
        language: "Language",
        theme: "Theme",
        lightTheme: "Light",
        darkTheme: "Dark"
    },
    
    // Time units
    time: {
        minutes: "{count} minutes",
        seconds: "s",
        lessThanMinute: "Less than 1 minute",
        hoursMinutes: "{hours}h {minutes}m",
        calculating: "Calculating...",
        noContent: "No content selected"
    },
    
    // File types
    fileTypes: {
        album: "album",
        chat: "chat"
    },
    
    // Batch summary page
    batchSummary: {
        title: "VK Archive Download Summary",
        processingComplete: "Processing Complete",
        totalImagesDownloaded: "Total Images Downloaded:",
        totalImagesFailed: "Total Images Failed:",
        numberOfZipFiles: "Number of ZIP Files:",
        processingDate: "Processing Date:",
        downloadZipFiles: "Download Your ZIP Files",
        downloadNote: "Note: Download all files before closing this page. Links will expire when you navigate away."
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TRANSLATIONS_EN;
}