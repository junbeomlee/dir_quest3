import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  Airdrop,
  Airdrop__factory,
  PFPNFT__factory,
  PFPNFT,
} from "../typechain-types";

export function generateMerkleRoot(elements: string[]): string {
  if (elements.length === 1) {
    return elements[0];
  }

  const newElements = [];
  for (let i = 0; i < elements.length; i += 2) {
    if (i + 1 < elements.length) {
      const element1 = elements[i];
      const element2 = elements[i + 1];

      // If element1 <= element2, hash as element1 + element2
      // Otherwise, hash as element2 + element1
      if (element1 <= element2) {
        newElements.push(
          ethers.keccak256(
            ethers.solidityPacked(["bytes32", "bytes32"], [element1, element2])
          )
        );
      } else {
        newElements.push(
          ethers.keccak256(
            ethers.solidityPacked(["bytes32", "bytes32"], [element2, element1])
          )
        );
      }
    } else {
      newElements.push(elements[i]);
    }
  }

  return generateMerkleRoot(newElements);
}

export function generateMerkleProof(
  elements: string[],
  index: number
): string[] {
  let proof: string[] = [];
  let currentIndex = index;
  let currentElements = [...elements];

  while (currentElements.length > 1) {
    const newElements = [];
    for (let i = 0; i < currentElements.length; i += 2) {
      if (i + 1 < currentElements.length) {
        newElements.push(
          ethers.keccak256(
            ethers.solidityPacked(
              ["bytes32", "bytes32"],
              [currentElements[i], currentElements[i + 1]]
            )
          )
        );
        if (i === currentIndex || i + 1 === currentIndex) {
          proof.push(currentElements[i === currentIndex ? i + 1 : i]);
        }
      } else {
        newElements.push(currentElements[i]);
      }
    }
    currentIndex = Math.floor(currentIndex / 2);
    currentElements = newElements;
  }
  return proof;
}

describe("Airdrop NFT", async function () {
  let deployer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let team: HardhatEthersSigner;
  let airdrop: Airdrop;
  let pfpNft: PFPNFT;
  let merkleRoot: string;
  let leaves: string[];

  beforeEach(async function () {
    [deployer, user1, user2, user3, team] = await ethers.getSigners();

    const whitelist = [user1, user2, user3];
    this.leaves = await Promise.all(
      whitelist.map(async (user) => {
        return ethers.keccak256(
          ethers.solidityPacked(["address"], [await user.getAddress()])
        );
      })
    );

    this.merkleRoot = generateMerkleRoot(this.leaves);
    const AirdropFactory = (await ethers.getContractFactory(
      "Airdrop"
    )) as Airdrop__factory;
    this.airdrop = await AirdropFactory.deploy(
      "SL NFT",
      "SLNFT",
      await team.getAddress(),
      this.merkleRoot
    );

    const PFPNFTFactory = (await ethers.getContractFactory(
      "PFPNFT"
    )) as PFPNFT__factory;
    this.pfpNft = await PFPNFTFactory.deploy(
      "PFP NFT",
      "PFP",
      await this.airdrop.getAddress()
    );
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await this.airdrop.owner()).to.equal(deployer.address);
      expect(await this.pfpNft.owner()).to.equal(deployer.address);
    });

    it("Should set the correct merkle root", async function () {
      expect(await this.airdrop.merkleRoot()).to.equal(this.merkleRoot);
    });
  });

  describe("Airdrop and Claim", function () {
    it("Should allow valid address to claim NFT", async function () {
      const tokenId = 1;

      const proof = generateMerkleProof(this.leaves, 0);
      await this.airdrop.connect(user1).claim(tokenId, proof);

      // Verify ownership
      expect(await this.airdrop.ownerOf(tokenId)).to.equal(
        await user1.getAddress()
      );
    });

    it("Should not allow invalid address to claim NFT", async function () {
      const tokenId = 2;

      const proof = generateMerkleProof(this.leaves, 2);
      // user3 will be vaild
      await expect(
        this.airdrop.connect(user1).claim(tokenId, proof)
      ).to.be.revertedWith("Invalid proof");
    });

    it("Should allow owner to claim after deadline", async function () {
      const tokenId = 3;

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]); // 15 days
      await ethers.provider.send("evm_mine");

      // Claim the NFT
      await this.airdrop.claimAfterDeadline([tokenId]);

      // Verify ownership
      expect(await this.airdrop.ownerOf(tokenId)).to.equal(
        await team.getAddress()
      );
    });
  });

  describe("PFP Minting", function () {
    it("Should allow SLNFT owner to mint PFP", async function () {
      const tokenId = 4;

      // user1 proof
      const proof = generateMerkleProof(this.leaves, 0);
      await this.airdrop.connect(user1).claim(tokenId, proof);
      await this.pfpNft.connect(user1).mintPFP();
      expect(await this.pfpNft.balanceOf(user1.address)).to.equal(1);
    });

    it("Should not allow non-SLNFT owner to mint PFP", async function () {
      await expect(this.pfpNft.connect(user2).mintPFP()).to.be.revertedWith(
        "You must own an Airdrop SLNFT to mint a PFP"
      );
    });

    it("Should not allow to mint PFP twice", async function () {
      const tokenId = 5;

      // user1 proof
      const proof = generateMerkleProof(this.leaves, 0);
      await this.airdrop.connect(user1).claim(tokenId, proof);
      await this.pfpNft.connect(user1).mintPFP();

      await expect(this.pfpNft.connect(user1).mintPFP()).to.be.revertedWith(
        "PFP already minted"
      );
    });
  });
});
