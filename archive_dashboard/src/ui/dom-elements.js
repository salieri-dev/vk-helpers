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