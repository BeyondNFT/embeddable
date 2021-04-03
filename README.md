# BeyondNFT - Embeddable Dynamic NFTs

Easily embed Dynamic NFTss in your website!

This was developed for the Untitled NFT Hackaton while working on a safe and hopefully in the future standard way to create Dynamic NFTss.

## Component

This exports an es module that you can bundle in your app or just include in your html [see ./public/index.html](./public/index.html).

It requires a `target` (the html element to which it should attach) and an object `props` :

### parameters
`target`: HTMLElement
`props`: object
 - `contract` (required): contract address
 - `tokenId` (required): tokenId
 - `network` (optional): network to request to. Good to make sure the ucrrent user is on the right chain.
 - `fitContent` (optional): If you allow the window to try to fit the content automatically. default true
 - `width` (optional): width of the container. Default: 388px;
 - `height` (optional): width of the container. Default: 560px;


## Usage

As a module from jsdeliver:

```html
<div class="viewer"></div>
<script type="module">
  import Embeddable from 'https://cdn.jsdelivr.net/npm/@beyondnft/embeddable@0.0.4/dist/embeddable.es.min.js';
  new Embeddable({
    target: document.querySelector('.viewer'),
    props: {
      contract: '0x60f80121c31a0d46b5279700f9df786054aa5ee5',
      tokenId: 49884,
      network: 'mainnet', // can be a number or a string (see src/conf/networks.js)
      fitContent: false,
      width: '400px',
      height: '600px',
    },
  });
</script>
```

you can also find the UMD version (will set Embeddable globally): [https://cdn.jsdelivr.net/npm/@beyondnft/embeddable@0.0.4/dist/embeddable.umd.min.js](https://cdn.jsdelivr.net/npm/@beyondnft/embeddable@0.0.4/dist/embeddable.umd.min.js)


## Development

Want to see how it works? Let's go!

```bash
  git clone https://github.com/BeyondNFT/embeddable.git embeddable-inft
  #or npx degit https://github.com/BeyondNFT/embeddable.git embeddable-inft
  cd embeddable-inft
  npm install
  npm run dev
  # open the url shown to you (probably http://localhost:3000)
```

There are two commands:

`npm run dev`

launches the dev mode. You can view the Embeddable work live at http://localhost:3000 (or any other address that the console gave you).
Any change in the src files will be reflected automatically in the browser (the page will livereload).

`npm run build`

build the source. files are built in `./dist`


Component is created with [Svelte](https://svelte/dev), because... what else?

Bundle is made using rollup, because i'm waiting for svelte@next before looking at Snowpack.
