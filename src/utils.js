import detectEthereumProvider from '@metamask/detect-provider';
import abi from './conf/abi.js';

export async function getProvider() {
  if ('undefined' === typeof Web3 || Web3.version !== '1.3.0') {
    await loadWeb3();
  }

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

async function loadWeb3() {
  return new Promise((resolve, reject) => {
    const src = 'https://cdnjs.cloudflare.com/ajax/libs/web3/1.3.0/web3.min.js';
    const script = document.createElement('script');
    script.onload = resolve;
    script.onerror = reject;
    script.src = src;
    document.body.appendChild(script);
  });
}
export async function getContract(web3, address) {
  return new web3.eth.Contract(abi, address);
}
