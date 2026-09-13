import { expect } from "chai";
import { network } from "hardhat";
import type { Abi_AvalancheBootcampToken } from "../generated/abis/AvalancheBootcampToken.js";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, networkHelpers, ethers } = await network.create();

async function deployFixture() {
  const env = await loadAndExecuteDeploymentsFromFiles({ provider });
  const { address, abi } = env.get<Abi_AvalancheBootcampToken>("AvalancheBootcampToken");
  const token = await ethers.getContractAt(abi, address);
  const [owner, other] = await ethers.getSigners();
  return { env, token, owner, other };
}

describe("AvalancheBootcampToken", function () {
  it("mints the initial supply to the owner", async function () {
    const { token, owner } = await networkHelpers.loadFixture(deployFixture);
    expect(await token.name()).to.equal("Avalanche Bootcamp Token");
    expect(await token.symbol()).to.equal("ABT");
    expect(await token.decimals()).to.equal(18n);
    expect(await token.owner()).to.equal(owner.address);
    expect(await token.totalSupply()).to.equal(1_000_000n * 10n ** 18n);
    expect(await token.balanceOf(owner.address)).to.equal(1_000_000n * 10n ** 18n);
  });

  it("allows only the owner to mint", async function () {
    const { token, owner, other } = await networkHelpers.loadFixture(deployFixture);
    await expect(token.connect(other).mint(other.address, 1n)).to.be.revertedWithCustomError(
      token,
      "OwnableUnauthorizedAccount",
    );
    await token.connect(owner).mint(other.address, 100n);
    expect(await token.balanceOf(other.address)).to.equal(100n);
  });

  it("allows holders to burn their tokens", async function () {
    const { token, owner } = await networkHelpers.loadFixture(deployFixture);
    await token.connect(owner).burn(1_000n * 10n ** 18n);
    expect(await token.totalSupply()).to.equal(999_000n * 10n ** 18n);
  });
});
