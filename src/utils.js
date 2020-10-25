import detectEthereumProvider from '@metamask/detect-provider';
import Web3 from 'web3/dist/web3.min.js';
import abi from './conf/abi.js';

export async function getProvider() {
  const provider = await detectEthereumProvider();
  if (provider) {
    const web3 = new Web3(provider);
    return { web3, provider };
  } else {
    throw new Error(`
			No ethereum provider detected.
			Please install Metamask or any other wallet (Polaris, Trust Wallet...).
		`);
  }
}

export async function getContract(web3, address) {
  return new web3.eth.Contract(abi, address);
}
