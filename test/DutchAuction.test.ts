import { expect } from "chai";
import { ethers } from "hardhat";
import { DutchAuction, DutchAuction__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { generateMerkleProof, generateMerkleRoot } from "./Airdrop.test";

describe("DutchAuctionNFT", function () {
  let dutchAuction: DutchAuction;
  let deployer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let leaves: string[];

  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    const tokenURIs = [
      "https://example0.com",
      "https://example1.com",
      "https://example2.com",
    ];

    leaves = tokenURIs.map((tokenURI, index) => {
      return ethers.keccak256(
        ethers.solidityPacked(["uint256", "string"], [index, tokenURI])
      );
    });

    const merkleRoot = generateMerkleRoot(leaves);
    const DutchAuctionFactory = (await ethers.getContractFactory(
      "DutchAuction"
    )) as DutchAuction__factory;
    dutchAuction = await DutchAuctionFactory.deploy(merkleRoot);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await dutchAuction.owner()).to.equal(deployer.address);
    });
  });

  describe("Sale", function () {
    it("Should start sale", async function () {
      await dutchAuction.startSale();
      expect(await dutchAuction.auctionStartTime()).to.not.equal(0);
    });

    it("Should mint NFT correctly during sale", async function () {
      await dutchAuction.startSale();
      const price = await dutchAuction.getCurrentPrice();
      await dutchAuction.connect(user1).mint({ value: price });
      expect(await dutchAuction.totalMinted()).to.equal(1);
      expect(await dutchAuction.ownerOf(0)).to.equal(user1.address);
    });

    it("Should not mint NFT with insufficient payment", async function () {
      await dutchAuction.startSale();
      const price = await dutchAuction.getCurrentPrice();
      await expect(
        dutchAuction.connect(user1).mint({ value: price - 1n })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should end sale when all NFTs are minted", async function () {
      await dutchAuction.startSale();

      for (let i = 0; i < 777; i++) {
        const price = await dutchAuction.getCurrentPrice();
        await dutchAuction.connect(user1).mint({ value: price });
      }

      const price = await dutchAuction.getCurrentPrice();
      expect(await dutchAuction.totalMinted()).to.equal(777);
      await expect(
        dutchAuction.connect(user2).mint({ value: price })
      ).to.be.revertedWith("All NFTs have been minted");
    });
  });

  describe("Metadata", function () {
    it("Should reveal metadata correctly", async function () {
      await dutchAuction.startSale();
      const price = await dutchAuction.getCurrentPrice();
      await dutchAuction.connect(user1).mint({ value: price });

      const proof = generateMerkleProof(leaves, 0);

      await dutchAuction.revealMetadata(0, "https://example0.com", proof);
      expect(await dutchAuction.tokenURI(0)).to.equal("https://example0.com");
    });

    it("Should not reveal metadata with invalid proof", async function () {
      await dutchAuction.startSale();
      const price = await dutchAuction.getCurrentPrice();
      await dutchAuction.connect(user1).mint({ value: price });

      const tokenId = 0;
      const tokenURI = "https://example0.com";

      // invalid
      const proof = generateMerkleProof(leaves, 1);

      await expect(
        dutchAuction.revealMetadata(tokenId, tokenURI, proof)
      ).to.be.revertedWith("Invalid Merkle Proof");
    });

    it("Should not reveal metadata if token does not exist", async function () {
      const tokenId = 0;
      const tokenURI = "https://example0.com";
      const proof = generateMerkleProof(leaves, 0);

      await expect(
        dutchAuction.revealMetadata(tokenId, tokenURI, proof)
      ).to.be.revertedWith("Token does not exist");
    });

    it("Should not reveal metadata if already revealed", async function () {
      await dutchAuction.startSale();
      const price = await dutchAuction.getCurrentPrice();
      await dutchAuction.connect(user1).mint({ value: price });

      const tokenId = 0;
      const tokenURI = "https://example0.com";

      const proof = generateMerkleProof(leaves, 0);

      await dutchAuction.revealMetadata(tokenId, tokenURI, proof);
      await expect(
        dutchAuction.revealMetadata(tokenId, tokenURI, proof)
      ).to.be.revertedWith("Token already revealed");
    });
  });
});
