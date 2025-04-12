# SAGA DAO Contracts

This repository contains the smart contracts for the SAGA DAO marketplace, which is built on the SAGA chain.

## Contracts

- **SagaToken**: ERC20Votes token for DAO governance
- **MCPPool**: Core contract for the MCP marketplace
- **SagaDAO**: DAO governance structure based on OpenZeppelin's Governor
- **BillingSystem**: Handles payments and revenue distribution for MCP usage

## Setup

1. Install dependencies:
```shell
npm install
```

2. Create a `.env` file based on `.env.example` and fill in the required values:
```shell
cp .env.example .env
```

3. Compile the contracts:
```shell
npm run compile
```

## Deployment

### Deploy to SAGA Chain

```shell
npm run deploy:web3
```

## Contract ABIs

After compilation, contract ABIs can be found in the `artifacts/contracts` directory:

- SagaToken: `artifacts/contracts/SagaToken.sol/SagaToken.json`
- MCPPool: `artifacts/contracts/MCPPool.sol/MCPPool.json`
- SagaDAO: `artifacts/contracts/SagaDAO.sol/SagaDAO.json`
- BillingSystem: `artifacts/contracts/BillingSystem.sol/BillingSystem.json`

## Testing

```shell
npm run test
```
