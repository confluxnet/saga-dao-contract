import { ethers } from "hardhat";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy SagaToken
  const SagaToken = await ethers.getContractFactory("SagaToken");
  const sagaToken = await SagaToken.deploy();
  await sagaToken.waitForDeployment();
  console.log("SagaToken deployed to:", await sagaToken.getAddress());

  // Deploy MCPPool
  const MCPPool = await ethers.getContractFactory("MCPPool");
  const mcpPool = await MCPPool.deploy(await sagaToken.getAddress(), deployer.address);
  await mcpPool.waitForDeployment();
  console.log("MCPPool deployed to:", await mcpPool.getAddress());

  // Deploy TimelockController
  const minDelay = 0; // For testing, in production this should be a reasonable delay
  const proposers: string[] = [];
  const executors: string[] = [];
  const TimelockController = await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(
    minDelay,
    proposers,
    executors,
    deployer.address
  );
  await timelock.waitForDeployment();
  console.log("TimelockController deployed to:", await timelock.getAddress());

  // Deploy SagaDAO
  const SagaDAO = await ethers.getContractFactory("SagaDAO");
  const sagaDAO = await SagaDAO.deploy(
    await sagaToken.getAddress(),
    await timelock.getAddress(),
    await mcpPool.getAddress()
  );
  await sagaDAO.waitForDeployment();
  console.log("SagaDAO deployed to:", await sagaDAO.getAddress());

  // Deploy BillingSystem
  const BillingSystem = await ethers.getContractFactory("BillingSystem");
  const billingSystem = await BillingSystem.deploy(
    await sagaToken.getAddress(),
    await mcpPool.getAddress(),
    await sagaDAO.getAddress()
  );
  await billingSystem.waitForDeployment();
  console.log("BillingSystem deployed to:", await billingSystem.getAddress());

  // Setup roles
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();

  // Grant proposer role to the DAO
  await timelock.grantRole(PROPOSER_ROLE, await sagaDAO.getAddress());
  console.log("Granted PROPOSER_ROLE to SagaDAO");

  // Grant executor role to everyone (0x00 address)
  await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress);
  console.log("Granted EXECUTOR_ROLE to everyone");

  // Revoke admin role from deployer
  const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
  await timelock.revokeRole(TIMELOCK_ADMIN_ROLE, deployer.address);
  console.log("Revoked TIMELOCK_ADMIN_ROLE from deployer");

  // Transfer ownership of MCPPool to the DAO
  await mcpPool.grantRole(await mcpPool.DEFAULT_ADMIN_ROLE(), await sagaDAO.getAddress());
  console.log("Transferred MCPPool admin role to SagaDAO");

  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
