const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("Deploying contracts to SAGA chain...");

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

  const billingSystemArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/BillingSystem.sol/BillingSystem.json"),
      "utf8"
    )
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
    gas: Math.floor(Number(sagaTokenGas) * 1.2),
    gasPrice: sagaTokenGasPrice,
  });

  console.log(`SagaToken deployed to: ${sagaTokenTx.options.address}`);
  const sagaTokenAddress = sagaTokenTx.options.address;

  // Deploy MCPPool
  console.log("Deploying MCPPool...");
  const mcpPool = new web3.eth.Contract(mcpPoolArtifact.abi);
  const mcpPoolDeploy = mcpPool.deploy({
    data: mcpPoolArtifact.bytecode,
    arguments: [sagaTokenAddress, account.address],
  });

  const mcpPoolGas = await mcpPoolDeploy.estimateGas({ from: account.address });
  const mcpPoolGasPrice = await web3.eth.getGasPrice();
  const mcpPoolTx = await mcpPoolDeploy.send({
    from: account.address,
    gas: Math.floor(Number(mcpPoolGas) * 1.2),
    gasPrice: mcpPoolGasPrice,
  });

  console.log(`MCPPool deployed to: ${mcpPoolTx.options.address}`);
  const mcpPoolAddress = mcpPoolTx.options.address;

  // Deploy TimelockController
  console.log("Deploying TimelockController...");
  const minDelay = 86400; // 1 day in seconds
  const proposers = [account.address]; // Initially, deployer is the proposer
  const executors = ["0x0000000000000000000000000000000000000000"]; // Everyone can execute
  const admin = account.address;

  const timelockArtifact = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "../artifacts/@openzeppelin/contracts/governance/TimelockController.sol/TimelockController.json"
      ),
      "utf8"
    )
  );

  const timelockContract = new web3.eth.Contract(timelockArtifact.abi);
  const timelockDeploy = timelockContract.deploy({
    data: timelockArtifact.bytecode,
    arguments: [minDelay, proposers, executors, admin],
  });

  const timelockGas = await timelockDeploy.estimateGas({ from: account.address });
  const timelockGasPrice = await web3.eth.getGasPrice();
  const timelockTx = await timelockDeploy.send({
    from: account.address,
    gas: Math.floor(Number(timelockGas) * 1.2),
    gasPrice: timelockGasPrice,
  });

  console.log(`TimelockController deployed to: ${timelockTx.options.address}`);
  const timelockAddress = timelockTx.options.address;

  // Deploy SagaDAO
  console.log("Deploying SagaDAO...");
  const sagaDaoContract = new web3.eth.Contract(sagaDaoArtifact.abi);
  const sagaDaoDeploy = sagaDaoContract.deploy({
    data: sagaDaoArtifact.bytecode,
    arguments: [sagaTokenAddress, timelockAddress, mcpPoolAddress],
  });

  const sagaDaoGas = await sagaDaoDeploy.estimateGas({ from: account.address });
  const sagaDaoGasPrice = await web3.eth.getGasPrice();
  const sagaDaoTx = await sagaDaoDeploy.send({
    from: account.address,
    gas: Math.floor(Number(sagaDaoGas) * 1.2),
    gasPrice: sagaDaoGasPrice,
  });

  console.log(`SagaDAO deployed to: ${sagaDaoTx.options.address}`);
  const sagaDaoAddress = sagaDaoTx.options.address;

  // Deploy BillingSystem
  console.log("Deploying BillingSystem...");
  const billingSystemContract = new web3.eth.Contract(billingSystemArtifact.abi);
  const billingSystemDeploy = billingSystemContract.deploy({
    data: billingSystemArtifact.bytecode,
    arguments: [sagaTokenAddress, mcpPoolAddress, sagaDaoAddress],
  });

  const billingSystemGas = await billingSystemDeploy.estimateGas({ from: account.address });
  const billingSystemGasPrice = await web3.eth.getGasPrice();
  const billingSystemTx = await billingSystemDeploy.send({
    from: account.address,
    gas: Math.floor(Number(billingSystemGas) * 1.2),
    gasPrice: billingSystemGasPrice,
  });

  console.log(`BillingSystem deployed to: ${billingSystemTx.options.address}`);
  const billingSystemAddress = billingSystemTx.options.address;

  // Grant ADMIN_ROLE to SagaDAO
  console.log("Granting ADMIN_ROLE to SagaDAO...");
  const ADMIN_ROLE = web3.utils.keccak256("ADMIN_ROLE");
  const mcpPoolContract = new web3.eth.Contract(mcpPoolArtifact.abi, mcpPoolAddress);
  await mcpPoolContract.methods.grantRole(ADMIN_ROLE, sagaDaoAddress).send({
    from: account.address,
    gas: 200000,
    gasPrice: await web3.eth.getGasPrice(),
  });

  console.log("Deployment completed successfully!");
  console.log({
    sagaToken: sagaTokenAddress,
    mcpPool: mcpPoolAddress,
    timelock: timelockAddress,
    sagaDao: sagaDaoAddress,
    billingSystem: billingSystemAddress,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
