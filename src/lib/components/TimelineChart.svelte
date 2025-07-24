<script lang="ts">
  import * as d3 from 'd3';
  import D3Chart from './D3Chart.svelte';

  interface ChatAnalytics {
    messages: Array<{
      timestamp: Date;
      [key: string]: any;
    }>;
    chatName: string;
  }

  interface TimelineData {
    month: Date;
    count: number;
    date: Date;
  }

  export let analytics: ChatAnalytics[];

  // Reactive data processing
  $: timelineData = generateTimelineData(analytics);

  function generateTimelineData(data: ChatAnalytics[]): TimelineData[] {
    if (data.length === 0) return [];

    // Get all messages from all chats
    const allMessages = data.flatMap(chat => 
      chat.messages.map(msg => ({
        ...msg,
        chatName: chat.chatName,
        timestamp: new Date(msg.timestamp)
      }))
    );

    // Sort by timestamp
    allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Group messages by month for timeline
    const monthlyData = d3.rollup(
      allMessages,
      v => v.length,
      d => d3.timeMonth(d.timestamp)
    );

    // Convert to array and sort
    return Array.from(monthlyData.entries())
      .map(([month, count]) => ({
        month,
        count,
        date: month
      }))
      .sort((a, b) => a.month.getTime() - b.month.getTime());
  }

  function formatMonth(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'short'
    }).format(date);
  }

  function createChart(chartContext: any) {
    const { svg, g, innerWidth, innerHeight, showTooltip, hideTooltip } = chartContext;

    if (timelineData.length === 0) return;

    // Create scales
    const xExtent = d3.extent(timelineData, d => d.month) as [Date, Date];
    const xScale = d3.scaleTime()
      .domain(xExtent)
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(timelineData, d => d.count) || 0])
      .nice()
      .range([innerHeight, 0]);

    // Create line generator
    const line = d3.line<TimelineData>()
      .x(d => xScale(d.month))
      .y(d => yScale(d.count))
      .curve(d3.curveMonotoneX);

    // Create area generator
    const area = d3.area<TimelineData>()
      .x(d => xScale(d.month))
      .y0(innerHeight)
      .y1(d => yScale(d.count))
      .curve(d3.curveMonotoneX);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d => formatMonth(d as Date)))
      .selectAll('text')
      .style('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#666')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    // Add X axis label
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + 50})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('Time Period');

    // Add Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -60)
      .attr('x', -(innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('Message Count');

    // Add gradient
    const gradient = svg.append('defs').append('linearGradient')
      .attr('id', 'timeline-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#4a90e2')
      .attr('stop-opacity', 0.8);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#4a90e2')
      .attr('stop-opacity', 0.2);

    // Add the area
    g.append('path')
      .datum(timelineData)
      .attr('fill', 'url(#timeline-gradient)')
      .attr('d', area);

    // Add the line
    g.append('path')
      .datum(timelineData)
      .attr('fill', 'none')
      .attr('stroke', '#4a90e2')
      .attr('stroke-width', 3)
      .attr('d', line);

    // Add points
    g.selectAll('.dot')
      .data(timelineData)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', (d: TimelineData) => xScale(d.month))
      .attr('cy', (d: TimelineData) => yScale(d.count))
      .attr('r', 5)
      .attr('fill', '#4a90e2')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mouseover', (event: MouseEvent, d: TimelineData) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .transition()
          .duration(200)
          .attr('r', 8);

        showTooltip(event, `
          <strong>${formatMonth(d.month)}</strong><br/>
          Messages: ${d.count.toLocaleString()}
        `);
      })
      .on('mouseout', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .transition()
          .duration(200)
          .attr('r', 5);

        hideTooltip();
      });
  }
</script>

<div class="timeline-chart">
  {#if timelineData.length > 0}
    <D3Chart
      data={timelineData}
      height={400}
      margin={{ top: 40, right: 40, bottom: 80, left: 80 }}
      responsive={true}
      maxWidth={1000}
      minWidth={500}
      on:ready={(event) => createChart(event.detail)}
    />
    
    <div class="chart-summary">
      <div class="summary-item">
        <span class="summary-label">Total Messages</span>
        <span class="summary-value">{timelineData.reduce((sum, d) => sum + d.count, 0).toLocaleString()}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Average per Month</span>
        <span class="summary-value">{Math.round(timelineData.reduce((sum, d) => sum + d.count, 0) / timelineData.length).toLocaleString()}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Peak Activity</span>
        <span class="summary-value">
          {#if timelineData.length > 0}
            {@const peakMonth = timelineData.reduce((max, d) => d.count > max.count ? d : max, timelineData[0])}
            {formatMonth(peakMonth.month)}
            <small>({peakMonth.count.toLocaleString()} msgs)</small>
          {/if}
        </span>
      </div>
    </div>
  {:else}
    <div class="no-data">
      <div class="no-data-icon">📈</div>
      <h4>No Timeline Data Available</h4>
      <p>No messages found in the selected date range and filters.</p>
    </div>
  {/if}
</div>

<style>
  .timeline-chart {
    background: white;
    border: 1px solid #ddd;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    width: 100%;
    overflow: hidden;
  }

  .chart-container {
    position: relative;
    height: 400px;
    width: 100%;
    overflow: visible;
  }

  .chart-container svg {
    width: 100%;
    height: 100%;
  }

  .chart-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    padding-top: 1.5rem;
    border-top: 2px solid #f0f0f0;
  }

  .summary-item {
    text-align: center;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .summary-label {
    display: block;
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .summary-value {
    display: block;
    font-size: 1.1rem;
    font-weight: 700;
    color: #4a90e2;
  }

  .summary-value small {
    display: block;
    font-size: 0.8rem;
    font-weight: 400;
    color: #666;
    margin-top: 0.25rem;
  }

  .no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    text-align: center;
    color: #666;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border-radius: 8px;
    border: 2px dashed #dee2e6;
  }

  .no-data-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.6;
  }

  .no-data h4 {
    margin: 0 0 0.5rem 0;
    color: #495057;
    font-size: 1.2rem;
  }

  .no-data p {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>