import { deployScript, artifacts } from "../rocketh/deploy.js";

/**
 * Deploys AvalancheBootcampToken using the deployer account as the initial owner.
 */
export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    const token = await env.deploy("AvalancheBootcampToken", {
      account: deployer,
      artifact: artifacts.AvalancheBootcampToken,
      args: [deployer],
    });

    const [name, symbol, totalSupply] = await Promise.all([
      env.read(token, { functionName: "name" }),
      env.read(token, { functionName: "symbol" }),
      env.read(token, { functionName: "totalSupply" }),
    ]);

    console.log("🪙 Token:", name, `(${symbol})`);
    console.log("🏦 Owner / deployer:", deployer);
    console.log("📦 Total supply:", totalSupply.toString());
    console.log("📍 Address:", token.address);
  },
  {
    tags: ["AvalancheBootcampToken"],
  },
);
