// English translations
export const TRANSLATIONS_EN = {
    // Page title and main headers
    title: "Archive Dashboard",
    subtitle: "Extract and download images and audio from your VK archive with EXIF metadata",
    
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
        processButton: "Download Selected Media",
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
        title: "Downloading Media",
        status: "Status",
        downloadReady: "Download Ready",
        initializing: "Initializing...",
        failedDownloads: "Failed Downloads"
    },
    
    // Status messages
    status: {
        buildingList: "Building file list...",
        queuedImages: "Queued {count} images from {type} '{name}'.",
        foundTotal: "Found {count} images to download.",
        noImages: "No images have been selected or found.",
        downloadComplete: "Download complete. Successfully retrieved {success} of {total} images.",
        creatingZip: "Creating ZIP archive with metadata, please wait...",
        zipReady: "Your ZIP file with metadata is ready for download.",
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
        invalidArchive: "Invalid VK archive. The following required files were not found:",
        fileNotFound: "The file could not be found: {file}",
        parseError: "Failed to parse the VK date: '{date}' - {error}",
        downloadError: "Failed to download from {url}: {error}",
        zipError: "An error occurred while creating the ZIP file: {error}",
        exifError: "Failed to add EXIF data to {name}: {error}"
    },
    
    // Analysis messages
    analysis: {
        loading: "Loading the archive, please wait...",
        validating: "Validating the archive structure...",
        analyzing: "Analyzing the archive contents...",
        estimatingImages: "Estimating image counts...",
        error: "Analysis error",
        found: "Discovered {albums} albums and {chats} chats.",
        foundWithCounts: "Discovered {albums} albums with {albumImages} images and {chats} chats with {chatImages} media files, totaling {totalImages} media files."
    },
    
    // Validation messages
    validation: {
        missingFile: "A required file is missing: {file}",
        invalidArchive: "Invalid VK archive"
    },
    
    // Buttons and controls
    buttons: {
        returnToStart: "Return to Start",
        downloadZip: "Download Your ZIP File",
        downloadSummary: "Download Summary Page (with all ZIP links)",
        processing: "Processing...",
        selectFile: "Select File",
        stopDownload: "Stop Download"
    },
    
    // Theme and language
    ui: {
        language: "Language",
        theme: "Theme",
        lightTheme: "Light",
        darkTheme: "Dark"
    },
    
    // Navigation
    nav: {
        download: "Download",
        analytics: "Analytics"
    },
    
    // Analytics
    analytics: {
        title: "Archive Analytics",
        description: "Discover insights from your VK archive messages and interactions.",
        startAnalysis: "Start Analysis",
        analyzing: "Analyzing...",
        noArchive: "Please upload an archive first",
        noChatsSelected: "Please select at least one chat to analyze",
        noAnalysisSelected: "Please select at least one analysis type",
        error: "Error during analysis",
        runAnalysisFirst: "Please run analysis first",
        
        // Configuration
        selectChats: "Select Chats to Analyze",
        selectAnalysis: "Select Analysis Types",
        
        // Statistics labels
        messagingStats: "Messaging Statistics",
        totalMessages: "Total Messages",
        totalChats: "Active Chats",
        mostActiveDay: "Most Active Day",
        mostActiveHour: "Most Active Hour",
        
        // Chart titles
        activityHeatmap: "Activity Heatmap",
        topContacts: "Top Contacts",
        messageTimeline: "Message Timeline",
        
        // Social Network
        socialNetwork: "Social Network Analysis",
        interactionGraph: "Interaction Network",
        responseTime: "Response Time Analysis",
        
        // Content Analysis
        contentAnalysis: "Content Analysis",
        wordCloud: "Most Used Words",
        emojiAnalysis: "Emoji Usage",
        
        // Export
        export: "Export Analytics",
        exportJson: "Export as JSON",
        exportCsv: "Export as CSV",
        
        // Info panel descriptions
        info: {
            activityHeatmap: "Shows message activity by hour of day and day of week. Each cell represents the number of messages sent during that time period across all analyzed chats.",
            topContacts: "Ranks all users (including yourself as 'Вы'/'You') by total number of messages sent. Shows the most active participants across all analyzed chats.",
            messageTimeline: "Shows messaging activity over time, allowing you to see periods of high and low activity in your chats. Helps identify communication patterns and trends.",
            interactionNetwork: "Heatmap showing message interactions between top 10 users. Diagonal cells show each user's total message count. Off-diagonal cells show combined messages between users in shared chats.",
            responseTime: "Measures how quickly users respond to messages from others. Only considers realistic response times (1 minute to 24 hours) and ranks users by their average response speed.",
            wordCloud: "Shows the most frequently used words across all messages. Filters out common words and words shorter than 3 characters. Font size reflects usage frequency.",
            emojiAnalysis: "Analyzes emoji usage patterns across all messages. Shows the most popular emojis with their usage counts and frequency percentages."
        }
    },
    
    // Time units

    // Instructions
    instructions: {
        privacy: "Everything is private and works only on your computer. No data is sent to any server.",
        sourceCode: "View source code on GitHub"
    },

    // Footer
    footer: {
        privacy: "All processing is done locally in your browser. No data is ever sent to a server."
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