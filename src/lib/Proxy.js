import * as utils from '../utils';
import { fromId } from '../conf/networks';

export default class {
  constructor(address, tokenId, chainId) {
    this.address = address;
    this.tokenId = tokenId;
    this.chainId = chainId;

    this.web3;
    this.provider;
  }

  async connect() {
    const detected = await utils.getProvider();
    this.web3 = detected.web3;
    this.provider = detected.provider;

    this.provider.on('chainChanged', (e) => {
      window.location.reload();
    });

    // check that the chainId is the right one
    let chainId = await this.web3.eth.net.getId();
    if (chainId !== this.chainId) {
      throw new Error(
        `Connected to the wrong network. Current{${chainId}:${fromId(
          chainId,
        )}}; Expected{${this.chainId}:${fromId(this.chainId)}}`,
      );
    }

    this.instance = await utils.getContract(this.web3, this.address);
  }

  async uris() {
    try {
      const tokenURI = await this.tokenURI();
      let interactiveConfURI = '';

      try {
        interactiveConfURI = await this.interactiveConfURI();
      } catch (e) {}

      return { tokenURI, interactiveConfURI };
    } catch (e) {
      console.log(e);
    }
  }

  // TODO: Manage call to ERC1155
  async tokenURI() {
    const ERC721Interface = '0x80ac58cd';
    const ERC1155Interface = '0xd9b67a26';

    if (await this.instance.methods.supportsInterface(ERC721Interface).call()) {
      return this.instance.methods.tokenURI(this.tokenId).call();
    } else if (
      await this.instance.methods.supportsInterface(ERC1155Interface).call()
    ) {
      let uri = await this.instance.methods.uri(this.tokenId).call();
      if (uri.indexOf('{id}') !== -1) {
        const bnID = Web3.utils.toBN(this.tokenId).toString(16, 64);
        uri = uri.replace('{id}', bnID);
      }
      return uri;
    }
  }

  async interactiveConfURI() {
    return this.instance.methods.interactiveConfURI(this.tokenId).call();
  }
}
