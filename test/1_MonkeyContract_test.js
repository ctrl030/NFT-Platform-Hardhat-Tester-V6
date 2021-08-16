// using chai assertion library
const { expect } = require('chai');

// Main function that is executed during the test
describe("Monkey Contract, testing", () => {
  // Global variable declarations
  let _contractInstance, monkeyContract, accounts;

  // counter for Hardhat assertions / chai expects 
  let  assertionCounter = 0;

  // helper variable, to check addresses in a format that is easier to read
  // this array will receive the generated Hardhat addresses,
  // i.e. accountToAddressArray[0] will hold the address of accounts[0]
  // can be queried by showAllAccounts and findAccountForAddress
  let accountToAddressArray = [];

  // creating an array of NFTs from the owner's mappings in ERC721Enumerable: _ownedTokens 
  async function getNFTArray(owner) {
    // getting the owned Token IDs as array of BigNumbers 
    const resultArray = await monkeyContract.findMonkeyIdsOfAddress(owner);
    const normalNumbersResultArr = [];
    
    // creating new array, holding Token IDs as normal numbers
    for(pos = 0; pos < resultArray.length; pos++) {
      normalNumbersResultArr[pos] = bigNumberToNumber(resultArray[pos]);
    } 

    // returning (and possibly console logging) result array with normal numbers 
    //console.log("NFT Array of", findAccountForAddress(owner), ": ", normalNumbersResultArr);
    return normalNumbersResultArr;
  };
  
  // comparing an array of NFT Token IDs to the owner's mappings, see: getNFTArray()
  async function expectNFTArray(owner, expectedArray) {
    // getting array of Token IDs
    let resultArray = await getNFTArray(owner);
    // going through the results and comparing each entry to expectedArray entry at same index
    for (let count = 0; count < resultArray.length; count ++) {
      expect(resultArray[count]).to.equal(expectedArray[count]);
      assertionCounter++;
    };  
  }  

  // querying address' balance and converting from WEI to ETH and into normal number
  async function getETHbalance(adress) {    
    const balanceInWEI = await ethers.provider.getBalance(adress); 
    const balanceInETH = Number(fromWEItoETH(balanceInWEI));        
    return balanceInETH;
  }

  // converting BN big numbers to normal numbers
  function bigNumberToNumber(bignumber) {
    let convertedNumber = Number (ethers.utils.formatUnits(bignumber, 0));
    return convertedNumber;
  }

  // converting ETH to WEI
  function fromETHtoWEI (numberInETH) {
    const numberInWEI = web3.utils.toWei(numberInETH.toString());
    return numberInWEI;
  }
  
  // converting WEI to ETH
  function fromWEItoETH (numberInWEI) {
    const numberInETH = web3.utils.fromWei(numberInWEI.toString());      
    return numberInETH;    
  }

  // to create multiple offers and verify that they are correct
  // first entry in priceInETHArray is the price for first entry in tokenIdArray
  // seller will connect for offer creation, onlyOwner will query and verify
  async function createMultipleOffersAndVerify(seller, priceInETHArray, tokenIdArray){ 

    //console.log('Will now create offers for Token IDs: ', tokenIdArray);
    // going through the sent-in tokenIdArray and doing the following steps for each TokenID in it
    for (let _index = 0; _index< tokenIdArray.length; _index++ ) {      
      const tokenIdNow = tokenIdArray[_index];
      // getting price from the sent-in priceInETHArray and converting it to WEI
      const priceInWEIForTokenId = web3.utils.toWei(priceInETHArray[_index].toString());
      //console.log('_index: ', _index, 'tokenIdNow: ', tokenIdNow, 'price: ', priceInETHArray[_index]);

      // setting the offer as seller and verifying the emitted event
      await expect(monkeyMarketContract.connect(seller).setOffer(priceInWEIForTokenId, tokenIdNow))
      .to.emit(monkeyMarketContract, 'MarketTransaction')
      .withArgs('Create offer', seller.address, tokenIdNow);      

      // querying the offer and comparing if everything went as expected / sent-in
      const offerForToken =  await monkeyMarketContract.getOffer(tokenIdNow);
      const tokenSeller = offerForToken.seller;
      const tokenPrice = fromWEItoETH(offerForToken.price);
      const tokenIdInOffer = bigNumberToNumber(offerForToken.tokenId);
      const offerActive = offerForToken.active;
      const offerArrayIndex = bigNumberToNumber(offerForToken.index);
      expect(tokenSeller).to.equal(seller.address);  
      expect(Number(tokenPrice)).to.equal(priceInETHArray[_index]);  
      expect(Number(tokenIdInOffer)).to.equal(tokenIdNow); 
      expect(offerActive).to.equal(true);

      // querying the offersArray directly (onlyOwner is needed)
      const offerArrayDirectResult = await monkeyMarketContract.showOfferArrayEntry(offerArrayIndex);
      expect(offerArrayDirectResult.active).to.equal(true);
      expect(offerArrayDirectResult.tokenId).to.equal(tokenIdInOffer);

      assertionCounter = assertionCounter+7;      
    }    
  }

  // sending in expected amount of active offers and comparing to amount of found active offers
  async function verifyAmountOfActiveOffers(expectedAmount) {
    const allActiveOffersArray = await monkeyMarketContract.getAllTokenOnSale();
    expect(allActiveOffersArray.length).to.equal(expectedAmount);
    assertionCounter++;
  } 
  
  // query and return details of offer for Token ID  
  async function checkOfferForTokenID( tokenIdToCheck ){
    const offerForToken = await monkeyMarketContract.getOffer(tokenIdToCheck);
    
    let tokenSeller = offerForToken.seller;
    let tokenPrice = fromWEItoETH(bigNumberToNumber(offerForToken.price));
    let tokenIdInOffer = bigNumberToNumber(offerForToken.tokenId);
    let offerActive = offerForToken.active;
    let offerArrayIndex = bigNumberToNumber(offerForToken.index);    

    return {
      tokenIdToCheck,
      tokenIdInOffer,
      tokenSeller,
      tokenPrice,      
      offerActive,
      offerArrayIndex
    }
  }  

  // helper function to console.log for testing/debugging: looking up the accounts[] variable for an address 
  function findAccountForAddress(addressToLookup){
    for (let findInd = 0; findInd < accountToAddressArray.length; findInd++) {
      if (accountToAddressArray[findInd] == addressToLookup) {
        return "accounts[" +`${findInd}`+ "]"
      } else if (addressToLookup== '0x0000000000000000000000000000000000000000' ) {
        return "Zero address: 0x0000000000000000000000000000000000000000 => i.e. it was burnt"      
      }   
    }  
  }; 

  // helper function to console.log for testing/debugging: looking up Token IDs on sale
  async function showTokenIDsOnSale(){ 
    //console.log('Tokens IDs now on sale:');
    let allOffersNow = await monkeyMarketContract.getAllTokenOnSale();
    for (_u in allOffersNow) {
     console.log(bigNumberToNumber(allOffersNow[_u]));
    }
  }

  // 12 genes-variables for the minting of gen0 monkey NFTs 
  const genes0 = [
    1111111111111111,
    2222222222222222,
    3333333333333333,
    4444444444444444,
    5555555555555555,
    6666666666666666,
    7777777777777777,
    1214131177989271,
    4778887573779531,
    2578926622376651,
    5867697316113337,
    2577786627976651        
  ] 

  //setting instances of contracts
  before(async function() {
   
    //get all accounts from Hardhat
    accounts = await ethers.getSigners();

    // making a copy of the account addresses to accountToAddressArray
    for (let accIndex = 0; accIndex < accounts.length ; accIndex++) {
      accountToAddressArray[accIndex] = accounts[accIndex].address;        
    }       

    // deploying the BananaToken smart contract to Hardhat testnet
    _bananaTokenInstance = await ethers.getContractFactory('BananaToken');
    bananaContract = await _bananaTokenInstance.deploy();  

    // deploying the MonkeyContract to Hardhat testnet
    _contractInstance = await ethers.getContractFactory('MonkeyContract');
    monkeyContract = await _contractInstance.deploy(bananaContract.address);  
    
    // deploying the MonkeyMarketplace smart contract and sending it the address of the MonkeyContract for the marketplace constructor
    _marketContractInstance = await ethers.getContractFactory('MonkeyMarketplace');
    monkeyMarketContract = await _marketContractInstance.deploy(monkeyContract.address);    
    
    // accounts[0] / onlyOwner connects market to main contract, tokens now cannot be transferred in main while on sale in market  
    await monkeyContract.connectMarket(monkeyMarketContract.address, true)

    // checking if contracts are connected correctly
    const marketConnection = await monkeyContract.checkMarketConnected();
    expect(marketConnection.isMarketConnected).to.equal(true);
    expect(marketConnection.marketAddressSaved).to.equal(monkeyMarketContract.address);

    assertionCounter=assertionCounter+2;
  })  
  
  it('Test 1: State variables are as expected: owner, contract address, NFT name, NFT symbol, gen 0 limit, gen 0 total, total supply', async() => { 

    // accounts[0] should be deployer of main contract
    const monkeyContractDeployer = await monkeyContract.owner();
    expect(monkeyContractDeployer).to.equal(accounts[0].address);

    // Main contract address should be saved correctly
    const _contractAddress = await monkeyContract.getMonkeyContractAddress(); 
    expect(_contractAddress).to.equal(monkeyContract.address); 

    // NFT name should be "Crypto Monkeys"
    const _name = await monkeyContract.name();
    expect(_name).to.equal('Crypto Monkeys'); 
    
    //  NFT symbol should be "MONKEY"'
    const _symbol = await monkeyContract.symbol()
    expect(_symbol).to.equal('MONKEY');    

    // NFT gen 0 limit should be 12
    const _GEN0_Limit = await monkeyContract.GEN0_Limit();
    expect(_GEN0_Limit).to.equal(12); 

    // NFT gen 0 total should be 0 in the beginning
    const _gen0amountTotal = await monkeyContract.gen0amountTotal();
    expect(_gen0amountTotal).to.equal(0);  
    
    // NFT total supply should be 0 in the beginning
    const _totalSupply = await monkeyContract.totalSupply();
    expect(_totalSupply).to.equal(0);
    
    // Zero Monkey placeholder was created and burned during deployment via constructor,
    // i.e. Zero monkey should exist in the allMonkeysArray, but burned,
    // owner is zero address and NFT is deleted from _allTokens which is queried by totalSupply()
    const zeroDetails = await monkeyContract.allMonkeysArray(0);
    const zeroGenes = bigNumberToNumber(zeroDetails[3]); 
    expect(zeroGenes).to.equal(bigNumberToNumber(1214131177989271));  

    assertionCounter=assertionCounter+8;
  });


  it("Test 2: Gen 0 monkeys: Create 12 gen 0 NFTs, then expect revert above 12 (after GEN0_Limit = 12)", async () => {   

    // REVERT: create a gen 0 monkey from account[1]
    await expect(monkeyContract.connect(accounts[1]).createGen0Monkey(genes0[0])).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // creating 12 gen 0 monkeys and verifying emitted event shows correct details
    for(let _i = 0; _i < genes0.length; _i++){     
      await expect(monkeyContract.createGen0Monkey(genes0[_i]))
      .to.emit(monkeyContract, 'MonkeyCreated')
      .withArgs(accounts[0].address, _i+1, 0,0, genes0[_i]);     
      assertionCounter++;
    }

    // NFT totalSupply should be 12
    const _totalSupply2 = await monkeyContract.totalSupply();
    expect(_totalSupply2).to.equal(12); 

    // There should be 12 Gen 0 Monkeys
    const _GEN0Amount = await monkeyContract.gen0amountTotal();
    expect(_GEN0Amount).to.equal(12);     

    // verify monkey genes are the same from our genes0 array 
    // skipping zero monkey created by constructor, starting with Token ID 1
    for (let i = 1; i < _totalSupply2; i++) {
      let _monkeyMapping = await monkeyContract.allMonkeysArray(i);
      
      if(i > 0){     
        // _monkeyMapping[3] shows genes attribute inside the returning CryptoMonkey object
        // comparison has to be i-1 to allow for zero monkey difference         
        expect(_monkeyMapping[3]).to.equal(genes0[i-1]);     
        assertionCounter++;
      }
    } 

    // GEN0_Limit reached, next creation should fail
    await expect(monkeyContract.createGen0Monkey(genes0[0])).to.be.revertedWith(
      "Maximum amount of gen 0 monkeys reached"
    );    

    assertionCounter=assertionCounter+4;
  });

  it("Test 3: Breeding CryptoMonkey NFTs", async () => {

    // accounts[0] gets Banana Token to pay for breeding
    await bananaContract.getBananas();
    // allowing MonkeyContract to handle Banana Token for accounts[0]    
    await bananaContract.approve(monkeyContract.address, 1000);

    // breeding 3 NFT monkeys
    await monkeyContract.breed(1, 2); // tokenId 12
    await monkeyContract.breed(3, 4); // tokenId 13
    await monkeyContract.breed(5, 6); // tokenId 14  
    
    // balanceOf accounts[0] should be 15
    expect(await monkeyContract.balanceOf(accounts[0].address)).to.equal(15);
    assertionCounter++;

    // NFT totalSupply should be 15
    expect(await monkeyContract.totalSupply()).to.equal(15);
    assertionCounter++;

    // checking NFT array of accounts[0]
    const test3Acc0ExpectedArr = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
    await expectNFTArray(accounts[0].address, test3Acc0ExpectedArr);
  });

  it("Test 4: Testing of safeTransferFrom, once with bytes data, once without", async () =>{ 

    // Account[0] transfers NFT with Token ID 2 to accounts[1] with safeTransferFrom with bytes data
    await expect(monkeyContract["safeTransferFrom(address,address,uint256,bytes)"](accounts[0].address, accounts[1].address, 2, 013456))
    .to.emit(monkeyContract, 'Transfer')
    .withArgs(accounts[0].address, accounts[1].address, 2);    
    expect(await monkeyContract.balanceOf(accounts[1].address)).to.equal(1);

    // Account[0] transfers NFT with Token ID 3 to accounts[1] with safeTransferFrom without bytes data
    await expect(monkeyContract["safeTransferFrom(address,address,uint256)"](accounts[0].address, accounts[1].address, 3))
    .to.emit(monkeyContract, 'Transfer')
    .withArgs(accounts[0].address, accounts[1].address, 3);    
    expect(await monkeyContract.balanceOf(accounts[1].address)).to.equal(2);   
    
    let test4Acc1ExpectedArr = [2,3];
    await expectNFTArray(accounts[1].address, test4Acc1ExpectedArr);
     
    // accounts[0] should now own 13 NFTs, IDs 1-15 without 2 and 3, and 15 and 14 swapped and popped to empty places of 2 and 3
    expect(await monkeyContract.balanceOf(accounts[0].address)).to.equal(13);
    let test4Acc0ExpectedArr = [1,15,14,4,5,6,7,8,9,10,11,12,13];
    await expectNFTArray(accounts[0].address, test4Acc0ExpectedArr);     
   
    assertionCounter=assertionCounter+5;
  });

  it("Test 5: Reverting unauthorized marketConnect, non-owned monkey transfers, breeding and mulitiple ERC20 Token faucet usage", async () => {      

    // REVERT: accounts[1] tries to unconnect the market from main contract
    await expect( monkeyContract.connect(accounts[1]).connectMarket(monkeyMarketContract.address, false) ).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );    

    // REVERT: transfering a non-owned monkey with transferNFT
    await expect(monkeyContract.transferNFT(accounts[1].address, accounts[2].address, 1)).to.be.revertedWith(
      "ERC721: transfer of token that is not own"
    ); 
    
    // REVERT: transfering a non-owned monkey with transferFrom 
    await expect(monkeyContract.transferFrom(accounts[1].address, accounts[2].address, 1)).to.be.revertedWith(
      "ERC721: transfer of token that is not own"
    );

    // REVERT: transfering a non-owned monkey with safeTransferFrom (w. 4 arguments)
    await expect(  monkeyContract["safeTransferFrom(address,address,uint256,bytes)"](accounts[1].address, accounts[2].address, 1, 013456) ).to.be.revertedWith(
      "ERC721: transfer of token that is not own"
    );

    // REVERT: transfering a non-owned monkey with safeTransferFrom (w. 3 arguments)  
    await expect( monkeyContract["safeTransferFrom(address,address,uint256)"](accounts[1].address, accounts[2].address, 1) ).to.be.revertedWith(
      "ERC721: transfer of token that is not own"
    ); 

    // REVERT: breeding a non-owned monkey    
    // accounts[7] gets Banana Token to pay breeding
    await bananaContract.connect(accounts[7]).getBananas();
    // accounts[7] allows MonkeyContract to handle Banana Token     
    await bananaContract.connect(accounts[7]).approve(monkeyContract.address, 1000);
    await expect( monkeyContract.connect(accounts[7]).breed(1, 2) ).to.be.revertedWith(
      "MonkeyContract: Must be owner of both parent tokens"
    );

    // REVERT: trying to get free Banana Token a second time
    await expect( bananaContract.connect(accounts[7]).getBananas() ).to.be.revertedWith(
      "You already claimed your free Bananas."
    );

    assertionCounter=assertionCounter+7;
  }); 
  
  it('Test 6: accounts[0] should give accounts[1] operator status and transfer, incl. reverting transfer without operator', async() => {  
    
    // accounts[0] gives accounts[1] operator status
    await monkeyContract.setApprovalForAll(accounts[1].address, true);
    expect(await monkeyContract.isApprovedForAll(accounts[0].address, accounts[1].address)).to.equal(true);

    // accounts[0] takes away operator status 
    await  monkeyContract.setApprovalForAll(accounts[1].address, false);
    expect(await monkeyContract.isApprovedForAll(accounts[0].address, accounts[1].address)).to.equal(false);

    // REVERT: without operator status, accounts[1] tries to use transferNFT to send NFT with Token ID 4 from accounts[0] to accounts[2]     
    await expect(monkeyContract.connect(accounts[1]).transferNFT(accounts[0].address, accounts[2].address, 4)).to.be.revertedWith(
      "MonkeyContract: Can't transfer this NFT without being owner, approved or operator"
    );

    // REVERT: without operator status, accounts[1] tries to use transferFrom to send NFT with Token ID 4 from accounts[0] to accounts[2]     
    await expect(monkeyContract.connect(accounts[1]).transferFrom(accounts[0].address, accounts[2].address, 4)).to.be.revertedWith(
      "ERC721: transfer caller is not owner nor approved"
    );

    // REVERT: without operator status, accounts[1] tries to use safeTransferFrom (w. 4 arguments) to send NFT with Token ID 4 from accounts[0] to accounts[2]  
    await expect(  monkeyContract.connect(accounts[1])["safeTransferFrom(address,address,uint256,bytes)"](accounts[0].address, accounts[2].address, 4, 013456) ).to.be.revertedWith(
      "ERC721: transfer caller is not owner nor approved"
    );

    // REVERT: without operator status, accounts[1] tries to use safeTransferFrom (w. 3 arguments) to send NFT with Token ID 4 from accounts[0] to accounts[2]  
    await expect( monkeyContract.connect(accounts[1])["safeTransferFrom(address,address,uint256)"](accounts[0].address, accounts[2].address, 4) ).to.be.revertedWith(
      "ERC721: transfer caller is not owner nor approved"
    ); 
    
    // accounts[0] gives accounts[1] operator status again
    await monkeyContract.setApprovalForAll(accounts[1].address, true);
    expect(await monkeyContract.isApprovedForAll(accounts[0].address, accounts[1].address)).to.equal(true);
    
    // As operator, accounts[1] sends NFT with Token IDs 6-9 from accounts[0] to accounts[2]
    for (let index = 6; index <= 9; index++) {
    await expect(monkeyContract.connect(accounts[1]).transferNFT(accounts[0].address, accounts[2].address,`${index}`))
    .to.emit(monkeyContract, 'Transfer')
    .withArgs(accounts[0].address,  accounts[2].address,`${index}`);    
    assertionCounter++;
    }  

    // checking NFT array of accounts[2]
    expect(await monkeyContract.balanceOf(accounts[2].address)).to.equal(4);
    const test6Acc2ExpectedArr = [6,7,8,9];    
    await expectNFTArray(accounts[2].address, test6Acc2ExpectedArr);

    // checking NFT array of accounts[0]
    expect(await monkeyContract.balanceOf(accounts[2].address)).to.equal(4);
    const test6Acc0ExpectedArr = [1,15,14,4,5,13,12,11,10];    
    await expectNFTArray(accounts[0].address, test6Acc0ExpectedArr);  
    assertionCounter=assertionCounter+9;  
  });  
  
  it('Test 7: as operator, accounts[1] should use transfer to take 3 NFTs with Token IDs 13-15 from accounts[0]', async() => {  
    
    // accounts[1] uses transferNFT to take the 3 NFTs
    for (let index = 13; index <= 15; index++) {
      await monkeyContract.connect(accounts[1]).transferNFT(accounts[0].address, accounts[1].address,`${index}`);
    }

    // checking NFT array of accounts[1]
    expect(await monkeyContract.balanceOf(accounts[1].address)).to.equal(5);
    const test7Acc1ExpectedArr = [2,3,13,14,15];    
    await expectNFTArray(accounts[1].address, test7Acc1ExpectedArr);
    assertionCounter++;

    // checking NFT array of accounts[0]
    expect(await monkeyContract.balanceOf(accounts[0].address)).to.equal(6);
    const test7Acc0ExpectedArr = [1,12,11,4,5,10];    
    await expectNFTArray(accounts[0].address, test7Acc0ExpectedArr);
    assertionCounter++;
    
  });
  
  it('Test 8: accounts[1] should give exclusive allowance for the NFT with Token ID 14 to accounts[2], which then takes the NFT using transferFrom', async() => {  

    // giving and testing approval
    await monkeyContract.connect(accounts[1]).approve(accounts[2].address, 14);
    const testingMonkeyNr14 = await monkeyContract.getApproved(14);
    expect(testingMonkeyNr14).to.equal(accounts[2].address);

    // transfering
    await expect(monkeyContract.connect(accounts[2]).transferFrom(accounts[1].address, accounts[2].address, 14))
    .to.emit(monkeyContract, 'Transfer')
    .withArgs(accounts[1].address,  accounts[2].address,14);    

    // checking NFT array of accounts[1]
    expect(await monkeyContract.balanceOf(accounts[1].address)).to.equal(4);
    const test8Acc1ExpectedArr = [2,3,13,15];    
    await expectNFTArray(accounts[1].address, test8Acc1ExpectedArr);

    // checking NFT array of accounts[2]
    expect(await monkeyContract.balanceOf(accounts[2].address)).to.equal(5);
    const test8Acc2ExpectedArr = [6,7,8,9,14];    
    await expectNFTArray(accounts[2].address, test8Acc2ExpectedArr);
    assertionCounter=assertionCounter+4;
  }); 
  
  it('Test 9: accounts[2] should use breed to create 2 NFTs each of gen2-gen7, i.e. should have 16 NFTs at the end' , async() => { 

    // NFT totalSupply should be 15
    expect(await monkeyContract.totalSupply()).to.equal(15);

    // checking Token ID 7 to be gen0
    expect((await monkeyContract.getMonkeyDetails(7)).generation).to.equal(0);

    // checking Token ID 14 to be gen1
    expect((await monkeyContract.getMonkeyDetails(14)).generation).to.equal(1);

    // accounts[2] gets Banana Token to pay breeding
    await bananaContract.connect(accounts[2]).getBananas();
    // accounts[2] allows MonkeyContract to handle Banana Token    
    await bananaContract.connect(accounts[2]).approve(monkeyContract.address, 1000);
    
    // accounts[2] breeds NFTs with Token IDs 7 and 14 twice, creating 2 gen2 NFTs: Token IDs 16 and 17       
    for (let indexT9B1 = 7; indexT9B1 <= 8; indexT9B1++) {
      await monkeyContract.connect(accounts[2]).breed(7, 14);      
    }

    // checking Token IDs 16 and 17 to be gen2
    expect((await monkeyContract.getMonkeyDetails(16)).generation).to.equal(2);
    expect((await monkeyContract.getMonkeyDetails(17)).generation).to.equal(2);
    assertionCounter=assertionCounter+5;
    
    // starting with gen2 for breeding NFTs with Token IDs 16 and 17 
    let test9Bgeneration = 3;
    // Token IDs are increased by 2 per loop, breeding 16 and 17, then 18 and 19, etc.
    // these are the Token IDs of the parents, not the children
    let test9BFirstParentIdCounter = 16;
    let test9BSecondParentIdCounter = test9BFirstParentIdCounter+1;
    
    // 5 loops, creating gen3-gen7
    for (let t9BigLoop = 0; t9BigLoop < 5; t9BigLoop++) {

      // creating 2 NFTs per loop
      for (let index9B2 = 0; index9B2 < 2; index9B2++) {
        await monkeyContract.connect(accounts[2]).breed(test9BFirstParentIdCounter, test9BSecondParentIdCounter);        
      }
      
      // increasing Token ID counter by 2 per loop
      test9BFirstParentIdCounter = test9BFirstParentIdCounter +2;    
      test9BSecondParentIdCounter = test9BSecondParentIdCounter +2;      
      
      // testing/expecting NFT generation
      expect( (await monkeyContract.getMonkeyDetails(test9BFirstParentIdCounter)).generation ).to.equal(test9Bgeneration);
      expect( (await monkeyContract.getMonkeyDetails(test9BFirstParentIdCounter)).generation ).to.equal(test9Bgeneration);
      
      // increasing NFT generation by 1 per loop
      test9Bgeneration++;
      assertionCounter++;
      assertionCounter++;      
      
    }      

    // NFT totalSupply should be 27
    expect(await monkeyContract.totalSupply()).to.equal(27);
    assertionCounter++;

    // checking NFT array of accounts[2]
    expect(await monkeyContract.balanceOf(accounts[2].address)).to.equal(17);
    const test9Acc2ExpectedArr = [6,7,8,9,14,16,17,18,19,20,21,22,23,24,25,26,27];    
    await expectNFTArray(accounts[2].address, test9Acc2ExpectedArr);
    assertionCounter++;
    
  });

  it('Test 10: Advanced constructor verifications, incl. MonkeyMarket', async () => {            
    // MonkeyMarketplace should know main contract address
    const mainContractAddressSavedInMarket = await monkeyMarketContract.savedMainContractAddress();     
    expect(mainContractAddressSavedInMarket).to.equal(monkeyContract.address);       
    assertionCounter++;

    // accounts[0] should be deployer of main contract
    const monkeyContractOwner = await monkeyContract.owner();      
    expect(monkeyContractOwner).to.equal(accounts[0].address);
    assertionCounter++;

    // accounts[0] should be deployer of market contract
    const marketContractOwner = await monkeyMarketContract.owner(); 
    expect(marketContractOwner).to.equal(accounts[0].address);  
    assertionCounter++;
  }) 

  it('Test 11: Creating and deleting offers', async () => { 
    
    // preparing prices and Token IDs for offer creation
    let pricesInETHTest14Acc2 = [6.5, 7.2, 0.000019, 260];
    let tokenIDsToSellT14Acc2 = [6, 7, 19, 26]; 

    // REVERT: without market having operator status, accounts[2] tries to create 4 offers
    await expect(createMultipleOffersAndVerify(accounts[2], pricesInETHTest14Acc2, tokenIDsToSellT14Acc2)).to.be.revertedWith(
      "Marketplace address needs operator status from monkey owner."
    );   

    // giving operator status and verifying
    await monkeyContract.connect(accounts[1]).setApprovalForAll(monkeyMarketContract.address, true);
    await monkeyContract.connect(accounts[2]).setApprovalForAll(monkeyMarketContract.address, true);
    expect(await monkeyContract.isApprovedForAll(accounts[1].address, monkeyMarketContract.address)).to.equal(true);
    expect(await monkeyContract.isApprovedForAll(accounts[2].address, monkeyMarketContract.address)).to.equal(true);

    // after giving operator status to market, accounts[2] creates 4 offers (Token IDs: 6, 7, 19, 26), offers are then verified 
    await createMultipleOffersAndVerify(accounts[2], pricesInETHTest14Acc2, tokenIDsToSellT14Acc2);      

    await verifyAmountOfActiveOffers(4);

    // accounts[1] creates 4 offers (Token IDs: 2,3,13,15), offers are then verified 
    let pricesInETHTest14Acc1 = [2, 3.5, 0.13, 150];
    let tokenIDsToSellT14Acc1 = [2, 3, 13, 15]; 
    await createMultipleOffersAndVerify(accounts[1], pricesInETHTest14Acc1, tokenIDsToSellT14Acc1);  

    await verifyAmountOfActiveOffers(8);
    
    // REVERT: accounts[1] deletes the offer for Token ID 7, though not the owner
    await expect(monkeyMarketContract.connect(accounts[1]).removeOffer(7)).to.be.revertedWith(
      "You're not the owner"
    );

    // REVERT: creating sell offer is reverted in market contract since caller is not the owner  
    await expect( monkeyMarketContract.connect(accounts[1]).setOffer("200000000000000", 7) ).to.be.revertedWith(
      "Only monkey owner can set offer for this tokenId"                                              
    );

    // accounts[2] deletes the offer for Token ID 7  
    await expect(monkeyMarketContract.connect(accounts[2]).removeOffer(7))
    .to.emit(monkeyMarketContract, 'MarketTransaction')
    .withArgs('Remove offer', accounts[2].address, 7);
    assertionCounter++;

    // REVERT: No active offer for Token ID 7 should exist
    await expect(monkeyMarketContract.getOffer(7)).to.be.revertedWith(
      "Market: No active offer for this tokenId."
    );

    // REVERT: buying NFT is reverted, no active offer for Token ID 7 should exist 
    await expect( monkeyMarketContract.buyMonkey(7, {value: ethers.utils.parseEther("7")} )).to.be.revertedWith(
      "Market: No active offer for this tokenId."
    );  

    // REVERT: deleting sell offer is reverted, no active offer for Token ID 7 should exist
    await expect( monkeyMarketContract.connect(accounts[2]).removeOffer(7) ).to.be.revertedWith(
      "Market: No active offer for this tokenId."
    );

    await verifyAmountOfActiveOffers(7);  
    assertionCounter=assertionCounter+8;

  });
  
  it('Test 12: "Real world use" - Buying / selling, interwoven with breeding, creating and deleting offers', async () => {    

    // accounts[1] owns these NFTs at this point (all 4 are up for sale)
    const tokensOwnedByAcc1 = [2, 3, 13, 15];
    await expectNFTArray(accounts[1].address, tokensOwnedByAcc1);

    // accounts[1] should have 10000 ETH (Hardhat environment starting balance) at this point
    const balanceBeforeT12Acc1 = await getETHbalance(accounts[1].address); 
    expect(balanceBeforeT12Acc1).to.equal(10000);
    assertionCounter++;

    // accounts[3] owns no NFTs at this point
    const tokensOwnedByAcc3 = [];
    await expectNFTArray(accounts[3].address, tokensOwnedByAcc3);

    // accounts[3] should have 10000 ETH (Hardhat environment starting balance) at this point
    const balanceBeforeT12Acc3 = await getETHbalance(accounts[3].address); 
    expect(balanceBeforeT12Acc3).to.equal(10000);
    assertionCounter++;

    // REVERT: accounts[3] tries to buy an NFT but sends not enough ETH for it
    await expect( monkeyMarketContract.connect( accounts[3] ).buyMonkey( 2, {value: ethers.utils.parseEther("1")} ) ).to.be.revertedWith(
      "Market: Not sending the correct amount"
    );    

    // REVERT: accounts[3] tries to buy an NFT but sends too much ETH for it
    await expect( monkeyMarketContract.connect( accounts[3] ).buyMonkey( 2, {value: ethers.utils.parseEther("3")} ) ).to.be.revertedWith(
      "Market: Not sending the correct amount"
    );
    assertionCounter++;
    assertionCounter++;   
    
    // accounts[3] buys 3 NFTs from acc1
    // two events are triggered and expected with correct details, "MarketTransaction" and "MonkeySold"
    await expect(monkeyMarketContract.connect( accounts[3] ).buyMonkey( 2, {value: ethers.utils.parseEther("2")} ))
    .to.emit(monkeyMarketContract, 'MarketTransaction')
    .withArgs('Buy', accounts[3].address, 2)
    .to.emit(monkeyMarketContract, 'MonkeySold')
    .withArgs(accounts[1].address, accounts[3].address, ethers.utils.parseEther("2"), 2);
    assertionCounter++;    
    await monkeyMarketContract.connect( accounts[3] ).buyMonkey( 13, {value: ethers.utils.parseEther("0.13")} );
    await monkeyMarketContract.connect( accounts[3] ).buyMonkey( 15, {value: ethers.utils.parseEther("150")} );

    // accounts[3] should now have 9847.87 ETH
    const balanceAfterT12Acc3 = await getETHbalance(accounts[3].address);
    expect(balanceAfterT12Acc3).to.equal((10000-2-0.13-150));
    assertionCounter++;

    // accounts[3] should now own these three NFTs and in this order in their _ownedTokens mapping 
    const tokensOwnedAfterByAcc3 = [2,13,15];
    await expectNFTArray(accounts[3].address, tokensOwnedAfterByAcc3);
   
    // accounts[1] should now have 10152.13 ETH
    const balanceAfterT12Acc1 = await getETHbalance(accounts[1].address); 
    expect(balanceAfterT12Acc1).to.equal(10000+2+0.13+150);
    assertionCounter++;

    // accounts[1] should now own this NFT in their _ownedTokens mapping 
    const tokensOwnedAfterByAcc1 = [3];
    await expectNFTArray(accounts[1].address, tokensOwnedAfterByAcc1);

    // accounts[4] buys 3 NFTs from acc2
    await monkeyMarketContract.connect( accounts[4] ).buyMonkey( 6, {value: ethers.utils.parseEther("6.5")} );   
    await monkeyMarketContract.connect( accounts[4] ).buyMonkey( 19, {value: ethers.utils.parseEther("0.000019")} );
    await monkeyMarketContract.connect( accounts[4] ).buyMonkey( 26, {value: ethers.utils.parseEther("260")} );

    // accounts[4] should now have 9733.499981 ETH
    const balanceAfterT12Acc4 = await getETHbalance(accounts[4].address);
    expect(balanceAfterT12Acc4).to.equal((10000-6.5-0.000019-260));
    assertionCounter++;

    // accounts[2] should now have 10266.500019 ETH
    const balanceAfterT12Acc2 = await getETHbalance(accounts[2].address);
    expect(balanceAfterT12Acc2).to.equal((10000+6.5+0.000019+260));
    assertionCounter++;

    // REVERT: trying to breed Monkey NFTs without enough Banana Token
    await expect(monkeyContract.connect(accounts[3]).breed(2, 15)).to.be.revertedWith(
      "Not enough Banana Token. Use the free faucet."
    );
    assertionCounter++;

    // accounts[3] gets Banana Token to pay breeding
    await bananaContract.connect(accounts[3]).getBananas();

    // REVERT: trying to breed Monkey NFTs without giving the contract allowance for Banana Token
    await expect(monkeyContract.connect(accounts[3]).breed(2, 15)).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
    assertionCounter++;  
    
    // allowing MonkeyContract to handle Banana Token for accounts[3]    
    await bananaContract.connect(accounts[3]).approve(monkeyContract.address, 1000);

    // accounts[3] breeds 4 NFTs
    await monkeyContract.connect(accounts[3]).breed(2, 15);    
    await monkeyContract.connect(accounts[3]).breed(2, 15);
    await monkeyContract.connect(accounts[3]).breed(2, 15); 
    await monkeyContract.connect(accounts[3]).breed(2, 15);

    // accounts[3] gives operator status to market
    await monkeyContract.connect(accounts[3]).setApprovalForAll(monkeyMarketContract.address, true);

    // preparing prices and Token IDs for offers
    const tokenIDsToSellT12Acc3 = [28, 29, 2, 15]; 
    const pricesInETHT12Acc3 = [28, 29, 2, 15];    

    // accounts[3] creates 4 offers
    await createMultipleOffersAndVerify(accounts[3], pricesInETHT12Acc3, tokenIDsToSellT12Acc3);      

    // accounts[5] buys 2 NFTs from accounts[3] (1 re-sold, originally bought from accounts[1] and 1 bred)
    await monkeyMarketContract.connect( accounts[5] ).buyMonkey( 29, {value: ethers.utils.parseEther("29")} );
    await monkeyMarketContract.connect( accounts[5] ).buyMonkey( 2, {value: ethers.utils.parseEther("2")} );       

    // expecting ETH balance of accounts[5]
    const balanceAfterT12Acc5 = await getETHbalance(accounts[5].address);
    expect(balanceAfterT12Acc5).to.equal((10000-2-29));
    assertionCounter++;
    
    // expecting ETH balance of accounts[3]
    const balanceAfterT12Acc3Again = await getETHbalance(accounts[3].address);
    expect(balanceAfterT12Acc3Again).to.equal((balanceAfterT12Acc3+2+29));   
    assertionCounter++;

    //accounts[4] creates 2 offers (Token IDs: 26,6), offers are then verified 
    await monkeyContract.connect(accounts[4]).setApprovalForAll(monkeyMarketContract.address, true);
    expect(await monkeyContract.isApprovedForAll(accounts[4].address, monkeyMarketContract.address)).to.equal(true);
    assertionCounter++;
    const pricesInETHTest12Acc1 = [0.26, 6];
    const tokenIDsToSellT12Acc1 = [26, 6]; 
    await createMultipleOffersAndVerify(accounts[4], pricesInETHTest12Acc1, tokenIDsToSellT12Acc1); 
    
    // accounts[2] buys back 2 NFTS from accounts[4]
    await monkeyMarketContract.connect( accounts[2] ).buyMonkey( 26, {value: ethers.utils.parseEther("0.26")} ); 
    await monkeyMarketContract.connect( accounts[2] ).buyMonkey( 6, {value: ethers.utils.parseEther("6")} );  

    // REVERT: trying to mint a Monkey NFT without enough Banana Token
    await expect(monkeyContract.connect(accounts[6]).createDemoMonkey(1111222233334444, accounts[6].address)).to.be.revertedWith(
      "Not enough Banana Token. Use the free faucet."
    );
    assertionCounter++;     

    // getting Banana Token from faucet, emits Transfer event
    await expect(bananaContract.connect(accounts[6]).getBananas())
    .to.emit(bananaContract, 'Transfer')
    .withArgs('0x0000000000000000000000000000000000000000', accounts[6].address, 1000);
    assertionCounter++;

    // REVERT: trying to mint a Monkey NFT without giving the contract allowance for Banana Token
    await expect(monkeyContract.connect(accounts[6]).createDemoMonkey(1111222233334444, accounts[6].address)).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
    assertionCounter++;    

    // accounts[6] allows main contract to transfer tokens
    await bananaContract.connect(accounts[6]).approve(monkeyContract.address, 1000);

    // accounts[6] creates NFT using createDemoMonkey
    await expect(monkeyContract.connect(accounts[6]).createDemoMonkey(1111222233334444, accounts[6].address))
    .to.emit(monkeyContract, 'MonkeyCreated')
    .withArgs(accounts[6].address, 32, 99,99, 1111222233334444);
    assertionCounter++;  

    // verifying owner array, ownership and monkey genes
    const test12Acc6ExpectedArr = [32];
    await expectNFTArray(accounts[6].address, test12Acc6ExpectedArr);
    const monkey32 = await monkeyContract.allMonkeysArray(32);    
    expect(monkey32[3]).to.equal(1111222233334444);
    assertionCounter++;   
    
  })

  it('Test 13: should test pausable functionality in both contracts, as well as reverting transfers for tokens that are still on sale', async () => {  

    // giving market operator status from accounts[5] and accounts[3]
    await monkeyContract.connect(accounts[5]).setApprovalForAll(monkeyMarketContract.address, true);
    await monkeyContract.connect(accounts[3]).setApprovalForAll(monkeyMarketContract.address, true);
    
    // REVERT: try to pause main contract while not being the owner
    await expect(monkeyContract.connect(accounts[1]).pause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // REVERT: try to pause main contract while not being the owner
    await expect(monkeyContract.connect(accounts[1]).unpause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // paused() should be false for both
    expect(await monkeyContract.paused()).to.equal(false);
    expect(await monkeyMarketContract.paused()).to.equal(false);
    
    // REVERT: try to pause market contract while not being the owner
    await expect(monkeyMarketContract.connect(accounts[1]).pause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // REVERT: try to pause market contract while not being the owner
    await expect(monkeyMarketContract.connect(accounts[1]).unpause()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    // paused() should be false for both
    expect(await monkeyContract.paused()).to.equal(false);
    expect(await monkeyMarketContract.paused()).to.equal(false);

    // pausing market as owner
    await expect(monkeyMarketContract.pause())
    .to.emit(monkeyMarketContract, 'Paused')
    .withArgs(accounts[0].address);
    assertionCounter++;
      
    // paused() should be false for monkeyContract, true for monkeyMarketContract
    expect(await monkeyContract.paused()).to.equal(false);
    expect(await monkeyMarketContract.paused()).to.equal(true);
    
    // REVERT: buying NFT is reverted in market contract while it is paused    
    await expect( monkeyMarketContract.connect(accounts[2]).buyMonkey(28, {value: ethers.utils.parseEther("28")} )).to.be.revertedWith(
      "Pausable: paused"
    );   
     
    // REVERT: creating sell offer is reverted in market contract while it is paused   
    await expect( monkeyMarketContract.connect(accounts[5]).setOffer("200000000000000", 2) ).to.be.revertedWith(
      "Pausable: paused"                                              
    );
      
    // REVERT: deleting sell offer is reverted in market contract while it is paused
    await expect( monkeyMarketContract.connect(accounts[3]).removeOffer(28) ).to.be.revertedWith(
      "Pausable: paused"
    );

    // transfering via main contract still works, as it is not paused
    await monkeyContract.connect(accounts[3]).transferNFT(accounts[3].address, accounts[4].address, 30);   

    // pausing main contract as owner
    await expect(monkeyContract.pause())
    .to.emit(monkeyContract, 'Paused')
    .withArgs(accounts[0].address);
    assertionCounter++;  

    // paused() should be true for both
    expect(await monkeyContract.paused()).to.equal(true);
    expect(await monkeyMarketContract.paused()).to.equal(true);    
      
    // REVERT: transfering NFT is reverted in main contract while it is paused    
    await expect( monkeyContract.connect(accounts[3]).transferNFT(accounts[3].address, accounts[4].address, 31) ).to.be.revertedWith(
      "Pausable: paused"
    );

    // REVERT: breeding NFT is reverted in main contract while it is paused    
    await expect( monkeyContract.connect(accounts[3]).breed(31, 15) ).to.be.revertedWith(
      "Pausable: paused"
    );

    // REVERT: creating demo NFT is reverted in main contract while it is paused    
    await expect( monkeyContract.connect(accounts[6]).createDemoMonkey(1111222233334444, accounts[6].address) ).to.be.revertedWith(
      "Pausable: paused"
    );       

    // unpause market, but not main
    await expect(monkeyMarketContract.unpause())
    .to.emit(monkeyMarketContract, 'Unpaused')
    .withArgs(accounts[0].address);
    assertionCounter++;    

    // paused() should be false for monkeyMarketContract, true for monkeyContract 
    expect(await monkeyMarketContract.paused()).to.equal(false);  
    expect(await monkeyContract.paused()).to.equal(true);    

    // transfering and buying are reverted when main contract is paused, but creating and deleting offers is allowed, since market is unpaused

    // REVERT: buying NFT is reverted in market contract while it is paused    
    await expect( monkeyMarketContract.connect(accounts[2]).buyMonkey(28, {value: ethers.utils.parseEther("28")} )).to.be.revertedWith(
      "Pausable: paused"
    );  

    // REVERT: using transferNFT to transfer an NFT is reverted in main contract while it is still paused    
    await expect( monkeyContract.connect(accounts[3]).transferNFT(accounts[3].address, accounts[4].address, 31) ).to.be.revertedWith(
      "Pausable: paused"
    );   

    // REVERT: using transferFrom to transfer an NFT is reverted in main contract while it is still paused    
    await expect( monkeyContract.connect(accounts[3]).transferFrom(accounts[3].address, accounts[4].address, 31) ).to.be.revertedWith(
      "Pausable: paused"
    );  
      
    // REVERT: using safeTransferFrom (w. 4 arguments) to transfer an NFT is reverted in main contract while it is still paused   
    await expect(  monkeyContract["safeTransferFrom(address,address,uint256,bytes)"](accounts[3].address, accounts[4].address, 31, 013456) ).to.be.revertedWith(
      "Pausable: paused"
    );

    // REVERT: using safeTransferFrom (w. 3 arguments) to transfer an NFT is reverted in main contract while it is still paused  
    await expect( monkeyContract["safeTransferFrom(address,address,uint256)"](accounts[3].address, accounts[4].address, 31) ).to.be.revertedWith(
      "Pausable: paused"
    );    
    
    // creating sell offer is allowed in market contract as it is unpaused      
    await monkeyMarketContract.connect(accounts[5]).setOffer("200000000000000", 2); 
    
    // deleting sell offer is allowed in market contract as it is unpaused     
    await monkeyMarketContract.connect(accounts[5]).removeOffer(2);    

    // unpause main as well, now both should work normal
    await expect(monkeyContract.unpause())
    .to.emit(monkeyContract, 'Unpaused')
    .withArgs(accounts[0].address);
    assertionCounter++; 
    

    // paused() should be false for both
    expect(await monkeyContract.paused()).to.equal(false);
    expect(await monkeyMarketContract.paused()).to.equal(false);    

    // transfering now works again, as both contracts are unpaused
    await monkeyContract.connect(accounts[3]).transferNFT(accounts[3].address, accounts[4].address, 31);
      
    // REVERT: using transferNFT to transfer an NFT is reverted in main contract, as token is still on sale     
    await expect( monkeyContract.connect(accounts[3]).transferNFT(accounts[3].address, accounts[4].address, 28) ).to.be.revertedWith(
      "MonkeyContract: NFT is still on sale. Remove offer first."
    );

    // REVERT: using transferFrom to transfer an NFT is reverted in main contract, as token is still on sale
    await expect( monkeyContract.connect(accounts[3]).transferFrom(accounts[3].address, accounts[4].address, 28) ).to.be.revertedWith(
      "MonkeyContract: NFT is still on sale. Remove offer first."
    );  
      
    // REVERT: using safeTransferFrom (w. 4 arguments) to transfer an NFT is reverted in main contract, as token is still on sale   
    await expect(  monkeyContract["safeTransferFrom(address,address,uint256,bytes)"](accounts[3].address, accounts[4].address, 28, 013456) ).to.be.revertedWith(
      "MonkeyContract: NFT is still on sale. Remove offer first."
    );

    // REVERT: using safeTransferFrom (w. 4 arguments) to transfer an NFT is reverted in main contract, as token is still on sale   
    await expect(  monkeyContract["safeTransferFrom(address,address,uint256)"](accounts[3].address, accounts[4].address, 28) ).to.be.revertedWith(
    "MonkeyContract: NFT is still on sale. Remove offer first."
    );

    // buying now works again, as both contracts are unpaused   
    await monkeyMarketContract.connect(accounts[2]).buyMonkey(28, {value: ethers.utils.parseEther("28")} );
    assertionCounter=assertionCounter+32;

  });

  it('Test LAST: should show estimate of amount of assertions in testing', async () => {
    // console logging assertionCounter, shows minimum amount of successful assertions during tests   
    console.log('During these Hardhat tests more than', assertionCounter , 'assertions were succesfully proven correct.')        
  });

});