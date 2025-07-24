<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Network } from 'vis-network';
  import type { Node, Edge, Options } from 'vis-network';

  export let nodes: Node[];
  export let edges: Edge[];

  let container: HTMLElement;
  let network: Network;

  const options: Options = {
    nodes: {
      shape: 'dot',
      size: 16,
      font: {
        size: 14,
        color: '#333'
      },
      borderWidth: 2,
    },
    edges: {
      width: 2,
      color: {
        color: '#848484',
        highlight: '#4a90e2',
      },
      arrows: {
        to: { enabled: false }
      }
    },
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based'
    },
    interaction: {
      hover: true,
      tooltipDelay: 200
    }
  };

  onMount(() => {
    if (container) {
      const data = { nodes, edges };
      network = new Network(container, data, options);
    }
  });

  // Update network if data changes
  $: if (network && nodes && edges) {
    network.setData({ nodes, edges });
  }

  onDestroy(() => {
    if (network) {
      network.destroy();
    }
  });
</script>

<div class="network-container" bind:this={container}></div>

<style>
  .network-container {
    height: 600px;
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #f8f9fa;
  }
</style>