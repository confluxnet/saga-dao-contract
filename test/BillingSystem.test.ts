import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { SagaToken, BillingSystem, MCPPool, SagaDAO } from "../typechain-types";
import { keccak256, toUtf8Bytes, parseEther } from "ethers";

describe("BillingSystem", function () {
  let sagaToken: SagaToken;
  let mcpPool: MCPPool;
  let sagaDAO: SagaDAO;
  let billingSystem: BillingSystem;
  let timelock: any;
  let owner: SignerWithAddress;
  let provider: SignerWithAddress;
  let user: SignerWithAddress;
  let operator: SignerWithAddress;
  let treasurer: SignerWithAddress;

  const OPERATOR_ROLE = keccak256(toUtf8Bytes("OPERATOR_ROLE"));
  const TREASURER_ROLE = keccak256(toUtf8Bytes("TREASURER_ROLE"));
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const PAYMENT_AMOUNT = ethers.parseEther("100");

  beforeEach(async () => {
    [owner, operator, provider, treasurer, user] = await ethers.getSigners();

    // Deploy SagaToken
    const SagaTokenFactory = await ethers.getContractFactory("SagaToken");
    sagaToken = (await SagaTokenFactory.deploy()) as SagaToken;
    await sagaToken.waitForDeployment();

    // Deploy MCPPool
    const MCPPoolFactory = await ethers.getContractFactory("MCPPool");
    mcpPool = (await MCPPoolFactory.deploy(await sagaToken.getAddress(), owner.address)) as MCPPool;
    await mcpPool.waitForDeployment();

    // Deploy SagaDAO
    const SagaDAOFactory = await ethers.getContractFactory("SagaDAO");
    sagaDAO = (await SagaDAOFactory.deploy(
      await sagaToken.getAddress(),
      ethers.ZeroAddress, // Using zero address for timelock in tests
      await mcpPool.getAddress()
    )) as SagaDAO;
    await sagaDAO.waitForDeployment();

    // Deploy BillingSystem
    const BillingSystemFactory = await ethers.getContractFactory("BillingSystem");
    billingSystem = (await BillingSystemFactory.deploy(
      await sagaToken.getAddress(),
      await mcpPool.getAddress(),
      await sagaDAO.getAddress()
    )) as BillingSystem;
    await billingSystem.waitForDeployment();

    // Mint tokens to owner and approve BillingSystem
    await sagaToken.mint(owner.address, ethers.parseEther("1000"));
    await sagaToken.approve(await billingSystem.getAddress(), ethers.parseEther("1000"));

    // Set up roles
    await billingSystem.grantRole(await billingSystem.OPERATOR_ROLE(), operator.address);
    await billingSystem.grantRole(await billingSystem.TREASURER_ROLE(), treasurer.address);

    // Transfer tokens to contract
    await billingSystem.transferTokensToContract(ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await billingSystem.hasRole(await billingSystem.DEFAULT_ADMIN_ROLE(), owner.address))
        .to.be.true;
    });

    it("Should assign the correct token address", async function () {
      expect(await billingSystem.sagaToken()).to.equal(await sagaToken.getAddress());
    });

    it("Should assign the correct MCP pool address", async function () {
      expect(await billingSystem.mcpPool()).to.equal(await mcpPool.getAddress());
    });

    it("Should assign the correct DAO address", async function () {
      expect(await billingSystem.dao()).to.equal(await sagaDAO.getAddress());
    });
  });

  describe("Payment Processing", function () {
    it("Should process payment correctly", async function () {
      await billingSystem
        .connect(operator)
        .processPayment(user.address, provider.address, PAYMENT_AMOUNT);

      const payment = await billingSystem.getPayment(0);
      expect(payment.payer).to.equal(user.address);
      expect(payment.provider).to.equal(provider.address);
      expect(payment.amount).to.equal(PAYMENT_AMOUNT);
      expect(payment.processed).to.be.false;
    });

    it("Should fail if non-operator tries to process payment", async function () {
      await expect(
        billingSystem.connect(user).processPayment(user.address, provider.address, PAYMENT_AMOUNT)
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await billingSystem.OPERATOR_ROLE()}`
      );
    });
  });

  describe("Revenue Distribution", function () {
    beforeEach(async function () {
      await billingSystem
        .connect(operator)
        .processPayment(user.address, provider.address, PAYMENT_AMOUNT);
    });

    it("Should distribute revenue correctly", async function () {
      await billingSystem.connect(operator).distributeRevenue(0);

      const payment = await billingSystem.getPayment(0);
      expect(payment.processed).to.be.true;

      const providerBalance = await billingSystem.getProviderBalance(provider.address);
      const daoBalance = await billingSystem.getDaoBalance();

      // 95% goes to provider (100% - 2% platform - 3% DAO)
      expect(providerBalance).to.equal((PAYMENT_AMOUNT * 95n) / 100n);
      // 3% goes to DAO
      expect(daoBalance).to.equal((PAYMENT_AMOUNT * 3n) / 100n);
    });

    it("Should fail if payment already processed", async function () {
      await billingSystem.connect(operator).distributeRevenue(0);
      await expect(billingSystem.connect(operator).distributeRevenue(0)).to.be.revertedWith(
        "Payment already processed"
      );
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      await billingSystem
        .connect(operator)
        .processPayment(user.address, provider.address, PAYMENT_AMOUNT);
      await billingSystem.connect(operator).distributeRevenue(0);
    });

    it("Should allow provider to withdraw funds", async function () {
      const initialBalance = await sagaToken.balanceOf(provider.address);
      await billingSystem.connect(provider).withdrawProviderFunds();
      const finalBalance = await sagaToken.balanceOf(provider.address);

      expect(finalBalance - initialBalance).to.equal((PAYMENT_AMOUNT * 95n) / 100n);
      expect(await billingSystem.getProviderBalance(provider.address)).to.equal(0n);
    });

    it("Should allow treasurer to withdraw DAO funds", async function () {
      const initialBalance = await sagaToken.balanceOf(await sagaDAO.getAddress());
      await billingSystem.connect(treasurer).withdrawDaoFunds();
      const finalBalance = await sagaToken.balanceOf(await sagaDAO.getAddress());

      expect(finalBalance - initialBalance).to.equal((PAYMENT_AMOUNT * 3n) / 100n);
      expect(await billingSystem.getDaoBalance()).to.equal(0n);
    });

    it("Should fail if non-treasurer tries to withdraw DAO funds", async function () {
      await expect(billingSystem.connect(user).withdrawDaoFunds()).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await billingSystem.TREASURER_ROLE()}`
      );
    });
  });
});
