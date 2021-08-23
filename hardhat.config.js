require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  mocha: {
    timeout: 240000,
  },
  networks: { 
    hardhat: {                      
    gasPrice: 0 
    },    
    
  },
};