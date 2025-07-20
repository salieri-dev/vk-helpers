document.addEventListener('DOMContentLoaded', () => {
    // Wait for external scripts to load
    const waitForDependencies = () => {
        return new Promise((resolve) => {
            const checkDependencies = () => {
                if (typeof CONFIG !== 'undefined' && typeof TRANSLATIONS_EN !== 'undefined' && typeof TRANSLATIONS_RU !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkDependencies, 10);
                }
            };
            checkDependencies();
        });
    };
    
    waitForDependencies().then(() => {
        // --- Load Configuration and Translations ---
        let currentLanguage = localStorage.getItem('vk-helper-language') || CONFIG.ui.defaultLanguage;
        let currentTheme = localStorage.getItem('vk-helper-theme') || CONFIG.ui.defaultTheme;
        let translations = currentLanguage === 'ru' ? TRANSLATIONS_RU : TRANSLATIONS_EN;
        
        // Apply theme on load
        document.documentElement.setAttribute('data-theme', currentTheme);
    
    // --- Translation System ---
    function t(key, replacements = {}) {
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
    
    // Apply translations to DOM
    function applyTranslations() {
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
    
    // Archive validation function
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
    
    // --- Constants & State ---
    let zipFile = null;
    let chatNameMap = new Map();
    let foundAlbums = [];
    let foundChats = new Map();
    let isProcessing = false;

    // --- Russian Date Parsing ---
    const MONTHS_MAP = {
        // January - январь
        "янв": 1, "января": 1, "январе": 1, "январём": 1, "январю": 1, "январь": 1,
        // February - февраль
        "фев": 2, "февраля": 2, "феврале": 2, "февралём": 2, "февралю": 2, "февраль": 2,
        // March - март
        "мар": 3, "марта": 3, "марте": 3, "мартом": 3, "марту": 3, "март": 3,
        // April - апрель
        "апр": 4, "апреля": 4, "апреле": 4, "апрелём": 4, "апрелю": 4, "апрель": 4,
        // May - май
        "май": 5, "мая": 5, "мае": 5, "маем": 5, "маю": 5,
        // June - июнь
        "июн": 6, "июня": 6, "июне": 6, "июнём": 6, "июню": 6, "июнь": 6,
        // July - июль
        "июл": 7, "июля": 7, "июле": 7, "июлём": 7, "июлю": 7, "июль": 7,
        // August - август
        "авг": 8, "августа": 8, "августе": 8, "августом": 8, "августу": 8, "август": 8,
        // September - сентябрь
        "сен": 9, "сентября": 9, "сентябре": 9, "сентябрём": 9, "сентябрю": 9, "сентябрь": 9,
        // October - октябрь
        "окт": 10, "октября": 10, "октябре": 10, "октябрём": 10, "октябрю": 10, "октябрь": 10,
        // November - ноябрь
        "ноя": 11, "ноября": 11, "ноябре": 11, "ноябрём": 11, "ноябрю": 11, "ноябрь": 11,
        // December - декабрь
        "дек": 12, "декабря": 12, "декабре": 12, "декабрём": 12, "декабрю": 12, "декабрь": 12
    };

    // --- Date Parsing Function ---
    function parseVkDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        
        try {
            let day, month, year, timeStr;
            
            if (dateStr.includes(',') && (dateStr.startsWith('Вы,') || /^[А-Яа-яA-Za-z\s]+,/.test(dateStr))) {
                const commaParts = dateStr.split(',', 2);
                if (commaParts.length !== 2) throw new Error('Invalid chat date format');
                
                const datePart = commaParts[1].trim();
                const parts = datePart.split(' ');
                if (parts.length < 5) throw new Error('Incomplete chat date format');
                
                day = parts[0];
                const monthStr = parts[1];
                year = parts[2];
                timeStr = parts[4]; // Skip "в" at parts[3]
                
                // Parse Russian month name
                const monthKey = monthStr.toLowerCase();
                if (monthKey in MONTHS_MAP) {
                    month = MONTHS_MAP[monthKey];
                } else {
                    const shortMonth = monthStr.substring(0, 3).toLowerCase();
                    if (shortMonth in MONTHS_MAP) {
                        month = MONTHS_MAP[shortMonth];
                    } else {
                        throw new Error(`Unknown month: ${monthStr}`);
                    }
                }
                
                // Convert time from HH:MM:SS to HH:MM
                const timeParts = timeStr.split(':');
                if (timeParts.length >= 2) {
                    timeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
                } else {
                    timeStr = `${timeParts[0].padStart(2, '0')}:00`;
                }
            } else {
                // Album date format
                let parts = dateStr.split(' ').filter(p => p && p !== 'в');
                if (parts.length < 4) throw new Error('Unsupported date format');
                
                day = parts[0];
                const monthStr = parts[1];
                year = parts[2];
                timeStr = parts[3];
                
                // Try numeric month first, then Russian names
                if (/^\d+$/.test(monthStr)) {
                    month = parseInt(monthStr);
                    if (month < 1 || month > 12) throw new Error(`Invalid numeric month: ${month}`);
                } else {
                    const monthKey = monthStr.toLowerCase();
                    if (monthKey in MONTHS_MAP) {
                        month = MONTHS_MAP[monthKey];
                    } else {
                        const shortMonth = monthStr.substring(0, 3).toLowerCase();
                        if (shortMonth in MONTHS_MAP) {
                            month = MONTHS_MAP[shortMonth];
                        } else {
                            throw new Error(`Unknown month: ${monthStr}`);
                        }
                    }
                }
                
                // Handle time format
                if (timeStr.includes(':')) {
                    const timeParts = timeStr.split(':');
                    if (timeParts.length === 2) {
                        timeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
                    } else {
                        throw new Error(`Invalid time format: ${timeStr}`);
                    }
                } else {
                    timeStr = `${timeStr.padStart(2, '0')}:00`;
                }
            }
            
            // Create date object
            const dayPadded = day.padStart(2, '0');
            const monthPadded = month.toString().padStart(2, '0');
            const dateTimeStr = `${dayPadded} ${monthPadded} ${year} ${timeStr}`;
            
            const parsedDate = new Date(year, month - 1, parseInt(day),
                                      parseInt(timeStr.split(':')[0]),
                                      parseInt(timeStr.split(':')[1]));
                                      
            if (isNaN(parsedDate.getTime())) {
                throw new Error(`Invalid date: ${dateTimeStr}`);
            }
            
            return parsedDate;
        } catch (error) {
            console.warn(`Failed to parse VK date: "${dateStr}" - ${error.message}`);
            return null;
        }
    }

    // --- [REVISED] EXIF Writing Function ---
    async function addExifData(imageBlob, parsedDate, imageName) {
        if (!parsedDate || !window.piexif) {
            return imageBlob;
        }

        try {
            // Use FileReader to safely convert the blob to a Data URL.
            // This is more robust than manual string manipulation.
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(new Error(`FileReader error: ${error.message}`));
                reader.readAsDataURL(imageBlob);
            });

            // EXIF data can only be written to JPEG files.
            if (!dataUrl.startsWith('data:image/jpeg')) {
                return imageBlob; // Not a JPEG, return original blob.
            }

            // Format date for EXIF (YYYY:MM:DD HH:MM:SS)
            const exifDate = parsedDate.getFullYear() + ':' +
                (parsedDate.getMonth() + 1).toString().padStart(2, '0') + ':' +
                parsedDate.getDate().toString().padStart(2, '0') + ' ' +
                parsedDate.getHours().toString().padStart(2, '0') + ':' +
                parsedDate.getMinutes().toString().padStart(2, '0') + ':' +
                parsedDate.getSeconds().toString().padStart(2, '0');

            // Construct the EXIF data object using piexif constants for readability.
            const exifDict = {
                "0th": {
                    [piexif.ImageIFD.DateTime]: exifDate
                },
                "Exif": {
                    [piexif.ExifIFD.DateTimeOriginal]: exifDate,
                    [piexif.ExifIFD.DateTimeDigitized]: exifDate
                },
                 "GPS": {},
                 "1st": {},
                 "thumbnail": null
            };
            
            const exifBytes = piexif.dump(exifDict);

            // Insert new EXIF data into the image's Data URL.
            const newImageDataUrl = piexif.insert(exifBytes, dataUrl);

            // Convert the new Data URL back to a Blob efficiently using fetch.
            const response = await fetch(newImageDataUrl);
            return await response.blob();

        } catch (error) {
            console.warn(`Failed to add EXIF data to ${imageName}: ${error.message}`);
            return imageBlob; // Return original blob on any error.
        }
    }


    // --- DOM Elements ---
    const screens = {
        upload: document.getElementById('upload-screen'),
        selection: document.getElementById('selection-screen'),
        progress: document.getElementById('progress-screen')
    };
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('zip-file');
    const analysisStatus = document.getElementById('analysis-status');
    const albumList = document.getElementById('album-list');
    const chatList = document.getElementById('chat-list');
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const statusLog = document.getElementById('status-log');
    const downloadLinkArea = document.getElementById('download-link-area');
    const finalDownloadLink = document.getElementById('final-download-link');
    
    // Configuration elements
    const exifToggle = document.getElementById('exif-toggle');
    const batchSizeInput = document.getElementById('batch-size');
    const sleepTimeInput = document.getElementById('sleep-time');
    const sortOrderSelect = document.getElementById('sort-order');
    const archiveBatchingToggle = document.getElementById('archive-batching');
    const archiveBatchSizeInput = document.getElementById('archive-batch-size');
    const batchConfig = document.getElementById('batch-config');
    const estimatedTimeSpan = document.getElementById('estimated-time');
    
    // UI control elements
    const languageSelect = document.getElementById('language-select');
    const themeSelect = document.getElementById('theme-select');
    
    // Initialize UI controls with saved preferences
    if (languageSelect) languageSelect.value = currentLanguage;
    if (themeSelect) themeSelect.value = currentTheme;
    
    // Apply initial translations
    applyTranslations();

    // --- UI Management ---
    const ui = {
        showScreen: (screenName) => {
            Object.values(screens).forEach(s => s.classList.remove('active'));
            screens[screenName].classList.add('active');
        },
        log: (message) => {
            statusLog.textContent += message + '\n';
            statusLog.scrollTop = statusLog.scrollHeight;
        },
        updateProgress: (label, value, max) => {
            progressLabel.textContent = label;
            progressBar.value = value;
            progressBar.max = max;
        },
        setProcessingState: (processing) => {
            isProcessing = processing;
            document.querySelectorAll('button, input, select').forEach(el => {
                if (el.id !== 'language-select' && el.id !== 'theme-select') {
                    el.disabled = processing;
                }
            });
        },
        renderSelectionLists: () => {
            foundAlbums.sort((a, b) => a.name.localeCompare(b.name));
            albumList.innerHTML = foundAlbums.map((album, i) => `
                <label><input type="checkbox" class="album-checkbox" value="${i}" checked> ${album.name} (${album.imageCount} images)</label>
            `).join('');
            document.getElementById('albums-count').textContent = foundAlbums.length;

            const sortedChats = [...foundChats.values()].sort((a, b) => a.name.localeCompare(b.name));
            chatList.innerHTML = sortedChats.map(chat => `
                <label><input type="checkbox" class="chat-checkbox" value="${chat.id}" checked> ${chat.name} (${chat.imageCount} images, ${chat.files.length} parts)</label>
            `).join('');
            document.getElementById('chats-count').textContent = sortedChats.length;
            
            // Update time estimation after rendering
            setTimeout(updateTimeEstimation, 100);
        }
    };

    // --- Event Listeners ---
    
    // Theme and Language switching
    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        translations = currentLanguage === 'ru' ? TRANSLATIONS_RU : TRANSLATIONS_EN;
        localStorage.setItem('vk-helper-language', currentLanguage);
        applyTranslations();
        updateTimeEstimation(); // Update with new language
    });
    
    themeSelect.addEventListener('change', (e) => {
        currentTheme = e.target.value;
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('vk-helper-theme', currentTheme);
    });
    
    // File handling
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => e.target.files.length && handleFile(e.target.files[0]));
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
        dropZone.querySelector('h2').textContent = t('upload.dragOver');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
        dropZone.querySelector('h2').textContent = t('upload.dropText');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        dropZone.querySelector('h2').textContent = t('upload.dropText');
        e.dataTransfer.files.length && handleFile(e.dataTransfer.files[0]);
    });

    document.getElementById('album-search').addEventListener('keyup', (e) => filterList(albumList, e.target.value));
    document.getElementById('chat-search').addEventListener('keyup', (e) => filterList(chatList, e.target.value));
    
    document.getElementById('select-all-albums').addEventListener('click', () => toggleAllCheckboxes(albumList, true));
    document.getElementById('deselect-all-albums').addEventListener('click', () => toggleAllCheckboxes(albumList, false));
    document.getElementById('select-all-chats').addEventListener('click', () => toggleAllCheckboxes(chatList, true));
    document.getElementById('deselect-all-chats').addEventListener('click', () => toggleAllCheckboxes(chatList, false));

    // Configuration event listeners
    archiveBatchingToggle.addEventListener('change', () => {
        batchConfig.style.display = archiveBatchingToggle.checked ? 'block' : 'none';
        updateTimeEstimation();
    });
    
    // Update time estimation when settings change
    [batchSizeInput, sleepTimeInput, sortOrderSelect, exifToggle, archiveBatchSizeInput].forEach(element => {
        element.addEventListener('change', updateTimeEstimation);
        element.addEventListener('input', updateTimeEstimation);
    });
    
    // Update estimation when selection changes
    albumList.addEventListener('change', updateTimeEstimation);
    chatList.addEventListener('change', updateTimeEstimation);

    document.getElementById('process-button').addEventListener('click', processSelected);
    document.getElementById('return-button').addEventListener('click', resetApplication);

    // --- Core Logic ---
    async function handleFile(file) {
        if (isProcessing) return;
        
        if (!file.name.toLowerCase().endsWith('.zip')) {
            alert(t('upload.invalidFile'));
            return;
        }
        
        ui.setProcessingState(true);
        analysisStatus.textContent = t('analysis.loading');

        try {
            zipFile = await JSZip.loadAsync(file);
            
            // Validate archive structure
            analysisStatus.textContent = t('analysis.validating');
            validateArchive(zipFile);
            
            // Analyze archive contents
            analysisStatus.textContent = t('analysis.analyzing');
            await analyzeZip();
            
            // Quick image estimation
            analysisStatus.textContent = t('analysis.estimatingImages');
            estimateImageCounts();
            
            ui.renderSelectionLists();
            ui.showScreen('selection');
            
            const totalAlbumImages = foundAlbums.reduce((sum, album) => sum + album.imageCount, 0);
            const totalChatImages = Array.from(foundChats.values()).reduce((sum, chat) => sum + chat.imageCount, 0);
            
            analysisStatus.textContent = t('analysis.foundWithCounts', {
                albums: foundAlbums.length,
                chats: foundChats.size,
                albumImages: totalAlbumImages,
                chatImages: totalChatImages,
                totalImages: totalAlbumImages + totalChatImages
            });
        } catch (error) {
            analysisStatus.textContent = t('analysis.error') + ': ' + error.message;
            console.error(error);
        } finally {
            ui.setProcessingState(false);
        }
    }

    async function analyzeZip() {
        const decoder = new TextDecoder('windows-1251');
        
        // --- Clear previous analysis ---
        chatNameMap.clear();
        foundAlbums = [];
        foundChats.clear();
        
        // 1. Populate chat names (no change here)
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

        // 2. *** NEW ALBUM LOGIC ***
        // Find albums using the master index file for correct names
        const albumIndexFile = zipFile.file('photos/photo-albums.html');
        if (albumIndexFile) {
            const doc = new DOMParser().parseFromString(decoder.decode(await albumIndexFile.async('uint8array')), 'text/html');
            doc.querySelectorAll('.item .item__main a').forEach(link => {
                const name = link.textContent.trim();
                const path = link.getAttribute('href'); // e.g., "photo-albums/282498999.html"
                
                // Construct the full path relative to the ZIP root
                const fullPath = 'photos/' + path;
                const albumFileEntry = zipFile.file(fullPath);

                if (albumFileEntry) {
                    // Store the correct name along with the file entry, we'll count images later
                    foundAlbums.push({ name: name, file: albumFileEntry, imageCount: 0 });
                }
            });
        } else {
            console.warn("Could not find photos/index.html. Album names might be incorrect.");
            // (Optional: You could add the old discovery method here as a fallback)
        }

        // 3. Find chats (no change here)
        for (const [relativePath, zipEntry] of Object.entries(zipFile.files)) {
            if (relativePath.startsWith('messages/') && relativePath.endsWith('.html') && !relativePath.endsWith('index-messages.html')) {
                const id = relativePath.split('/')[1];
                if (!foundChats.has(id)) {
                    foundChats.set(id, { id, name: chatNameMap.get(id) || `Chat ${id}`, files: [], imageCount: 0 });
                }
                foundChats.get(id).files.push(zipEntry);
            }
        }
        
        // Quick estimate image counts without parsing HTML
        estimateImageCounts();
    }
    
    // Fast estimation based on file patterns and directory structure
    function estimateImageCounts() {
        // Estimate album images by counting photo files in ZIP
        for (const album of foundAlbums) {
            // Extract album ID from file path to find corresponding photos
            const albumMatch = album.file.name.match(/photo-albums\/(\d+)\.html$/);
            if (albumMatch) {
                const albumId = albumMatch[1];
                // Count actual image files for this album in the ZIP
                let imageCount = 0;
                for (const [path, entry] of Object.entries(zipFile.files)) {
                    if (path.startsWith(`photos/`) &&
                        path.includes(`${albumId}/`) &&
                        /\.(jpg|jpeg|png|gif|webp)$/i.test(path)) {
                        imageCount++;
                    }
                }
                // Use count if found, otherwise use reasonable estimate
                album.imageCount = imageCount > 0 ? imageCount : CONFIG.estimation.avgImagesPerAlbum;
            } else {
                album.imageCount = CONFIG.estimation.avgImagesPerAlbum;
            }
        }
        
        // Estimate chat images based on chat file patterns
        for (const [id, chat] of foundChats) {
            let estimatedImages = 0;
            
            // Look at chat file names to estimate message count
            let maxMessages = 0;
            for (const file of chat.files) {
                const match = file.name.match(/messages(\d+)\.html$/);
                if (match) {
                    maxMessages = Math.max(maxMessages, parseInt(match[1]));
                }
            }
            
            // Estimate: roughly 1 image per 15-20 messages in active chats
            if (maxMessages > 0) {
                estimatedImages = Math.max(1, Math.floor(maxMessages / 15));
            } else {
                // Fallback: estimate based on number of chat files
                estimatedImages = chat.files.length * 5; // ~5 images per chat file on average
            }
            
            chat.imageCount = Math.min(estimatedImages, 500); // Cap at reasonable maximum
        }
    }
    
    // --- Time Estimation Function ---
    function updateTimeEstimation() {
        try {
            // Get actual counts from selected albums and chats
            const selectedAlbums = document.querySelectorAll('.album-checkbox:checked');
            const selectedChats = document.querySelectorAll('.chat-checkbox:checked');
            
            // Calculate real image count
            let estimatedImages = 0;
            
            // Count images from selected albums
            selectedAlbums.forEach(checkbox => {
                const albumIndex = parseInt(checkbox.value);
                const album = foundAlbums[albumIndex];
                estimatedImages += album ? album.imageCount : CONFIG.estimation.avgImagesPerAlbum;
            });
            
            // Count images from selected chats
            selectedChats.forEach(checkbox => {
                const chatId = checkbox.value;
                const chat = foundChats.get(chatId);
                estimatedImages += chat ? chat.imageCount : CONFIG.estimation.avgImagesPerChat;
            });
            
            if (estimatedImages === 0) {
                estimatedTimeSpan.textContent = t('selection.noSelection');
                return;
            }
            
            const batchSize = parseInt(batchSizeInput.value) || CONFIG.defaults.batchSize;
            const sleepTime = parseInt(sleepTimeInput.value) || CONFIG.defaults.sleepTime;
            const exifEnabled = exifToggle.checked;
            
            // Time calculations using config values
            const baseTimePerImage = CONFIG.estimation.downloadTimePerImage;
            const exifTimePerImage = exifEnabled ? CONFIG.estimation.exifTimePerImage : 0;
            
            const totalTimePerImage = baseTimePerImage + exifTimePerImage;
            const numberOfBatches = Math.ceil(estimatedImages / batchSize);
            const totalSleepTime = numberOfBatches * sleepTime;
            const totalEstimatedTime = (estimatedImages * totalTimePerImage) + totalSleepTime;
            
            // Convert to minutes
            const totalMinutes = totalEstimatedTime / (1000 * 60);
            
            // Format time display
            const formatTime = (minutes) => {
                if (minutes < 1) return t('time.lessThanMinute');
                if (minutes < 60) return t('time.minutes', { count: Math.round(minutes) });
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = Math.round(minutes % 60);
                return t('time.hoursMinutes', { hours, minutes: remainingMinutes });
            };
            
            estimatedTimeSpan.textContent = t('selection.estimatedTime', {
                count: estimatedImages,
                time: formatTime(totalMinutes)
            });
        } catch (error) {
            estimatedTimeSpan.textContent = t('selection.calculating');
            console.warn('Time estimation error:', error);
        }
    }
    
    async function processSelected() {
        ui.showScreen('progress');
        ui.setProcessingState(true);
        statusLog.textContent = ""; // Clear log
        ui.log('Building file list...');

        const decoder = new TextDecoder('windows-1251');
        let imagesToDownload = [];

        const selectedAlbumIndexes = [...document.querySelectorAll('.album-checkbox:checked')].map(cb => parseInt(cb.value));
        for (const index of selectedAlbumIndexes) {
            const album = foundAlbums[index];
            const html = decoder.decode(await album.file.async('uint8array'));
            imagesToDownload.push(...parseAlbumHtml(album.name, html));
        }

        const selectedChatIds = [...document.querySelectorAll('.chat-checkbox:checked')].map(cb => cb.value);
        for (const id of selectedChatIds) {
            const chat = foundChats.get(id);
            imagesToDownload.push(...await parseChatHtml(chat, decoder));
        }
        
        ui.log(`Found a total of ${imagesToDownload.length} images to download.`);
        if (imagesToDownload.length > 0) {
            await fetchAndZipImages(imagesToDownload);
        } else {
             ui.log('No images selected or found. Nothing to do.');
        }

        ui.setProcessingState(false);
    }

    function parseAlbumHtml(albumName, htmlContent) {
        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        const images = [];
        const sanitizedAlbumName = albumName.replace(/[\<\>:"/\\|?*]/g, ""); // Sanitize for folder names
        
        doc.querySelectorAll('.item').forEach(itemEl => {
            const imgEl = itemEl.querySelector('img');
            if (imgEl && imgEl.src) {
                // Extract VK photo URL
                const vkUrlEl = itemEl.querySelector('a[href*="vk.com/photo"]');
                const vkUrl = vkUrlEl ? vkUrlEl.getAttribute('href') : "";
                
                // Extract date from clear_fix div
                let dateStr = null;
                const dateEl = itemEl.querySelector('.clear_fix');
                if (dateEl) {
                    const fullDateStr = dateEl.textContent.trim();
                    // Clean date string (remove comments info)
                    dateStr = fullDateStr.replace(/\s*Комментарии.*/, '').replace(' в ', ' ').replace(/\s+/g, ' ').trim();
                }
                
                // Extract filename and remove query parameters
                const urlPart = imgEl.src.substring(imgEl.src.lastIndexOf('/') + 1);
                const cleanFilename = urlPart.split('?')[0]; // Remove query parameters
                const finalFilename = `${imgEl.alt || 'photo'}_${cleanFilename}`;
                
                images.push({
                    url: imgEl.src,
                    path: `albums/${sanitizedAlbumName}/${finalFilename}`,
                    vkUrl: vkUrl,
                    date: dateStr,
                    filename: imgEl.alt || 'photo'
                });
            }
        });
        ui.log(`- Queued ${images.length} images from album "${albumName}".`);
        return images;
    }

    async function parseChatHtml(chatData, decoder) {
        const images = [];
        const sanitizedChatName = chatData.name.replace(/[\<\>:"/\\|?*]/g, "");

        for (const file of chatData.files) {
            const doc = new DOMParser().parseFromString(decoder.decode(await file.async('uint8array')), 'text/html');
            doc.querySelectorAll('.item').forEach(itemEl => {
                const attachmentLinks = itemEl.querySelectorAll('.attachment__link');
                attachmentLinks.forEach(link => {
                    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(link.href)) {
                        const messageEl = link.closest('.message');
                        const messageId = messageEl?.dataset.id || 'unknown';
                        
                        // Extract date from message header
                        let dateStr = null;
                        const headerEl = messageEl?.querySelector('.message__header');
                        if (headerEl) {
                            // Remove editing info spans and clean up
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = headerEl.innerHTML;
                            tempDiv.querySelectorAll('span').forEach(span => span.remove());
                            dateStr = tempDiv.textContent.trim();
                        }
                        
                        // Extract filename and remove query parameters
                        const urlPart = link.href.substring(link.href.lastIndexOf('/') + 1);
                        const cleanFilename = urlPart.split('?')[0]; // Remove query parameters
                        const finalFilename = `msg_${messageId}_${cleanFilename}`;
                        
                        images.push({
                            url: link.href,
                            path: `chats/${sanitizedChatName}/${finalFilename}`,
                            messageId: messageId,
                            date: dateStr,
                            filename: cleanFilename
                        });
                    }
                });
            });
        }
        ui.log(`- Queued ${images.length} images from chat "${chatData.name}".`);
        return images;
    }

    async function fetchAndZipImages(imageList) {
        // Get configuration values
        const batchSize = parseInt(batchSizeInput.value) || CONFIG.defaults.batchSize;
        const sleepTime = parseInt(sleepTimeInput.value) || CONFIG.defaults.sleepTime;
        const exifEnabled = exifToggle.checked;
        const sortOrder = sortOrderSelect.value;
        const archiveBatching = archiveBatchingToggle.checked;
        const archiveBatchSize = parseInt(archiveBatchSizeInput.value) || CONFIG.defaults.archiveBatchSize;
        
        // Sort images based on user preference
        const sortedImages = sortImages(imageList, sortOrder);
        
        // Handle archive batching
        if (archiveBatching && sortedImages.length > archiveBatchSize) {
            return await processWithArchiveBatching(sortedImages, archiveBatchSize, batchSize, sleepTime, exifEnabled);
        }
        
        // Single archive processing
        return await processSingleArchive(sortedImages, batchSize, sleepTime, exifEnabled);
    }
    
    // Sort images based on selected order
    function sortImages(imageList, sortOrder) {
        const sorted = [...imageList];
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
                // For size, we'll sort by URL length as a rough proxy since we can't get actual file size without downloading
                return sorted.sort((a, b) => a.url.length - b.url.length);
            case 'name':
            default:
                return sorted.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
        }
    }
    
    // Process multiple archives in batches
    async function processWithArchiveBatching(imageList, archiveBatchSize, batchSize, sleepTime, exifEnabled) {
        const totalBatches = Math.ceil(imageList.length / archiveBatchSize);
        ui.log(`\nUsing archive batching: ${totalBatches} separate ZIP files will be created.`);
        
        const allSuccessful = [];
        const allFailed = [];
        const downloadLinks = [];
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * archiveBatchSize;
            const endIndex = Math.min(startIndex + archiveBatchSize, imageList.length);
            const batchImages = imageList.slice(startIndex, endIndex);
            
            ui.log(`\nProcessing archive batch ${batchIndex + 1}/${totalBatches} (${batchImages.length} images)...`);
            
            const result = await processSingleArchive(batchImages, batchSize, sleepTime, exifEnabled, `batch_${batchIndex + 1}`);
            
            allSuccessful.push(...result.successful);
            allFailed.push(...result.failed);
            downloadLinks.push(result.downloadLink);
            
            // Force garbage collection between batches
            if (batchIndex < totalBatches - 1) {
                ui.log('Cleaning up memory before next batch...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Create a summary page with all download links
        createBatchSummaryPage(downloadLinks, allSuccessful, allFailed);
    }
    
    // Process a single archive
    async function processSingleArchive(imageList, batchSize, sleepTime, exifEnabled, batchName = null) {
        const zip = new JSZip();
        let downloadedCount = 0;
        let successfulImages = [];
        let failedImages = [];
        let processedCount = 0;

        // Function to download a single image
        const downloadImage = async (image) => {
            try {
                const response = await fetch(image.url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                let blob = await response.blob();
                
                // Parse VK date and add EXIF data if enabled
                const parsedDate = parseVkDate(image.date);
                let exifAdded = false;
                if (exifEnabled && parsedDate && window.piexif) {
                    const originalSize = blob.size;
                    blob = await addExifData(blob, parsedDate, image.path.split('/').pop());
                    exifAdded = blob.size !== originalSize; // A simple check to see if data was added
                }
                
                zip.file(image.path, blob);
                downloadedCount++;
                successfulImages.push({ ...image, parsedDate, exifAdded });
                return { success: true, image, parsedDate, exifAdded };
            } catch (error) {
                ui.log(`[ERROR] Failed to download ${image.url}: ${error.message}`);
                failedImages.push({ ...image, error: error.message });
                return { success: false, image, error };
            }
        };

        // Process images in batches
        for (let i = 0; i < imageList.length; i += batchSize) {
            const batch = imageList.slice(i, i + batchSize);
            
            // Download batch in parallel
            const promises = batch.map(downloadImage);
            await Promise.all(promises);
            
            processedCount += batch.length;
            const progressText = batchName ?
                `${batchName}: Downloaded ${downloadedCount} / ${imageList.length}` :
                `Downloaded ${downloadedCount} / ${imageList.length} (${Math.min(processedCount, imageList.length)} processed)`;
                
            ui.updateProgress(
                progressText,
                Math.min(processedCount, imageList.length),
                imageList.length
            );
            
            // Configurable delay between batches
            if (i + batchSize < imageList.length && sleepTime > 0) {
                await new Promise(resolve => setTimeout(resolve, sleepTime));
            }
        }
        
        const logPrefix = batchName ? `${batchName}: ` : '';
        ui.log(`\n${logPrefix}Download complete. Successfully got ${downloadedCount} of ${imageList.length} images.`);
        if (downloadedCount === 0) {
            return { successful: successfulImages, failed: failedImages, downloadLink: null };
        }

        // Create metadata JSON file
        const exifCount = successfulImages.filter(img => img.exifAdded).length;
        const parsedDateCount = successfulImages.filter(img => img.parsedDate).length;
        
        const metadata = {
            download_info: {
                date_created: new Date().toISOString(),
                batch_name: batchName || 'single_archive',
                total_images_found: imageList.length,
                total_images_downloaded: downloadedCount,
                total_images_failed: failedImages.length,
                images_with_parsed_dates: parsedDateCount,
                images_with_exif_added: exifCount,
                configuration: {
                    batch_size: batchSize,
                    sleep_time: sleepTime,
                    exif_enabled: exifEnabled,
                    sort_order: sortOrderSelect.value
                },
                exif_capabilities: [
                    "EXIF DateTimeOriginal, DateTime, and DateTimeDigitized are set from VK dates",
                    "Russian date formats are parsed automatically",
                    "EXIF is only added to JPEG images",
                    "File timestamps cannot be set due to browser limitations"
                ]
            },
            successful_downloads: successfulImages.map(img => ({
                filename: img.path.split('/').pop(),
                path: img.path,
                original_url: img.url,
                vk_url: img.vkUrl || null,
                date_from_vk: img.date || null,
                parsed_date: img.parsedDate ? img.parsedDate.toISOString() : null,
                exif_added: img.exifAdded || false,
                message_id: img.messageId || null
            })),
            failed_downloads: failedImages.map(img => ({
                filename: img.path.split('/').pop(),
                path: img.path,
                original_url: img.url,
                error: img.error,
                date_from_vk: img.date || null
            }))
        };

        zip.file('download_metadata.json', JSON.stringify(metadata, null, 2));

        ui.log(`${logPrefix}Creating ZIP archive with metadata...`);
        const blob = await zip.generateAsync({ type: "blob" }, (metadata) => {
            const progressText = batchName ? `${batchName}: Zipping ${metadata.percent.toFixed(0)}%` : `Zipping: ${metadata.percent.toFixed(0)}% complete`;
            ui.updateProgress(progressText, metadata.percent, 100);
        });
        
        const fileName = batchName ? `vk_images_${batchName}_${new Date().toISOString().split('T')[0]}.zip` : `vk_images_${new Date().toISOString().split('T')[0]}.zip`;
        const downloadUrl = URL.createObjectURL(blob);
        
        if (!batchName) {
            // Single archive - show download link immediately
            finalDownloadLink.href = downloadUrl;
            finalDownloadLink.download = fileName;
            downloadLinkArea.style.display = 'block';
            ui.log('ZIP file with metadata is ready for download!');
            ui.log(`\nEXIF Processing Summary:`);
            ui.log(`- Images with parsed VK dates: ${parsedDateCount}/${imageList.length}`);
            ui.log(`- Images with EXIF data added: ${exifCount}/${downloadedCount} (JPEG only)`);
            ui.log(`\nNote: File timestamps cannot be set due to browser limitations.`);
            ui.log(`Check download_metadata.json for detailed processing information.`);
        } else {
            ui.log(`${batchName}: ZIP file ready`);
        }
        
        return {
            successful: successfulImages,
            failed: failedImages,
            downloadLink: { url: downloadUrl, filename: fileName, count: downloadedCount }
        };
    }
    
    // Create summary page for batch downloads
    function createBatchSummaryPage(downloadLinks, allSuccessful, allFailed) {
        ui.log('\n=== BATCH PROCESSING COMPLETE ===');
        ui.log(`Total images downloaded: ${allSuccessful.length}`);
        ui.log(`Total images failed: ${allFailed.length}`);
        ui.log(`Number of ZIP files created: ${downloadLinks.length}`);
        
        // Create HTML summary
        const summaryHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>VK Archive Download Summary</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .summary { background: #f0f8ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                    .download-link { display: block; background: #4CAF50; color: white; padding: 10px; margin: 5px 0; text-decoration: none; border-radius: 3px; }
                    .download-link:hover { background: #45a049; }
                </style>
            </head>
            <body>
                <h1>VK Archive Download Summary</h1>
                <div class="summary">
                    <h3>Processing Complete</h3>
                    <p><strong>Total Images Downloaded:</strong> ${allSuccessful.length}</p>
                    <p><strong>Total Images Failed:</strong> ${allFailed.length}</p>
                    <p><strong>Number of ZIP Files:</strong> ${downloadLinks.length}</p>
                    <p><strong>Processing Date:</strong> ${new Date().toLocaleString()}</p>
                </div>
                <h2>Download Your ZIP Files</h2>
                ${downloadLinks.map((link, index) =>
                    `<a href="${link.url}" download="${link.filename}" class="download-link">Download ${link.filename} (${link.count} images)</a>`
                ).join('')}
                <p><em>Note: Download all files before closing this page. Links will expire when you navigate away.</em></p>
            </body>
            </html>
        `;
        
        // Create and download summary page
        const summaryBlob = new Blob([summaryHtml], { type: 'text/html' });
        finalDownloadLink.href = URL.createObjectURL(summaryBlob);
        finalDownloadLink.download = `vk_archive_summary_${new Date().toISOString().split('T')[0]}.html`;
        finalDownloadLink.textContent = 'Download Summary Page (with all ZIP links)';
        downloadLinkArea.style.display = 'block';
        
        ui.log('\nDownload summary page created with links to all ZIP files.');
        ui.log('IMPORTANT: Download the summary page first, then use it to download all ZIP files.');
    }
    
    // --- Helper Functions ---
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
    
    // --- Reset Application ---
    function resetApplication() {
        // Reset state variables
        zipFile = null;
        chatNameMap.clear();
        foundAlbums = [];
        foundChats.clear();
        isProcessing = false;
        
        // Clear UI elements
        albumList.innerHTML = '';
        chatList.innerHTML = '';
        statusLog.textContent = '';
        analysisStatus.textContent = '';
        fileInput.value = '';
        
        // Reset counters
        document.getElementById('albums-count').textContent = '0';
        document.getElementById('chats-count').textContent = '0';
        
        // Reset configuration to defaults
        exifToggle.checked = CONFIG.defaults.exifEnabled;
        batchSizeInput.value = CONFIG.defaults.batchSize;
        sleepTimeInput.value = CONFIG.defaults.sleepTime;
        sortOrderSelect.value = CONFIG.defaults.sortOrder;
        archiveBatchingToggle.checked = CONFIG.defaults.archiveBatching;
        archiveBatchingToggle.disabled = false;
        archiveBatchSizeInput.value = CONFIG.defaults.archiveBatchSize;
        batchConfig.style.display = CONFIG.defaults.archiveBatching ? 'block' : 'none';
        
        // Reset progress elements
        progressBar.value = 0;
        progressBar.max = 100;
        progressLabel.textContent = 'Initializing...';
        downloadLinkArea.style.display = 'none';
        
        // Clean up any existing download URLs
        if (finalDownloadLink.href && finalDownloadLink.href.startsWith('blob:')) {
            URL.revokeObjectURL(finalDownloadLink.href);
        }
        finalDownloadLink.href = '#';
        finalDownloadLink.download = 'vk_images.zip';
        finalDownloadLink.textContent = 'Download Your ZIP File';
        
        // Reset time estimation
        estimatedTimeSpan.textContent = '--';
        
        // Re-enable all inputs
        document.querySelectorAll('button, input, select').forEach(el => el.disabled = false);
        
        // Return to upload screen
        ui.showScreen('upload');
    }
    
        // --- Initial State ---
        ui.showScreen('upload');
        updateTimeEstimation();
    });
});