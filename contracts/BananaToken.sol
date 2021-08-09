// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract BananaToken is ERC20, Ownable{
    // to manage claiming, only 1 time a msg.sender can claim tokens
    mapping(address => bool) hasClaimTokens;

    constructor() ERC20("BananaToken", "BANANA"){

    }

    // claim tokens by minting to msg.sender, limited to 1000 tokens, one time use
    function claimToken() public{
        require(hasClaimTokens[msg.sender] == false, "msg.sender already claimed tokens");
        // claim limit
        uint256 _claimAmount = 1000;
        uint256 _oldTotalSupply = totalSupply();
        // update mapping
        hasClaimTokens[msg.sender] = true;
        // mint tokens, sender, amount
        _mint(msg.sender, _claimAmount);
        // to validate that totalSupply is updated properly
        assert(totalSupply() == _oldTotalSupply + _claimAmount);
    }
}