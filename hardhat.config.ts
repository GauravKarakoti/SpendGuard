import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

// Fallback to the standard 0G Testnet RPC if not provided in .env
const ZEROG_RPC_URL  = process.env.ZEROG_RPC_URL  || "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY    = process.env.DEPLOYER_PRIVATE_KEY || "";
// Blockscout doesn't always require a real API key, but Hardhat requires the field to be populated
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "0g-testnet-placeholder-key";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ...(PRIVATE_KEY
      ? {
          zerog: {
            url: ZEROG_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 16602, // 0G Testnet Chain ID
          },
        }
      : {}),
  },
  etherscan: {
    apiKey: {
      zerog: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "zerog",
        chainId: 16600,
        urls: {
          apiURL: "https://chainscan-galileo.0g.ai/api", // 0G Testnet block explorer API
          browserURL: "https://chainscan-galileo.0g.ai", // 0G Testnet block explorer GUI
        },
      },
    ],
  },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;