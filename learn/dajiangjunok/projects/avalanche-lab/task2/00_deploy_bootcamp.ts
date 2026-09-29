import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployBootcamp: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.name === "avalancheFuji" && !process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY) {
    throw new Error("Use Scaffold-ETH yarn account:import / yarn generate and yarn deploy; do not use a default development key on Fuji.");
  }
  const { deployer } = await hre.getNamedAccounts();
  await hre.deployments.deploy("BootcampToken", { from: deployer, args: [deployer], log: true, autoMine: true });
};
export default deployBootcamp;
deployBootcamp.tags = ["BootcampToken"];
