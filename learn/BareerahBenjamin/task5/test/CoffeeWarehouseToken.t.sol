// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {CoffeeWarehouseToken} from "../src/CoffeeWarehouseToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

interface VmTest {
    function prank(address caller) external;
    function expectRevert(bytes calldata revertData) external;
    function expectRevert(bytes4 selector) external;
    function expectEmit(bool topic1, bool topic2, bool topic3, bool data, address emitter) external;
}

contract CoffeeWarehouseTokenTest {
    VmTest private constant vm = VmTest(address(uint160(uint256(keccak256("hevm cheat code")))));
    CoffeeWarehouseToken private token;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant ATTACKER = address(0xBAD);

    event TokensIssued(address indexed operator, address indexed to, uint256 amount);
    event RedemptionRequested(address indexed holder, uint256 amount);
    event AssetDocumentUpdated(
        uint256 indexed version, string previousDocument, string newDocument
    );

    function setUp() public {
        token = new CoffeeWarehouseToken(address(this), "sha256:demo-v1");
    }

    function testDeploymentAndInitialMetadata() public view {
        require(address(token).code.length > 0, "No deployed bytecode");
        require(keccak256(bytes(token.name())) == keccak256("Fuji Coffee Warehouse Receipt"));
        require(keccak256(bytes(token.symbol())) == keccak256("FCWR"));
        require(token.decimals() == 3);
        require(token.owner() == address(this));
        require(token.totalSupply() == 0 && token.totalIssued() == 0);
        require(token.documentVersion() == 1);
        require(keccak256(bytes(token.assetDocument())) == keccak256("sha256:demo-v1"));
    }

    function testAuthorizedMintAndEvent() public {
        vm.expectEmit(true, true, false, true, address(token));
        emit TokensIssued(address(this), ALICE, 1_000_000);
        token.mint(ALICE, 1_000_000);
        require(token.balanceOf(ALICE) == 1_000_000);
        require(token.totalSupply() == 1_000_000 && token.totalIssued() == 1_000_000);
    }

    function testUnauthorizedMintRejected() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ATTACKER)
        );
        vm.prank(ATTACKER);
        token.mint(ATTACKER, 1_000);
        require(token.totalSupply() == 0);
    }

    function testHolderTransfer() public {
        token.mint(ALICE, 1_000_000);
        vm.prank(ALICE);
        require(token.transfer(BOB, 200_000));
        require(token.balanceOf(ALICE) == 800_000 && token.balanceOf(BOB) == 200_000);
        require(token.totalSupply() == 1_000_000);
    }

    function testHolderBurnAndEvent() public {
        token.mint(ALICE, 1_000_000);
        vm.expectEmit(true, false, false, true, address(token));
        emit RedemptionRequested(ALICE, 50_000);
        vm.prank(ALICE);
        token.burn(50_000);
        require(token.balanceOf(ALICE) == 950_000 && token.totalSupply() == 950_000);
        require(token.totalIssued() == 1_000_000);
    }

    function testCompleteBusinessLifecycle() public {
        token.mint(ALICE, 1_000_000);
        vm.prank(ALICE);
        token.transfer(BOB, 200_000);
        vm.prank(ALICE);
        token.burn(50_000);
        require(token.balanceOf(ALICE) == 750_000);
        require(token.balanceOf(BOB) == 200_000);
        require(token.totalSupply() == 950_000);
    }

    function testAuthorizedDocumentUpdateAndEvent() public {
        vm.expectEmit(true, false, false, true, address(token));
        emit AssetDocumentUpdated(2, "sha256:demo-v1", "sha256:demo-v2");
        token.updateAssetDocument("sha256:demo-v2");
        require(token.documentVersion() == 2);
        require(keccak256(bytes(token.assetDocument())) == keccak256("sha256:demo-v2"));
    }

    function testUnauthorizedDocumentUpdateRejected() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ATTACKER)
        );
        vm.prank(ATTACKER);
        token.updateAssetDocument("tampered");
        require(token.documentVersion() == 1);
    }

    function testEmptyDocumentRejected() public {
        vm.expectRevert(CoffeeWarehouseToken.EmptyAssetDocument.selector);
        token.updateAssetDocument("");
        require(token.documentVersion() == 1);
    }

    function testEmptyInitialDocumentRejected() public {
        vm.expectRevert(CoffeeWarehouseToken.EmptyAssetDocument.selector);
        new CoffeeWarehouseToken(address(this), "");
    }

    function testZeroOwnerRejected() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new CoffeeWarehouseToken(address(0), "proof");
    }

    function testZeroMintRejected() public {
        vm.expectRevert(CoffeeWarehouseToken.ZeroAmount.selector);
        token.mint(ALICE, 0);
    }

    function testZeroBurnRejected() public {
        vm.expectRevert(CoffeeWarehouseToken.ZeroAmount.selector);
        vm.prank(ALICE);
        token.burn(0);
    }

    function testMintToZeroAddressRejectedAndAccountingRolledBack() public {
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        token.mint(address(0), 1_000);
        require(token.totalIssued() == 0 && token.totalSupply() == 0);
    }

    function testTransferToZeroAddressRejected() public {
        token.mint(ALICE, 1_000);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        vm.prank(ALICE);
        token.transfer(address(0), 1);
    }

    function testInsufficientBalanceTransferRejected() public {
        token.mint(ALICE, 1_000);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 1_000, 1_001
            )
        );
        vm.prank(ALICE);
        token.transfer(BOB, 1_001);
        require(token.balanceOf(ALICE) == 1_000 && token.balanceOf(BOB) == 0);
    }

    function testInsufficientBalanceBurnRejected() public {
        token.mint(ALICE, 1_000);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 1_000, 1_001
            )
        );
        vm.prank(ALICE);
        token.burn(1_001);
        require(token.totalSupply() == 1_000);
    }

    function testCannotBurnAnotherHoldersBalance() public {
        token.mint(ALICE, 1_000);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ATTACKER, 0, 1)
        );
        vm.prank(ATTACKER);
        token.burn(1);
        require(token.balanceOf(ALICE) == 1_000);
    }

    function testBatchLimitAndBurnDoesNotRestoreCapacity() public {
        uint256 cap = token.MAX_BATCH_ISSUANCE();
        token.mint(ALICE, cap);
        vm.prank(ALICE);
        token.burn(1_000);
        vm.expectRevert(
            abi.encodeWithSelector(CoffeeWarehouseToken.BatchIssuanceExceeded.selector, 1, 0)
        );
        token.mint(ALICE, 1);
        require(token.totalIssued() == cap && token.totalSupply() == cap - 1_000);
    }

    function testOverCapMintRejected() public {
        uint256 cap = token.MAX_BATCH_ISSUANCE();
        vm.expectRevert(
            abi.encodeWithSelector(
                CoffeeWarehouseToken.BatchIssuanceExceeded.selector, cap + 1, cap
            )
        );
        token.mint(ALICE, cap + 1);
        require(token.totalIssued() == 0);
    }

    function testApproveAndTransferFrom() public {
        token.mint(ALICE, 1_000);
        vm.prank(ALICE);
        token.approve(BOB, 250);
        vm.prank(BOB);
        token.transferFrom(ALICE, BOB, 200);
        require(token.balanceOf(ALICE) == 800 && token.balanceOf(BOB) == 200);
        require(token.allowance(ALICE, BOB) == 50 && token.totalSupply() == 1_000);
    }

    function testTransferFromWithoutAllowanceRejected() public {
        token.mint(ALICE, 1_000);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, ATTACKER, 0, 1)
        );
        vm.prank(ATTACKER);
        token.transferFrom(ALICE, ATTACKER, 1);
    }

    function testTwoStepOwnershipTransferMovesBothPermissions() public {
        token.transferOwnership(BOB);
        require(token.owner() == address(this) && token.pendingOwner() == BOB);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, BOB));
        vm.prank(BOB);
        token.mint(BOB, 1);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ATTACKER)
        );
        vm.prank(ATTACKER);
        token.acceptOwnership();
        vm.prank(BOB);
        token.acceptOwnership();
        require(token.owner() == BOB && token.pendingOwner() == address(0));
        vm.prank(BOB);
        token.mint(BOB, 1);
        vm.prank(BOB);
        token.updateAssetDocument("new-owner-proof");
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this))
        );
        token.mint(ALICE, 1);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this))
        );
        token.updateAssetDocument("old-owner-proof");
    }

    function testStandardZeroTransferAllowed() public {
        vm.prank(ALICE);
        require(token.transfer(BOB, 0));
    }

    function testFuzzSupplyAndBalanceConservation(
        uint96 rawMint,
        uint96 rawTransfer,
        uint96 rawBurn
    ) public {
        uint256 minted = uint256(rawMint) % token.MAX_BATCH_ISSUANCE() + 1;
        uint256 transferred = uint256(rawTransfer) % (minted + 1);
        uint256 burned = uint256(rawBurn) % (minted - transferred + 1);
        token.mint(ALICE, minted);
        vm.prank(ALICE);
        token.transfer(BOB, transferred);
        if (burned > 0) {
            vm.prank(ALICE);
            token.burn(burned);
        }
        require(token.totalSupply() == minted - burned);
        require(token.balanceOf(ALICE) == minted - transferred - burned);
        require(token.balanceOf(BOB) == transferred);
        require(token.totalSupply() == token.balanceOf(ALICE) + token.balanceOf(BOB));
        require(token.totalIssued() == minted);
    }
}
