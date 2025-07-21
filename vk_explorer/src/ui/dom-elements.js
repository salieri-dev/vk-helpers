export const screens = {
    upload: document.getElementById('upload-screen'),
    selection: document.getElementById('selection-screen'),
    progress: document.getElementById('progress-screen')
};

export const dropZone = document.getElementById('drop-zone');
export const fileInput = document.getElementById('zip-file');
export const analysisStatus = document.getElementById('analysis-status');
export const albumList = document.getElementById('album-list');
export const chatList = document.getElementById('chat-list');
export const progressBar = document.getElementById('progress-bar');
export const progressLabel = document.getElementById('progress-label');
export const statusLog = document.getElementById('status-log');
export const downloadLinkArea = document.getElementById('download-link-area');
export const finalDownloadLink = document.getElementById('final-download-link');

// New elements for stop button and failed downloads
export const stopButton = document.getElementById('stop-button');
export const failedDownloadsSection = document.getElementById('failed-downloads-section');
export const failedDownloadsList = document.getElementById('failed-downloads-list');

// Configuration elements
export const exifToggle = document.getElementById('exif-toggle');
export const batchSizeInput = document.getElementById('batch-size');
export const sleepTimeInput = document.getElementById('sleep-time');
export const sortOrderSelect = document.getElementById('sort-order');
export const archiveBatchingToggle = document.getElementById('archive-batching');
export const archiveBatchSizeInput = document.getElementById('archive-batch-size');
export const batchConfig = document.getElementById('batch-config');
export const estimatedTimeSpan = document.getElementById('estimated-time');


// UI control elements
export const languageSelect = document.getElementById('language-select');
export const themeSelect = document.getElementById('theme-select');

// Navigation elements
export const downloadTab = document.getElementById('download-tab');
export const analyticsTab = document.getElementById('analytics-tab');
export const downloadContent = document.getElementById('download-content');
export const analyticsContent = document.getElementById('analytics-content');

// Analytics elements
export const startAnalysisButton = document.getElementById('start-analysis-button');
export const analyticsConfiguration = document.getElementById('analytics-configuration');
export const analyticsResults = document.getElementById('analytics-results');
export const analyticsProgressArea = document.getElementById('analytics-progress-area');
export const analyticsProgressStatus = document.getElementById('analytics-progress-status');
export const analyticsProgressBar = document.getElementById('analytics-progress-bar');
export const analyticsProgressPercentage = document.getElementById('analytics-progress-percentage');
export const analyticsProgressDetails = document.getElementById('analytics-progress-details');

// Analytics configuration elements
export const analyticsChatSearch = document.getElementById('analytics-chat-search');
export const analyticsChatList = document.getElementById('analytics-chat-list');
export const selectAllAnalyticsChats = document.getElementById('select-all-analytics-chats');
export const deselectAllAnalyticsChats = document.getElementById('deselect-all-analytics-chats');
export const selectAllAnalysisTypes = document.getElementById('select-all-analysis-types');
export const deselectAllAnalysisTypes = document.getElementById('deselect-all-analysis-types');

// Analysis type checkboxes
export const analysisMessagingStats = document.getElementById('analysis-messaging-stats');
export const analysisActivityHeatmap = document.getElementById('analysis-activity-heatmap');
export const analysisTopContacts = document.getElementById('analysis-top-contacts');
export const analysisMessageTimeline = document.getElementById('analysis-message-timeline');
export const analysisInteractionNetwork = document.getElementById('analysis-interaction-network');
export const analysisResponseTimes = document.getElementById('analysis-response-times');
export const analysisWordCloud = document.getElementById('analysis-word-cloud');
export const analysisEmojiAnalysis = document.getElementById('analysis-emoji-analysis');

// Analytics statistics elements
export const totalMessages = document.getElementById('total-messages');
export const totalChats = document.getElementById('total-chats');
export const mostActiveDay = document.getElementById('most-active-day');
export const mostActiveHour = document.getElementById('most-active-hour');

// Analytics chart containers
export const activityHeatmap = document.getElementById('activity-heatmap');
export const topContactsChart = document.getElementById('top-contacts-chart');
export const messageTimelineChart = document.getElementById('message-timeline-chart');
export const interactionGraph = document.getElementById('interaction-graph');
export const responseTimeChart = document.getElementById('response-time-chart');
export const wordCloud = document.getElementById('word-cloud');
export const emojiAnalysis = document.getElementById('emoji-analysis');

// Analytics export buttons
export const exportJsonButton = document.getElementById('export-json-button');
export const exportCsvButton = document.getElementById('export-csv-button');