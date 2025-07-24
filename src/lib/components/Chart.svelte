<script lang="ts">
  import { onMount } from 'svelte';
  import ApexCharts from 'apexcharts';

  export let options: any;
  let chartElement: HTMLElement;
  let chart: ApexCharts;

  onMount(() => {
    chart = new ApexCharts(chartElement, options);
    chart.render();
  });

  // Automatically update the chart when options change
  $: if (chart && options) {
    chart.updateOptions(options);
  }
</script>

<div bind:this={chartElement}></div>