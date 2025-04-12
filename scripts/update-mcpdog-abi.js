const fs = require("fs");
const path = require("path");

// Paths
const SAGA_CONTRACTS_ARTIFACTS = path.join(__dirname, "../artifacts/contracts");
const MCPDOG_CONTRACTS = "/Users/I749306/Desktop/personal/hackathon/mcpdog/src/contracts";

// Contract names to copy
const CONTRACTS = ["SagaToken", "BillingSystem", "MCPPool", "SagaDAO"];

// Ensure the target directory exists
if (!fs.existsSync(MCPDOG_CONTRACTS)) {
  console.error(`Target directory ${MCPDOG_CONTRACTS} does not exist!`);
  process.exit(1);
}

// Copy each contract's ABI
CONTRACTS.forEach((contractName) => {
  const sourcePath = path.join(
    SAGA_CONTRACTS_ARTIFACTS,
    `${contractName}.sol`,
    `${contractName}.json`
  );
  const targetPath = path.join(MCPDOG_CONTRACTS, `${contractName}.json`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file ${sourcePath} does not exist!`);
    return;
  }

  try {
    // Read the source file
    const sourceContent = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

    // Extract only the ABI
    const abi = sourceContent.abi;

    // Write the ABI to the target file
    fs.writeFileSync(targetPath, JSON.stringify(abi, null, 2));

    console.log(`Successfully copied ABI for ${contractName} to ${targetPath}`);
  } catch (error) {
    console.error(`Error processing ${contractName}:`, error);
  }
});

console.log("ABI update completed!");
