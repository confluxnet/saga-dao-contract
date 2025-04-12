import { ethers } from "hardhat";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up DAO governance with the account:", deployer.address);

  // Get contract addresses from deployment
  const sagaTokenAddress = process.env.SAGA_TOKEN_ADDRESS;
  const mcpPoolAddress = process.env.MCP_POOL_ADDRESS;
  const timelockAddress = process.env.TIMELOCK_ADDRESS;
  const sagaDaoAddress = process.env.SAGA_DAO_ADDRESS;

  if (!sagaTokenAddress || !mcpPoolAddress || !timelockAddress || !sagaDaoAddress) {
    throw new Error("Contract addresses not found in environment variables");
  }

  // Get contract instances
  const sagaToken = await ethers.getContractAt("SagaToken", sagaTokenAddress);
  const mcpPool = await ethers.getContractAt("MCPPool", mcpPoolAddress);
  const timelock = await ethers.getContractAt("TimelockController", timelockAddress);
  const sagaDao = await ethers.getContractAt("SagaDAO", sagaDaoAddress);

  console.log("Connected to contracts:");
  console.log("SagaToken:", await sagaToken.getAddress());
  console.log("MCPPool:", await mcpPool.getAddress());
  console.log("TimelockController:", await timelock.getAddress());
  console.log("SagaDAO:", await sagaDao.getAddress());

  // Setup roles for MCPPool
  const REVIEWER_ROLE = await mcpPool.REVIEWER_ROLE();
  const ADMIN_ROLE = await mcpPool.ADMIN_ROLE();

  // Grant REVIEWER_ROLE to the DAO
  await mcpPool.grantRole(REVIEWER_ROLE, await sagaDao.getAddress());
  console.log("Granted REVIEWER_ROLE to SagaDAO");

  // Create a proposal to approve an MCP (example)
  // This would be done by a DAO member in practice
  const proposalDescription = "Approve MCP #0 for the marketplace";
  const targets = [await mcpPool.getAddress()];
  const values = [0];
  const calldatas = [mcpPool.interface.encodeFunctionData("approveMCP", [0])];

  // Submit proposal to the DAO
  const tx = await sagaDao.propose(targets, values, calldatas, proposalDescription);
  const receipt = await tx.wait();

  // Get the proposal ID from the event
  const proposalId = receipt.logs.find(
    (log) => log.fragment && log.fragment.name === "ProposalCreated"
  )?.args[0];

  console.log(`Proposal created with ID: ${proposalId}`);

  // In a real scenario, token holders would vote on the proposal
  // For testing, we can simulate voting
  const voteTx = await sagaDao.castVote(proposalId, 1); // 1 = For
  await voteTx.wait();
  console.log("Voted FOR on the proposal");

  // Wait for the voting period to end (in production)
  // For testing, we can execute immediately
  const executeTx = await sagaDao.execute(
    targets,
    values,
    calldatas,
    ethers.keccak256(ethers.toUtf8Bytes(proposalDescription))
  );
  await executeTx.wait();
  console.log("Proposal executed");

  console.log("DAO governance setup completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
