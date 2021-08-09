// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./MonkeyContract.sol";
import "./MonkeyMarketplace.sol";

contract SimulateReentrancy {

  MonkeyContract public _monkeyContractObject;
  MonkeyMarketplace public _monkeyMarketplaceObject;

  constructor (address _monkeyContractAddress, address _monkeyMarketplaceAddress) {
    _monkeyContractObject = MonkeyContract(_monkeyContractAddress);
    _monkeyMarketplaceObject = MonkeyMarketplace(_monkeyMarketplaceAddress);
  }

  fallback() external payable {

  }

  function simulateReentrancy() external payable {
    
  } 

}