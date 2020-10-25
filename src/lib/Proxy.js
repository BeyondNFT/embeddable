import * as utils from '../utils';

export default class {
  constructor(address, tokenId, chaindId) {
    this.address = address;
    this.tokenId = tokenId;
    this.chaindId = chaindId;

    this.web3;
    this.provider;
  }

  async connect() {
    const detected = await utils.getProvider();
    this.web3 = detected.web3;
    this.provider = detected.provider;

    // check that the chainId is the right one
    let chaindId = await this.web3.eth.net.getId();
    if (chaindId !== this.chaindId) {
      throw new Error(
        `Connected to the wrong network. Current{${chaindId}}; Expected{${this.chaindId}}`
      );
    }

    this.instance = await utils.getContract(this.web3, this.address);
  }

  // TODO: Manage call to ERC1155
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

  async tokenURI() {
    return this.instance.methods.tokenURI(this.tokenId).call();
  }

  async interactiveConfURI() {
    return this.instance.methods.interactiveConfURI(this.tokenId).call();
  }
}
