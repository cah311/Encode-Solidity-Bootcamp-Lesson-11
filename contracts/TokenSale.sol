// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./MyERC20.sol";

interface IMyToken {
    function mint(address to, uint256 amount) external;
}

contract TokenSale {
    uint256 public ratio;
    IMyToken public tokenContract;

    constructor(uint256 _ratio, address _tokenContractAddress) {
        ratio = _ratio;
        tokenContract = IMyToken(_tokenContractAddress);
    }

    function buyTokens() external payable {
        tokenContract.mint(msg.sender, msg.value * ratio);
        
    }
}