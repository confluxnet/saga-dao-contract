import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Deploying contracts with ethers.js directly...");

  // Connect to the SAGA network
  const provider = new ethers.JsonRpcProvider(process.env.SAGA_RPC_URL);

  // Create a wallet from the private key
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
  console.log(`Deploying with account: ${wallet.address}`);

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

  const timelockArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/TimelockController.sol/TimelockController.json"),
      "utf8"
    )
  );

  const sagaDaoArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/SagaDAO.sol/SagaDAO.json"), "utf8")
  );

  // Deploy SagaToken
  console.log("Deploying SagaToken...");
  const sagaTokenFactory = new ethers.ContractFactory(
    sagaTokenArtifact.abi,
    sagaTokenArtifact.bytecode,
    wallet
  );
  const sagaToken = await sagaTokenFactory.deploy();
  await sagaToken.waitForDeployment();
  const sagaTokenAddress = await sagaToken.getAddress();
  console.log(`SagaToken deployed to: ${sagaTokenAddress}`);

  // Deploy MCPPool
  console.log("Deploying MCPPool...");
  const mcpPoolFactory = new ethers.ContractFactory(
    mcpPoolArtifact.abi,
    mcpPoolArtifact.bytecode,
    wallet
  );
  const mcpPool = await mcpPoolFactory.deploy();
  await mcpPool.waitForDeployment();
  const mcpPoolAddress = await mcpPool.getAddress();
  console.log(`MCPPool deployed to: ${mcpPoolAddress}`);

  // Deploy TimelockController
  console.log("Deploying TimelockController...");
  const timelockFactory = new ethers.ContractFactory(
    timelockArtifact.abi,
    timelockArtifact.bytecode,
    wallet
  );

  // Calculate timelock parameters
  const minDelay = 86400; // 1 day in seconds
  const proposers: string[] = []; // Will be set after SagaDAO deployment
  const executors: string[] = [ethers.ZeroAddress]; // Everyone can execute
  const admin = wallet.address; // Deployer is admin initially

  const timelock = await timelockFactory.deploy(minDelay, proposers, executors, admin);
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log(`TimelockController deployed to: ${timelockAddress}`);

  // Deploy SagaDAO
  console.log("Deploying SagaDAO...");
  const sagaDaoFactory = new ethers.ContractFactory(
    sagaDaoArtifact.abi,
    sagaDaoArtifact.bytecode,
    wallet
  );

  // Calculate DAO parameters
  const votingDelay = 0; // No delay before voting starts
  const votingPeriod = 86400; // 1 day voting period
  const quorumNumerator = 4; // 4% quorum
  const proposalThreshold = 1; // 1 token needed to propose

  const sagaDao = await sagaDaoFactory.deploy(
    sagaTokenAddress,
    timelockAddress,
    votingDelay,
    votingPeriod,
    quorumNumerator,
    proposalThreshold
  );
  await sagaDao.waitForDeployment();
  const sagaDaoAddress = await sagaDao.getAddress();
  console.log(`SagaDAO deployed to: ${sagaDaoAddress}`);

  // Set up roles
  console.log("Setting up roles...");

  // Grant PROPOSER_ROLE to SagaDAO
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

  const grantProposerTx = await timelock.grantRole(PROPOSER_ROLE, sagaDaoAddress);
  await grantProposerTx.wait();
  console.log("Granted PROPOSER_ROLE to SagaDAO");

  // Revoke TIMELOCK_ADMIN_ROLE from deployer
  const revokeAdminTx = await timelock.revokeRole(TIMELOCK_ADMIN_ROLE, wallet.address);
  await revokeAdminTx.wait();
  console.log("Revoked TIMELOCK_ADMIN_ROLE from deployer");

  // Transfer MCPPool ownership to SagaDAO
  const transferOwnershipTx = await mcpPool.transferOwnership(sagaDaoAddress);
  await transferOwnershipTx.wait();
  console.log("Transferred MCPPool ownership to SagaDAO");

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
