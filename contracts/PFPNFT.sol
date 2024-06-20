// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IAirdropSLNFT {
    function balanceOf(address owner) external view returns (uint256);
}

contract PFPNFT is ERC721Enumerable, Ownable {
    IAirdropSLNFT public airdropSLNFTContract;
    mapping(address => bool) public hasMintedPFP;

    event MintedPFP(address indexed owner, uint256 tokenId);

    constructor(
        string memory name,
        string memory symbol,
        address _airdropSLNFTAddress
    ) ERC721(name, symbol) Ownable(msg.sender) {
        airdropSLNFTContract = IAirdropSLNFT(_airdropSLNFTAddress);
    }

    function mintPFP() external {
        require(
            airdropSLNFTContract.balanceOf(msg.sender) > 0,
            "You must own an Airdrop SLNFT to mint a PFP"
        );
        require(!hasMintedPFP[msg.sender], "PFP already minted");

        uint256 tokenId = totalSupply() + 1;
        _mint(msg.sender, tokenId);
        hasMintedPFP[msg.sender] = true;

        emit MintedPFP(msg.sender, tokenId);
    }
}
