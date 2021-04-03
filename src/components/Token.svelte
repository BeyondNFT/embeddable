<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import IPFS from '../conf/link.js';
  import Sandbox from '@beyondnft/sandbox';

  export let owner;
  export let uris;
  export let fitContent;
  export let width = '100%';
  export let height = '100%';

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
    json.interactive_nft.code_uri = IPFS.process(json.interactive_nft.code_uri);

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
      proxy = sandbox.getProxy();
      size = await proxy.size();
      console.log(size);
      proxy.iframe.width = size.width;
      proxy.iframe.height = size.height;
      if (fitContent) {
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
    let wRatio = Math.floor((parseInt(width) * 100) / size.width) / 100;
    let hRatio = Math.floor((parseInt(height) * 100) / size.height) / 100;
    let ratio = Math.min(wRatio, hRatio);
    console.log(wRatio, hRatio);
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
        res = await fetch(IPFS.process(uris.tokenURI));
        json = await res.json();
      }

      if (uris.interactiveConfURI) {
        res = await fetch(IPFS.process(uris.interactiveConfURI));
        owner_properties = await res.json();
      }

      loaded = true;
    } catch (e) {
      dispatch('error', 'Error while loading NFT JSONs.');
    }
  });
</script>

{#if !loaded}
  Loading...
{:else}
  <div
    class="beyondembeddable__wrapper"
    class:fitContent
    style={`width: ${_width}; height: ${_height}`}
  >
    {#if json.interactive_nft}
      <div class="beyondembeddable__sandbox" bind:this={view} />
    {:else}
      <!-- TODO: integrate other types of NFT -->
      <img
        class="beyondembeddable__fallback"
        src={IPFS.process(json.image)}
        alt={json.name}
      />
    {/if}
  </div>
{/if}

<style>
  .beyondembeddable__wrapper {
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

  .beyondembeddable__sandbox {
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
