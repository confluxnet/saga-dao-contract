const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("Deploying contracts with Web3.js directly...");

  // Connect to the SAGA network
  const web3 = new Web3(process.env.SAGA_RPC_URL);

  // Create a wallet from the private key
  const privateKey = process.env.PRIVATE_KEY?.startsWith("0x")
    ? process.env.PRIVATE_KEY
    : `0x${process.env.PRIVATE_KEY}`;
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  console.log(`Deploying with account: ${account.address}`);

  // Get the contract artifacts
  const sagaTokenArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/SagaToken.sol/SagaToken.json"),
      "utf8"
    )
  );

  const mcpPoolArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/MCPPool.sol/MCPPool.json"), "utf8")
  );

  const sagaDaoArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/SagaDAO.sol/SagaDAO.json"), "utf8")
  );

  // Deploy SagaToken
  console.log("Deploying SagaToken...");
  const sagaTokenContract = new web3.eth.Contract(sagaTokenArtifact.abi);
  const sagaTokenDeploy = sagaTokenContract.deploy({
    data: sagaTokenArtifact.bytecode,
    arguments: [],
  });

  const sagaTokenGas = await sagaTokenDeploy.estimateGas({ from: account.address });
  const sagaTokenGasPrice = await web3.eth.getGasPrice();
  const sagaTokenTx = await sagaTokenDeploy.send({
    from: account.address,
    gas: Math.floor(Number(sagaTokenGas) * 1.2), // Add 20% buffer
    gasPrice: sagaTokenGasPrice,
  });

  console.log(`SagaToken deployed to: ${sagaTokenTx.options.address}`);
  const sagaTokenAddress = sagaTokenTx.options.address;

  // Deploy MCPPool
  console.log("Deploying MCPPool...");
  const mcpPool = new web3.eth.Contract(mcpPoolArtifact.abi);
  const mcpPoolGas = await mcpPool
    .deploy({
      data: mcpPoolArtifact.bytecode,
      arguments: [sagaTokenAddress, account.address],
    })
    .estimateGas();
  const mcpPoolGasPrice = await web3.eth.getGasPrice();
  const mcpPoolDeploy = await mcpPool
    .deploy({
      data: mcpPoolArtifact.bytecode,
      arguments: [sagaTokenAddress, account.address],
    })
    .send({
      from: account.address,
      gas: Number(mcpPoolGas),
      gasPrice: Number(mcpPoolGasPrice),
    });
  const mcpPoolAddress = mcpPoolDeploy.options.address;
  console.log("MCPPool deployed to:", mcpPoolAddress);

  // Deploy TimelockController using OpenZeppelin's contract
  console.log("Deploying TimelockController...");

  // TimelockController ABI (minimal version for deployment)
  const timelockAbi = [
    {
      inputs: [
        { internalType: "uint256", name: "minDelay", type: "uint256" },
        { internalType: "address[]", name: "proposers", type: "address[]" },
        { internalType: "address[]", name: "executors", type: "address[]" },
        { internalType: "address", name: "admin", type: "address" },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [
        { internalType: "bytes32", name: "role", type: "bytes32" },
        { internalType: "address", name: "account", type: "address" },
      ],
      name: "grantRole",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "bytes32", name: "role", type: "bytes32" },
        { internalType: "address", name: "account", type: "address" },
      ],
      name: "revokeRole",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "PROPOSER_ROLE",
      outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "EXECUTOR_ROLE",
      outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "TIMELOCK_ADMIN_ROLE",
      outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  // TimelockController bytecode (this is a placeholder, you need the actual bytecode)
  const timelockBytecode = "0x..."; // Replace with actual bytecode

  const timelockContract = new web3.eth.Contract(timelockAbi);

  // Calculate timelock parameters
  const minDelay = 86400; // 1 day in seconds
  const proposers = []; // Will be set after SagaDAO deployment
  const executors = ["0x0000000000000000000000000000000000000000"]; // Everyone can execute
  const admin = account.address; // Deployer is admin initially

  // For now, we'll skip the TimelockController deployment and use a placeholder address
  // In a real deployment, you would need to deploy the TimelockController with the correct bytecode
  const timelockAddress = "0x0000000000000000000000000000000000000000"; // Placeholder

  console.log(`Using placeholder TimelockController address: ${timelockAddress}`);

  // Deploy SagaDAO
  console.log("Deploying SagaDAO...");
  const sagaDaoContract = new web3.eth.Contract(sagaDaoArtifact.abi);

  // Calculate DAO parameters
  const votingDelay = 0; // No delay before voting starts
  const votingPeriod = 86400; // 1 day voting period
  const quorumNumerator = 4; // 4% quorum
  const proposalThreshold = 1; // 1 token needed to propose

  const sagaDaoDeploy = sagaDaoContract.deploy({
    data: sagaDaoArtifact.bytecode,
    arguments: [
      sagaTokenAddress,
      timelockAddress,
      votingDelay,
      votingPeriod,
      quorumNumerator,
      proposalThreshold,
      mcpPoolAddress,
    ],
  });

  const sagaDaoGas = await sagaDaoDeploy.estimateGas({ from: account.address });
  const sagaDaoGasPrice = await web3.eth.getGasPrice();
  const sagaDaoTx = await sagaDaoDeploy.send({
    from: account.address,
    gas: Math.floor(Number(sagaDaoGas) * 1.2), // Add 20% buffer
    gasPrice: sagaDaoGasPrice,
  });

  console.log(`SagaDAO deployed to: ${sagaDaoTx.options.address}`);
  const sagaDaoAddress = sagaDaoTx.options.address;

  // For now, we'll skip the role setup since we're using a placeholder TimelockController

  console.log("Deployment completed successfully!");
  console.log({
    sagaToken: sagaTokenAddress,
    mcpPool: mcpPoolAddress,
    timelock: timelockAddress,
    sagaDao: sagaDaoAddress,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
