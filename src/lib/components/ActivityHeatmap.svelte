<script lang="ts">
  import * as d3 from 'd3';
  import D3Chart from './D3Chart.svelte';

  export let data: { [key: string]: number } = {};
  export let type: 'hourly' | 'daily' = 'hourly';
  export let title: string = '';

  interface ChartData {
    day: string;
    value: number;
  }

  function createHourlyHeatmap(chartContext: any) {
    const { svg, g, width, height, innerWidth, innerHeight, showTooltip, hideTooltip } = chartContext;

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(title || 'Hourly Activity Pattern');

    // Create circular/radial visualization
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    const outerRadius = Math.min(innerWidth, innerHeight) / 2 - 20;
    const innerRadius = outerRadius * 0.4;

    // Process data for 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const maxValue = Math.max(...Object.values(data));
    
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, maxValue]);

    const angleScale = d3.scaleLinear()
      .domain([0, 24])
      .range([0, 2 * Math.PI]);

    // Create arc generator with proper typing
    const arc = d3.arc<number>()
      .innerRadius(innerRadius)
      .outerRadius((d: number) => {
        const value = data[d] || 0;
        return innerRadius + (outerRadius - innerRadius) * (value / maxValue);
      })
      .startAngle((d: number) => angleScale(d))
      .endAngle((d: number) => angleScale(d + 1))
      .padAngle(0.02);

    // Add hour segments
    const hourGroup = g.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    hourGroup.selectAll('.hour-arc')
      .data(hours)
      .enter().append('path')
      .attr('class', 'hour-arc')
      .attr('d', (d: number) => arc(d))
      .attr('fill', (d: number) => colorScale(data[d] || 0))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('opacity', 0.8)
      .on('mouseover', function(this: SVGPathElement, event: MouseEvent, d: number) {
        d3.select(this).style('opacity', 1);
        
        showTooltip(event, `
          <strong>${d}:00 - ${d + 1}:00</strong><br/>
          Messages: ${(data[d] || 0).toLocaleString()}
        `);
      })
      .on('mouseout', function(this: SVGPathElement) {
        d3.select(this).style('opacity', 0.8);
        hideTooltip();
      });

    // Add hour labels
    hourGroup.selectAll('.hour-label')
      .data(hours.filter(h => h % 3 === 0)) // Show every 3rd hour
      .enter().append('text')
      .attr('class', 'hour-label')
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

    // Add center circle with total
    const totalMessages = Object.values(data).reduce((sum, val) => sum + val, 0);
    hourGroup.append('circle')
      .attr('r', innerRadius - 10)
      .attr('fill', '#f8f9fa')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 2);

    hourGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('Total');

    hourGroup.append('text')
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#4a90e2')
      .text(totalMessages.toLocaleString());
  }

  function createDailyChart(chartContext: any) {
    const { svg, g, width, height, innerWidth, innerHeight, showTooltip, hideTooltip } = chartContext;

    // Add title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(title || 'Daily Activity Pattern');

    // Process data - use actual keys from the data
    const days = Object.keys(data).length > 0 ? Object.keys(data) : [];
    const chartData: ChartData[] = days.map(day => ({
      day,
      value: data[day] || 0
    })).filter(d => d.value > 0); // Only show days with activity

    // If no data, show a message
    if (chartData.length === 0) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('fill', '#666')
        .text('No daily activity data available');
      return;
    }

    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.day))
      .range([0, innerWidth])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.value) || 0])
      .nice()
      .range([innerHeight, 0]);

    // Add gradient definition
    const gradient = svg.append('defs').append('linearGradient')
      .attr('id', 'bar-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#4a90e2')
      .attr('stop-opacity', 0.8);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#2c5aa0')
      .attr('stop-opacity', 1);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat((d: d3.NumberValue) => d.toLocaleString()))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    // Add bars with animation
    g.selectAll('.bar')
      .data(chartData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', (d: ChartData) => xScale(d.day) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('fill', 'url(#bar-gradient)')
      .attr('rx', 4)
      .attr('ry', 4)
      .style('opacity', 0.8)
      .on('mouseover', function(this: SVGRectElement, event: MouseEvent, d: ChartData) {
        d3.select(this).style('opacity', 1);
        
        showTooltip(event, `
          <strong>${d.day}</strong><br/>
          Messages: ${d.value.toLocaleString()}
        `);
      })
      .on('mouseout', function(this: SVGRectElement) {
        d3.select(this).style('opacity', 0.8);
        hideTooltip();
      })
      .transition()
      .duration(1000)
      .delay((_d: ChartData, i: number) => i * 100)
      .attr('y', (d: ChartData) => yScale(d.value))
      .attr('height', (d: ChartData) => innerHeight - yScale(d.value));

    // Add value labels on bars
    g.selectAll('.bar-label')
      .data(chartData)
      .enter().append('text')
      .attr('class', 'bar-label')
      .attr('x', (d: ChartData) => (xScale(d.day) || 0) + xScale.bandwidth() / 2)
      .attr('y', (d: ChartData) => yScale(d.value) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .style('opacity', 0)
      .text((d: ChartData) => d.value.toLocaleString())
      .transition()
      .duration(1000)
      .delay((_d: ChartData, i: number) => i * 100 + 500)
      .style('opacity', 1);
  }
</script>

<D3Chart
  {data}
  height={type === 'hourly' ? 400 : 300}
  margin={{ top: 60, right: 40, bottom: 60, left: 80 }}
  maxWidth={600}
  minWidth={400}
  responsive={true}
  let:chartContext
>
  {#if Object.keys(data).length > 0}
    {#if type === 'hourly'}
      {createHourlyHeatmap(chartContext)}
    {:else}
      {createDailyChart(chartContext)}
    {/if}
  {:else}
    <div class="no-data">
      No activity data available
    </div>
  {/if}
</D3Chart>

<style>
  :global(.d3-chart-container) {
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    min-height: 400px;
  }

  .no-data {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    font-size: 16px;
    color: #666;
  }
</style>