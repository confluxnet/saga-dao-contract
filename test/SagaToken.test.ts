import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SagaToken } from "../typechain-types";

describe("SagaToken", function () {
  let sagaToken: SagaToken;
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
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await sagaToken.name()).to.equal("SAGA Token");
      expect(await sagaToken.symbol()).to.equal("SAGA");
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await sagaToken.balanceOf(await owner.getAddress());
      expect(await sagaToken.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Mint additional tokens to owner
      const mintAmount = ethers.parseEther("1000");
      await sagaToken.mint(await owner.getAddress(), mintAmount);

      // Transfer 50 tokens from owner to addr1
      await sagaToken.transfer(await addr1.getAddress(), ethers.parseEther("50"));
      const addr1Balance = await sagaToken.balanceOf(await addr1.getAddress());
      expect(addr1Balance).to.equal(ethers.parseEther("50"));

      // Transfer 50 tokens from addr1 to addr2
      await sagaToken.connect(addr1).transfer(await addr2.getAddress(), ethers.parseEther("50"));
      const addr2Balance = await sagaToken.balanceOf(await addr2.getAddress());
      expect(addr2Balance).to.equal(ethers.parseEther("50"));
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      // Mint additional tokens to owner
      const mintAmount = ethers.parseEther("1000");
      await sagaToken.mint(await owner.getAddress(), mintAmount);

      // Transfer 50 tokens from owner to addr1
      await sagaToken.transfer(await addr1.getAddress(), ethers.parseEther("50"));

      // Try to transfer 100 tokens from addr1 to addr2 (should fail)
      await expect(
        sagaToken.connect(addr1).transfer(await addr2.getAddress(), ethers.parseEther("100"))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Voting", function () {
    it("Should delegate voting power", async function () {
      // Mint additional tokens to owner and addr1
      const mintAmount = ethers.parseEther("1000");
      await sagaToken.mint(await owner.getAddress(), mintAmount);
      await sagaToken.mint(await addr1.getAddress(), mintAmount);

      // Delegate voting power
      await sagaToken.delegate(await owner.getAddress());
      await sagaToken.connect(addr1).delegate(await addr1.getAddress());

      // Check voting power
      const ownerVotes = await sagaToken.getVotes(await owner.getAddress());
      const addr1Votes = await sagaToken.getVotes(await addr1.getAddress());
      expect(ownerVotes).to.equal(ethers.parseEther("1001000")); // Initial supply + minted amount
      expect(addr1Votes).to.equal(mintAmount);
    });

    it("Should update voting power after transfer", async function () {
      // Mint additional tokens to owner
      const mintAmount = ethers.parseEther("1000");
      await sagaToken.mint(await owner.getAddress(), mintAmount);

      // Delegate voting power
      await sagaToken.delegate(await owner.getAddress());

      // Transfer 500 tokens from owner to addr1
      await sagaToken.transfer(await addr1.getAddress(), ethers.parseEther("500"));

      // Delegate voting power for addr1
      await sagaToken.connect(addr1).delegate(await addr1.getAddress());

      // Check voting power
      const ownerVotes = await sagaToken.getVotes(await owner.getAddress());
      const addr1Votes = await sagaToken.getVotes(await addr1.getAddress());
      expect(ownerVotes).to.equal(ethers.parseEther("1000500")); // Initial supply + remaining minted amount
      expect(addr1Votes).to.equal(ethers.parseEther("500"));
    });
  });
});
