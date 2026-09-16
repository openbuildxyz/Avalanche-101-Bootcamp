// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CarbonCreditToken} from "../src/CarbonCreditToken.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

interface Vm {
    function prank(address msgSender) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
}

contract CarbonCreditTokenTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    CarbonCreditToken private token;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant ISSUER = address(0x1550E2);
    string private constant INITIAL_DOCUMENT = "ipfs://QmInitialCarbonReport";
    uint256 private constant ONE_TOKEN = 1 ether;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event AssetDocumentUpdated(string previousDocument, string newDocument, address indexed updatedBy);

    function setUp() public {
        token = new CarbonCreditToken(INITIAL_DOCUMENT);
    }

    // Task 5: contract deploys successfully.
    function testDeploymentSucceeds() public view {
        _assertTrue(address(token).code.length > 0, "contract has no code");
        _assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), address(this)), "wrong admin");
    }

    // Task 5: initial token information is correct.
    function testInitialTokenInformation() public view {
        _assertEq(token.name(), "Verified Carbon Credit", "wrong name");
        _assertEq(token.symbol(), "VCC", "wrong symbol");
        _assertEq(uint256(token.decimals()), 18, "wrong decimals");
        _assertEq(token.totalSupply(), 0, "supply should start at zero");
        _assertEq(token.assetDocument(), INITIAL_DOCUMENT, "wrong document");
        _assertTrue(token.isMinter(address(this)), "deployer is not minter");
        _assertTrue(token.isAssetDocumentUpdater(address(this)), "deployer cannot update document");
    }

    // Task 5: an authorized account can mint and the Transfer event is emitted.
    function testAuthorizedAccountCanMint() public {
        token.setMinter(ISSUER, true);

        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), ALICE, 10 * ONE_TOKEN);
        vm.prank(ISSUER);
        token.mint(ALICE, 10 * ONE_TOKEN);

        _assertEq(token.balanceOf(ALICE), 10 * ONE_TOKEN, "mint balance mismatch");
        _assertEq(token.totalSupply(), 10 * ONE_TOKEN, "mint supply mismatch");
    }

    // Task 5: a non-authorized account cannot mint.
    function testNonAuthorizedAccountCannotMint() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                ALICE,
                token.MINTER_ROLE()
            )
        );
        vm.prank(ALICE);
        token.mint(ALICE, ONE_TOKEN);
    }

    // Task 5: a holder can transfer; balances change while supply remains constant.
    function testHolderCanTransferAndAccountingIsCorrect() public {
        token.mint(ALICE, 10 * ONE_TOKEN);

        vm.prank(ALICE);
        token.transfer(BOB, 4 * ONE_TOKEN);

        _assertEq(token.balanceOf(ALICE), 6 * ONE_TOKEN, "sender balance mismatch");
        _assertEq(token.balanceOf(BOB), 4 * ONE_TOKEN, "recipient balance mismatch");
        _assertEq(token.totalSupply(), 10 * ONE_TOKEN, "transfer changed supply");
    }

    // Extra ERC-20 coverage: approve + transferFrom.
    function testAllowanceAndTransferFrom() public {
        token.mint(ALICE, 5 * ONE_TOKEN);
        vm.prank(ALICE);
        token.approve(BOB, 2 * ONE_TOKEN);

        vm.prank(BOB);
        token.transferFrom(ALICE, BOB, 2 * ONE_TOKEN);

        _assertEq(token.allowance(ALICE, BOB), 0, "allowance mismatch");
        _assertEq(token.balanceOf(ALICE), 3 * ONE_TOKEN, "owner balance mismatch");
        _assertEq(token.balanceOf(BOB), 2 * ONE_TOKEN, "spender balance mismatch");
    }

    // Task 5: tokens can be burned; both holder balance and supply decrease.
    function testTokenCanBeBurnedAndAccountingIsCorrect() public {
        token.mint(ALICE, 8 * ONE_TOKEN);

        vm.expectEmit(true, true, false, true);
        emit Transfer(ALICE, address(0), 3 * ONE_TOKEN);
        vm.prank(ALICE);
        token.burn(3 * ONE_TOKEN);

        _assertEq(token.balanceOf(ALICE), 5 * ONE_TOKEN, "burn balance mismatch");
        _assertEq(token.totalSupply(), 5 * ONE_TOKEN, "burn supply mismatch");
    }

    function testAuthorizedAccountCanUpdateAssetDocument() public {
        string memory newDocument = "ipfs://QmUpdatedCarbonReport";
        token.setAssetDocumentUpdater(ISSUER, true);

        vm.expectEmit(true, false, false, true);
        emit AssetDocumentUpdated(INITIAL_DOCUMENT, newDocument, ISSUER);
        vm.prank(ISSUER);
        token.updateAssetDocument(newDocument);

        _assertEq(token.assetDocument(), newDocument, "document not updated");
    }

    function testAdminCanRevokeOperationalRoles() public {
        token.setMinter(ISSUER, true);
        token.setAssetDocumentUpdater(ISSUER, true);
        token.setMinter(ISSUER, false);
        token.setAssetDocumentUpdater(ISSUER, false);

        _assertTrue(!token.isMinter(ISSUER), "minter role not revoked");
        _assertTrue(
            !token.isAssetDocumentUpdater(ISSUER),
            "document role not revoked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                ISSUER,
                token.MINTER_ROLE()
            )
        );
        vm.prank(ISSUER);
        token.mint(ALICE, ONE_TOKEN);
    }

    // Task 5: a non-authorized account cannot update proof information.
    function testNonAuthorizedAccountCannotUpdateAssetDocument() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                ALICE,
                token.ASSET_DOCUMENT_ROLE()
            )
        );
        vm.prank(ALICE);
        token.updateAssetDocument("ipfs://malicious");
    }

    // Task 5: erroneous operations are rejected.
    function testCannotTransferMoreThanBalance() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                ALICE,
                0,
                ONE_TOKEN
            )
        );
        vm.prank(ALICE);
        token.transfer(BOB, ONE_TOKEN);
    }

    function testCannotBurnMoreThanBalance() public {
        token.mint(ALICE, ONE_TOKEN);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                ALICE,
                ONE_TOKEN,
                2 * ONE_TOKEN
            )
        );
        vm.prank(ALICE);
        token.burn(2 * ONE_TOKEN);
    }

    function testCannotTransferToZeroAddress() public {
        token.mint(ALICE, ONE_TOKEN);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        vm.prank(ALICE);
        token.transfer(address(0), ONE_TOKEN);
    }

    function testCannotSetEmptyAssetDocument() public {
        vm.expectRevert(CarbonCreditToken.EmptyAssetDocument.selector);
        token.updateAssetDocument("");
    }

    function testOnlyAdminCanManageAuthorization() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                ALICE,
                token.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(ALICE);
        token.setMinter(ALICE, true);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                ALICE,
                token.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(ALICE);
        token.setAssetDocumentUpdater(ALICE, true);
    }

    function _assertTrue(bool value, string memory message) private pure {
        require(value, message);
    }

    function _assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function _assertEq(address actual, address expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function _assertEq(string memory actual, string memory expected, string memory message) private pure {
        require(keccak256(bytes(actual)) == keccak256(bytes(expected)), message);
    }
}
