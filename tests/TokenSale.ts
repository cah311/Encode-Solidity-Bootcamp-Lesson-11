import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  MyNFT,
  MyNFT__factory,
  MyToken,
  MyToken__factory,
  TokenSale,
  TokenSale__factory,
} from "../typechain-types";

const TEST_TOKEN_RATIO = 2;
const TEST_TOKEN_PRICE = ethers.utils.parseEther("0.02");
const TEST_TOKEN_MINT = ethers.utils.parseEther("1");
const TEST_TOKEN_ID = 42;

describe("NFT Shop", async () => {
  let tokenSaleContract: TokenSale;
  let tokenContract: MyToken;
  let nftContract: MyNFT;
  let deployer: SignerWithAddress;
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;

  beforeEach(async () => {
    // deployer == signer[0], account1 = signer[1], account2 = signer[2]
    [deployer, account1, account2] = await ethers.getSigners();

    const tokenContractFactory = new MyToken__factory(deployer);
    tokenContract = await tokenContractFactory.deploy();
    await tokenContract.deployTransaction.wait();

    const nftContractFactory = new MyNFT__factory(deployer);
    nftContract = await nftContractFactory.deploy();
    await nftContract.deployTransaction.wait();

    const tokenSaleContractFactory = new TokenSale__factory(deployer);
    tokenSaleContract = await tokenSaleContractFactory.deploy(
      TEST_TOKEN_RATIO,
      TEST_TOKEN_PRICE,
      tokenContract.address,
      nftContract.address
    );
    await tokenSaleContract.deployTransaction.wait();

    const minterRoleHash = await tokenContract.MINTER_ROLE();

    const giveTokenMinterRoleTx = await tokenContract.grantRole(
      minterRoleHash,
      tokenSaleContract.address
    );
    await giveTokenMinterRoleTx.wait();

    const giveNftMinterRoleTx = await nftContract.grantRole(
      minterRoleHash,
      tokenSaleContract.address
    );
    await giveNftMinterRoleTx.wait();
  });

  describe("When the Shop contract is deployed", async () => {
    it("defines the ratio as provided in parameters", async () => {
      const ratio = await tokenSaleContract.ratio();
      expect(ratio).to.eq(TEST_TOKEN_RATIO);
    });

    it("uses a valid ERC20 as payment token", async () => {
      const tokenAddress = await tokenSaleContract.tokenContract();
      const tokenContractFactory = new MyToken__factory(deployer);
      const tokenContractFromAddress =
        tokenContractFactory.attach(tokenAddress);
      expect((await tokenContractFromAddress.name()).length).to.be.gt(0);
      await expect(tokenContractFromAddress.totalSupply()).not.to.be.reverted;
      await expect(tokenContractFromAddress.decimals()).not.to.be.reverted;
      await expect(tokenContractFromAddress.balanceOf(deployer.address)).not.to
        .be.reverted;
      await expect(
        tokenContractFromAddress.transfer(account1.address, 10)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("When a user buys an ERC20 from the Token contract", async () => {
    let tokenBalanceBeforeMint: BigNumber;
    let ethBalanceBeforeMint: BigNumber;
    let mintTxGasCost: BigNumber;
    beforeEach(async () => {
      tokenBalanceBeforeMint = await tokenContract.balanceOf(account1.address);
      ethBalanceBeforeMint = await account1.getBalance();
      const mintTx = await tokenSaleContract.connect(account1).buyTokens({
        value: TEST_TOKEN_MINT,
      });
      const mintTxReceipt = await mintTx.wait();
      mintTxGasCost = mintTxReceipt.gasUsed.mul(
        mintTxReceipt.effectiveGasPrice
      );
    });

    it("charges the correct amount of ETH", async () => {
      const ethBalanceAfterMint = await account1.getBalance();
      const diff = ethBalanceAfterMint.sub(ethBalanceAfterMint);
      const cost = TEST_TOKEN_MINT.add(mintTxGasCost);
      const error = diff.sub(cost);
      expect(diff).to.eq(0);
    });

    it("gives the correct amount of tokens", async () => {
      const tokenBalanceAfterMint = await tokenContract.balanceOf(
        account1.address
      );
      expect(tokenBalanceAfterMint.sub(tokenBalanceBeforeMint)).to.eq(
        TEST_TOKEN_MINT.mul(TEST_TOKEN_RATIO)
      );
    });

    describe("When a user burns an ERC20 at the Shop contract", async () => {
      let burnAmount: BigNumber;
      let tokenBalanceBeforeBurn: BigNumber;
      let ethBalanceBeforeBurn: BigNumber;
      let approveTxCost: BigNumber;
      let burnTxCost: BigNumber;

      beforeEach(async () => {
        ethBalanceBeforeBurn = await account1.getBalance();
        tokenBalanceBeforeBurn = await tokenContract.balanceOf(
          account1.address
        );
        burnAmount = tokenBalanceBeforeBurn.div(2);
        const approveTx = await tokenContract
          .connect(account1)
          .approve(tokenSaleContract.address, burnAmount);
        const approveTxReciept = await approveTx.wait();
        approveTxCost = approveTxReciept.gasUsed.mul(
          approveTxReciept.effectiveGasPrice
        );
        const burnTx = await tokenSaleContract
          .connect(account1)
          .burnTokens(burnAmount);
        const burnTxReciept = await burnTx.wait();
        burnTxCost = burnTxReciept.gasUsed.mul(burnTxReciept.effectiveGasPrice);
      });
      it("gives the correct amount of ETH", async () => {
        const etheBalanceAfterBurn = await account1.getBalance();
        const diff = etheBalanceAfterBurn.sub(ethBalanceBeforeBurn);
        const cost = approveTxCost.add(burnTxCost);
        const error = diff.sub(burnAmount.div(TEST_TOKEN_RATIO).sub(cost));
        expect(error).to.eq(0);
      });

      it("burns the correct amount of tokens", async () => {
        const tokenBalanceAfterBurn = await tokenContract.balanceOf(
          account1.address
        );
        const diff = tokenBalanceBeforeBurn.sub(tokenBalanceAfterBurn);
        expect(diff).to.eq(burnAmount);
      });
    });

    describe("When a user buys an NFT from the Shop contract", async () => {
      let tokenBalanceBeforeBuy: BigNumber;
      beforeEach(async () => {
        tokenBalanceBeforeBuy = await tokenContract.balanceOf(account1.address);
        const allowTx = await tokenContract
          .connect(account1)
          .approve(tokenSaleContract.address, TEST_TOKEN_PRICE);
        await allowTx.wait();
        const buyTx = await tokenSaleContract
          .connect(account1)
          .buyNFT(TEST_TOKEN_ID);
        await buyTx.wait();
      });

      it("charges the correct amount of ERC20 tokens", async () => {
        const tokenBalanceAfterBuy = await tokenContract.balanceOf(
          account1.address
        );
        const diff = tokenBalanceBeforeBuy.sub(tokenBalanceAfterBuy);
        expect(diff).to.eq(TEST_TOKEN_PRICE);
      });

      it("gives the correct NFT", async () => {
        const nftOwner = await nftContract.ownerOf(TEST_TOKEN_ID);
        expect(nftOwner).to.eq(account1.address);
      });

      it("updates the owner pool account correctly", async () => {
        const withdrawableAmount = await tokenSaleContract.withdrawableAmount();
        expect(withdrawableAmount).to.eq(TEST_TOKEN_PRICE.div(2));
      });
    });
  });

  //   describe("When a user burns their NFT at the Shop contract", async () => {
  //     it("gives the correct amount of ERC20 tokens", async () => {
  //       throw new Error("Not implemented");
  //     });
  //     it("updates the public pool correctly", async () => {
  //       throw new Error("Not implemented");
  //     });
  //   });

  //   describe("When the owner withdraw from the Shop contract", async () => {
  //     it("recovers the right amount of ERC20 tokens", async () => {
  //       throw new Error("Not implemented");
  //     });

  //     it("updates the owner pool account correctly", async () => {
  //       throw new Error("Not implemented");
  //     });
  //   });
});
