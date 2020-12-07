// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./libraries/Error.sol";
import "./libraries/OrderData.sol";
import "./libraries/SafeMathExt.sol";
import "./libraries/Utils.sol";

import "./interface/IFactory.sol";
import "./interface/IShareToken.sol";

import "./Type.sol";
import "./Storage.sol";
import "./module/AMMModule.sol";
import "./module/MarginModule.sol";
import "./module/TradeModule.sol";
import "./module/SettlementModule.sol";
import "./module/OrderModule.sol";
import "./module/FeeModule.sol";
import "./module/CollateralModule.sol";

import "./Events.sol";
import "./AccessControl.sol";

contract Settlement is Storage, AccessControl, ReentrancyGuard {
    using SafeCast for int256;
    using SafeCast for uint256;
    using SafeMath for uint256;
    using SafeMathExt for int256;
    using SafeMathExt for uint256;
    using SafeMathExt for uint256;
    using SignedSafeMath for int256;
    using Address for address;

    using OrderData for Order;
    using OrderModule for Core;

    using AMMModule for Core;
    using TradeModule for Core;
    using FeeModule for Core;
    using MarginModule for Market;
    using CollateralModule for Core;
    using SettlementModule for Market;
    using EnumerableSet for EnumerableSet.AddressSet;

    function unclearedTraderCount(bytes32 marketID) public view returns (uint256) {
        return _core.markets[marketID].registeredTraders.length();
    }

    function listUnclearedTraders(
        bytes32 marketID,
        uint256 start,
        uint256 count
    ) public view returns (address[] memory result) {
        Market storage market = _core.markets[marketID];
        uint256 total = market.registeredTraders.length();
        if (start >= total) {
            return result;
        }
        uint256 stop = start.add(count).min(total);
        result = new address[](stop.sub(start));
        for (uint256 i = start; i < stop; i++) {
            result[i.sub(start)] = market.registeredTraders.at(i);
        }
    }

    function clearMarginAccount(bytes32 marketID, address trader)
        public
        onlyWhen(marketID, MarketState.EMERGENCY)
        nonReentrant
    {
        require(trader != address(0), Error.INVALID_TRADER_ADDRESS);
        Market storage market = _core.markets[marketID];
        market.clearMarginAccount(trader);
        if (market.keeperGasReward > 0) {
            _core.transferToUser(msg.sender, market.keeperGasReward);
        }
        if (unclearedTraderCount(marketID) == 0) {
            market.updateWithdrawableMargin(0);
            _enterClearedState(marketID);
        }
        emit Clear(trader);
    }

    function settle(bytes32 marketID, address trader)
        public
        auth(trader, PRIVILEGE_WITHDRAW)
        onlyWhen(marketID, MarketState.CLEARED)
        nonReentrant
    {
        require(trader != address(0), Error.INVALID_TRADER_ADDRESS);
        Market storage market = _core.markets[marketID];
        int256 withdrawable = market.settledMarginAccount(trader);
        market.updateCashBalance(trader, withdrawable.neg());
        _core.transferToUser(payable(trader), withdrawable);
        emit Withdraw(trader, withdrawable);
    }
}
