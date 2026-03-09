/** @type {import('hardhat/config').HardhatUserConfig} */
const config = {
  solidity: "0.8.19",
  networks: {
    // Start local node with: cd blockchain && npm run node
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Uncomment and fill in for testnet deployment
    // testnet: {
    //   url: "https://rpc-mumbai.maticvigil.com",
    //   accounts: [process.env.PRIVATE_KEY],
    // },
  },
};

export default config;
