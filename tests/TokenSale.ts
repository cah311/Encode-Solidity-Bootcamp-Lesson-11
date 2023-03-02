import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  MyToken,
  MyToken__factory,
  TokenSale,
  TokenSale__factory,
} from "../typechain-types";

const TEST_TOKEN_RATIO = 1;
const TEST_TOKEN_MINT = ethers.utils.parseEther("1");

describe("NFT Shop", async () => {
  let tokenSaleContract: TokenSale;
  let tokenContract: MyToken;
  let deployer: SignerWithAddress;
  let account1: SignerWithAddress;
  let account2: SignerWithAddress;

  beforeEach(async () => {
    // deployer == signer[0], account1 = signer[1], account2 = signer[2]
    [deployer, account1, account2] = await ethers.getSigners();

    const tokenContractFactory = new MyToken__factory(deployer);
    tokenContract = await tokenContractFactory.deploy();
    await tokenContract.deployTransaction.wait();

    const tokenSaleContractFactory = new TokenSale__factory(deployer);
    tokenSaleContract = await tokenSaleContractFactory.deploy(
      TEST_TOKEN_RATIO,
      tokenContract.address
    );
    await tokenSaleContract.deployTransaction.wait();

    const giveMinterRoleTx = await tokenContract.grantRole(
      "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
      tokenSaleContract.address
    );
    await giveMinterRoleTx.wait();
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
    beforeEach(async () => {
      tokenBalanceBeforeMint = await tokenContract.balanceOf(account1.address);
      ethBalanceBeforeMint = await account1.getBalance();
      const mintTx = await tokenSaleContract.connect(account1).buyTokens({
        value: TEST_TOKEN_MINT,
      });
      await mintTx.wait();
    });

    it("charges the correct amount of ETH", async () => {
      const ethBalanceAfterMint = await account1.getBalance();
      expect(ethBalanceAfterMint.sub(tokenBalanceBeforeMint)).to.eq(
        TEST_TOKEN_MINT.mul(TEST_TOKEN_RATIO)
      );
    });

    it("gives the correct amount of tokens", async () => {
      const tokenBalanceAfterMint = await tokenContract.balanceOf(
        account1.address
      );
      expect(tokenBalanceAfterMint.sub(tokenBalanceBeforeMint)).to.eq(
        TEST_TOKEN_MINT.mul(TEST_TOKEN_RATIO)
      );
    });
  });

  //   describe("When a user burns an ERC20 at the Shop contract", async () => {
  //     it("gives the correct amount of ETH", async () => {
  //       throw new Error("Not implemented");
  //     });

  //     it("burns the correct amount of tokens", async () => {
  //       throw new Error("Not implemented");
  //     });
  //   });

  //   describe("When a user buys an NFT from the Shop contract", async () => {
  //     it("charges the correct amount of ERC20 tokens", async () => {
  //       throw new Error("Not implemented");
  //     });

  //     it("gives the correct NFT", async () => {
  //       throw new Error("Not implemented");
  //     });

  //     it("updates the owner pool account correctly", async () => {
  //       throw new Error("Not implemented");
  //     });
  //   });

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
