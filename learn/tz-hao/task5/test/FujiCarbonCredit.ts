import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("FujiCarbonCredit", function () {
  const assetDocument = "ipfs://bafybeigdyrzt-simulated-carbon-report-v1";

  async function deployToken() {
    const [admin, holder, outsider] = await ethers.getSigners();
    const token = await ethers.deployContract("FujiCarbonCredit", [assetDocument]);
    await token.waitForDeployment();
    return { token, admin, holder, outsider };
  }

  it("sets metadata and initial asset evidence", async function () {
    const { token } = await deployToken();
    expect(await token.name()).to.equal("Fuji Carbon Credit");
    expect(await token.symbol()).to.equal("FCC");
    expect(await token.assetDocument()).to.equal(assetDocument);
  });

  it("allows an issuer to mint and emits issuance", async function () {
    const { token, admin, holder } = await deployToken();
    const amount = ethers.parseUnits("1250", 18);
    await expect(token.connect(admin).mint(holder.address, amount))
      .to.emit(token, "CarbonCreditsIssued")
      .withArgs(holder.address, amount, admin.address);
    expect(await token.balanceOf(holder.address)).to.equal(amount);
  });

  it("rejects non-issuer minting", async function () {
    const { token, holder, outsider } = await deployToken();
    await expect(token.connect(outsider).mint(holder.address, 1n)).to.be.revertedWithCustomError(
      token,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("supports transfer and holder burning", async function () {
    const { token, admin, holder, outsider } = await deployToken();
    const issued = ethers.parseUnits("10", 18);
    const transferred = ethers.parseUnits("4", 18);
    const burned = ethers.parseUnits("1.5", 18);
    await token.connect(admin).mint(holder.address, issued);
    await token.connect(holder).transfer(outsider.address, transferred);
    await token.connect(outsider).burn(burned);
    expect(await token.totalSupply()).to.equal(issued - burned);
  });

  it("restricts asset evidence updates to asset managers", async function () {
    const { token, admin, outsider } = await deployToken();
    const replacement = "ipfs://bafybeigdyrzt-simulated-carbon-report-v2";
    await expect(token.connect(outsider).updateAssetDocument(replacement)).to.be.revertedWithCustomError(
      token,
      "AccessControlUnauthorizedAccount",
    );
    await token.connect(admin).updateAssetDocument(replacement);
    expect(await token.assetDocument()).to.equal(replacement);
  });
});
