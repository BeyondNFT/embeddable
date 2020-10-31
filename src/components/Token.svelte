<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Sandbox from '@beyondnft/sandbox';
  //import Sandbox from '../../../sandbox/dist/nftsandbox.es.js';

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

  let size;
  let proxy;
  let sandbox;

  let _width = width;
  let _height = height;

  $: loaded && view && json.interactive_nft && !sandbox && makeSandbox();
  function makeSandbox() {
    const props = {
      data: json,
    };

    if (owner) {
      props.owner = owner;
    }

    if (owner_properties) {
      props.owner_properties = owner_properties;
    }

    sandbox = new Sandbox({
      target: view,
      props,
    });

    sandbox.$on('loaded', async (e) => {
      if (resizable) {
        proxy = sandbox.getProxy();
        size = await proxy.size();
        proxy.iframe.width = size.width;
        proxy.iframe.height = size.height;
        resize();
      }

      dispatch('loaded', {
        size,
      });
    });

    sandbox.$on('error', (e) => {
      dispatch('error', e.detail);
    });
  }

  function resize() {
    // scale the iframe to fit in current width
    let ratio = Math.floor((parseInt(width) * 100) / size.width) / 100;
    view.style.transform = `scale(${ratio}, ${ratio})`;
  }

  function toggleSize() {
    view.style.transform = '';
    if (_width === width) {
      _width = size.width + 'px';
      _height = size.height + 'px';
    } else {
      _width = width;
      _height = height;
      resize();
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
    transform-origin: top left;
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
  }

  img {
    width: 100%;
    height: auto;
  }

  em {
    cursor: pointer;
  }
</style>

{#if !loaded}
  Loading...
{:else}
  <div
    class="beyondembeddable__wrapper"
    class:resizable
    style={`width: ${_width}; height: ${_height}`}>
    {#if json.interactive_nft}
      <div class="beyondembeddable__sandbox" bind:this={view} />
      {#if resizable}<em on:click={toggleSize}>toggle size</em>{/if}
    {:else}
      <!-- TODO: integrate other types of NFT -->
      <img
        class="beyondembeddable__fallback"
        src={json.image.replace('ipfs://', 'https://gateway.ipfs.io/')}
        alt={json.name} />
    {/if}
  </div>
{/if}
