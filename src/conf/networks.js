const networks = {
  mainnet: 0x1,
  ropsten: 0x3,
  rinkeby: 0x4,
  goerli: 0x5,
  kovan: 0x2a,
  polygon: 0x89,
  xDai: 0x64,
  mumbai: 0x13881,
};

export default networks;

export function fromId(id) {
  let name = 'Unknown';
  Object.keys(networks).forEach((key) => {
    if (networks[key] === id) {
      name = key;
    }
  });

  return name;
}
