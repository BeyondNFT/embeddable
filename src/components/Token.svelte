<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Sandbox from '@beyondnft/sandbox';

  export let owner;
  export let uris;
  export let resizable;
  export let width;
  export let height;

  const dispatch = createEventDispatcher();

  let loaded = false;
  let json;
  let owner_properties = {};
  let view;

  $: {
    if (loaded && view) {
      if (json.interactive_nft) {
        const props = {
          data: json,
        };

        if (owner) {
          props.owner = owner;
        }

        if (owner_properties) {
          props.owner_properties = owner_properties;
        }

        const sandbox = new Sandbox({
          target: view,
          props,
        });

        sandbox.$on('error', (e) => {
          dispatch('error', e.detail);
        });
      }
    }
  }

  onMount(async () => {
    try {
      let res;
      if (uris.tokenURI) {
        res = await fetch(uris.tokenURI);
        json = await res.json();
      }

      if (uris.interactiveConfURI) {
        res = await fetch(uris.interactiveConfURI);
        owner_properties = await res.json();
      }

      loaded = true;
    } catch (e) {
      dispatch('error', 'Error while loading NFT JSONs.');
    }
  });
</script>

<style>
  .beyondembeddable__wrapper.resizable {
    position: relative;
  }

  em {
    position: absolute;
    top: 100%;
    font-size: 0.8em;
    right: 0;
    z-index: 0;
  }

  .beyondembeddable__sandbox {
    width: 100%;
    height: 100%;
  }

  .beyondembeddable__wrapper.resizable .beyondembeddable__sandbox {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    min-width: 100%;
    min-height: 100%;
    z-index: 1;
    resize: both;
    overflow: auto;
  }

  img {
    width: 100%;
    height: auto;
  }
</style>

{#if !loaded}
  Loading...
{:else}
  <div
    class="beyondembeddable__wrapper"
    class:resizable
    style={`width: ${width}; height: ${height}`}>
    {#if json.interactive_nft}
      <div class="beyondembeddable__sandbox" bind:this={view} />
      {#if resizable}<em>resize if needed</em>{/if}
    {:else}
      <!-- TODO: integrate other types of NFT -->
      <img
        class="beyondembeddable__fallback"
        src={json.image.replace('ipfs://', 'https://gateway.ipfs.io/')}
        alt={json.name} />
    {/if}
  </div>
{/if}
