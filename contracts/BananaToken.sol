// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract BananaToken is ERC20, Ownable{
    // to manage claiming, only 1 time a _msgSender() can claim tokens
    mapping(address => bool) hasClaimedTokens;

    constructor() ERC20("BananaToken", "BANANA"){

    }

    // claim tokens by minting to _msgSender(), limited to 1000 tokens, one time use
    function claimToken() public{
        require(hasClaimedTokens[_msgSender()] == false, "_msgSender() already claimed tokens");
        // claim limit
        uint256 _claimAmount = 1000;
        uint256 _oldTotalSupply = totalSupply();
        // update mapping
        hasClaimedTokens[_msgSender()] = true;
        // mint tokens, sender, amount
        _mint(_msgSender(), _claimAmount);
        // to validate that totalSupply is updated properly
        assert(totalSupply() == _oldTotalSupply + _claimAmount);
    }
}