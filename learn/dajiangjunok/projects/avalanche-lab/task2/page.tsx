import Link from "next/link";
import type { NextPage } from "next";

const Home: NextPage = () => (
  <main className="flex grow flex-col items-center px-5 py-16">
    <div className="w-full max-w-3xl">
      <p className="text-sm uppercase tracking-widest opacity-60">dajiangjunok / Avalanche Bootcamp / Task 2</p>
      <h1 className="mt-5 text-4xl font-bold">My first Avalanche ERC-20</h1>
      <p className="mt-6 text-lg leading-relaxed">Dajiangjun Bootcamp Token (DJJ) is an ERC-20 learning token with 18 decimals and an initial supply of 1,000,000 tokens. Deploy it to Fuji, read balances, and send a test transfer using Scaffold-ETH Debug Contracts.</p>
      <div className="my-8 rounded-2xl bg-base-200 p-7">
        <h2 className="text-xl font-semibold">Verify on chain</h2>
        <ol className="ml-5 mt-4 list-decimal space-y-3">
          <li>Connect a wallet and select Avalanche Fuji (43113), or local Hardhat / Anvil (31337).</li>
          <li>Open BootcampToken in Debug Contracts.</li>
          <li>Read name, symbol, totalSupply and balanceOf.</li>
          <li>Call transfer with another test account and save the transaction receipt.</li>
        </ol>
      </div>
      <Link href="/debug" className="btn btn-primary">Open Debug Contracts</Link>
      <p className="mt-8 text-sm opacity-60">Educational tokens only. Local deployment records are not Fuji submission evidence.</p>
    </div>
  </main>
);
export default Home;
