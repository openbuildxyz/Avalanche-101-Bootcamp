// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Hahn Solar Revenue Token
/// @notice Educational RWA token representing simulated community-solar revenue rights.
/// @dev One whole HSRT represents the simulated revenue right associated with 1 kWh
///      of metered generation. This contract makes no claim over a real-world asset.
contract HahnSolarRWA is ERC20, ERC20Burnable, Ownable {
    string private _assetDocument;

    error HahnSolarRWA__EmptyDocument();
    error HahnSolarRWA__ZeroAddress();
    error HahnSolarRWA__ZeroAmount();

    event TokensIssued(address indexed operator, address indexed beneficiary, uint256 amount);
    event TokensBurned(address indexed holder, uint256 amount);
    event AssetDocumentUpdated(string previousDocument, string newDocument);

    constructor(address initialOwner, string memory initialDocument)
        ERC20("Hahn Solar Revenue Token", "HSRT")
        Ownable(initialOwner)
    {
        if (bytes(initialDocument).length == 0) {
            revert HahnSolarRWA__EmptyDocument();
        }
        _assetDocument = initialDocument;
        emit AssetDocumentUpdated("", initialDocument);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert HahnSolarRWA__ZeroAddress();
        if (amount == 0) revert HahnSolarRWA__ZeroAmount();
        _mint(to, amount);
        emit TokensIssued(msg.sender, to, amount);
    }

    function burn(uint256 amount) public override {
        if (amount == 0) revert HahnSolarRWA__ZeroAmount();
        super.burn(amount);
        emit TokensBurned(msg.sender, amount);
    }

    function updateAssetDocument(string calldata document) external onlyOwner {
        if (bytes(document).length == 0) revert HahnSolarRWA__EmptyDocument();
        string memory previousDocument = _assetDocument;
        _assetDocument = document;
        emit AssetDocumentUpdated(previousDocument, document);
    }

    function assetDocument() external view returns (string memory) {
        return _assetDocument;
    }
}

