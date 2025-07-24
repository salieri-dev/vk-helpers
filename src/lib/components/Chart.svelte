<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  interface ChartData {
    [key: string]: any;
  }

  export let data: ChartData[] = [];
  export let type: 'bar' | 'line' | 'pie' | 'area' | 'heatmap' = 'bar';
  export let xKey: string = 'x';
  export let yKey: string = 'y';
  export let width: number = 400;
  export let height: number = 300;
  export let margin = { top: 20, right: 20, bottom: 40, left: 40 };
  export let color: string = '#3b82f6';
  export let title: string = '';

  // For legacy ApexCharts compatibility
  export let options: any = null;

  let chartElement: SVGElement | HTMLDivElement;

  $: if (chartElement && ((data && data.length > 0) || options)) {
    renderChart();
  }

  function renderChart() {
    // Handle legacy ApexCharts options format
    if (options && !data.length) {
      handleLegacyOptions();
      return;
    }

    // Clear previous chart
    d3.select(chartElement).selectAll('*').remove();

    const svg = d3.select(chartElement).append('svg')
      .attr('width', width)
      .attr('height', height);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add title if provided
    if (title) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(title);
    }

    switch (type) {
      case 'bar':
        renderBarChart(g, innerWidth, innerHeight);
        break;
      case 'line':
        renderLineChart(g, innerWidth, innerHeight);
        break;
      case 'pie':
        renderPieChart(svg as d3.Selection<SVGSVGElement, unknown, null, undefined>, width, height);
        break;
      case 'area':
        renderAreaChart(g, innerWidth, innerHeight);
        break;
      case 'heatmap':
        renderHeatmap(g, innerWidth, innerHeight);
        break;
    }
  }

  function handleLegacyOptions() {
    // Convert ApexCharts heatmap options to D3 heatmap
    if (options?.chart?.type === 'heatmap' && options?.series) {
      const heatmapData = options.series[0]?.data || [];
      data = heatmapData.map((item: any) => ({ x: item.x, y: item.y }));
      type = 'heatmap';
      title = options?.title?.text || '';
      renderChart();
    }
  }

  function renderBarChart(g: d3.Selection<SVGGElement, unknown, null, undefined>, innerWidth: number, innerHeight: number) {
    const xScale = d3.scaleBand()
      .domain(data.map(d => String(d[xKey])))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => Number(d[yKey])) || 0])
      .nice()
      .range([innerHeight, 0]);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(String(d[xKey])) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', d => yScale(Number(d[yKey])))
      .attr('height', d => innerHeight - yScale(Number(d[yKey])))
      .attr('fill', color);
  }

  function renderLineChart(g: d3.Selection<SVGGElement, unknown, null, undefined>, innerWidth: number, innerHeight: number) {
    const xScale = d3.scalePoint()
      .domain(data.map(d => String(d[xKey])))
      .range([0, innerWidth])
      .padding(0.5);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => Number(d[yKey])) || 0])
      .nice()
      .range([innerHeight, 0]);

    const line = d3.line<ChartData>()
      .x(d => xScale(String(d[xKey])) || 0)
      .y(d => yScale(Number(d[yKey])))
      .curve(d3.curveMonotoneX);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add the line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add dots
    g.selectAll('.dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(String(d[xKey])) || 0)
      .attr('cy', d => yScale(Number(d[yKey])))
      .attr('r', 4)
      .attr('fill', color);
  }

  function renderPieChart(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, width: number, height: number) {
    const radius = Math.min(width, height) / 2 - 10;
    
    const pie = d3.pie<ChartData>()
      .value(d => Number(d[yKey]))
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<ChartData>>()
      .innerRadius(0)
      .outerRadius(radius);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => colorScale(i.toString()));

    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .text(d => String(d.data[xKey]));
  }

  function renderAreaChart(g: d3.Selection<SVGGElement, unknown, null, undefined>, innerWidth: number, innerHeight: number) {
    const xScale = d3.scalePoint()
      .domain(data.map(d => String(d[xKey])))
      .range([0, innerWidth])
      .padding(0.5);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => Number(d[yKey])) || 0])
      .nice()
      .range([innerHeight, 0]);

    const area = d3.area<ChartData>()
      .x(d => xScale(String(d[xKey])) || 0)
      .y0(innerHeight)
      .y1(d => yScale(Number(d[yKey])))
      .curve(d3.curveMonotoneX);

    const line = d3.line<ChartData>()
      .x(d => xScale(String(d[xKey])) || 0)
      .y(d => yScale(Number(d[yKey])))
      .curve(d3.curveMonotoneX);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add the area
    g.append('path')
      .datum(data)
      .attr('fill', color)
      .attr('fill-opacity', 0.3)
      .attr('stroke', 'none')
      .attr('d', area);

    // Add the line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);
  }

  function renderHeatmap(g: d3.Selection<SVGGElement, unknown, null, undefined>, innerWidth: number, innerHeight: number) {
    const uniqueX = Array.from(new Set(data.map(d => String(d[xKey]))));
    const uniqueY = Array.from(new Set(data.map(d => String(d[yKey]))));
    
    const cellWidth = innerWidth / uniqueX.length;
    const cellHeight = innerHeight / uniqueY.length;
    
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(data, d => Number(d.y)) || 0]);

    const cells = g.selectAll('.cell')
      .data(data)
      .enter().append('rect')
      .attr('class', 'cell')
      .attr('x', d => uniqueX.indexOf(String(d[xKey])) * cellWidth)
      .attr('y', d => uniqueY.indexOf(String(d[yKey])) * cellHeight)
      .attr('width', cellWidth)
      .attr('height', cellHeight)
      .attr('fill', d => colorScale(Number(d.y)))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    // Add X axis labels
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .selectAll('.x-label')
      .data(uniqueX)
      .enter().append('text')
      .attr('class', 'x-label')
      .attr('x', (d, i) => i * cellWidth + cellWidth/2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .text(d => d);

    // Add Y axis labels
    g.selectAll('.y-label')
      .data(uniqueY)
      .enter().append('text')
      .attr('class', 'y-label')
      .attr('x', -10)
      .attr('y', (d, i) => i * cellHeight + cellHeight/2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .text(d => d);
  }
</script>

<div bind:this={chartElement}></div>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style>