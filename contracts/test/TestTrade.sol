// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "../module/MarginAccountModule.sol";
import "../module/PerpetualModule.sol";
import "../module/TradeModule.sol";
import "../module/OrderModule.sol";

import "../libraries/OrderData.sol";

import "../Type.sol";

import "./TestLiquidityPool.sol";

contract TestTrade is TestLiquidityPool {
    using OrderData for bytes;
    using PerpetualModule for PerpetualStorage;
    using MarginAccountModule for PerpetualStorage;
    using TradeModule for LiquidityPoolStorage;
    using TradeModule for PerpetualStorage;
    using OrderModule for LiquidityPoolStorage;

    function setVault(address vault, int256 vaultFeeRate) public {
        _liquidityPool.vault = vault;
        _liquidityPool.vaultFeeRate = vaultFeeRate;
    }

    function trade(
        uint256 perpetualIndex,
        address trader,
        int256 amount,
        int256 limitPrice,
        address referrer,
        uint32 flags
    ) public syncState {
        _liquidityPool.trade(perpetualIndex, trader, amount, limitPrice, referrer, flags);
    }

    function brokerTrade(bytes memory orderData, int256 amount) public syncState returns (int256) {
        Order memory order = orderData.decodeOrderData();
        bytes memory signature = orderData.decodeSignature();
        _liquidityPool.validateSignature(order, signature);
        _liquidityPool.validateOrder(order, amount);
        _liquidityPool.validateTriggerPrice(order);
        return
            _liquidityPool.trade(
                order.perpetualIndex,
                order.trader,
                amount,
                order.limitPrice,
                order.referrer,
                order.flags
            );
    }

    function getFees(
        uint256 perpetualIndex,
        address trader,
        address referrer,
        int256 tradeValue,
        bool hasOpened
    )
        public
        view
        returns (
            int256 lpFee,
            int256 operatorFee,
            int256 vaultFee,
            int256 referralRebate
        )
    {
        PerpetualStorage storage perpetual = _liquidityPool.perpetuals[perpetualIndex];
        (lpFee, operatorFee, vaultFee, referralRebate) = _liquidityPool.getFees(
            perpetual,
            trader,
            referrer,
            tradeValue,
            hasOpened
        );
    }

    function postTrade(
        uint256 perpetualIndex,
        address trader,
        address referrer,
        int256 deltaCash,
        int256 deltaPosition
    ) public returns (int256 totalFee) {
        PerpetualStorage storage perpetual = _liquidityPool.perpetuals[perpetualIndex];
        totalFee = _liquidityPool.postTrade(perpetual, trader, referrer, deltaCash, deltaPosition);
    }

    function validatePrice(
        bool isLong,
        int256 price,
        int256 limitPrice
    ) public pure {
        TradeModule.validatePrice(isLong, price, limitPrice);
    }

    function getClaimableFee(address claimer) public view returns (int256) {
        return _liquidityPool.claimableFees[claimer];
    }

    function hasOpenedPosition(int256 amount, int256 delta) public pure returns (bool hasOpened) {
        hasOpened = TradeModule.hasOpenedPosition(amount, delta);
    }

    function getMargin(uint256 perpetualIndex, address trader) public view returns (int256) {
        PerpetualStorage storage perpetual = _liquidityPool.perpetuals[perpetualIndex];
        return perpetual.getMargin(trader, perpetual.getMarkPrice());
    }

    function liquidateByAMM(
        uint256 perpetualIndex,
        address liquidator,
        address trader
    ) public returns (int256 deltaPosition) {
        deltaPosition = _liquidityPool.liquidateByAMM(perpetualIndex, liquidator, trader);
    }
}
