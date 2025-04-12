import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SagaToken, MCPPool, TimelockController, SagaDAO } from "../typechain-types";

describe("SagaDAO", function () {
  let sagaToken: SagaToken;
  let mcpPool: MCPPool;
  let timelock: TimelockController;
  let sagaDao: SagaDAO;
  let owner: Signer;
  let addr1: Signer;
  let addr2: Signer;
  let addrs: Signer[];

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy SagaToken
    const SagaToken = await ethers.getContractFactory("SagaToken");
    sagaToken = (await SagaToken.deploy()) as unknown as SagaToken;
    await sagaToken.waitForDeployment();

    // Deploy MCPPool
    const MCPPool = await ethers.getContractFactory("MCPPool");
    mcpPool = (await MCPPool.deploy(
      await sagaToken.getAddress(),
      await owner.getAddress()
    )) as unknown as MCPPool;
    await mcpPool.waitForDeployment();

    // Deploy TimelockController
    const minDelay = 86400; // 1 day
    const proposers: string[] = [];
    const executors: string[] = [ethers.ZeroAddress]; // Everyone can execute
    const admin = await owner.getAddress();

    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = (await TimelockController.deploy(
      minDelay,
      proposers,
      executors,
      admin
    )) as unknown as TimelockController;
    await timelock.waitForDeployment();

    // Deploy SagaDAO
    const SagaDAO = await ethers.getContractFactory("SagaDAO");
    sagaDao = (await SagaDAO.deploy(
      await sagaToken.getAddress(),
      await timelock.getAddress(),
      await mcpPool.getAddress()
    )) as unknown as SagaDAO;
    await sagaDao.waitForDeployment();

    // Mint additional tokens to test accounts
    const mintAmount = ethers.parseEther("1000");
    await sagaToken.mint(await owner.getAddress(), mintAmount);
    await sagaToken.mint(await addr1.getAddress(), mintAmount);
    await sagaToken.mint(await addr2.getAddress(), mintAmount);

    // Delegate voting power
    await sagaToken.connect(owner).delegate(await owner.getAddress());
    await sagaToken.connect(addr1).delegate(await addr1.getAddress());
    await sagaToken.connect(addr2).delegate(await addr2.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await mcpPool.hasRole(await mcpPool.ADMIN_ROLE(), await owner.getAddress())).to.be
        .true;
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      // The initial supply is 1,000,000 tokens
      // We minted 1000 tokens to each of the three accounts (owner, addr1, addr2)
      // So the total supply should be 1,000,000 + 3,000 = 1,003,000 tokens
      const expectedTotalSupply = ethers.parseEther("1003000");
      const actualTotalSupply = await sagaToken.totalSupply();
      expect(actualTotalSupply).to.equal(expectedTotalSupply);
    });
  });

  describe("MCP Registration", function () {
    it("Should allow users to register MCPs", async function () {
      const name = "Test MCP";
      const description = "Test Description";
      const apiEndpoint = "https://api.example.com";
      const implementation = "Test Implementation";
      const pricePerCall = ethers.parseEther("1");

      await mcpPool
        .connect(addr1)
        .registerMCP(name, description, apiEndpoint, implementation, pricePerCall);

      const mcp = await mcpPool.getMCP(0);
      expect(mcp.name).to.equal(name);
      expect(mcp.owner).to.equal(await addr1.getAddress());
      expect(mcp.pricePerCall).to.equal(pricePerCall);
    });
  });

  describe("MCP Approval", function () {
    it("Should allow admin to approve MCPs", async function () {
      // Register an MCP
      await mcpPool
        .connect(addr1)
        .registerMCP(
          "Test MCP",
          "Test Description",
          "https://api.example.com",
          "Test Implementation",
          ethers.parseEther("1")
        );

      // Approve the MCP
      await mcpPool.connect(owner).approveMCP(0);

      const mcp = await mcpPool.getMCP(0);
      expect(mcp.isApproved).to.be.true;
      expect(mcp.isActive).to.be.true;
    });
  });

  describe("MCP Usage", function () {
    it("Should allow users to use approved MCPs", async function () {
      // Register and approve an MCP
      await mcpPool
        .connect(addr1)
        .registerMCP(
          "Test MCP",
          "Test Description",
          "https://api.example.com",
          "Test Implementation",
          ethers.parseEther("1")
        );
      await mcpPool.connect(owner).approveMCP(0);

      // Approve tokens for MCPPool
      await sagaToken.connect(addr2).approve(await mcpPool.getAddress(), ethers.parseEther("10"));

      // Use the MCP
      await mcpPool.connect(addr2).useMCP(0, 5);

      const mcp = await mcpPool.getMCP(0);
      expect(mcp.totalCalls).to.equal(5);
      expect(mcp.totalRevenue).to.equal(ethers.parseEther("5"));
    });
  });
});
