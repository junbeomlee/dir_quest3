// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Airdrop is ERC721Enumerable, Ownable {
    uint256 public constant CLAIM_PERIOD = 2 weeks;
    uint256 public claimDeadline;

    address public teamAddress;
    bytes32 public merkleRoot;

    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed claimer, uint256 tokenId);

    constructor(
        string memory name,
        string memory symbol,
        address _teamAddress,
        bytes32 _merkleRoot
    ) ERC721(name, symbol) Ownable(msg.sender) {
        teamAddress = _teamAddress;
        merkleRoot = _merkleRoot;
        claimDeadline = block.timestamp + CLAIM_PERIOD;
    }

    function claim(uint256 tokenId, bytes32[] calldata merkleProof) external {
        require(block.timestamp <= claimDeadline, "Claim period is over");
        require(!hasClaimed[msg.sender], "Already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, leaf),
            "Invalid proof"
        );

        _mint(msg.sender, tokenId);
        hasClaimed[msg.sender] = true;

        emit Claimed(msg.sender, tokenId);
    }

    function claimAfterDeadline(uint256[] memory tokenIds) external onlyOwner {
        require(block.timestamp > claimDeadline, "Claim period is not over");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _mint(teamAddress, tokenIds[i]);
            emit Claimed(teamAddress, tokenIds[i]);
        }
    }
}
