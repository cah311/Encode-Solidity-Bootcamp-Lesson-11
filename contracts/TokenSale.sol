// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMyToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

interface IMyNFT {
    function safeMint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

contract TokenSale is Ownable{
    uint256 public ratio;
    uint256 public price;
    uint256 public withdrawableAmount;
    IMyToken public tokenContract;
    IMyNFT public nftContract;

    constructor(uint256 _ratio, uint256 _price, address _tokenContractAddress, address _nftContractAddress) {
        ratio = _ratio;
        price = _price;
        tokenContract = IMyToken(_tokenContractAddress);
        nftContract = IMyNFT(_nftContractAddress);
    }

    function buyTokens() external payable {
        tokenContract.mint(msg.sender, msg.value * ratio);
        
    }

    function burnTokens(uint256 amount) external {
        tokenContract.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount / ratio);
    }

    function buyNFT(uint256 tokenId) external {
        tokenContract.transferFrom(msg.sender, address(this), price);
        nftContract.safeMint(msg.sender, tokenId);
        withdrawableAmount += price / 2;
    }

    function burnNft(uint256 tokenId) external {
        // Burn the senders NFT
        tokenContract.transfer(msg.sender, price - (price / 2));
    }

    function withdraw(uint256 amount) external onlyOwner{
        withdrawableAmount -= amount;
        // send the tokens to the owner
    }
 }