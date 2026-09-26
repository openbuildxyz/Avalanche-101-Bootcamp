import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const DOCUMENT = "WH-TEA-2026-001";
const ONE = 10n ** 18n;

async function deploy() {
  const [owner, stranger, recipient] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("TeaWarehouseReceipt");
  const token = await factory.deploy(DOCUMENT);
  await token.waitForDeployment();
  return { owner, stranger, recipient, token };
}

describe("TeaWarehouseReceipt", function () {
  it("deploys with the receipt name and an empty supply", async function () {
    const { owner, token } = await deploy();
    expect(await token.name()).to.equal("Tea Warehouse Receipt");
    expect(await token.symbol()).to.equal("TEA");
    expect(await token.decimals()).to.equal(18);
    expect(await token.totalSupply()).to.equal(0n);
    expect(await token.assetDocument()).to.equal(DOCUMENT);
    expect(await token.owner()).to.equal(owner.address);
  });

  it("lets the warehouse mint, and rejects everyone else", async function () {
    const { owner, stranger, token } = await deploy();
    await token.mint(owner.address, 100n * ONE);
    expect(await token.balanceOf(owner.address)).to.equal(100n * ONE);
    expect(await token.totalSupply()).to.equal(100n * ONE);
    await expect(token.connect(stranger).mint(stranger.address, ONE)).to.be.revertedWithCustomError(
      token,
      "OwnableUnauthorizedAccount",
    );
  });

  it("lets a holder transfer and burn, and keeps supply and balances in step", async function () {
    const { owner, recipient, token } = await deploy();
    await token.mint(owner.address, 100n * ONE);
    await token.transfer(recipient.address, 10n * ONE);
    expect(await token.balanceOf(owner.address)).to.equal(90n * ONE);
    expect(await token.balanceOf(recipient.address)).to.equal(10n * ONE);
    expect(await token.totalSupply()).to.equal(100n * ONE);

    await token.burn(5n * ONE);
    expect(await token.balanceOf(owner.address)).to.equal(85n * ONE);
    expect(await token.totalSupply()).to.equal(95n * ONE);
    await expect(token.burn(1000n * ONE)).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("lets only the warehouse change the asset document", async function () {
    const { stranger, token } = await deploy();
    await expect(token.connect(stranger).updateAssetDocument("changed")).to.be.revertedWithCustomError(
      token,
      "OwnableUnauthorizedAccount",
    );
    await token.updateAssetDocument("WH-TEA-2026-002");
    expect(await token.assetDocument()).to.equal("WH-TEA-2026-002");
  });
});
