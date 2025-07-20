// Pure JavaScript analytics visualization without external dependencies
export class AnalyticsVisualizer {
    constructor() {
        this.colors = {
            primary: '#3498db',
            secondary: '#e74c3c',
            success: '#2ecc71',
            warning: '#f39c12',
            info: '#9b59b6',
            gradient: ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6']
        };
    }

    // Create SVG element with given dimensions
    createSVG(width, height) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
        return svg;
    }

    // Render activity heatmap
    renderActivityHeatmap(container, heatmapData) {
        const data = heatmapData.data;
        const maxCount = heatmapData.maxCount;
        
        container.innerHTML = '';
        const width = Math.min(container.offsetWidth, 600);
        const height = 400;
        const svg = this.createSVG(width, height);
        
        const margin = { top: 40, right: 40, bottom: 40, left: 60 };
        const cellWidth = (width - margin.left - margin.right) / 7;
        const cellHeight = (height - margin.top - margin.bottom) / 24;

        // Days labels
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach((day, i) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', margin.left + i * cellWidth + cellWidth / 2);
            text.setAttribute('y', margin.top - 10);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '12px');
            text.setAttribute('fill', '#666');
            text.textContent = day;
            svg.appendChild(text);
        });

        // Hour labels
        for (let hour = 0; hour < 24; hour += 2) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', margin.left - 10);
            text.setAttribute('y', margin.top + hour * cellHeight + cellHeight / 2);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('font-size', '10px');
            text.setAttribute('fill', '#666');
            text.textContent = `${hour.toString().padStart(2, '0')}:00`;
            svg.appendChild(text);
        }

        // Heatmap cells
        data.forEach(cell => {
            const intensity = cell.count / maxCount;
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', margin.left + cell.day * cellWidth);
            rect.setAttribute('y', margin.top + cell.hour * cellHeight);
            rect.setAttribute('width', cellWidth - 1);
            rect.setAttribute('height', cellHeight - 1);
            rect.setAttribute('fill', `rgba(52, 152, 219, ${intensity})`);
            rect.setAttribute('stroke', '#fff');
            rect.setAttribute('stroke-width', '0.5');
            
            // Tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${cell.dayName} ${cell.hourLabel}: ${cell.count} messages`;
            rect.appendChild(title);
            
            svg.appendChild(rect);
        });

        container.appendChild(svg);
    }

    // Render top contacts bar chart
    renderTopContactsChart(container, topContacts) {
        container.innerHTML = '';
        const width = Math.min(container.offsetWidth, 600);
        const height = Math.max(topContacts.length * 40, 300);
        const svg = this.createSVG(width, height);
        
        const margin = { top: 20, right: 40, bottom: 40, left: 150 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        const barHeight = Math.min(30, chartHeight / topContacts.length - 2);
        
        const maxMessages = Math.max(...topContacts.map(c => c.messageCount));
        
        topContacts.forEach((contact, i) => {
            const barWidth = Math.max(0, (contact.messageCount / maxMessages) * chartWidth);
            const y = margin.top + i * (barHeight + 5);
            
            // Bar background
            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('x', margin.left);
            bgRect.setAttribute('y', y);
            bgRect.setAttribute('width', chartWidth);
            bgRect.setAttribute('height', barHeight);
            bgRect.setAttribute('fill', '#f8f9fa');
            bgRect.setAttribute('stroke', '#dee2e6');
            svg.appendChild(bgRect);
            
            // Bar
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', margin.left);
            rect.setAttribute('y', y);
            rect.setAttribute('width', barWidth);
            rect.setAttribute('height', barHeight);
            rect.setAttribute('fill', this.colors.gradient[i % this.colors.gradient.length]);
            svg.appendChild(rect);
            
            // Contact name
            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('x', margin.left - 10);
            nameText.setAttribute('y', y + barHeight / 2 + 4);
            nameText.setAttribute('text-anchor', 'end');
            nameText.setAttribute('font-size', '12px');
            nameText.setAttribute('fill', '#333');
            nameText.textContent = contact.name.length > 18 ? contact.name.substring(0, 18) + '...' : contact.name;
            svg.appendChild(nameText);
            
            // Message count
            const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            countText.setAttribute('x', margin.left + barWidth + 5);
            countText.setAttribute('y', y + barHeight / 2 + 4);
            countText.setAttribute('font-size', '11px');
            countText.setAttribute('fill', '#666');
            countText.textContent = contact.messageCount.toLocaleString();
            svg.appendChild(countText);
        });
        
        container.appendChild(svg);
    }

    // Render message timeline chart
    renderMessageTimeline(container, timeline) {
        container.innerHTML = '';
        const width = Math.min(container.offsetWidth, 800);
        const height = 300;
        const svg = this.createSVG(width, height);
        
        if (timeline.length === 0) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', width / 2);
            text.setAttribute('y', height / 2);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '14px');
            text.setAttribute('fill', '#666');
            text.textContent = 'No timeline data available';
            svg.appendChild(text);
            container.appendChild(svg);
            return;
        }
        
        const margin = { top: 20, right: 40, bottom: 60, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        const maxCount = Math.max(...timeline.map(d => d.count));
        const xStep = chartWidth / (timeline.length - 1);
        
        // Create path for line chart
        let pathD = '';
        const points = [];
        
        timeline.forEach((point, i) => {
            const x = margin.left + i * xStep;
            const y = margin.top + chartHeight - (point.count / maxCount) * chartHeight;
            points.push({ x, y, data: point });
            
            if (i === 0) {
                pathD += `M ${x} ${y}`;
            } else {
                pathD += ` L ${x} ${y}`;
            }
        });
        
        // Line
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('stroke', this.colors.primary);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
        
        // Points
        points.forEach(point => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', '4');
            circle.setAttribute('fill', this.colors.primary);
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '2');
            
            // Tooltip
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${point.data.month}: ${point.data.count} messages`;
            circle.appendChild(title);
            
            svg.appendChild(circle);
        });
        
        // X-axis labels (show every few months to avoid crowding)
        const labelInterval = Math.max(1, Math.floor(timeline.length / 8));
        timeline.forEach((point, i) => {
            if (i % labelInterval === 0 || i === timeline.length - 1) {
                const x = margin.left + i * xStep;
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x);
                text.setAttribute('y', height - 20);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '10px');
                text.setAttribute('fill', '#666');
                text.setAttribute('transform', `rotate(-45, ${x}, ${height - 20})`);
                text.textContent = point.month;
                svg.appendChild(text);
            }
        });
        
        container.appendChild(svg);
    }

    // Render interaction graph (simplified network)
    renderInteractionGraph(container, interactionData) {
        container.innerHTML = '';
        const { nodes, edges } = interactionData;
        
        const width = Math.min(container.offsetWidth, 600);
        const height = 400;
        const svg = this.createSVG(width, height);
        
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.3;
        
        // Position nodes in a circle
        const nodePositions = new Map();
        nodes.forEach((node, i) => {
            const angle = (i / nodes.length) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            nodePositions.set(node.id, { x, y, node });
        });
        
        // Draw edges
        edges.forEach(edge => {
            const source = nodePositions.get(edge.source);
            const target = nodePositions.get(edge.target);
            
            if (source && target) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', source.x);
                line.setAttribute('y1', source.y);
                line.setAttribute('x2', target.x);
                line.setAttribute('y2', target.y);
                line.setAttribute('stroke', '#ddd');
                line.setAttribute('stroke-width', Math.min(8, Math.sqrt(edge.weight / 10)));
                
                const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                title.textContent = `${edge.source} ↔ ${edge.target}: ${edge.weight} messages`;
                line.appendChild(title);
                
                svg.appendChild(line);
            }
        });
        
        // Draw nodes
        nodePositions.forEach(({ x, y, node }) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', Math.min(20, 5 + Math.sqrt(node.messageCount / 10)));
            circle.setAttribute('fill', node.isCurrentUser ? this.colors.secondary : this.colors.primary);
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '2');
            
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${node.name}: ${node.messageCount} messages`;
            circle.appendChild(title);
            
            svg.appendChild(circle);
            
            // Node label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y + 30);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '10px');
            text.setAttribute('fill', '#333');
            text.textContent = node.name.length > 10 ? node.name.substring(0, 8) + '...' : node.name;
            svg.appendChild(text);
        });
        
        container.appendChild(svg);
    }

    // Render response time chart
    renderResponseTimeChart(container, responseData) {
        container.innerHTML = '';
        const data = responseData.averageByUser.slice(0, 10); // Top 10
        
        const width = Math.min(container.offsetWidth, 600);
        const height = Math.max(data.length * 35, 250);
        const svg = this.createSVG(width, height);
        
        const margin = { top: 20, right: 100, bottom: 40, left: 150 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        const barHeight = Math.min(25, chartHeight / data.length - 2);
        
        const maxTime = Math.max(...data.map(d => d.averageResponseMinutes));
        
        data.forEach((item, i) => {
            const barWidth = Math.max(0, (item.averageResponseMinutes / maxTime) * chartWidth);
            const y = margin.top + i * (barHeight + 5);
            
            // Bar
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', margin.left);
            rect.setAttribute('y', y);
            rect.setAttribute('width', barWidth);
            rect.setAttribute('height', barHeight);
            rect.setAttribute('fill', this.colors.info);
            svg.appendChild(rect);
            
            // User name
            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('x', margin.left - 10);
            nameText.setAttribute('y', y + barHeight / 2 + 4);
            nameText.setAttribute('text-anchor', 'end');
            nameText.setAttribute('font-size', '12px');
            nameText.setAttribute('fill', '#333');
            nameText.textContent = item.user.length > 15 ? item.user.substring(0, 15) + '...' : item.user;
            svg.appendChild(nameText);
            
            // Time label
            const timeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            timeText.setAttribute('x', margin.left + barWidth + 5);
            timeText.setAttribute('y', y + barHeight / 2 + 4);
            timeText.setAttribute('font-size', '11px');
            timeText.setAttribute('fill', '#666');
            
            const minutes = Math.round(item.averageResponseMinutes);
            const timeStr = minutes < 60 ? `${minutes}m` : 
                           minutes < 1440 ? `${Math.round(minutes/60)}h` : `${Math.round(minutes/1440)}d`;
            timeText.textContent = timeStr;
            svg.appendChild(timeText);
        });
        
        container.appendChild(svg);
    }

    // Render word cloud (simplified version)
    renderWordCloud(container, wordData) {
        container.innerHTML = '';
        const words = wordData.slice(0, 50); // Top 50 words
        
        container.style.position = 'relative';
        container.style.padding = '20px';
        container.style.minHeight = '300px';
        container.style.textAlign = 'center';
        
        const maxCount = words[0]?.count || 1;
        const minFontSize = 12;
        const maxFontSize = 48;
        
        words.forEach((wordItem, i) => {
            const span = document.createElement('span');
            span.textContent = wordItem.word;
            span.style.margin = '5px';
            span.style.padding = '2px 6px';
            span.style.borderRadius = '4px';
            span.style.color = this.colors.gradient[i % this.colors.gradient.length];
            span.style.fontSize = `${minFontSize + (wordItem.count / maxCount) * (maxFontSize - minFontSize)}px`;
            span.style.fontWeight = wordItem.count > maxCount * 0.7 ? 'bold' : 'normal';
            span.title = `${wordItem.word}: ${wordItem.count} times`;
            
            container.appendChild(span);
        });
    }

    // Render emoji analysis
    renderEmojiAnalysis(container, emojiData) {
        container.innerHTML = '';
        
        if (emojiData.topEmojis.length === 0) {
            const message = document.createElement('div');
            message.textContent = 'No emojis found in messages';
            message.style.textAlign = 'center';
            message.style.color = '#666';
            message.style.fontSize = '14px';
            message.style.padding = '40px';
            container.appendChild(message);
            return;
        }
        
        // Summary stats
        const summary = document.createElement('div');
        summary.style.marginBottom = '20px';
        summary.style.textAlign = 'center';
        summary.innerHTML = `
            <strong>Total Emojis:</strong> ${emojiData.totalEmojis.toLocaleString()} |
            <strong>Unique Emojis:</strong> ${emojiData.uniqueEmojis}
        `;
        container.appendChild(summary);
        
        // Top emojis grid
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(100px, 1fr))';
        grid.style.gap = '15px';
        grid.style.maxHeight = '300px';
        grid.style.overflow = 'auto';
        
        emojiData.topEmojis.forEach(item => {
            const emojiCard = document.createElement('div');
            emojiCard.style.textAlign = 'center';
            emojiCard.style.padding = '10px';
            emojiCard.style.border = '1px solid #ddd';
            emojiCard.style.borderRadius = '8px';
            emojiCard.style.backgroundColor = '#f8f9fa';
            
            const emoji = document.createElement('div');
            emoji.textContent = item.emoji;
            emoji.style.fontSize = '24px';
            emoji.style.marginBottom = '5px';
            
            const count = document.createElement('div');
            count.textContent = item.count;
            count.style.fontSize = '12px';
            count.style.color = '#666';
            count.style.fontWeight = 'bold';
            
            emojiCard.appendChild(emoji);
            emojiCard.appendChild(count);
            grid.appendChild(emojiCard);
        });
        
        container.appendChild(grid);
    }

    // [NEW & IMPROVED] Render sentiment analysis chart with axes, grid, and tooltips
    renderSentimentChart(container, sentimentData) {
        container.innerHTML = '';
        const width = Math.min(container.offsetWidth, 800);
        const height = 300;
        const svg = this.createSVG(width, height);

        if (!sentimentData || sentimentData.length === 0) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', width / 2); text.setAttribute('y', height / 2);
            text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', '#666');
            text.textContent = 'No sentiment data available';
            svg.appendChild(text);
            container.appendChild(svg);
            return;
        }

        const margin = { top: 20, right: 20, bottom: 50, left: 50 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        const xStep = chartWidth / (sentimentData.length > 1 ? sentimentData.length - 1 : 1);
        
        // --- Y-Axis & Grid ---
        const yAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        for (let i = 0; i <= 4; i++) {
            const ratio = i * 0.25;
            const y = margin.top + chartHeight - (ratio * chartHeight);

            const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            gridLine.setAttribute('x1', margin.left);
            gridLine.setAttribute('y1', y);
            gridLine.setAttribute('x2', width - margin.right);
            gridLine.setAttribute('y2', y);
            gridLine.setAttribute('stroke', '#eee');
            yAxisGroup.appendChild(gridLine);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', margin.left - 10);
            label.setAttribute('y', y + 4);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('font-size', '10px');
            label.setAttribute('fill', '#666');
            label.textContent = `${ratio * 100}%`;
            yAxisGroup.appendChild(label);
        }
        svg.appendChild(yAxisGroup);

        // --- X-Axis ---
        const xAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const labelInterval = Math.max(1, Math.floor(sentimentData.length / (chartWidth / 80)));
        sentimentData.forEach((point, i) => {
            if (i % labelInterval === 0 || i === sentimentData.length - 1) {
                const x = margin.left + i * xStep;
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x);
                text.setAttribute('y', height - margin.bottom + 15);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '10px');
                text.setAttribute('fill', '#666');
                text.setAttribute('transform', `rotate(-45, ${x}, ${height - margin.bottom + 15})`);
                text.textContent = point.month;
                xAxisGroup.appendChild(text);
            }
        });
        svg.appendChild(xAxisGroup);

        // --- Helper for creating paths and points ---
        const createSeries = (dataKey, color) => {
            const seriesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            let pathD = '';
            sentimentData.forEach((point, i) => {
                const x = margin.left + i * xStep;
                const y = margin.top + chartHeight - (point[dataKey] * chartHeight);
                pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', color);
                circle.setAttribute('stroke', 'white');
                circle.setAttribute('stroke-width', '2');
                
                const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                title.textContent = `${point.month}\n${(point[dataKey] * 100).toFixed(1)}% ${dataKey.replace('Ratio', '')}`;
                circle.appendChild(title);
                seriesGroup.appendChild(circle);
            });
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            seriesGroup.insertBefore(path, seriesGroup.firstChild);
            return seriesGroup;
        };
        
        svg.appendChild(createSeries('neutralRatio', '#95a5a6'));
        svg.appendChild(createSeries('negativeRatio', this.colors.secondary));
        svg.appendChild(createSeries('positiveRatio', this.colors.success));

        // --- Legend ---
        const legend = document.createElement('div');
        legend.style.marginTop = '10px';
        legend.style.textAlign = 'center';
        legend.innerHTML = `
            <span style="color: ${this.colors.success};">● Positive</span>
            <span style="color: ${this.colors.secondary}; margin-left: 15px;">● Negative</span>
            <span style="color: #95a5a6; margin-left: 15px;">● Neutral</span>
        `;
        
        container.appendChild(svg);
        container.appendChild(legend);
    }
}