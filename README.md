# SAGA DAO Contracts

This repository contains the smart contracts for the SAGA DAO marketplace, which is built on the SAGA chain.

## Contracts

- **SagaToken**: ERC20Votes token for DAO governance
- **MCPPool**: Core contract for the MCP marketplace
- **SagaDAO**: DAO governance structure based on OpenZeppelin's Governor
- **TimelockController**: Manages the execution of proposed actions

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

### Deploy to Ethereum Testnet (Sepolia)

```shell
npm run deploy:sepolia
```

### Deploy to Ethereum Mainnet

```shell
npm run deploy:mainnet
```

## Testing

```shell
npm run test
```
