import './style.css';
import JSZip from 'jszip';
import piexif from 'piexifjs';
import { initializeTranslations, applyTranslationsToDOM, t } from './ui/translation.js';
import { parseVkDate } from './lib/date-parser.js';
import { addExifData } from './lib/exif-writer.js';
import * as dom from './ui/dom-elements.js';
import { screenManager } from './ui/screen-manager.js';
import { parseAlbumHtml, parseChatHtml } from './lib/archive-parser.js';
import { CONFIG } from './config.js';
import { VKAnalytics } from './lib/analytics.js';
import { AnalyticsVisualizer } from './lib/analytics-visualizer.js';

// Make libraries globally available if needed by old code
window.JSZip = JSZip;
window.piexif = piexif;

document.addEventListener('DOMContentLoaded', () => {
    // --- Initial Setup ---
    let currentLanguage = localStorage.getItem('archive-dashboard-language') || CONFIG.ui.defaultLanguage;
    let currentTheme = localStorage.getItem('archive-dashboard-theme') || CONFIG.ui.defaultTheme;
    
    initializeTranslations(currentLanguage);
    applyTranslationsToDOM();
    document.documentElement.setAttribute('data-theme', currentTheme);
    dom.batchSizeInput.value = CONFIG.defaults.batchSize;
    dom.sleepTimeInput.value = CONFIG.defaults.sleepTime;
    dom.sortOrderSelect.value = CONFIG.defaults.sortOrder;
    dom.exifToggle.checked = CONFIG.defaults.exifEnabled;

    // --- App State ---
    let zipFile = null;
    let chatNameMap = new Map();
    let foundAlbums = [];
    let foundChats = new Map();
    let isProcessing = false;
    let shouldStop = false;  // Flag to stop downloads
    let failedDownloads = []; // Track failed downloads for display only
    let maxRetryAttempts = 5; // Maximum number of automatic retry attempts
    let currentRetryAttempt = 0; // Current retry attempt counter
    
    // Analytics state
    let analytics = new VKAnalytics();
    let visualizer = new AnalyticsVisualizer();
    let analyticsProcessed = false;

    // --- Event Listeners ---
    dom.languageSelect.value = currentLanguage;
    dom.themeSelect.value = currentTheme;
    
    dom.languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        initializeTranslations(currentLanguage);
        applyTranslationsToDOM();
        localStorage.setItem('archive-dashboard-language', currentLanguage);
    });
    
    dom.themeSelect.addEventListener('change', (e) => {
        currentTheme = e.target.value;
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('archive-dashboard-theme', currentTheme);
    });

    // --- UI Logic ---
    const ui = {
        log: (message) => {
            dom.statusLog.textContent += message + '\n';
            dom.statusLog.scrollTop = dom.statusLog.scrollHeight;
        },
        updateProgress: (label, value, max) => {
            dom.progressLabel.textContent = label;
            dom.progressBar.value = value;
            dom.progressBar.max = max;
        },
        setProcessingState: (processing) => {
            isProcessing = processing;
            document.querySelectorAll('button, input, select').forEach(el => {
                if (el.id !== 'language-select' && el.id !== 'theme-select' && el.id !== 'stop-button') {
                    el.disabled = processing;
                }
            });
            
            // Show/hide stop button
            if (dom.stopButton) {
                dom.stopButton.style.display = processing ? 'inline-block' : 'none';
                dom.stopButton.disabled = false;
            }
        },
        showFailedDownloads: (failures) => {
            if (!failures || failures.length === 0) {
                dom.failedDownloadsSection.style.display = 'none';
                return;
            }
            
            failedDownloads = failures;
            const failedList = failures.map(f =>
                `${f.path.split('/').pop()} - ${f.error}`
            ).join('\n');
            
            dom.failedDownloadsList.textContent = failedList;
            dom.failedDownloadsSection.style.display = 'block';
        },
        renderSelectionLists: () => {
             foundAlbums.sort((a, b) => a.name.localeCompare(b.name));
             dom.albumList.innerHTML = foundAlbums.map((album, i) => `
                 <label><input type="checkbox" class="album-checkbox" value="${i}" checked> ${album.name}</label>
             `).join('');
             document.getElementById('albums-count').textContent = foundAlbums.length;

             const sortedChats = [...foundChats.values()].sort((a, b) => a.name.localeCompare(b.name));
             dom.chatList.innerHTML = sortedChats.map(chat => `
                 <label><input type="checkbox" class="chat-checkbox" value="${chat.id}" checked> ${chat.name} (${chat.files.length} parts)</label>
             `).join('');
             document.getElementById('chats-count').textContent = sortedChats.length;
            
        },
        renderAnalyticsChatList: () => {
            const sortedChats = [...foundChats.values()].sort((a, b) => a.name.localeCompare(b.name));
            dom.analyticsChatList.innerHTML = sortedChats.map(chat => `
                <label><input type="checkbox" class="analytics-chat-checkbox" value="${chat.id}" checked> ${chat.name} (${chat.files.length} parts)</label>
            `).join('');
        }
    };
    
    // --- Core Application Logic ---
    async function handleFile(file) {
        if (isProcessing) return;
        
        if (!file.name.toLowerCase().endsWith('.zip')) {
            alert(t('upload.invalidFile'));
            return;
        }
        
        ui.setProcessingState(true);
        dom.analysisStatus.textContent = t('analysis.loading');

        try {
            zipFile = await JSZip.loadAsync(file);
            
            dom.analysisStatus.textContent = t('analysis.validating');
            validateArchive(zipFile);
            
            dom.analysisStatus.textContent = t('analysis.analyzing');
            await analyzeZip();
            
            
            ui.renderSelectionLists();
            ui.renderAnalyticsChatList();
            screenManager.showScreen('selection');
            
            const totalAlbumImages = foundAlbums.reduce((sum, album) => sum + album.imageCount, 0);
            const totalChatMedia = Array.from(foundChats.values()).reduce((sum, chat) => sum + chat.mediaCount, 0);
            
            dom.analysisStatus.textContent = t('analysis.foundWithCounts', {
                albums: foundAlbums.length,
                chats: foundChats.size,
                albumImages: totalAlbumImages,
                chatImages: totalChatMedia,
                totalImages: totalAlbumImages + totalChatMedia
            });
        } catch (error) {
            dom.analysisStatus.textContent = t('analysis.error') + ': ' + error.message;
            console.error(error);
        } finally {
            ui.setProcessingState(false);
        }
    }

    async function analyzeZip() {
        const decoder = new TextDecoder('windows-1251');
        
        chatNameMap.clear();
        foundAlbums = [];
        foundChats.clear();
        
        const chatIndexFile = zipFile.file('messages/index-messages.html');
        if (chatIndexFile) {
            const doc = new DOMParser().parseFromString(decoder.decode(await chatIndexFile.async('uint8array')), 'text/html');
            doc.querySelectorAll('.message-peer--id a').forEach(a => {
                const href = a.getAttribute('href');
                const name = a.textContent.trim();
                const id = href.split('/')[0];
                if (id && name) chatNameMap.set(id, name);
            });
        }

        const albumIndexFile = zipFile.file('photos/photo-albums.html');
        if (albumIndexFile) {
            const doc = new DOMParser().parseFromString(decoder.decode(await albumIndexFile.async('uint8array')), 'text/html');
            doc.querySelectorAll('.item .item__main a').forEach(link => {
                const name = link.textContent.trim();
                const path = link.getAttribute('href'); 
                const fullPath = 'photos/' + path;
                const albumFileEntry = zipFile.file(fullPath);

                if (albumFileEntry) {
                    foundAlbums.push({ name: name, file: albumFileEntry, imageCount: 0 });
                }
            });
        } else {
            console.warn("Could not find photos/index.html. Album names might be incorrect.");
        }

        for (const [relativePath, zipEntry] of Object.entries(zipFile.files)) {
            if (relativePath.startsWith('messages/') && relativePath.endsWith('.html') && !relativePath.endsWith('index-messages.html')) {
                const id = relativePath.split('/')[1];
                if (!foundChats.has(id)) {
                    foundChats.set(id, { id, name: chatNameMap.get(id) || `Chat ${id}`, files: [], mediaCount: 0 });
                }
                foundChats.get(id).files.push(zipEntry);
            }
        }
    }
    
    function validateArchive(zipFile) {
        const errors = [];
        
        for (const requiredFile of CONFIG.validation.requiredFiles) {
            if (!zipFile.file(requiredFile)) {
                errors.push(t('validation.missingFile', { file: requiredFile }));
            }
        }
        
        if (errors.length > 0) {
            const errorMessage = t('validation.invalidArchive') + '\n' + errors.join('\n');
            throw new Error(errorMessage);
        }
        
        return true;
    }



    // --- Event Listeners ---
    dom.languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        initializeTranslations(currentLanguage);
        applyTranslationsToDOM();
        localStorage.setItem('archive-dashboard-language', currentLanguage);
    });

    dom.themeSelect.addEventListener('change', (e) => {
        currentTheme = e.target.value;
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('archive-dashboard-theme', currentTheme);
    });

    dom.dropZone.addEventListener('click', () => dom.fileInput.click());
    dom.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropZone.classList.add('drag-over');
        dom.dropZone.querySelector('h2').textContent = t('upload.dragOver');
    });
    dom.dropZone.addEventListener('dragleave', () => {
        dom.dropZone.classList.remove('drag-over');
        dom.dropZone.querySelector('h2').textContent = t('upload.dropText');
    });
    dom.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropZone.classList.remove('drag-over');
        dom.dropZone.querySelector('h2').textContent = t('upload.dropText');
        e.dataTransfer.files.length && handleFile(e.dataTransfer.files[0]);
    });
    dom.fileInput.addEventListener('change', (e) => e.target.files.length && handleFile(e.target.files[0]));
    document.getElementById('album-search').addEventListener('keyup', (e) => filterList(dom.albumList, e.target.value));
    document.getElementById('chat-search').addEventListener('keyup', (e) => filterList(dom.chatList, e.target.value));
    document.getElementById('select-all-albums').addEventListener('click', () => toggleAllCheckboxes(dom.albumList, true));
    document.getElementById('deselect-all-albums').addEventListener('click', () => toggleAllCheckboxes(dom.albumList, false));
    document.getElementById('select-all-chats').addEventListener('click', () => toggleAllCheckboxes(dom.chatList, true));
    document.getElementById('deselect-all-chats').addEventListener('click', () => toggleAllCheckboxes(dom.chatList, false));
    
    // Analytics chat selection
    dom.analyticsChatSearch.addEventListener('keyup', (e) => filterList(dom.analyticsChatList, e.target.value));
    dom.selectAllAnalyticsChats.addEventListener('click', () => toggleAllCheckboxes(dom.analyticsChatList, true));
    dom.deselectAllAnalyticsChats.addEventListener('click', () => toggleAllCheckboxes(dom.analyticsChatList, false));
    
    // Analytics type selection
    dom.selectAllAnalysisTypes.addEventListener('click', () => toggleAllAnalysisTypes(true));
    dom.deselectAllAnalysisTypes.addEventListener('click', () => toggleAllAnalysisTypes(false));
    
    // Analytics tab navigation
    dom.downloadTab.addEventListener('click', () => switchTab('download'));
    dom.analyticsTab.addEventListener('click', () => switchTab('analytics'));
    
    // Analytics functionality
    dom.startAnalysisButton.addEventListener('click', startAnalysis);
    dom.exportJsonButton.addEventListener('click', () => exportAnalytics('json'));
    dom.exportCsvButton.addEventListener('click', () => exportAnalytics('csv'));

    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.nav-content').forEach(content => content.classList.remove('active'));
        
        if (tabName === 'download') {
            dom.downloadTab.classList.add('active');
            dom.downloadContent.classList.add('active');
        } else if (tabName === 'analytics') {
            dom.analyticsTab.classList.add('active');
            dom.analyticsContent.classList.add('active');
        }
    }

    async function startAnalysis() {
        if (!zipFile) {
            alert(t('analytics.noArchive') || 'Please upload an archive first');
            return;
        }

        // Get selected chats and analysis types
        const selectedChats = getSelectedChatsForAnalytics();
        const selectedAnalysisTypes = getSelectedAnalysisTypes();
        
        if (selectedChats.size === 0) {
            alert(t('analytics.noChatsSelected') || 'Please select at least one chat to analyze');
            return;
        }

        // Check if at least one analysis type is selected
        if (!Object.values(selectedAnalysisTypes).some(value => value === true)) {
            alert(t('analytics.noAnalysisSelected') || 'Please select at least one analysis type');
            return;
        }

        dom.startAnalysisButton.disabled = true;
        dom.startAnalysisButton.textContent = t('analytics.analyzing') || 'Analyzing...';
        
        // Show progress area and hide configuration
        dom.analyticsConfiguration.style.display = 'none';
        dom.analyticsProgressArea.style.display = 'block';
        dom.analyticsResults.style.display = 'none';
        
        try {
            // Parse messages for analytics with progress tracking
            const decoder = new TextDecoder('windows-1251');
            
            await analytics.parseMessages(zipFile, selectedChats, decoder, (status, progress, details) => {
                updateAnalyticsProgress(status, progress, details);
            });
            analyticsProcessed = true;
            
            await renderSelectedAnalyticsWithProgress(selectedAnalysisTypes);
            
        } catch (error) {
            console.error('Analytics error:', error);
            dom.analyticsProgressArea.style.display = 'none';
            dom.analyticsConfiguration.style.display = 'block';
            alert(t('analytics.error') || 'Error during analysis: ' + error.message);
        } finally {
            dom.startAnalysisButton.disabled = false;
            dom.startAnalysisButton.textContent = t('analytics.startAnalysis') || 'Start Analysis';
        }
    }

    function updateAnalyticsProgress(status, progress, details) {
        dom.analyticsProgressStatus.textContent = status;
        dom.analyticsProgressBar.style.width = `${progress}%`;
        dom.analyticsProgressPercentage.textContent = `${progress}%`;
        dom.analyticsProgressDetails.textContent = details;
    }

    async function renderSelectedAnalyticsWithProgress(selectedAnalysisTypes) {
        const allComponents = [
            {
                key: 'messagingStats',
                name: 'Calculating messaging statistics...',
                fn: () => {
                    const stats = analytics.getMessagingStatistics();
                    if (stats) {
                        dom.totalMessages.textContent = stats.totalMessages.toLocaleString();
                        dom.totalChats.textContent = stats.totalChats.toLocaleString();
                    }
                    return stats;
                }
            },
            {
                key: 'activityHeatmap',
                name: 'Generating activity heatmap...',
                fn: () => {
                    const heatmapData = analytics.getActivityHeatmapData();
                    if (heatmapData) {
                        dom.mostActiveDay.textContent = heatmapData.mostActiveDay;
                        dom.mostActiveHour.textContent = heatmapData.mostActiveHour;
                        visualizer.renderActivityHeatmap(dom.activityHeatmap, heatmapData);
                    }
                    return heatmapData;
                }
            },
            {
                key: 'topContacts',
                name: 'Analyzing top contacts...',
                fn: () => {
                    const topContacts = analytics.getTopContacts(10);
                    if (topContacts) {
                        visualizer.renderTopContactsChart(dom.topContactsChart, topContacts);
                    }
                    return topContacts;
                }
            },
            {
                key: 'messageTimeline',
                name: 'Building message timeline...',
                fn: () => {
                    const timeline = analytics.getMessageTimeline();
                    if (timeline) {
                        visualizer.renderMessageTimeline(dom.messageTimelineChart, timeline);
                    }
                    return timeline;
                }
            },
            {
                key: 'interactionNetwork',
                name: 'Mapping interaction network...',
                fn: () => {
                    const interactions = analytics.getInteractionData();
                    if (interactions) {
                        visualizer.renderInteractionGraph(dom.interactionGraph, interactions);
                    }
                    return interactions;
                }
            },
            {
                key: 'responseTimes',
                name: 'Analyzing response times...',
                fn: () => {
                    const responseTimes = analytics.getResponseTimeAnalysis();
                    if (responseTimes) {
                        visualizer.renderResponseTimeChart(dom.responseTimeChart, responseTimes);
                    }
                    return responseTimes;
                }
            },
            {
                key: 'wordCloud',
                name: 'Creating word cloud...',
                fn: () => {
                    const wordData = analytics.getWordFrequency();
                    if (wordData) {
                        visualizer.renderWordCloud(dom.wordCloud, wordData);
                    }
                    return wordData;
                }
            },
            {
                key: 'emojiAnalysis',
                name: 'Processing emoji usage...',
                fn: () => {
                    const emojiData = analytics.getEmojiAnalysis();
                    if (emojiData) {
                        visualizer.renderEmojiAnalysis(dom.emojiAnalysis, emojiData);
                    }
                    return emojiData;
                }
            },
            {
                key: 'sentiment',
                name: 'Computing sentiment analysis...',
                fn: () => {
                    const sentimentData = analytics.getSentimentAnalysis();
                    if (sentimentData) {
                        visualizer.renderSentimentChart(dom.sentimentChart, sentimentData);
                    }
                    return sentimentData;
                }
            }
        ];
    
        // Hide progress and show results
        dom.analyticsProgressArea.style.display = 'none';
        dom.analyticsResults.style.display = 'block';
    
        // Filter components based on selected analysis types
        const selectedComponents = allComponents.filter(component =>
            selectedAnalysisTypes[component.key] === true
        );
    
        for (let i = 0; i < selectedComponents.length; i++) {
            const component = selectedComponents[i];
            const progress = Math.round(((i) / selectedComponents.length) * 100);
            
            updateAnalyticsProgress(
                component.name,
                progress,
                `Step ${i + 1} of ${selectedComponents.length} - Generating selected visualizations`
            );
            
            // Add small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 200));
            
            try {
                component.fn();
            } catch (error) {
                console.warn(`Failed to render ${component.name}:`, error);
            }
        }
        
        // Final progress update
        updateAnalyticsProgress(
            'Analysis complete!',
            100,
            `${selectedComponents.length} analytics components have been generated successfully`
        );
        
        // Brief pause before hiding progress
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    function exportAnalytics(format) {
        if (!analyticsProcessed) {
            alert(t('analytics.runAnalysisFirst') || 'Please run analysis first');
            return;
        }

        const data = analytics.exportAnalyticsData();
        
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vk_analytics_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'csv') {
            // Create CSV from top contacts and basic stats
            let csvContent = 'Category,Name,Value\n';
            
            // Add basic stats
            const stats = data.messagingStatistics;
            if (stats) {
                csvContent += `Total Messages,,${stats.totalMessages}\n`;
                csvContent += `Total Chats,,${stats.totalChats}\n`;
                csvContent += `Average Message Length,,${stats.averageMessageLength.toFixed(2)}\n`;
                csvContent += `Average Words Per Message,,${stats.averageWordsPerMessage.toFixed(2)}\n`;
            }
            
            // Add top contacts
            if (data.topContacts) {
                csvContent += '\nTop Contacts\n';
                data.topContacts.forEach(contact => {
                    csvContent += `Contact,${contact.name},${contact.messageCount}\n`;
                });
            }
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vk_analytics_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    function filterList(listElement, searchTerm) {
        const term = searchTerm.toLowerCase();
        listElement.querySelectorAll('label').forEach(label => {
            const text = label.textContent.toLowerCase();
            label.style.display = text.includes(term) ? 'block' : 'none';
        });
    }

    function toggleAllCheckboxes(listElement, checked) {
        listElement.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);
    }

    function toggleAllAnalysisTypes(checked) {
        document.querySelectorAll('.analysis-options-grid input[type="checkbox"]').forEach(cb => cb.checked = checked);
    }

    function getSelectedChatsForAnalytics() {
        const selectedChatIds = [...document.querySelectorAll('.analytics-chat-checkbox:checked')].map(cb => cb.value);
        const selectedChats = new Map();
        selectedChatIds.forEach(id => {
            if (foundChats.has(id)) {
                selectedChats.set(id, foundChats.get(id));
            }
        });
        return selectedChats;
    }

    function getSelectedAnalysisTypes() {
        return {
            messagingStats: dom.analysisMessagingStats.checked,
            activityHeatmap: dom.analysisActivityHeatmap.checked,
            topContacts: dom.analysisTopContacts.checked,
            messageTimeline: dom.analysisMessageTimeline.checked,
            interactionNetwork: dom.analysisInteractionNetwork.checked,
            responseTimes: dom.analysisResponseTimes.checked,
            wordCloud: dom.analysisWordCloud.checked,
            emojiAnalysis: dom.analysisEmojiAnalysis.checked,
            sentiment: dom.analysisSentiment.checked
        };
    }

    // --- Final Processing ---
    async function processSelected() {
        screenManager.showScreen('progress');
        ui.setProcessingState(true);
        dom.statusLog.textContent = ""; // Clear log
        ui.log(t('status.buildingList'));

        const decoder = new TextDecoder('windows-1251');
        let mediaFilesToDownload = [];

        const selectedAlbumIndexes = [...document.querySelectorAll('.album-checkbox:checked')].map(cb => parseInt(cb.value));
        for (const index of selectedAlbumIndexes) {
            const album = foundAlbums[index];
            const html = decoder.decode(await album.file.async('uint8array'));
            mediaFilesToDownload.push(...parseAlbumHtml(album.name, html));
        }

        const selectedChatIds = [...document.querySelectorAll('.chat-checkbox:checked')].map(cb => cb.value);
        for (const id of selectedChatIds) {
            const chat = foundChats.get(id);
            mediaFilesToDownload.push(...await parseChatHtml(chat, decoder));
        }
        
        // Count different media types
        const images = mediaFilesToDownload.filter(f => !f.mediaType || f.mediaType === 'image');
        const audio = mediaFilesToDownload.filter(f => f.mediaType === 'audio');
        
        ui.log(`Found ${mediaFilesToDownload.length} media files total: ${images.length} images, ${audio.length} audio files`);
        
        if (mediaFilesToDownload.length > 0) {
            // Reset retry counter for new download session
            currentRetryAttempt = 0;
            await fetchAndZipMediaFiles(mediaFilesToDownload);
        } else {
             ui.log('No media files found to download');
        }

        ui.setProcessingState(false);
    }

    async function fetchAndZipMediaFiles(mediaFileList) {
        const batchSize = parseInt(dom.batchSizeInput.value) || CONFIG.defaults.batchSize;
        const sleepTime = parseInt(dom.sleepTimeInput.value) || CONFIG.defaults.sleepTime;
        const exifEnabled = dom.exifToggle.checked;
        const sortOrder = dom.sortOrderSelect.value;
        
        const sortedMediaFiles = sortMediaFiles(mediaFileList, sortOrder);
        
        await downloadAllMediaWithRetries(sortedMediaFiles, batchSize, sleepTime, exifEnabled);
    }
    
    function sortMediaFiles(mediaFileList, sortOrder) {
        const sorted = [...mediaFileList];
        switch (sortOrder) {
            case 'date':
                return sorted.sort((a, b) => {
                    const dateA = parseVkDate(a.date);
                    const dateB = parseVkDate(b.date);
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return dateA - dateB;
                });
            case 'size':
                return sorted.sort((a, b) => a.url.length - b.url.length);
            case 'name':
            default:
                return sorted.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
        }
    }
    
    async function downloadAllMediaWithRetries(mediaFileList, batchSize, sleepTime, exifEnabled) {
        let allSuccessfulMedia = [];
        let remainingFiles = [...mediaFileList];
        currentRetryAttempt = 0;
        
        ui.log(`Starting download process for ${mediaFileList.length} files with up to ${maxRetryAttempts} retry attempts...`);
        
        while (remainingFiles.length > 0 && currentRetryAttempt <= maxRetryAttempts) {
            if (currentRetryAttempt === 0) {
                ui.log(`Initial download attempt (${remainingFiles.length} files)...`);
            } else {
                ui.log(`Retry attempt ${currentRetryAttempt}/${maxRetryAttempts} (${remainingFiles.length} failed files)...`);
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            const result = await downloadBatch(remainingFiles, batchSize, sleepTime, exifEnabled);
            
            // Add successful downloads to our collection
            allSuccessfulMedia.push(...result.successful);
            
            // Update remaining files to only failed ones
            remainingFiles = result.failed;
            
            if (shouldStop) {
                ui.log('[INFO] Download stopped by user');
                break;
            }
            
            if (remainingFiles.length === 0) {
                ui.log('All downloads completed successfully!');
                break;
            }
            
            currentRetryAttempt++;
        }
        
        if (remainingFiles.length > 0 && !shouldStop) {
            ui.log(`Download complete with ${remainingFiles.length} permanently failed files after ${maxRetryAttempts} retry attempts.`);
        }
        
        // Now create the final ZIP with all successful downloads
        await createFinalZip(allSuccessfulMedia, remainingFiles, mediaFileList.length);
    }
    
    async function downloadBatch(mediaFileList, batchSize, sleepTime, exifEnabled) {
        let successfulMedia = [];
        let failedMedia = [];
        let processedCount = 0;
        
        // Reset stop flag
        shouldStop = false;
        
        const downloadMediaFile = async (mediaFile) => {
            // Check if we should stop
            if (shouldStop) {
                throw new Error('Download stopped by user');
            }
            
            try {
                const response = await fetch(mediaFile.url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                let blob = await response.blob();
                
                const parsedDate = parseVkDate(mediaFile.date);
                let exifAdded = false;
                
                // Only add EXIF data to images
                if (exifEnabled && parsedDate && window.piexif &&
                    (!mediaFile.mediaType || mediaFile.mediaType === 'image')) {
                    const originalSize = blob.size;
                    blob = await addExifData(blob, parsedDate, mediaFile.path.split('/').pop());
                    exifAdded = blob.size !== originalSize;
                }
                
                return { success: true, mediaFile, blob, parsedDate, exifAdded };
            } catch (error) {
                if (shouldStop) {
                    return { success: false, mediaFile, error: { message: 'Download stopped by user' }, stopped: true };
                }
                ui.log(`[ERROR] Failed to download ${mediaFile.mediaType || 'file'}: ${mediaFile.url} - ${error.message}`);
                return { success: false, mediaFile, error };
            }
        };

        for (let i = 0; i < mediaFileList.length && !shouldStop; i += batchSize) {
            const batch = mediaFileList.slice(i, i + batchSize);
            
            const promises = batch.map(downloadMediaFile);
            const results = await Promise.all(promises);
            
            // Check if any download was stopped
            if (results.some(r => r.stopped)) {
                ui.log('[INFO] Download stopped by user');
                break;
            }
            
            // Separate successful and failed downloads
            results.forEach(result => {
                if (result.success) {
                    successfulMedia.push({
                        ...result.mediaFile,
                        blob: result.blob,
                        parsedDate: result.parsedDate,
                        exifAdded: result.exifAdded
                    });
                } else {
                    failedMedia.push({
                        ...result.mediaFile,
                        error: result.error.message
                    });
                }
            });
            
            processedCount += batch.length;
            const progressText = shouldStop ? 'Download stopped' : `Downloaded ${successfulMedia.length} / ${mediaFileList.length} media files`;
                
            ui.updateProgress(
                progressText,
                Math.min(processedCount, mediaFileList.length),
                mediaFileList.length
            );
            
            if (i + batchSize < mediaFileList.length && sleepTime > 0 && !shouldStop) {
                await new Promise(resolve => setTimeout(resolve, sleepTime));
            }
        }
        
        return { successful: successfulMedia, failed: failedMedia };
    }
    
    async function createFinalZip(allSuccessfulMedia, finalFailedFiles, totalFiles) {
        const zip = new JSZip();
        
        // Add all successful media to ZIP
        allSuccessfulMedia.forEach(mediaFile => {
            zip.file(mediaFile.path, mediaFile.blob);
        });
        
        // Count by media type
        const successfulImages = allSuccessfulMedia.filter(f => !f.mediaType || f.mediaType === 'image');
        const successfulAudio = allSuccessfulMedia.filter(f => f.mediaType === 'audio');
        
        ui.log(`\nFinal results: ${allSuccessfulMedia.length} / ${totalFiles} files successfully downloaded`);
        ui.log(`  - Images: ${successfulImages.length}`);
        ui.log(`  - Audio: ${successfulAudio.length}`);
        
        if (finalFailedFiles.length > 0) {
            ui.log(`\nPermanently failed downloads: ${finalFailedFiles.length}`);
            ui.showFailedDownloads(finalFailedFiles);
        }
        
        const exifCount = allSuccessfulMedia.filter(f => f.exifAdded).length;
        const parsedDateCount = allSuccessfulMedia.filter(f => f.parsedDate).length;
        
        const metadata = {
            download_info: {
                date_created: new Date().toISOString(),
                total_files_found: totalFiles,
                total_files_downloaded: allSuccessfulMedia.length,
                total_files_failed: finalFailedFiles.length,
                images_downloaded: successfulImages.length,
                audio_downloaded: successfulAudio.length,
                files_with_parsed_dates: parsedDateCount,
                images_with_exif_added: exifCount,
                retry_attempts_made: currentRetryAttempt,
                max_retry_attempts: maxRetryAttempts
            },
            successful_downloads: allSuccessfulMedia.map(f => ({
                filename: f.path.split('/').pop(),
                path: f.path,
                original_url: f.url,
                vk_url: f.vkUrl || null,
                date_from_vk: f.date || null,
                parsed_date: f.parsedDate ? f.parsedDate.toISOString() : null,
                exif_added: f.exifAdded || false,
                message_id: f.messageId || null,
                media_type: f.mediaType || 'image'
            })),
            failed_downloads: finalFailedFiles.map(f => ({
                filename: f.path.split('/').pop(),
                path: f.path,
                original_url: f.url,
                error: f.error,
                date_from_vk: f.date || null,
                media_type: f.mediaType || 'image'
            }))
        };

        zip.file('download_metadata.json', JSON.stringify(metadata, null, 2));

        ui.log('Creating final ZIP archive...');
        const blob = await zip.generateAsync({ type: "blob" }, (metadata) => {
            ui.updateProgress(`Zipping: ${metadata.percent.toFixed(0)}% complete`, metadata.percent, 100);
        });
        
        const fileName = `vk_media_${new Date().toISOString().split('T')[0]}.zip`;
        const downloadUrl = URL.createObjectURL(blob);
        
        dom.finalDownloadLink.href = downloadUrl;
        dom.finalDownloadLink.download = fileName;
        dom.downloadLinkArea.style.display = 'block';
        ui.log('Final ZIP archive ready for download!');
    }


    function resetApplication() {
        zipFile = null;
        chatNameMap.clear();
        foundAlbums = [];
        foundChats.clear();
        isProcessing = false;
        shouldStop = false;
        failedDownloads = [];
        currentRetryAttempt = 0;
        
        // Reset analytics
        analytics = new VKAnalytics();
        analyticsProcessed = false;
        dom.analyticsConfiguration.style.display = 'block';
        dom.analyticsProgressArea.style.display = 'none';
        dom.analyticsResults.style.display = 'none';
        dom.analyticsChatList.innerHTML = '';
        switchTab('download'); // Reset to download tab
        
        dom.albumList.innerHTML = '';
        dom.chatList.innerHTML = '';
        dom.statusLog.textContent = '';
        dom.analysisStatus.textContent = '';
        dom.fileInput.value = '';
        
        document.getElementById('albums-count').textContent = '0';
        document.getElementById('chats-count').textContent = '0';
        
        dom.exifToggle.checked = CONFIG.defaults.exifEnabled;
        dom.batchSizeInput.value = CONFIG.defaults.batchSize;
        dom.sleepTimeInput.value = CONFIG.defaults.sleepTime;
        dom.sortOrderSelect.value = CONFIG.defaults.sortOrder;
        
        dom.progressBar.value = 0;
        dom.progressLabel.textContent = t('progress.initializing');
        dom.downloadLinkArea.style.display = 'none';
        
        // Hide failed downloads section
        if (dom.failedDownloadsSection) {
            dom.failedDownloadsSection.style.display = 'none';
        }
        
        if (dom.finalDownloadLink.href && dom.finalDownloadLink.href.startsWith('blob:')) {
            URL.revokeObjectURL(dom.finalDownloadLink.href);
        }
        dom.finalDownloadLink.href = '#';
        
        
        ui.setProcessingState(false);
        screenManager.showScreen('upload');
    }

    document.getElementById('process-button').addEventListener('click', processSelected);
    document.getElementById('return-button').addEventListener('click', resetApplication);

    // Stop button functionality
    if (dom.stopButton) {
        dom.stopButton.addEventListener('click', () => {
            shouldStop = true;
            dom.stopButton.disabled = true;
            dom.stopButton.textContent = t('status.stopping') || 'Stopping...';
            ui.log('[INFO] Stop requested by user');
        });
    }


    // --- Init ---
    screenManager.showScreen('upload');
});
