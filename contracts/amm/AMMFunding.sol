// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../Type.sol";
import "../libraries/Constant.sol";
import "../libraries/Math.sol";
import "../libraries/SafeMathExt.sol";
import "../libraries/Utils.sol";

import "./AMMCommon.sol";

library AMMFunding {
    using Math for int256;
    using Math for uint256;
    using SafeMathExt for int256;
    using SignedSafeMath for int256;
    using SafeMath for uint256;

    int256 constant FUNDING_INTERVAL = 3600 * 8;

    function updateFundingState(
        FundingState storage fundingState,
        uint256 checkTimestamp
    ) internal {
        if (checkTimestamp > fundingState.fundingTime) {
            int256 deltaUnitAccFundingLoss = deltaFundingLoss(
                fundingState.fundingRate,
                fundingState.indexPrice,
                fundingState.fundingTime,
                checkTimestamp
            );
            fundingState.unitAccFundingLoss = fundingState.unitAccFundingLoss.add(deltaUnitAccFundingLoss);
            fundingState.fundingTime = checkTimestamp;
        }
    }

    function updateFundingRate(
        FundingState storage fundingState,
        RiskParameter storage riskParameter,
        MarginAccount storage ammAccount,
        int256 indexPrice
    ) internal {
        int256 newFundingRate = fundingRate(
            fundingState,
            riskParameter,
            ammAccount,
            indexPrice
        );
        fundingState.fundingRate = newFundingRate;
        fundingState.indexPrice = indexPrice;
    }

    function deltaFundingLoss(
        int256 fundingRate,
        int256 indexPrice,
        uint256 beginTimestamp,
        uint256 endTimestamp
    ) internal pure returns (int256 deltaUnitAccumulatedFundingLoss) {
        require(
            endTimestamp > beginTimestamp,
            "time steps (n) must be positive"
        );
        int256 timeElapsed = int256(endTimestamp.sub(beginTimestamp));
        deltaUnitAccumulatedFundingLoss = indexPrice.wfrac(
            fundingRate.wmul(timeElapsed),
            FUNDING_INTERVAL
        );
    }

    function fundingRate(
        FundingState storage fundingState,
        RiskParameter storage riskParameter,
        MarginAccount storage ammAccount,
        int256 indexPrice
    ) internal view returns (int256 newFundingRate) {
        if (ammAccount.positionAmount == 0) {
            newFundingRate = 0;
        } else {
            int256 mc = AMMCommon.availableCashBalance(
                ammAccount,
                fundingState.unitAccFundingLoss
            );
            require(
                AMMCommon.isAMMMarginSafe(
                    mc,
                    ammAccount.positionAmount,
                    indexPrice,
                    riskParameter.targetLeverage.value,
                    riskParameter.beta1.value
                ),
                "amm unsafe"
            );
            (int256 mv, int256 m0) = AMMCommon.regress(
                mc,
                ammAccount.positionAmount,
                indexPrice,
                riskParameter.targetLeverage.value,
                riskParameter.beta1.value
            );
            if (ammAccount.positionAmount > 0) {
                newFundingRate = mc.add(mv).wdiv(m0).sub(Constant.SIGNED_ONE);
            } else {
                newFundingRate = indexPrice.neg().wfrac(
                    ammAccount.positionAmount,
                    m0
                );
            }
            newFundingRate = newFundingRate.wmul(
                riskParameter.fundingRateCoefficient.value
            );
        }
    }
}
