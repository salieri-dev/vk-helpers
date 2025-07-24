<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import cloud from 'd3-cloud';

  export let words: { word: string; count: number }[];
  export let scale: 'sqrt' | 'linear' | 'log' = 'linear';
  export let colorScheme: 'category10' | 'accent' | 'paired' | 'spectral' = 'category10';

  let svgElement: SVGElement;
  let wordCloudContainer: HTMLDivElement;
  let width = 0;
  const height = 450;

  // This single reactive block depends on all relevant props.
  // It ensures drawWordCloud is only called when everything is ready,
  // and re-runs whenever the configuration changes.
  $: if (svgElement && width > 0 && words && scale && colorScheme) {
    drawWordCloud();
  }

  function drawWordCloud() {
    d3.select(svgElement).selectAll('*').remove();

    const svg = d3.select(svgElement)
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);
    
    const maxCount = d3.max(words, (d) => d.count);

    // --- MODIFIED: Select font scale based on the prop ---
    let fontSize;
    switch (scale) {
      case 'linear':
        fontSize = d3.scaleLinear().domain([0, maxCount || 1]).range([10, 80]);
        break;
      case 'log':
        // Log scale domain cannot include 0, and we adjust the range to prevent overflow
        fontSize = d3.scaleLog().domain([1, maxCount || 1]).range([10, 60]);
        break;
      case 'sqrt':
      default:
        fontSize = d3.scaleSqrt().domain([0, maxCount || 1]).range([12, 60]);
        break;
    }

    const layout = cloud()
      .size([width, height])
      .words(words.map((d) => ({ text: d.word, size: fontSize(d.count), count: d.count })))
      .padding(2)
      .rotate(0)
      .font('Impact, sans-serif')
      .fontSize((d: any) => d.size)
      .on('end', draw);

    layout.start();

    function draw(drawnWords: any[]) {
      let colors: readonly string[];
      switch (colorScheme) {
        case 'accent':    colors = d3.schemeAccent; break;
        case 'paired':    colors = d3.schemePaired; break;
        case 'spectral':  colors = d3.schemeSpectral[11]; break;
        default:          colors = d3.schemeCategory10; break;
      }
      const colorScale = d3.scaleOrdinal(colors);

      // Explicitly type the selection to resolve the TS error with .merge()
      const updateSelection = svg.selectAll<SVGTextElement, any>("text")
        .data(drawnWords, (d: any) => d.text);

      // EXIT: Remove old words
      updateSelection.exit()
        .transition().duration(200)
        .style("fill-opacity", 1e-6)
        .remove();

      // ENTER: Create new text elements for new words
      const enterSelection = updateSelection.enter().append("text")
        .attr("class", "word-text")
        .style("font-family", "Impact, sans-serif")
        .attr("text-anchor", "middle")
        .style("fill-opacity", 1e-6) // Start transparent for fade-in
        .text((d: any) => d.text);
      
      // MERGE + UPDATE: Apply attributes and styles to both new and existing words
      const mergedSelection = enterSelection.merge(updateSelection);
      
      mergedSelection
        .transition().duration(600)
        .attr("transform", (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .style("font-size", (d: any) => `${d.size}px`)
        .style("fill", (d: any) => colorScale(d.text))
        .style("fill-opacity", 1);
        
      // Apply hover events to the entire merged selection
      mergedSelection
        .on('mouseover', function(event, d: any) {
          d3.select(this).classed('hovered', true);
          const tooltip = svg.append('g')
            .attr('class', 'word-tooltip')
            .attr('transform', `translate(${d.x}, ${d.y})`);
          
          const textNode = tooltip.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', -d.size / 2 - 15)
            .text(`${d.text}: ${d.count}`)
            .node();
          
          if (textNode) {
            const bbox = textNode.getBBox();
            tooltip.insert('rect', 'text')
              .attr('x', bbox.x - 5)
              .attr('y', bbox.y - 2)
              .attr('width', bbox.width + 10)
              .attr('height', bbox.height + 4)
              .attr('rx', 4)
              .style('fill', 'rgba(0, 0, 0, 0.75)');
          }
        })
        .on('mouseout', function() {
          d3.select(this).classed('hovered', false);
          svg.select('.word-tooltip').remove();
        });
    }
  }
</script>

<div class="word-cloud-container" bind:clientWidth={width}>
  <svg bind:this={svgElement}></svg>
</div>

<style>
  .word-cloud-container {
    width: 100%;
    min-height: 450px;
  }
  svg {
    width: 100%;
    height: 100%;
  }

  /* --- ADDED: Styles for hover effects and tooltip --- */
  :global(.word-text) {
    cursor: pointer;
    transition: all 0.2s ease-in-out;
  }
  :global(.word-text.hovered) {
    fill: #000 !important;
    text-shadow: 0 0 5px rgba(0,0,0,0.3);
  }
  :global(.word-tooltip text) {
    fill: white;
    font-size: 14px;
    font-family: sans-serif;
    font-weight: bold;
    pointer-events: none; /* Make sure tooltip doesn't interfere with mouse events */
  }
</style>