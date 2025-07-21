import ApexCharts from 'apexcharts';

export class AnalyticsVisualizer {
    constructor() {
        this.charts = {}; // Store chart instances to update themes
        this.currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        
        this.commonOptions = {
            chart: {
                type: 'bar',
                height: 350,
                toolbar: {
                    show: true,
                    tools: {
                        download: true,
                        selection: true,
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                    }
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                }
            },
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    horizontal: true,
                }
            },
            dataLabels: {
                enabled: false
            },
            xaxis: {
                labels: {
                    style: {
                        colors: this.currentTheme === 'dark' ? '#999' : '#373d3f',
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: this.currentTheme === 'dark' ? '#999' : '#373d3f',
                    }
                }
            },
            tooltip: {
                theme: this.currentTheme,
            }
        };
    }
    
    // Helper to destroy and clear a chart before re-rendering
    _prepareContainer(container, chartKey) {
        container.innerHTML = '';
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
        }
    }

    // NEW: Update theme for all active charts
    updateTheme(theme) {
        this.currentTheme = theme;
        for (const chartKey in this.charts) {
            if (this.charts[chartKey]) {
                this.charts[chartKey].updateOptions({
                    tooltip: { theme },
                    xaxis: { labels: { style: { colors: theme === 'dark' ? '#999' : '#373d3f' } } },
                    yaxis: { labels: { style: { colors: theme === 'dark' ? '#999' : '#373d3f' } } },
                });
            }
        }
    }
    
    // [REVISED] Render Top Contacts
    renderTopContactsChart(container, topContacts) {
        this._prepareContainer(container, 'topContacts');
        
        const options = {
            ...this.commonOptions,
            series: [{
                name: 'Message Count',
                data: topContacts.map(c => c.messageCount)
            }],
            chart: { ...this.commonOptions.chart, height: Math.max(topContacts.length * 40, 300) },
            xaxis: { ...this.commonOptions.xaxis, categories: topContacts.map(c => c.name) },
            title: { text: 'Messages per Contact', align: 'center', style: { color: this.currentTheme === 'dark' ? '#fff' : '#000' } }
        };

        this.charts.topContacts = new ApexCharts(container, options);
        this.charts.topContacts.render();
    }

    // [REVISED] Render Message Timeline
    renderMessageTimeline(container, timeline) {
        this._prepareContainer(container, 'messageTimeline');
        
        const options = {
            ...this.commonOptions,
            chart: { ...this.commonOptions.chart, type: 'area', height: 300 },
            series: [{
                name: 'Messages',
                data: timeline.map(d => ({ x: d.month, y: d.count }))
            }],
            xaxis: {
                ...this.commonOptions.xaxis,
                type: 'datetime',
                title: { text: 'Month', style: { color: this.currentTheme === 'dark' ? '#999' : '#373d3f' } }
            },
            yaxis: { ...this.commonOptions.yaxis, title: { text: 'Message Count', style: { color: this.currentTheme === 'dark' ? '#999' : '#373d3f' } } },
            title: { text: 'Monthly Message Volume', align: 'center', style: { color: this.currentTheme === 'dark' ? '#fff' : '#000' } },
            dataLabels: { enabled: false }
        };

        this.charts.messageTimeline = new ApexCharts(container, options);
        this.charts.messageTimeline.render();
    }
    
    // Sentiment analysis chart removed due to resource constraints

    // [NEW] Render Response Time Chart
    renderResponseTimeChart(container, responseData) {
        this._prepareContainer(container, 'responseTime');
        const data = responseData.averageByUser.slice(0, 10); // Top 10 fastest

        const options = {
            ...this.commonOptions,
            series: [{
                name: 'Avg. Response Time (minutes)',
                data: data.map(d => Math.round(d.averageResponseMinutes))
            }],
            chart: { ...this.commonOptions.chart, height: Math.max(data.length * 40, 300) },
            xaxis: {
                ...this.commonOptions.xaxis,
                categories: data.map(d => d.user),
                title: { text: 'Average Response Time (minutes)' }
            },
            title: { text: 'Fastest Responders', align: 'center', style: { color: this.currentTheme === 'dark' ? '#fff' : '#000' } }
        };

        this.charts.responseTime = new ApexCharts(container, options);
        this.charts.responseTime.render();
    }

    // [NEW] Render Interaction Heatmap (replaces the old graph)
    renderInteractionHeatmap(container, heatmapSeries) {
        this._prepareContainer(container, 'interactionHeatmap');

        if (!heatmapSeries || heatmapSeries.length < 2) {
             container.innerHTML = '<div class="loading-placeholder">Not enough data for an interaction heatmap.</div>';
             return;
        }

        // Debug output to help diagnose issues
        console.log('Interaction heatmap data:', heatmapSeries);
        
        // Validate data structure
        const hasValidData = heatmapSeries.every(series =>
            series.name && Array.isArray(series.data) && series.data.length > 0
        );
        
        if (!hasValidData) {
            container.innerHTML = '<div class="loading-placeholder">Invalid interaction data structure.</div>';
            return;
        }

        const options = {
            ...this.commonOptions,
            series: heatmapSeries,
            chart: {
                ...this.commonOptions.chart,
                type: 'heatmap',
                height: Math.max(heatmapSeries.length * 30, 300)
            },
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0.5,
                    colorScale: {
                        ranges: [
                            { from: 0, to: 0, color: '#f8f9fa', name: 'None' },
                            { from: 1, to: 10, color: '#00A100', name: 'Low' },
                            { from: 11, to: 50, color: '#128FD9', name: 'Medium' },
                            { from: 51, to: 200, color: '#FFB200', name: 'High' },
                            { from: 201, to: 1000, color: '#FF0000', name: 'Very High' },
                            { from: 1001, to: Infinity, color: '#B32824', name: 'Extreme' }
                        ]
                    }
                }
            },
            dataLabels: {
                enabled: true,
                style: {
                    colors: ['#fff']
                }
            },
            xaxis: {
                type: 'category',
                categories: heatmapSeries[0].data.map(d => d.x),
                labels: {
                    style: {
                        colors: this.currentTheme === 'dark' ? '#999' : '#373d3f',
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: this.currentTheme === 'dark' ? '#999' : '#373d3f',
                    }
                }
            },
            title: { text: 'Interaction Heatmap (Messages Exchanged)', align: 'center', style: { color: this.currentTheme === 'dark' ? '#fff' : '#000' } },
            tooltip: {
                theme: this.currentTheme,
                y: {
                    formatter: function(val) {
                        return val === 0 ? 'No interaction' : `${val} messages`;
                    }
                }
            }
        };

        this.charts.interactionHeatmap = new ApexCharts(container, options);
        this.charts.interactionHeatmap.render();
    }
    
    renderActivityHeatmap(container, heatmapData) { const data = heatmapData.data; const maxCount = heatmapData.maxCount; container.innerHTML = ''; const width = Math.min(container.offsetWidth, 600); const height = 400; const svg = this.createSVG(width, height); const margin = { top: 40, right: 40, bottom: 40, left: 60 }; const cellWidth = (width - margin.left - margin.right) / 7; const cellHeight = (height - margin.top - margin.bottom) / 24; const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; days.forEach((day, i) => { const text = document.createElementNS('http://www.w3.org/2000/svg', 'text'); text.setAttribute('x', margin.left + i * cellWidth + cellWidth / 2); text.setAttribute('y', margin.top - 10); text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '12px'); text.setAttribute('fill', this.currentTheme === 'dark' ? '#999' : '#666'); text.textContent = day; svg.appendChild(text); }); for (let hour = 0; hour < 24; hour += 2) { const text = document.createElementNS('http://www.w3.org/2000/svg', 'text'); text.setAttribute('x', margin.left - 10); text.setAttribute('y', margin.top + hour * cellHeight + cellHeight / 2); text.setAttribute('text-anchor', 'end'); text.setAttribute('font-size', '10px'); text.setAttribute('fill', this.currentTheme === 'dark' ? '#999' : '#666'); text.textContent = `${hour.toString().padStart(2, '0')}:00`; svg.appendChild(text); } data.forEach(cell => { const intensity = cell.count / maxCount; const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); rect.setAttribute('x', margin.left + cell.day * cellWidth); rect.setAttribute('y', margin.top + cell.hour * cellHeight); rect.setAttribute('width', cellWidth - 1); rect.setAttribute('height', cellHeight - 1); rect.setAttribute('fill', `rgba(79, 195, 247, ${intensity})`); rect.setAttribute('stroke', this.currentTheme === 'dark' ? '#2d2d2d' : '#fff'); rect.setAttribute('stroke-width', '0.5'); const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = `${cell.dayName} ${cell.hourLabel}: ${cell.count} messages`; rect.appendChild(title); svg.appendChild(rect); }); container.appendChild(svg); }
    renderWordCloud(container, wordData) {
        container.innerHTML = '';
        const words = wordData.slice(0, 50);
        container.style.position = 'relative';
        container.style.padding = '20px';
        container.style.minHeight = '300px';
        container.style.textAlign = 'center';
        
        // Create controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.style.marginBottom = '15px';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.alignItems = 'center';
        controlsContainer.style.gap = '10px';
        controlsContainer.style.flexWrap = 'wrap';
        controlsContainer.style.justifyContent = 'center';
        
        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Filter words...';
        searchInput.style.padding = '5px 10px';
        searchInput.style.border = '1px solid var(--border-color)';
        searchInput.style.borderRadius = '4px';
        searchInput.style.background = 'var(--bg-color)';
        searchInput.style.color = 'var(--text-color)';
        
        // Word count selector
        const wordCountSelect = document.createElement('select');
        wordCountSelect.style.padding = '5px 10px';
        wordCountSelect.style.border = '1px solid var(--border-color)';
        wordCountSelect.style.borderRadius = '4px';
        wordCountSelect.style.background = 'var(--bg-color)';
        wordCountSelect.style.color = 'var(--text-color)';
        
        [25, 50, 100].forEach(count => {
            const option = document.createElement('option');
            option.value = count;
            option.textContent = `Show ${count} words`;
            option.selected = count === 50;
            wordCountSelect.appendChild(option);
        });
        
        // Sort options
        const sortSelect = document.createElement('select');
        sortSelect.style.padding = '5px 10px';
        sortSelect.style.border = '1px solid var(--border-color)';
        sortSelect.style.borderRadius = '4px';
        sortSelect.style.background = 'var(--bg-color)';
        sortSelect.style.color = 'var(--text-color)';
        
        ['frequency', 'alphabetical', 'length'].forEach(sort => {
            const option = document.createElement('option');
            option.value = sort;
            option.textContent = `Sort by ${sort}`;
            option.selected = sort === 'frequency';
            sortSelect.appendChild(option);
        });
        
        // Reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset';
        resetButton.style.padding = '5px 15px';
        resetButton.style.border = '1px solid var(--border-color)';
        resetButton.style.borderRadius = '4px';
        resetButton.style.background = 'var(--button-bg)';
        resetButton.style.color = 'var(--button-text)';
        resetButton.style.cursor = 'pointer';
        
        controlsContainer.appendChild(searchInput);
        controlsContainer.appendChild(wordCountSelect);
        controlsContainer.appendChild(sortSelect);
        controlsContainer.appendChild(resetButton);
        container.appendChild(controlsContainer);
        
        // Word cloud container
        const cloudContainer = document.createElement('div');
        cloudContainer.style.position = 'relative';
        cloudContainer.style.minHeight = '250px';
        cloudContainer.style.textAlign = 'center';
        cloudContainer.className = 'word-cloud-container';
        container.appendChild(cloudContainer);
        
        // Selected word info
        const infoContainer = document.createElement('div');
        infoContainer.style.marginTop = '15px';
        infoContainer.style.padding = '10px';
        infoContainer.style.background = 'var(--config-bg)';
        infoContainer.style.borderRadius = '8px';
        infoContainer.style.border = '1px solid var(--border-color)';
        infoContainer.style.display = 'none';
        infoContainer.className = 'word-info';
        container.appendChild(infoContainer);
        
        const maxCount = words[0]?.count || 1;
        const minFontSize = 12;
        const maxFontSize = 48;
        const colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
        
        let allWords = [...wordData]; // Store all word data for filtering
        let currentWords = words;
        let selectedWords = new Set();
        
        const renderWords = (wordsToRender = currentWords) => {
            cloudContainer.innerHTML = '';
            
            if (wordsToRender.length === 0) {
                cloudContainer.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">No words match your filter</div>';
                return;
            }
            
            wordsToRender.forEach((wordItem, i) => {
                const span = document.createElement('span');
                span.textContent = wordItem.word;
                span.className = 'word-cloud-word';
                span.style.margin = '5px';
                span.style.padding = '4px 8px';
                span.style.borderRadius = '6px';
                span.style.cursor = 'pointer';
                span.style.display = 'inline-block';
                span.style.transition = 'all 0.3s ease';
                span.style.position = 'relative';
                span.style.userSelect = 'none';
                
                const fontSize = Math.max(minFontSize, Math.min(maxFontSize, minFontSize + (wordItem.count / maxCount) * (maxFontSize - minFontSize)));
                const isSelected = selectedWords.has(wordItem.word);
                
                if (isSelected) {
                    span.style.background = colors[i % colors.length];
                    span.style.color = '#fff';
                    span.style.fontWeight = 'bold';
                    span.style.transform = 'scale(1.1)';
                    span.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                } else {
                    span.style.color = colors[i % colors.length];
                    span.style.background = 'transparent';
                    span.style.fontWeight = wordItem.count > maxCount * 0.7 ? 'bold' : 'normal';
                }
                
                span.style.fontSize = `${fontSize}px`;
                span.title = `${wordItem.word}: ${wordItem.count} times (click to select)`;
                
                // Hover effects
                span.addEventListener('mouseenter', () => {
                    if (!selectedWords.has(wordItem.word)) {
                        span.style.background = `${colors[i % colors.length]}20`;
                        span.style.transform = 'scale(1.05)';
                        span.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    }
                });
                
                span.addEventListener('mouseleave', () => {
                    if (!selectedWords.has(wordItem.word)) {
                        span.style.background = 'transparent';
                        span.style.transform = 'scale(1)';
                        span.style.boxShadow = 'none';
                    }
                });
                
                // Click handler
                span.addEventListener('click', () => {
                    if (selectedWords.has(wordItem.word)) {
                        selectedWords.delete(wordItem.word);
                    } else {
                        selectedWords.add(wordItem.word);
                    }
                    renderWords(wordsToRender);
                    updateInfoPanel();
                });
                
                cloudContainer.appendChild(span);
            });
        };
        
        const updateInfoPanel = () => {
            if (selectedWords.size === 0) {
                infoContainer.style.display = 'none';
                return;
            }
            
            const selectedWordsData = allWords.filter(w => selectedWords.has(w.word));
            const totalOccurrences = selectedWordsData.reduce((sum, w) => sum + w.count, 0);
            
            infoContainer.innerHTML = `
                <h4 style="margin: 0 0 10px 0; color: var(--text-color);">Selected Words (${selectedWords.size})</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                    ${selectedWordsData.map(w =>
                        `<span style="background: var(--button-bg); color: var(--button-text); padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                            ${w.word} (${w.count})
                        </span>`
                    ).join('')}
                </div>
                <div style="color: var(--text-muted); font-size: 14px;">
                    Total occurrences: ${totalOccurrences} |
                    Average: ${Math.round(totalOccurrences / selectedWords.size)} per word
                </div>
            `;
            infoContainer.style.display = 'block';
        };
        
        const applyFilters = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const wordCount = parseInt(wordCountSelect.value);
            const sortType = sortSelect.value;
            
            let filteredWords = [...allWords];
            
            // Apply search filter
            if (searchTerm) {
                filteredWords = filteredWords.filter(w => w.word.toLowerCase().includes(searchTerm));
            }
            
            // Apply sorting
            switch (sortType) {
                case 'alphabetical':
                    filteredWords.sort((a, b) => a.word.localeCompare(b.word));
                    break;
                case 'length':
                    filteredWords.sort((a, b) => b.word.length - a.word.length);
                    break;
                case 'frequency':
                default:
                    filteredWords.sort((a, b) => b.count - a.count);
                    break;
            }
            
            // Apply word count limit
            filteredWords = filteredWords.slice(0, wordCount);
            
            currentWords = filteredWords;
            renderWords();
        };
        
        // Event listeners
        searchInput.addEventListener('input', applyFilters);
        wordCountSelect.addEventListener('change', applyFilters);
        sortSelect.addEventListener('change', applyFilters);
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            wordCountSelect.value = '50';
            sortSelect.value = 'frequency';
            selectedWords.clear();
            applyFilters();
            updateInfoPanel();
        });
        
        // Initial render
        renderWords();
    }
    renderEmojiAnalysis(container, emojiData) { container.innerHTML = ''; if (emojiData.topEmojis.length === 0) { container.innerHTML = '<div class="loading-placeholder">No emojis found</div>'; return; } const summary = document.createElement('div'); summary.style.marginBottom = '20px'; summary.style.textAlign = 'center'; summary.innerHTML = `<strong>Total Emojis:</strong> ${emojiData.totalEmojis.toLocaleString()} | <strong>Unique Emojis:</strong> ${emojiData.uniqueEmojis}`; container.appendChild(summary); const grid = document.createElement('div'); grid.style.display = 'grid'; grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(80px, 1fr))'; grid.style.gap = '15px'; grid.style.maxHeight = '300px'; grid.style.overflowY = 'auto'; emojiData.topEmojis.forEach(item => { const emojiCard = document.createElement('div'); emojiCard.style.textAlign = 'center'; emojiCard.style.padding = '10px'; emojiCard.style.border = '1px solid var(--border-color)'; emojiCard.style.borderRadius = '8px'; emojiCard.style.backgroundColor = 'var(--config-bg)'; const emoji = document.createElement('div'); emoji.textContent = item.emoji; emoji.style.fontSize = '24px'; emoji.style.marginBottom = '5px'; const count = document.createElement('div'); count.textContent = item.count; count.style.fontSize = '12px'; count.style.color = 'var(--text-muted)'; count.style.fontWeight = 'bold'; emojiCard.appendChild(emoji); emojiCard.appendChild(count); grid.appendChild(emojiCard); }); container.appendChild(grid); }
    createSVG(width, height) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', width); svg.setAttribute('height', height); svg.style.maxWidth = '100%'; svg.style.height = 'auto'; return svg; }
}