// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// 1 个 TEA 代表 1 公斤已入库茶叶。部署者是仓库管理员。
contract TeaWarehouseReceipt is ERC20, Ownable {
    string public assetDocument;

    event AssetDocumentUpdated(string document);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    constructor(string memory document) ERC20("Tea Warehouse Receipt", "TEA") Ownable(msg.sender) {
        assetDocument = document;
        emit AssetDocumentUpdated(document);
    }

    /// 茶叶入库后，仓库管理员签发仓单。
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// 持有人提货，仓单注销。
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }

    /// 更换仓单证明编号。只有仓库管理员可以改。
    function updateAssetDocument(string calldata document) external onlyOwner {
        assetDocument = document;
        emit AssetDocumentUpdated(document);
    }
}
