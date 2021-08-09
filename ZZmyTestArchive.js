const MonkeyContract = artifacts.require('MonkeyContract');
const MonkeyMarketplace = artifacts.require('MonkeyMarketplace');
const { expectRevert, expectEvent, balance, BN } = require('@openzeppelin/test-helpers');
const { assert } = require('hardhat');

let monkeyContractHHInstance;
let monkeyMarketplaceHHInstance;

// this array serves as will receive the generated Hardhat addresses,
// i.e. accountToAddressArray[0] will hold the address of accounts[0]
// can be queried by showAllAccounts and findAccountForAddress
let accountToAddressArray = [];

let assertionCounter = 0;

// asserting a specific amount of NFTs for an account
async function assertAmountofNFTs(accToCheck, expectedAmount){
// checking how many NFTs are owned by account 'acc', should be 'amount' 
const prepAmountNFTsAcc = await monkeyContractHHInstance.balanceOf(accToCheck);
const ammountNFTsAcc = parseInt(prepAmountNFTsAcc) ;
assert.equal(ammountNFTsAcc, expectedAmount)
assertionCounter++;
}

// asserting owner and generation for an NFT
async function assertOwnerAndGeneration(ownerToExpect, tokenId, genToExpect){
  let testOwnAndGenDetails  = await monkeyContractHHInstance.getMonkeyDetails(tokenId); 
  assert.equal(testOwnAndGenDetails.owner, ownerToExpect);  
  assert.equal(testOwnAndGenDetails.generation, genToExpect);
  assertionCounter++;
  assertionCounter++;
}

// assert an offer's details
async function assertOfferDetailsForTokenID(tokenId, expectedActive, expectedSeller, expectedPriceInETH ) {

  let expectedPriceInWEI = web3.utils.toWei(expectedPriceInETH);

  let assertOfferTestingResult = await monkeyMarketplaceHHInstance.getOffer(tokenId);

  let returnedTokenId = parseInt(assertOfferTestingResult.tokenId); 
  let returnedActive = assertOfferTestingResult.active;
  let returnedSeller = assertOfferTestingResult.seller;
  let priceInWEITestingResult = parseInt(assertOfferTestingResult.price); 
  let priceInETHTestingResult = web3.utils.fromWei(priceInWEITestingResult.toString()); 
  
  assert.equal(returnedTokenId, tokenId);
  assert.equal(returnedActive, expectedActive);
  assert.equal(returnedSeller, expectedSeller);
  assert.equal(priceInETHTestingResult, expectedPriceInETH);
  assert.equal(priceInWEITestingResult, expectedPriceInWEI);
  assertionCounter++;
  assertionCounter++;
  assertionCounter++;
  assertionCounter++;
  assertionCounter++;
}

// creates an offer and asserts if values are correct
async function createOfferAndAssert (priceInETH, tokenId, fromAccount) {
  let priceInETHTesting = priceInETH.toString(); 
  let priceInWEIForCallingTest28 = web3.utils.toWei(priceInETHTesting); 
  await monkeyMarketplaceHHInstance.setOffer(priceInWEIForCallingTest28, tokenId, {from: fromAccount});  
  await assertOfferDetailsForTokenID(tokenId, true, fromAccount, priceInETHTesting ); 
}

// expects call to check NFT sell offer to revert with specific error message. Has to count 'revert' still xxxx
async function expectNoActiveOfferAndCount(tokenId) {
  await expectRevert( monkeyMarketplaceHHInstance.getOffer(tokenId), 'No active offer for this tokenId.');       
}

// address 'acc' gives operator status to market and asserts it works.
async function giveMarketOperatorAndAssertAndCount (acc) {
  await monkeyContractHHInstance.setApprovalForAll(monkeyMarketplaceHHInstance.address, true, {from: acc});
  let resultMarketOpTest = await monkeyContractHHInstance.isApprovedForAll(acc, monkeyMarketplaceHHInstance.address);     
  assert.equal(resultMarketOpTest, true);
  assertionCounter++;
}

// uses findNFTposition while skipping zero entries and and converting the result to normal number
async function findNFTPositionJS (ownerToQuery, tokenIdtoCheck) {
  if (tokenIdtoCheck !=0){
    
    const positionFoundBN = await monkeyContractHHInstance.findNFTposition(ownerToQuery, tokenIdtoCheck);
    const positionFound = parseInt(positionFoundBN);
  
    //console.log('Token ID: ', tokenIdtoCheck, ' should be in the _owners2tokenIdArrayMapping of', findAccountForAddress(ownerToQuery),'in this position: ', positionFound);
  
    return positionFound;

  } else {
    console.log(' Error, trying to lookup Token ID Zero, but burnt/zero address is not in accounts.')
  }	
}  

// controls MonkeyIdPositionsMapping by comparing it's results to _owners2tokenIdArrayMapping
// should be called passing amount and an spreading array of expected tokenId, for ex.:
async function assertPosIntegrAllNFTs(){

  // this many NFTs exist
  const totalSupplyAmount = parseInt(await monkeyContractHHInstance.showTotalSupply());   

  // asserting the Zero Monkey was burnt and owned by Zero Address
  const zeroMonkeyOwner = await monkeyContractHHInstance.ownerOf(0);
  assert.equal(zeroMonkeyOwner, '0x0000000000000000000000000000000000000000');
  assertionCounter++;

  // looping through all NFTs that exist 
  for (let assertAllIndex = 1; assertAllIndex < totalSupplyAmount; assertAllIndex++) {

    //console.log('Looking up NFT with Token ID:', assertAllIndex);
    
    // looking up owner
    let ownerAccount = await monkeyContractHHInstance.ownerOf(assertAllIndex);
    const readableOwner = findAccountForAddress(ownerAccount);
    //console.log('NFT with Token ID:', assertAllIndex, ' is owned by', readableOwner);
    
    // creating array to compare index to
    // using _owners2tokenIdArrayMapping as control variable to compare against
    // getting the owner's array of NFTs (without 0 entries, and converted to normal numbers) from: _owners2tokenIdArrayMapping
    let arrayOfFoundNFTs = await getNFTArrayOfAccount(ownerAccount);    
    //showArrayOfAccount(ownerAccount);
     
    // looking up this NFT, using address and tokenId, in the MonkeyIdPositionsMapping
    const positionFound = await findNFTPositionJS(ownerAccount, assertAllIndex);

    //console.log('Token ID', assertAllIndex, 'should be found in this position:', positionFound);

    // checking the _owners2tokenIdArrayMapping at the position that was found in the MonkeyIdPositionsMapping
    const tokenFound = arrayOfFoundNFTs[positionFound];    
    
    assert.equal(tokenFound, assertAllIndex);
    assertionCounter++;    
    //console.log('Token ID', assertAllIndex, 'was in the correct position');
    //console.log('-------------------------');
  }
}

// deep comparing an array of Token IDs to the queried array in the _owners2tokenIdArrayMapping
// for now must have " let collectingArray = []; " state variable, can't send list that will be kept, only 1 arg per call
let collectingArray = []; // put into global scope
async function deepCompareNFTArray (accountToTest, expectedArray) {

  // the collecting array in global scope receives the incoming expectedArray
  collectingArray = expectedArray;
  
  // looking up the accounts NFT array in the _owners2tokenIdArrayMapping 
  const queriedArray = await getNFTArrayOfAccount(accountToTest);

  // comparing both arrays
  assert.deepEqual(queriedArray, collectingArray);
  for (let assertionIndex = 0; assertionIndex < queriedArray.length; assertionIndex++) {  
    assertionCounter++;
  }

  //console.log('NFT array of', findAccountForAddress(accountToTest), 'is exactly as expected.');

  // resetting the collectingArray to empty
  collectingArray = [];
}

// uses assertOwnerMapping to check _monkeyIdsAndTheirOwnersMapping 
// and assertPosOfSpecificNFTinArray to check MonkeyIdPositionsMapping 
async function assertNFTArrIntegrityWPositions(accountToTest, expectedArray) {

  // looping through the incoming expectedArray 
  for (let index = 0; index < expectedArray.length; index++) {

    const tokenIdFoundInExpectedArr = expectedArray[index];

    // skipping deleted entries, i.e. entries with Token ID 0 
    if (tokenIdFoundInExpectedArr !=0) {
      await assertOwnerMapping(tokenIdFoundInExpectedArr, accountToTest);
      await assertPosOfSpecificNFTinArray(accountToTest, tokenIdFoundInExpectedArr, expectedArray);
    }     
  }
}

// asserting correct MonkeyIdPositionsMapping entries
async function assertPosOfSpecificNFTinArray(accountToTest, tokenIdtoCheck, expectedArray) {

  const positionFound = await findNFTPositionJS(accountToTest,tokenIdtoCheck);  

  // checking the incoming array at the position that was found in the MonkeyIdPositionsMapping
  const tokenFound = expectedArray[positionFound];

  assert.equal(tokenFound, tokenIdtoCheck);
  assertionCounter++;

}

// asserts integrity between an owners _owners2tokenIdArrayMapping and their MonkeyIdPositionsMapping for a incoming tokenIdtoCheck
async function assertPositionIntegrityOfSpecificNFT(tokenIdtoCheck){

  let foundOwner = await monkeyContractHHInstance.ownerOf(tokenIdtoCheck);

  console.log('Token ID: ', tokenIdtoCheck, 'is owned by: ', findAccountForAddress(foundOwner)); 

  // using _owners2tokenIdArrayMapping as control variable to compare against
  // getting the owner's array of NFTs (without 0 entries, and converted to normal numbers) from: _owners2tokenIdArrayMapping
  let arrayOfFoundNFTs = await getNFTArrayOfAccount(foundOwner);
  console.log('This is their _owners2tokenIdArrayMapping: ', findAccountForAddress(foundOwner));
  console.log('Looking up position in MonkeyIdPositionsMapping for Token ID:', tokenIdtoCheck);

  // looking up this NFT, using address and tokenId, in the MonkeyIdPositionsMapping
  const positionFound = await findNFTPositionJS(foundOwner,tokenIdtoCheck);  

  // checking the _owners2tokenIdArrayMapping at the position that was found in the MonkeyIdPositionsMapping
  const tokenFound = arrayOfFoundNFTs[positionFound];

  assert.equal(tokenFound, tokenIdtoCheck);
  assertionCounter++;
}

// asserting correct entry in all 4 NFT trackers
async function assertAllFourTrackersCorrect (accToQuery, expectedAmount, expectedArray) {

  // asserts correct amount entry in _numberOfNFTsOfAddressMapping
  await assertAmountofNFTs(accToQuery, expectedAmount);

  // asserts exactly same array as expectedArray in _owners2tokenIdArrayMapping
  await deepCompareNFTArray (accToQuery, expectedArray);

  // asserts correct ownership entry in _monkeyIdsAndTheirOwnersMapping 
  // asserts correct position in MonkeyIdPositionsMapping 
  await assertNFTArrIntegrityWPositions(accToQuery, expectedArray);  
} 

// asserting ownership entry in _monkeyIdsAndTheirOwnersMapping via ownerOf 
async function assertOwnerMapping(tokenIdTocheck, expectedOwnerAcc){
 const checkedTokenIdOwner = await monkeyContractHHInstance.ownerOf(tokenIdTocheck);
 assert.equal(checkedTokenIdOwner, expectedOwnerAcc);
 assertionCounter++;
}

// querying an accounts NFT array entry in _owners2tokenIdArrayMapping via findMonkeyIdsOfAddress
async function getNFTArrayOfAccount(acc){
  // outer array holds 1 element: the inner array with BN elements
  const bigNrAccOutArr = [];
  bigNrAccOutArr.push(await monkeyContractHHInstance.findMonkeyIdsOfAddress(acc));

  // inner array holds BN elements
  const bigNrAccInArr = bigNrAccOutArr[0];    
  const convertedNumArr = [];

  // converting BN to numbers and pushing to array convertedNumArr
  for (let testC = 0; testC < bigNrAccInArr.length; testC++) {                   
           
    const bigNrToConvert = bigNrAccInArr[testC];
    const convertedNrToPush = parseInt(bigNrToConvert);
    convertedNumArr.push( convertedNrToPush ); 
    
  }      
  //console.log(findAccountForAddress(acc)  +' has this NFT array: ');
  //console.log(convertedNumArr);  

  return convertedNumArr;
}

// assert balance of account
async function assertBalanceAsBN(acc, expectedBalanceInWEIasBN) {

  const balanceInWEI = await web3.eth.getBalance(acc); 
  //const balanceInWEIasBN = new BN(balanceInWEI);

  const parsedExpected = parseInt(expectedBalanceInWEIasBN);
  console.log('Incoming parsed: parsedExpected:', parsedExpected);

  console.log('Incoming: expectedBalanceInWEIasBN', expectedBalanceInWEIasBN);
  console.log('Result: balanceInWEI:', balanceInWEI);
  //console.log('Result: balanceInWEIasBN:', balanceInWEIasBN);  

  assert.equal(balanceInWEI, expectedBalanceInWEIasBN);
  assertionCounter++;
}





// show X - functions to console.log

// for testing/debugging: shows all accounts and their addresses
// is querying the copied addresses in accountToAddressArray
async function showAllAccounts(){
  for (let ind = 0; ind < accountToAddressArray.length; ind++) {
    console.log("accounts[" +`${ind}`+ "] is: " + accountToAddressArray[ind])
  }  
};

// for testing/debugging: looking up the accounts[] variable for an address
function findAccountForAddress(addressToLookup){
  for (let findInd = 0; findInd < accountToAddressArray.length; findInd++) {
    if (accountToAddressArray[findInd] == addressToLookup) {
      return "accounts[" +`${findInd}`+ "]"
    } else if (addressToLookup== '0x0000000000000000000000000000000000000000' ) {
      return "Zero address: 0x0000000000000000000000000000000000000000 => i.e. it was burnt"      
    }       
  }  
};

// for testing/debugging: show the NFT array of an account
async function showArrayOfAccount(acc){

  const readableAcc = findAccountForAddress(acc);

  const amountOfTestingAcc = parseInt( await monkeyContractHHInstance.balanceOf(acc));

  console.log(readableAcc , 'has this many NFTs:', amountOfTestingAcc);
        
  // this will receive the incoming array
  const bigNrAccOutArr = [];

  // outer array holds 1 element, at index 0: the inner array with BN elements
  bigNrAccOutArr.push(await monkeyContractHHInstance.findMonkeyIdsOfAddress(acc));

  // inner array holds BN elements at index 0
  const bigNrAccInArr = bigNrAccOutArr[0];    
  const convertedNumArr = [];

  // converting BN to numbers and pushing to array convertedNumArr
  for (let testC = 0; testC < bigNrAccInArr.length; testC++) {                   
          
    const bigNrToConvert = bigNrAccInArr[testC];
    const convertedNrToPush = parseInt(bigNrToConvert);
    convertedNumArr.push( convertedNrToPush ); 
    
  }      
  console.log( readableAcc +' has this NFT array: ');
  console.log(convertedNumArr);  
}

// for testing/debugging: show owner and generation for an NFT
async function showOwnerAndGeneration(tokenIdToTest){
  let testOwnAndGenDetails  = await monkeyContractHHInstance.getMonkeyDetails(tokenIdToTest); 
  console.log('NFT with Token ID: ' + tokenIdToTest);    
  console.log( 'is owned by: ' + findAccountForAddress(testOwnAndGenDetails.owner)); 
  console.log( 'and is gen' + parseInt(testOwnAndGenDetails.generation) );
  console.log('-------------------');
}

// for testing/debugging: show owner and generation for all NFTs
async function showAllNFTsWithOwnerAndGen() {
  let totalAmount = await monkeyContractHHInstance.totalSupply();
  for (let showAllInd = 0; showAllInd < totalAmount; showAllInd++) {          
    showOwnerAndGeneration(showAllInd);
  }
}

// for testing/debugging: shows active offer for Token ID, if one exists
async function showActiveOfferForTokenID(tokenId) {

  let offerTestingResult = await monkeyMarketplaceHHInstance.getOffer(tokenId);  
  let offerTRIndex = parseInt(offerTestingResult.index);      

  console.log('Offer Nr.: ' + offerTRIndex + ' Token ID: ' + parseInt(offerTestingResult.tokenId));
  console.log('Offer Nr.: ' + offerTRIndex + ' Active: ' + offerTestingResult.active);
  console.log('Offer Nr.: ' + offerTRIndex + ' Index: ' + offerTRIndex);
  console.log('Offer Nr.: ' + offerTRIndex + ' Seller: ' + findAccountForAddress(offerTestingResult.seller));

  let priceInWEITestingResult = parseInt(offerTestingResult.price); 
  console.log('Offer Nr.: ' + offerTRIndex + ' Price in WEI: ' + priceInWEITestingResult );  

  let priceInETHTestingResult = web3.utils.fromWei(priceInWEITestingResult.toString()); 
  console.log('Offer Nr.: ' + offerTRIndex + ' Price in ETH: ' + priceInETHTestingResult );  
  console.log('-----------------------------------');

}

// for testing/debugging: show all Token IDs with active offer
async function showingTokenIDsWithActiveOffer() {
  let actOffersBNArr = await monkeyMarketplaceHHInstance.getAllTokenOnSale();
  let activeOffers = [];

  for (let checkOffersIndex = 0; checkOffersIndex < actOffersBNArr.length; checkOffersIndex++) {    
    let offerToCheck = parseInt(actOffersBNArr[checkOffersIndex]);
    activeOffers.push(offerToCheck);
    console.log( 'Found active for Token ID: ' + offerToCheck);      
  }

  console.log('activeOffers');
  console.log(activeOffers);

}

// asserting that a specific number of sales offers are active
async function assertAmountOfActiveOffersAndCount(expectedAmount, expectedTokensArray) {
  const actOffersBNArr = await monkeyMarketplaceHHInstance.getAllTokenOnSale();
  const activeOffersAmount = actOffersBNArr.length;

  const convertedNumArr = [];

  // converting BN to numbers and pushing to array convertedNumArr
  for (let counter = 0; counter < activeOffersAmount; counter++) {                   
          
    const bigNrToConvert = actOffersBNArr[counter];
    const convertedNrToPush = parseInt(bigNrToConvert);
    convertedNumArr.push( convertedNrToPush ); 
    
  }      
  assert.deepEqual(convertedNumArr, expectedTokensArray);
  for (let assertionIndex = 0; assertionIndex < convertedNumArr.length; assertionIndex++) {  
  assertionCounter++;
  }
  
  assert.equal(activeOffersAmount, expectedAmount);
  assertionCounter++;
}

// Main contract Hardhat test with openzeppelin, Truffle and web3
contract('MonkeyContract with HH', accounts => {

  // deploying the main smart contract: MonkeyContract
  before(async()=> {    

    // making a copy of the account addresses to accountToAddressArray
    for (let accIndex = 0; accIndex < accounts.length ; accIndex++) {
      accountToAddressArray[accIndex] = accounts[accIndex];    
    }

    // deploying the main smart contract: MonkeyContract
    monkeyContractHHInstance = await MonkeyContract.new();    
    
  });