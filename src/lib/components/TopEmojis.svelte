<script lang="ts">
  import * as d3 from 'd3';
  import D3Chart from './D3Chart.svelte';

  export let emojiStats: Map<string, number> = new Map();
  export let topN = 10;

  $: topEmojis = Array.from(emojiStats.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  $: hasData = emojiStats.size > 0;

  function drawChart(chartContext: any) {
    const { g, innerWidth, innerHeight, showTooltip, hideTooltip } = chartContext;

    if (topEmojis.length === 0) return;

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(topEmojis, d => d[1]) || 0])
      .nice()
      .range([0, innerWidth]);

    const yScale = d3.scaleBand()
      .domain(topEmojis.map(d => d[0]))
      .range([0, innerHeight])
      .padding(0.1);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#666');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '14px')
      .style('fill', '#333');

    // Add bars with hover effects
    g.selectAll('.bar')
      .data(topEmojis)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', (d: [string, number]) => yScale(d[0]) || 0)
      .attr('width', (d: [string, number]) => xScale(d[1]))
      .attr('height', yScale.bandwidth())
      .attr('fill', '#4a90e2')
      .attr('rx', 4)
      .style('opacity', 0.8)
      .on('mouseover', (event: MouseEvent, d: [string, number]) => {
        d3.select(event.currentTarget as SVGRectElement).style('opacity', 1);
        showTooltip(event, `
          <strong>${d[0]}</strong><br/>
          Count: ${d[1].toLocaleString()}
        `);
      })
      .on('mouseout', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGRectElement).style('opacity', 0.8);
        hideTooltip();
      });

    // Add value labels
    g.selectAll('.label')
      .data(topEmojis)
      .enter().append('text')
      .attr('class', 'label')
      .attr('x', (d: [string, number]) => xScale(d[1]) + 10)
      .attr('y', (d: [string, number]) => (yScale(d[0]) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .text((d: [string, number]) => d[1].toLocaleString())
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', '#333');
  }
</script>

<div class="top-emojis-container">
  <D3Chart
    data={hasData ? topEmojis : null}
    width={600}
    height={400}
    margin={{ top: 20, right: 60, bottom: 40, left: 120 }}
    responsive={true}
    maxWidth={800}
    on:ready={(event) => drawChart(event.detail)}
  />
</div>

<style>
  .top-emojis-container {
    width: 100%;
    max-width: 600px;
    margin: auto;
  }
  
  svg {
    width: 100%;
    height: 100%;
  }
  
</style>