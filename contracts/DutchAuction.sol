// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract DutchAuction is ERC721URIStorage, Ownable {
    uint256 public constant TOTAL_SUPPLY = 777;
    uint256 public constant START_PRICE = 5 ether;
    uint256 public constant END_PRICE = 0.1 ether;
    uint256 public constant PRICE_INCREASE_PER_PURCHASE = 0.006 ether;
    uint256 public constant PRICE_DECREASE_PER_MINUTE = 0.003 ether;

    uint256 public totalMinted;
    uint256 public auctionStartTime;
    bytes32 public merkleRoot;

    mapping(uint256 => bool) private _revealedTokens;

    event Mint(uint256 indexed tokenId, address indexed owner);
    event SaleStarted(uint256 timestamp);
    event SaleEnded(uint256 timestamp);

    constructor(
        bytes32 _merkleRoot
    ) ERC721("DutchAuctionNFT", "DANFT") Ownable(msg.sender) {
        merkleRoot = _merkleRoot;
    }

    function startSale() external onlyOwner {
        require(auctionStartTime == 0, "Sale has already started");
        auctionStartTime = block.timestamp;
        emit SaleStarted(block.timestamp);
    }

    function mint() external payable {
        require(auctionStartTime != 0, "Sale has already started");
        require(totalMinted < TOTAL_SUPPLY, "All NFTs have been minted");
        uint256 price = getCurrentPrice();
        require(msg.value >= price, "Insufficient payment");

        _mint(msg.sender, totalMinted);
        emit Mint(totalMinted, msg.sender);

        totalMinted++;

        if (totalMinted == TOTAL_SUPPLY) {
            emit SaleEnded(block.timestamp);
        }
    }

    function getCurrentPrice() public view returns (uint256) {
        if (auctionStartTime == 0) {
            return START_PRICE;
        }

        uint256 timeElapsed = block.timestamp - auctionStartTime;
        uint256 priceDecrease = (timeElapsed / 60) * PRICE_DECREASE_PER_MINUTE;

        uint256 decreasedPrice = START_PRICE > priceDecrease
            ? START_PRICE - priceDecrease
            : END_PRICE;

        uint256 priceIncrease = totalMinted * PRICE_INCREASE_PER_PURCHASE;
        return decreasedPrice + priceIncrease;
    }

    function revealMetadata(
        uint256 tokenId,
        string memory _tokenURI,
        bytes32[] calldata merkleProof
    ) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        require(!_revealedTokens[tokenId], "Token already revealed");

        // Generate the node for the given tokenId and tokenURI
        bytes32 node = keccak256(abi.encodePacked(tokenId, _tokenURI));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, node),
            "Invalid Merkle Proof"
        );

        _setTokenURI(tokenId, _tokenURI);
        _revealedTokens[tokenId] = true;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        require(_revealedTokens[tokenId], "Metadata not revealed yet");

        return super.tokenURI(tokenId);
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
