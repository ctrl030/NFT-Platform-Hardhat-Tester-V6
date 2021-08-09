// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IMonkeyContract.sol";
// preparing for some functions to be restricted 
import "@openzeppelin/contracts/access/Ownable.sol";
// preparing safemath to rule out over- and underflow  
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
// importing openzeppelin script to guard against re-entrancy
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
// importing openzeppelin script to make contract pausable
import "@openzeppelin/contracts/security/Pausable.sol";

contract MonkeyMarketplace is Ownable, ReentrancyGuard, Pausable {
  using SafeMath for uint256;
  
  IMonkeyContract private _monkeyContractInterface;

  address public savedMainContractAddress;
  address public savedMarketContractAddress;

  event MarketTransaction(string TxType, address owner, uint256 tokenId);

  event MonkeySold (address seller, address buyer, uint256 price, uint256 tokenId); 

  struct Offer {
    address payable seller;
    uint256 price;
    uint256 index;
    uint256 tokenId;    
    bool active;
  }

  // Array of all offers
  // can be queried by onlyOwner via showOfferArrayEntry
  Offer[] private offersArray; 

  // Mapping of Token ID to offer
  mapping (uint256 => Offer) tokenIdToOfferMapping;    

  constructor (address _constructorMonkeyContractAddress) {
    _monkeyContractInterface = IMonkeyContract(_constructorMonkeyContractAddress);
    require(_monkeyContractInterface.getMonkeyContractAddress() == _constructorMonkeyContractAddress, "CONSTRUCTOR: Monkey contract address must be the same.");
    savedMainContractAddress = _constructorMonkeyContractAddress; 

  } 
 
 function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function isTokenOnSale(uint256 _tokenId) public view returns (bool tokenIsOnSale) {
    return (
      tokenIdToOfferMapping[_tokenId].active
    );
  }
  
  /**
  * Get the details about a offer for _tokenId. Throws an error if there is no active offer for _tokenId.
  */
  function getOffer(uint256 _tokenId) public view returns (
    address seller,
    uint256 price,
    uint256 index,
    uint256 tokenId,
    bool active
    )
  {
    require (tokenIdToOfferMapping[_tokenId].active, "Market: No active offer for this tokenId.");

    Offer memory offer = tokenIdToOfferMapping[_tokenId]; 
    return (
    offer.seller,
    offer.price,
    offer.index, 
    offer.tokenId,
    offer.active       
    );
  }

  /**
  * Get all tokenId's that are currently for sale. 
  * Returns an empty array if none exist.
  // adds a Token ID to the 'result' array each time the loop finds an active offer in the offersArray  
  */
  function getAllTokenOnSale() public view returns(uint256[] memory listOfTokenIdsOnSale) {  

    // counting active offers, needed to create correct hardcoded length of 'result' array
    uint256 numberOfActiveOffers;
    
    // looking through offersArray at each postion
    for (uint256 actCount = 0; actCount < offersArray.length; actCount++) {

      // each time an active offer is found, numberOfActiveOffers is increased by 1
      if (offersArray[actCount].active) {
        numberOfActiveOffers++;
      }
    }     

    // if no active offers are found, an empty array is returned
    if (numberOfActiveOffers == 0){
      return new uint256[](0);
    }
    // looking again through offersArray at each postion
    else {
      // 'result' array with hardcoded length, defined by active offers found above
      uint256[] memory result = new uint256[](numberOfActiveOffers);      

      // index position in result array
      uint256 newIndex = 0 ;

      for (uint256 k = 0; k < offersArray.length; k++) {
        
        // each time an active offer is found, its tokenId is put into the next position in the 'result' array
        if (offersArray[k].active) {
          result[newIndex] = offersArray[k].tokenId;
          newIndex++;
        }         
      }

      return result; 

    }
   
  }

  /**
  * Creates a new offer for _tokenId for the price _price.
  * Emits the MarketTransaction event with txType "Create offer"
  * Requirement: Only the owner of _tokenId can create an offer.
  * Requirement: There can only be one active offer for a token at a time.
  * Requirement: Marketplace contract (this) needs to be an approved operator when the offer is created.
  */    
  function setOffer(uint256 _price, uint256 _tokenId) public whenNotPaused {    

    //  Only the owner of _tokenId can create an offer.
    require( _monkeyContractInterface.ownerOf(_tokenId) == _msgSender(), "Only monkey owner can set offer for this tokenId" );
    //Marketplace contract (this) needs to be an approved operator when the offer is created.
    require( _monkeyContractInterface.isApprovedForAll(_msgSender(), address(this)), "Marketplace address needs operator status from monkey owner." );
    //Offer price must be greater than 0
    require(_price >= 1000000000000, "offer price must be at least 1000000000000 WEI, i.e. 0.000001 ETH ");
    
    Offer memory tokenOffer = tokenIdToOfferMapping[_tokenId];

    // There can only be one active offer for a token at a time.    
    if (tokenOffer.active == true) {
      // delete offer array entry 
      delete offersArray[tokenOffer.index]; 
      // delete mapping entry
      delete tokenIdToOfferMapping[_tokenId];
      // emit MarketTransaction("Remove offer", _msgSender(), _tokenId);
    }
    
    // Creating a new offer from the Offer struct "blueprint"
    Offer memory _newOffer = Offer({
      seller: payable(_msgSender()),
      price: _price,
      tokenId: _tokenId,      
      active: true,
      index: offersArray.length  
    });

    // saving new offer (it's a struct) to mapping 
    tokenIdToOfferMapping[_tokenId] = _newOffer;    

    offersArray.push(_newOffer);  

    emit MarketTransaction("Create offer", _msgSender(), _tokenId);
  }

  /**
  * Removes an existing offer.
  * Emits the MarketTransaction event with txType "Remove offer"
  * Requirement: Only the seller of _tokenId can remove an offer.
  */
  function removeOffer(uint256 _tokenId) public whenNotPaused {

    Offer memory tokenOffer = tokenIdToOfferMapping[_tokenId];
    // Active offer must be present
    require(tokenOffer.active == true, "Market: No active offer for this tokenId." );
    //  Only the owner of _tokenId can delete an offer.
    require(tokenOffer.seller == _msgSender(), "You're not the owner");    
    // setting array entry inactive
    offersArray[tokenOffer.index].active = false;
    // deleting mapping entry
    delete tokenIdToOfferMapping[_tokenId];      

    emit MarketTransaction("Remove offer", _msgSender(), _tokenId);
    
  }

  /**
  * Executes the purchase of _tokenId.
  * Sends the funds to the seller and transfers the token using transfer in Monkeycontract.   
  * Emits the MarketTransaction event with txType "Buy".
  * Requirement: The msg.value needs to equal the price of _tokenId
  * Requirement: There must be an active offer for _tokenId
  */
  function buyMonkey(uint256 _tokenId) public payable nonReentrant whenNotPaused{    

    Offer memory tokenOffer = tokenIdToOfferMapping[_tokenId];
    
    require(tokenOffer.active == true, "Market: No active offer for this tokenId. TEST" );

    require(tokenOffer.price == msg.value, "Market: Not sending the correct amount.");   
                                       
    address payable _oldOwner = tokenOffer.seller;

    // deactivating offer by setting array entry inactive
    offersArray[tokenOffer.index].active = false;

    // deleting offer mapping entry
    delete tokenIdToOfferMapping[_tokenId];

    // deleting local memory variable against re-entrancy  
    delete tokenOffer;    

    // transferring the NFT
    _monkeyContractInterface.transferNFT(_oldOwner, _msgSender(), _tokenId);  

    // transferring sent funds to _oldOwner
    _oldOwner.transfer(msg.value);

    // emitting events
    emit MarketTransaction("Buy", _msgSender(), _tokenId);
    emit MonkeySold (_oldOwner, _msgSender(), msg.value, _tokenId);
  }

  function showLengthOfOffersArray() public view onlyOwner returns(uint256 length) {
    return offersArray.length;
  }
  
  function showOfferArrayEntry(uint256 arrayPosition) public view onlyOwner returns(address seller, uint256 price, uint256 index, uint256 tokenId, bool active) { 

    Offer memory offer = offersArray[arrayPosition]; 

    return (
    offer.seller,
    offer.price,
    offer.index, 
    offer.tokenId,
    offer.active       
    );      

  }    

} 