import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("BillingSystem", function () {
  let sagaToken: Contract;
  let mcpPool: Contract;
  let dao: Contract;
  let billingSystem: Contract;
  let owner: SignerWithAddress;
  let provider: SignerWithAddress;
  let user: SignerWithAddress;
  let operator: SignerWithAddress;
  let treasurer: SignerWithAddress;

  const OPERATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OPERATOR_ROLE"));
  const TREASURER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TREASURER_ROLE"));
  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const PAYMENT_AMOUNT = ethers.utils.parseEther("100");

  beforeEach(async function () {
    [owner, provider, user, operator, treasurer] = await ethers.getSigners();

    // Deploy SagaToken
    const SagaToken = await ethers.getContractFactory("SagaToken");
    sagaToken = await SagaToken.deploy();
    await sagaToken.deployed();

    // Deploy MCPPool (mock)
    const MCPPool = await ethers.getContractFactory("MCPPool");
    mcpPool = await MCPPool.deploy(sagaToken.address);
    await mcpPool.deployed();

    // Deploy DAO (mock)
    const Dao = await ethers.getContractFactory("SagaDAO");
    dao = await Dao.deploy(sagaToken.address, mcpPool.address);
    await dao.deployed();

    // Deploy BillingSystem
    const BillingSystem = await ethers.getContractFactory("BillingSystem");
    billingSystem = await BillingSystem.deploy(sagaToken.address, mcpPool.address, dao.address);
    await billingSystem.deployed();

    // Setup roles
    await billingSystem.grantRole(OPERATOR_ROLE, operator.address);
    await billingSystem.grantRole(TREASURER_ROLE, treasurer.address);

    // Transfer tokens to user
    await sagaToken.transfer(user.address, INITIAL_SUPPLY);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await billingSystem.hasRole(await billingSystem.DEFAULT_ADMIN_ROLE(), owner.address))
        .to.be.true;
    });

    it("Should assign the correct token address", async function () {
      expect(await billingSystem.sagaToken()).to.equal(sagaToken.address);
    });

    it("Should assign the correct MCP pool address", async function () {
      expect(await billingSystem.mcpPool()).to.equal(mcpPool.address);
    });

    it("Should assign the correct DAO address", async function () {
      expect(await billingSystem.dao()).to.equal(dao.address);
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
      ).to.be.revertedWith("AccessControl:");
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
      expect(providerBalance).to.equal(PAYMENT_AMOUNT.mul(95).div(100));
      // 3% goes to DAO
      expect(daoBalance).to.equal(PAYMENT_AMOUNT.mul(3).div(100));
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

      expect(finalBalance.sub(initialBalance)).to.equal(PAYMENT_AMOUNT.mul(95).div(100));
      expect(await billingSystem.getProviderBalance(provider.address)).to.equal(0);
    });

    it("Should allow treasurer to withdraw DAO funds", async function () {
      const initialBalance = await sagaToken.balanceOf(dao.address);
      await billingSystem.connect(treasurer).withdrawDaoFunds();
      const finalBalance = await sagaToken.balanceOf(dao.address);

      expect(finalBalance.sub(initialBalance)).to.equal(PAYMENT_AMOUNT.mul(3).div(100));
      expect(await billingSystem.getDaoBalance()).to.equal(0);
    });

    it("Should fail if non-treasurer tries to withdraw DAO funds", async function () {
      await expect(billingSystem.connect(provider).withdrawDaoFunds()).to.be.revertedWith(
        "AccessControl:"
      );
    });
  });
});
