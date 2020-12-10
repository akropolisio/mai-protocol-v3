// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/SafeCastUpgradeable.sol";

import "./interface/IShareToken.sol";

import "./module/AMMModule.sol";
import "./module/CoreModule.sol";
import "./module/CollateralModule.sol";

import "./Type.sol";
import "./Storage.sol";

contract AMM is Storage, ReentrancyGuardUpgradeable {
    using SafeCastUpgradeable for int256;
    using SignedSafeMathUpgradeable for int256;

    using AMMModule for Core;
    using CollateralModule for Core;
    using CoreModule for Core;

    function claimFee(int256 amount) external nonReentrant {
        _core.claimFee(msg.sender, amount);
    }

    function donateInsuranceFund(int256 amount) external payable nonReentrant {
        require(amount > 0, "amount is 0");
        _core.donateInsuranceFund(amount);
    }

    function addLiquidity(uint256 marketIndex, int256 cashToAdd)
        external
        payable
        syncState
        nonReentrant
    {
        require(cashToAdd > 0, "amount is invalid");
        _core.addLiquidity(marketIndex, cashToAdd);
    }

    function removeLiquidity(uint256 marketIndex, int256 shareToRemove)
        external
        syncState
        nonReentrant
    {
        require(shareToRemove > 0, "amount is invalid");
        _core.removeLiquidity(marketIndex, shareToRemove);
    }

    bytes[50] private __gap;
}
