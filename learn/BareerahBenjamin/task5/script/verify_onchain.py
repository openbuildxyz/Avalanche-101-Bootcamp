#!/usr/bin/env python3
"""Read-only Fuji verification. Requires Python 3 and Foundry cast/forge."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
RPC = os.environ.get("FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")
CONTRACT = "0xdCa267f03D04a8fc775f8161cfe52a63dAb4f73E"
OWNER = "0x10e0E8930bE146edD1214324915646b5ab095f87"
RECIPIENT = "0xE83B1DCF8F9F3765DAbd34555f39240a14f5AcE9"


def rpc(method, params):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    with urlopen(Request(RPC, data=payload, headers={"Content-Type": "application/json"}), timeout=45) as response:
        body = json.load(response)
    if "error" in body:
        raise RuntimeError(json.dumps(body["error"]))
    return body["result"]


def cast(*args):
    return subprocess.check_output(["cast", *args], text=True).strip()


def call(signature, *args, block="latest"):
    data = cast("calldata", signature, *args)
    return rpc("eth_call", [{"to": CONTRACT, "data": data}, block])


def integer(signature, *args, block="latest"):
    return int(call(signature, *args, block=block), 16)


def main():
    assert int(rpc("eth_chainId", []), 16) == 43113, "Fuji only"
    broadcast = json.loads((ROOT / "evidence/broadcast.json").read_text())
    actions = ["deploy", "mint", "transfer", "burn", "updateAssetDocument"]
    expected = [(0, 0, 0), (1000000, 1000000, 0), (1000000, 800000, 200000),
                (950000, 750000, 200000), (950000, 750000, 200000)]
    records = []
    for tx, action, balances in zip(broadcast["transactions"], actions, expected, strict=True):
        receipt = rpc("eth_getTransactionReceipt", [tx["hash"]])
        assert receipt and int(receipt["status"], 16) == 1, f"{action} unsuccessful"
        block = receipt["blockNumber"]
        actual = (integer("totalSupply()", block=block), integer("balanceOf(address)", OWNER, block=block),
                  integer("balanceOf(address)", RECIPIENT, block=block))
        assert actual == balances, f"{action}: {actual} != {balances}"
        records.append({"action": action, "transactionHash": tx["hash"], "block": int(block, 16),
                        "status": "success", "totalSupplyBaseUnits": actual[0],
                        "ownerBalanceBaseUnits": actual[1], "recipientBalanceBaseUnits": actual[2],
                        "receipt": receipt})

    final_block = hex(records[-1]["block"])
    local_code = json.loads((ROOT / "out/CoffeeWarehouseToken.sol/CoffeeWarehouseToken.json").read_text())["deployedBytecode"]["object"]
    assert rpc("eth_getCode", [CONTRACT, final_block]).lower() == local_code.lower(), "Bytecode mismatch"
    assert integer("totalIssued()", block=final_block) == 1000000
    assert integer("documentVersion()", block=final_block) == 2
    assert integer("decimals()", block=final_block) == 3
    assert integer("owner()", block=final_block) == int(OWNER, 16)
    document = "sha256:0x" + hashlib.sha256((ROOT / "docs/asset-proof-v2.json").read_bytes()).hexdigest()
    actual_document = json.loads(cast("abi-decode", "assetDocument()(string)", call("assetDocument()", block=final_block)))
    assert actual_document == document, "Asset document hash mismatch"
    rejected = []
    selector = cast("sig", "OwnableUnauthorizedAccount(address)")[2:]
    for signature, args in [("mint(address,uint256)", [RECIPIENT, "1"]),
                            ("updateAssetDocument(string)", ["tampered"])]:
        try:
            rpc("eth_call", [{"from": RECIPIENT, "to": CONTRACT,
                              "data": cast("calldata", signature, *args)}, final_block])
        except RuntimeError as error:
            assert selector in str(error), f"Unexpected revert: {error}"
            rejected.append({"function": signature, "from": RECIPIENT, "error": json.loads(str(error))})
        else:
            raise AssertionError(f"Unauthorized call accepted: {signature}")

    summary = {"network": "Avalanche Fuji C-Chain", "chainId": 43113, "contract": CONTRACT,
               "owner": OWNER, "recipient": RECIPIENT, "decimals": 3,
               "verificationBlock": records[-1]["block"], "runtimeBytecodeMatches": True,
               "assetDocument": document, "documentVersion": 2, "totalIssuedBaseUnits": 1000000,
               "transactions": records, "unauthorizedReadOnlySimulations": rejected}
    (ROOT / "evidence/onchain-verification.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(f"Verified Fuji contract {CONTRACT}; runtime bytecode matches local build.")
    for record in records:
        print(f"{record['action']}: success; block {record['block']}; supply={record['totalSupplyBaseUnits']/1000:g} FCWR; "
              f"owner={record['ownerBalanceBaseUnits']/1000:g}; recipient={record['recipientBalanceBaseUnits']/1000:g}")
    print("Document SHA-256 matches v2. Unauthorized mint and document update reverted with the expected custom error.")


if __name__ == "__main__":
    main()
