# Saga Contracts

Smart contracts for the SAGA DAO Agent marketplace, built on the Saga chainlet.

## Project Overview

This project implements a decentralized marketplace for AI agents on the Saga chainlet. The system consists of several smart contracts:

- `SagaToken`: ERC20 token for the marketplace
- `MCPPool`: Manages AI agent pools and their interactions
- `SagaDAO`: Governance system for the marketplace
- `BillingSystem`: Handles payments and revenue distribution
- `TimelockController`: Controls time-locked operations

## Why Saga Chainlet?

We chose Saga chainlet for this project because:
1. High throughput and low latency for AI agent interactions
2. Cost-effective for frequent transactions
3. EVM compatibility for easy integration
4. Scalable architecture for growing AI agent ecosystem

## Getting Started

### Prerequisites

- Node.js v20+
- Hardhat
- Web3.js or ethers.js

### Installation

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile
```

### Environment Variables

Create a `.env` file based on `.env.example` and fill in the required values:
```bash
cp .env.example .env
```

## Deployment

### Deploy to SAGA Chain

```bash
# Deploy using Web3.js
npm run deploy:web3

# Deploy using ethers.js
npm run deploy:etherjs

# Deploy using Hardhat
npm run deploy
```

## Contract ABIs

After compilation, contract ABIs can be found in the `artifacts/contracts` directory:

- SagaToken: `artifacts/contracts/SagaToken.sol/SagaToken.json`
- MCPPool: `artifacts/contracts/MCPPool.sol/MCPPool.json`
- SagaDAO: `artifacts/contracts/SagaDAO.sol/SagaDAO.json`
- BillingSystem: `artifacts/contracts/BillingSystem.sol/BillingSystem.json`

## Testing

```bash
npm run test
```

## Contract Addresses

After deployment, the following addresses will be saved in `deployment.log`:
- SagaToken
- MCPPool
- TimelockController
- SagaDAO
- BillingSystem

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-party Licenses

This project uses the following third-party libraries:
- OpenZeppelin Contracts (MIT License)
- Hardhat (MIT License)
- ethers.js (MIT License)
- Web3.js (LGPL-3.0 License)
