// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Vault} from "../src/Vault.sol";
import {MockERC20} from "../src/MockERC20.sol";

/// @dev 跑：forge test -vvv
contract VaultTest is Test {
    Vault internal vault;
    MockERC20 internal usdc;
    MockERC20 internal wavax;
    MockERC20 internal junk; // 没上白名单的代币

    // 后端 signer：测试里用一个已知私钥，vm.sign 用它签，地址设成 Vault.signer
    uint256 internal constant SIGNER_PK = 0xA11CE;
    uint256 internal constant OTHER_PK = 0xB0B; // 冒充者
    address internal signerAddr;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    // 复制一份事件声明，给 vm.expectEmit 用
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 nonce);

    function setUp() public {
        vm.warp(1_700_000_000); // 给 block.timestamp 一个像样的值，方便算 deadline

        signerAddr = vm.addr(SIGNER_PK);
        vault = new Vault(signerAddr);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        wavax = new MockERC20("Wrapped AVAX", "WAVAX", 18);
        junk = new MockERC20("Junk", "JUNK", 18);

        vault.setAllowedToken(address(usdc), true);
        vault.setAllowedToken(address(wavax), true);

        usdc.mint(alice, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ---------- helpers ----------

    /// @dev 用 pk 对 Withdraw(user, token, amount, nonce, deadline) 签名，返回 65 字节 (r,s,v)
    function _sign(uint256 pk, address user, address token, uint256 amount, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = vault.hashWithdraw(user, token, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _depositAlice(uint256 amount) internal {
        vm.prank(alice);
        vault.deposit(address(usdc), amount);
    }

    // ---------- MockERC20 ----------

    function test_MockERC20_DecimalsAndMint() public {
        assertEq(usdc.decimals(), 6);
        assertEq(wavax.decimals(), 18);
        wavax.mint(bob, 5e18);
        assertEq(wavax.balanceOf(bob), 5e18);
    }

    // ---------- deposit ----------

    function test_Deposit_HappyPath_EmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(vault));
        emit Deposit(alice, address(usdc), 100e6);

        _depositAlice(100e6);

        assertEq(vault.balances(alice, address(usdc)), 100e6);
        assertEq(usdc.balanceOf(address(vault)), 100e6);
        assertEq(usdc.balanceOf(alice), 900e6);
    }

    function test_RevertWhen_Deposit_TokenNotAllowed() public {
        junk.mint(alice, 1e18);
        vm.startPrank(alice);
        junk.approve(address(vault), 1e18);
        vm.expectRevert("Vault: token not allowed");
        vault.deposit(address(junk), 1e18);
        vm.stopPrank();
    }

    function test_RevertWhen_Deposit_ZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert("Vault: amount is zero");
        vault.deposit(address(usdc), 0);
    }

    // ---------- withdraw ----------

    function test_Withdraw_HappyPath_EmitsEvent() public {
        _depositAlice(100e6);

        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(SIGNER_PK, alice, address(usdc), 40e6, nonce, deadline);

        vm.expectEmit(true, true, false, true, address(vault));
        emit Withdraw(alice, address(usdc), 40e6, nonce);

        vm.prank(alice);
        vault.withdraw(address(usdc), 40e6, nonce, deadline, sig);

        assertEq(usdc.balanceOf(alice), 940e6);
        assertEq(usdc.balanceOf(address(vault)), 60e6);
        assertEq(vault.balances(alice, address(usdc)), 60e6);
        assertTrue(vault.usedNonces(nonce));
    }

    function test_RevertWhen_Withdraw_ReplaySameNonce() public {
        _depositAlice(100e6);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(SIGNER_PK, alice, address(usdc), 10e6, 7, deadline);

        vm.startPrank(alice);
        vault.withdraw(address(usdc), 10e6, 7, deadline, sig);
        vm.expectRevert("Vault: nonce used");
        vault.withdraw(address(usdc), 10e6, 7, deadline, sig);
        vm.stopPrank();
    }

    function test_RevertWhen_Withdraw_Expired() public {
        _depositAlice(100e6);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(SIGNER_PK, alice, address(usdc), 10e6, 1, deadline);

        vm.warp(deadline + 1);

        vm.prank(alice);
        vm.expectRevert("Vault: expired");
        vault.withdraw(address(usdc), 10e6, 1, deadline, sig);
    }

    function test_RevertWhen_Withdraw_WrongSigner() public {
        _depositAlice(100e6);
        uint256 deadline = block.timestamp + 1 hours;
        // 用冒充者的私钥签
        bytes memory sig = _sign(OTHER_PK, alice, address(usdc), 10e6, 1, deadline);

        vm.prank(alice);
        vm.expectRevert("Vault: bad signature");
        vault.withdraw(address(usdc), 10e6, 1, deadline, sig);
    }

    function test_RevertWhen_Withdraw_CallerIsNotUser() public {
        _depositAlice(100e6);
        uint256 deadline = block.timestamp + 1 hours;
        // signer 合法地给 alice 签了授权，但 bob 拿去用
        bytes memory sig = _sign(SIGNER_PK, alice, address(usdc), 10e6, 1, deadline);

        vm.prank(bob);
        vm.expectRevert("Vault: bad signature");
        vault.withdraw(address(usdc), 10e6, 1, deadline, sig);
    }

    /// @dev 课上要讲的点：链上 balances 不限制提现。signer 签多少就能取多少（只要金库里有币）。
    function test_Withdraw_NotBoundByOnchainBalances_ClampsToZero() public {
        _depositAlice(100e6);
        // bob 也充 100，金库里总共 200
        usdc.mint(bob, 100e6);
        vm.startPrank(bob);
        usdc.approve(address(vault), 100e6);
        vault.deposit(address(usdc), 100e6);
        vm.stopPrank();

        // signer 给 alice 签了 150（假设她链下赚了）
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(SIGNER_PK, alice, address(usdc), 150e6, 1, deadline);

        vm.prank(alice);
        vault.withdraw(address(usdc), 150e6, 1, deadline, sig);

        assertEq(usdc.balanceOf(alice), 1_050e6);
        assertEq(vault.balances(alice, address(usdc)), 0); // 归零而不是 revert
    }

    // ---------- admin ----------

    function test_RevertWhen_SetSigner_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setSigner(alice);
    }

    function test_SetSigner_RotatesKey() public {
        address newSigner = vm.addr(OTHER_PK);
        vault.setSigner(newSigner);
        assertEq(vault.signer(), newSigner);

        _depositAlice(100e6);
        uint256 deadline = block.timestamp + 1 hours;
        // 旧 signer 签的现在失效，新 signer 签的有效
        bytes memory oldSig = _sign(SIGNER_PK, alice, address(usdc), 1e6, 1, deadline);
        bytes memory newSig = _sign(OTHER_PK, alice, address(usdc), 1e6, 2, deadline);

        vm.startPrank(alice);
        vm.expectRevert("Vault: bad signature");
        vault.withdraw(address(usdc), 1e6, 1, deadline, oldSig);
        vault.withdraw(address(usdc), 1e6, 2, deadline, newSig);
        vm.stopPrank();
    }

    // ---------- EIP-712 兼容性 ----------

    /// @dev 手工按 EIP-712 规范拼 digest，和 hashWithdraw 对比。
    ///      后端（viem hashTypedData / signTypedData）算出来的必须和这个一致。
    function test_HashWithdraw_MatchesManualEip712() public view {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MiniDexVault"),
                keccak256("1"),
                block.chainid,
                address(vault)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(vault.WITHDRAW_TYPEHASH(), alice, address(usdc), uint256(123), uint256(9), uint256(1_800_000_000))
        );
        bytes32 expected = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        assertEq(vault.hashWithdraw(alice, address(usdc), 123, 9, 1_800_000_000), expected);
    }
}
