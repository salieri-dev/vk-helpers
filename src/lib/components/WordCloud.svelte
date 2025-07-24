<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import cloud from 'd3-cloud';

  export let words: { word: string; count: number }[];

  let svgElement: SVGElement;
  let wordCloudContainer: HTMLDivElement;

  onMount(() => {
    if (words && svgElement && wordCloudContainer) {
      const width = wordCloudContainer.offsetWidth;
      const height = 450;

      d3.select(svgElement).attr('height', height);

      const maxCount = d3.max(words, (d: { word: string; count: number }) => d.count);
      const fontSize = d3.scaleSqrt().domain([0, maxCount || 1]).range([10, 80]);

      const layout = cloud()
        .size([width, height])
        .words(words.map((d) => ({ text: d.word, size: fontSize(d.count) })))
        .padding(5)
        .rotate(() => ~~(Math.random() * 6 - 3) * 30)
        .font('Impact')
        .fontSize((d: any) => d.size)
        .on('end', draw);

      layout.start();

      function draw(drawnWords: any[]) {
        d3.select(svgElement)
          .append('g')
          .attr('transform', `translate(${layout.size()[0] / 2},${layout.size()[1] / 2})`)
          .selectAll('text')
          .data(drawnWords)
          .enter()
          .append('text')
          .style('font-size', (d: any) => `${d.size}px`)
          .style('font-family', 'Impact')
          .attr('text-anchor', 'middle')
          .attr('transform', (d: any) => `translate(${d.x},${d.y})rotate(${d.rotate})`)
          .text((d: any) => d.text);
      }
    }
  });
</script>
<div bind:this={wordCloudContainer} style="width: 100%;">
  <svg bind:this={svgElement} width="100%"></svg>
</div>