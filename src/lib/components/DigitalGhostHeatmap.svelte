<script lang="ts">
  import * as d3 from 'd3';
  import D3Chart from './D3Chart.svelte';

  export let data: { [key: string]: number } = {};
  export let type: 'hourly' | 'daily' | 'weekday-hourly' = 'hourly';
  export let title: string = '';

  interface ChartData {
    day: string;
    value: number;
    inverseValue: number;
  }

  interface WeeklyHourData {
    day: number; // 0-6 (Sunday-Saturday)
    hour: number; // 0-23
    value: number;
    inverseValue: number;
  }

  function calculateInverseActivity(data: { [key: string]: number }) {
    const values = Object.values(data);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // Calculate inverse: higher original value = lower inverse value
    const inverseData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(data)) {
      // Inverse calculation: max - current + min (to avoid zero values)
      inverseData[key] = maxValue - value + minValue;
    }
    
    return inverseData;
  }

  function findQuietestPeriods(data: { [key: string]: number }, type: string): string[] {
    const entries = Object.entries(data);
    entries.sort((a, b) => a[1] - b[1]); // Sort by value ascending (lowest first)
    
    const quietest = entries.slice(0, Math.min(3, entries.length)).map(([key, value]) => {
      if (type === 'hourly') {
        const hour = parseInt(key);
        const nextHour = (hour + 1) % 24;
        return `${hour}:00-${nextHour}:00 (${value} messages)`;
      } else {
        return `${key} (${value} messages)`;
      }
    });
    
    return quietest;
  }

  function createHourlyGhostHeatmap(chartContext: any) {
    const { svg, g, width, height, innerWidth, innerHeight, showTooltip, hideTooltip } = chartContext;

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(title || '👻 Digital Ghost - Hourly Quiet Hours');

    // Create circular/radial visualization
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    const outerRadius = Math.min(innerWidth, innerHeight) / 2 - 60;
    const innerRadius = outerRadius * 0.4;

    // Process data for 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const inverseData = calculateInverseActivity(data);
    const maxInverseValue = Math.max(...Object.values(inverseData));
    
    // Use a color scheme where dark colors represent low activity (ghost hours)
    const colorScale = d3.scaleSequential(d3.interpolateGreys)
      .domain([0, maxInverseValue]);

    const angleScale = d3.scaleLinear()
      .domain([0, 24])
      .range([0, 2 * Math.PI]);

    // Create arc generator
    const arc = d3.arc<number>()
      .innerRadius(innerRadius)
      .outerRadius((d: number) => {
        const inverseValue = inverseData[d] || 0;
        return innerRadius + (outerRadius - innerRadius) * (inverseValue / maxInverseValue);
      })
      .startAngle((d: number) => angleScale(d))
      .endAngle((d: number) => angleScale(d + 1))
      .padAngle(0.02);

    // Add hour segments
    const hourGroup = g.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    hourGroup.selectAll('.ghost-hour-arc')
      .data(hours)
      .enter().append('path')
      .attr('class', 'ghost-hour-arc')
      .attr('d', (d: number) => arc(d))
      .attr('fill', (d: number) => colorScale(inverseData[d] || 0))
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .style('opacity', 0.8)
      .on('mouseover', function(this: SVGPathElement, event: MouseEvent, d: number) {
        d3.select(this).style('opacity', 1);
        
        const originalValue = data[d] || 0;
        const isQuiet = originalValue <= Math.min(...Object.values(data).filter(v => v > 0));
        
        showTooltip(event, `
          <strong>${d}:00 - ${d + 1}:00</strong><br/>
          Messages: ${originalValue.toLocaleString()}<br/>
          ${isQuiet ? '<span style="color: #666;">👻 Ghost Hour - Very Quiet!</span>' : ''}
        `);
      })
      .on('mouseout', function(this: SVGPathElement) {
        d3.select(this).style('opacity', 0.8);
        hideTooltip();
      });

    // Add hour labels
    hourGroup.selectAll('.ghost-hour-label')
      .data(hours.filter(h => h % 3 === 0))
      .enter().append('text')
      .attr('class', 'ghost-hour-label')
      .attr('transform', (d: number) => {
        const angle = angleScale(d + 0.5) - Math.PI / 2;
        const radius = outerRadius + 15;
        return `translate(${Math.cos(angle) * radius}, ${Math.sin(angle) * radius})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#666')
      .text((d: number) => `${d}:00`);

    // Add center info - just a simple ghost icon
    hourGroup.append('circle')
      .attr('r', innerRadius - 10)
      .attr('fill', '#f8f9fa')
      .attr('stroke', '#333')
      .attr('stroke-width', 2);


    // Add quietest periods info box positioned at the bottom of the chart
    const quietestPeriods = findQuietestPeriods(data, 'hourly');
    const infoGroup = g.append('g').attr('class', 'quietest-info');
    
    const boxWidth = 200;
    const boxHeight = 30 + quietestPeriods.length * 16;
    const boxX = centerX - boxWidth / 2;
    const boxY = centerY + outerRadius + 30;
    
    // Add background box
    infoGroup.append('rect')
      .attr('x', boxX)
      .attr('y', boxY)
      .attr('width', boxWidth)
      .attr('height', boxHeight)
      .attr('fill', 'rgba(248, 249, 250, 0.95)')
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .attr('rx', 6);
    
    // Add title
    infoGroup.append('text')
      .attr('x', boxX + boxWidth / 2)
      .attr('y', boxY + 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('👻 Quietest Hours');

    // Add quietest periods
    quietestPeriods.slice(0, 3).forEach((period, i) => {
      infoGroup.append('text')
        .attr('x', boxX + boxWidth / 2)
        .attr('y', boxY + 36 + i * 16)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#666')
        .text(period.split(' (')[0]); // Just show the time range
    });
  }

  function createDailyGhostChart(chartContext: any) {
    const { svg, g, width, height, innerWidth, innerHeight, showTooltip, hideTooltip } = chartContext;

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(title || '👻 Digital Ghost - Daily Quiet Days');

    // Process data
    const days = Object.keys(data).length > 0 ? Object.keys(data) : [];
    const inverseData = calculateInverseActivity(data);
    
    const chartData: ChartData[] = days.map(day => ({
      day,
      value: data[day] || 0,
      inverseValue: inverseData[day] || 0
    })).filter(d => d.value >= 0);

    if (chartData.length === 0) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#666')
        .text('No activity data available for ghost analysis');
      return;
    }

    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.day))
      .range([0, innerWidth])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.inverseValue) || 0])
      .nice()
      .range([innerHeight, 0]);

    // Create gradient for ghost theme
    const gradient = svg.append('defs').append('linearGradient')
      .attr('id', 'ghost-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#666')
      .attr('stop-opacity', 0.3);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#333')
      .attr('stop-opacity', 0.8);

    // Add X axis with rotated labels to prevent overlap
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#666')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.8em')
      .attr('dy', '0.15em');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat((d: d3.NumberValue) => `${d.valueOf()}`))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    // Add bars with animation
    g.selectAll('.ghost-bar')
      .data(chartData)
      .enter().append('rect')
      .attr('class', 'ghost-bar')
      .attr('x', (d: ChartData) => xScale(d.day) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('fill', 'url(#ghost-gradient)')
      .attr('rx', 4)
      .attr('ry', 4)
      .style('opacity', 0.8)
      .on('mouseover', function(this: SVGRectElement, event: MouseEvent, d: ChartData) {
        d3.select(this).style('opacity', 1);
        
        const isQuiet = d.value <= Math.min(...chartData.map(cd => cd.value).filter(v => v > 0));
        
        showTooltip(event, `
          <strong>${d.day}</strong><br/>
          Messages: ${d.value.toLocaleString()}<br/>
          ${isQuiet ? '<span style="color: #666;">👻 Ghost Day - Very Quiet!</span>' : ''}
        `);
      })
      .on('mouseout', function(this: SVGRectElement) {
        d3.select(this).style('opacity', 0.8);
        hideTooltip();
      })
      .transition()
      .duration(1000)
      .delay((_d: ChartData, i: number) => i * 100)
      .attr('y', (d: ChartData) => yScale(d.inverseValue))
      .attr('height', (d: ChartData) => innerHeight - yScale(d.inverseValue));

    // Add quietest days info box positioned at the bottom of the chart
    const quietestPeriods = findQuietestPeriods(data, 'daily');
    const infoGroup = g.append('g').attr('class', 'quietest-info');
    
    const boxWidth = 300;
    const boxHeight = 30 + quietestPeriods.length * 16;
    const boxX = innerWidth / 2 - boxWidth / 2;
    const boxY = innerHeight + 40;
    
    // Add background box
    infoGroup.append('rect')
      .attr('x', boxX)
      .attr('y', boxY)
      .attr('width', boxWidth)
      .attr('height', boxHeight)
      .attr('fill', 'rgba(248, 249, 250, 0.95)')
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .attr('rx', 6);
    
    // Add title
    infoGroup.append('text')
      .attr('x', boxX + boxWidth / 2)
      .attr('y', boxY + 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('👻 Quietest Days');

    // Add quietest periods
    quietestPeriods.slice(0, 3).forEach((period, i) => {
      infoGroup.append('text')
        .attr('x', boxX + boxWidth / 2)
        .attr('y', boxY + 36 + i * 16)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#666')
        .text(period);
    });
  }

  function createWeeklyHourlyGhostHeatmap(chartContext: any) {
    const { svg, g, width, height, innerWidth, innerHeight, showTooltip, hideTooltip } = chartContext;

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(title || '👻 Digital Ghost - Weekly Activity Pattern');

    // Expected data format: "day-hour" (e.g., "0-14" for Sunday 2PM)
    const weeklyData: WeeklyHourData[] = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Process data into weekly format
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const value = data[key] || 0;
        weeklyData.push({ day, hour, value, inverseValue: 0 });
      }
    }

    // Calculate inverse values
    const maxValue = Math.max(...weeklyData.map(d => d.value));
    const minValue = Math.min(...weeklyData.map(d => d.value));
    weeklyData.forEach(d => {
      d.inverseValue = maxValue - d.value + minValue;
    });

    const maxInverseValue = Math.max(...weeklyData.map(d => d.inverseValue));
    
    // Dimensions
    const cellWidth = innerWidth / 24;
    const cellHeight = innerHeight / 7;

    // Color scale for ghost effect
    const colorScale = d3.scaleSequential(d3.interpolateGreys)
      .domain([0, maxInverseValue]);

    // Create cells
    const cells = g.selectAll('.ghost-cell')
      .data(weeklyData)
      .enter().append('rect')
      .attr('class', 'ghost-cell')
      .attr('x', (d: WeeklyHourData) => d.hour * cellWidth)
      .attr('y', (d: WeeklyHourData) => d.day * cellHeight)
      .attr('width', cellWidth - 1)
      .attr('height', cellHeight - 1)
      .attr('fill', (d: WeeklyHourData) => colorScale(d.inverseValue))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('opacity', 0.8)
      .on('mouseover', function(this: SVGRectElement, event: MouseEvent, d: WeeklyHourData) {
        d3.select(this).style('opacity', 1);
        
        const isQuiet = d.value <= Math.min(...weeklyData.map(wd => wd.value).filter(v => v > 0));
        
        showTooltip(event, `
          <strong>${days[d.day]} ${d.hour}:00-${d.hour + 1}:00</strong><br/>
          Messages: ${d.value.toLocaleString()}<br/>
          ${isQuiet ? '<span style="color: #666;">👻 Ghost Time - Very Quiet!</span>' : ''}
        `);
      })
      .on('mouseout', function(this: SVGRectElement) {
        d3.select(this).style('opacity', 0.8);
        hideTooltip();
      });

    // Add day labels
    g.selectAll('.day-label')
      .data(days)
      .enter().append('text')
      .attr('class', 'day-label')
      .attr('x', -10)
      .attr('y', (_d: string, i: number) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#666')
      .text((d: string) => d);

    // Add hour labels (every 4 hours)
    const hourLabels = [0, 4, 8, 12, 16, 20];
    g.selectAll('.hour-label')
      .data(hourLabels)
      .enter().append('text')
      .attr('class', 'hour-label')
      .attr('x', (d: number) => d * cellWidth + cellWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#666')
      .text((d: number) => `${d}:00`);
  }
</script>

<D3Chart
  {data}
  height={type === 'weekday-hourly' ? 300 : 500}
  margin={{ top: 60, right: 40, bottom: 120, left: 80 }}
  maxWidth={type === 'weekday-hourly' ? 800 : 600}
  minWidth={400}
  responsive={true}
  let:chartContext
>
  {#if Object.keys(data).length > 0}
    {#if type === 'hourly'}
      {createHourlyGhostHeatmap(chartContext)}
    {:else if type === 'weekday-hourly'}
      {createWeeklyHourlyGhostHeatmap(chartContext)}
    {:else}
      {createDailyGhostChart(chartContext)}
    {/if}
  {:else}
    <div class="no-data">
      <div class="ghost-icon">👻</div>
      <div>No activity data available for ghost analysis</div>
      <div class="ghost-subtitle">The digital realm awaits your presence...</div>
    </div>
  {/if}
</D3Chart>

<style>
  :global(.d3-chart-container) {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    min-height: 400px;
    border: 1px solid #dee2e6;
  }

  .no-data {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 200px;
    font-size: 16px;
    color: #666;
    text-align: center;
  }

  .ghost-icon {
    font-size: 48px;
    margin-bottom: 10px;
    opacity: 0.7;
  }

  .ghost-subtitle {
    font-size: 12px;
    font-style: italic;
    margin-top: 5px;
    opacity: 0.6;
  }

  :global(.ghost-hour-arc:hover),
  :global(.ghost-bar:hover),
  :global(.ghost-cell:hover) {
    filter: brightness(1.1);
    cursor: pointer;
  }
</style>