// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.4;

library Math {
    uint256 private constant _POSITIVE_INT256_MAX = 2**255 - 1;

    /**
     * @dev Convert uint256 to int256 safely
     * @param x The uint256 input
     * @return int256 The int256 output
     */
    function toInt256(uint256 x) internal pure returns (int256) {
        require(x <= _POSITIVE_INT256_MAX, "uint256 overflow");
        return int256(x);
    }

    /**
     * @dev Get the most significant bit of the number,
            example: 0 ~ 1 => 0, 2 ~ 3 => 1, 4 ~ 7 => 2, 8 ~ 15 => 3,
            about use 606 ~ 672 gas
     * @param x The number
     * @return uint8 The significant bit of the number
     */
    function mostSignificantBit(uint256 x) internal pure returns (uint8) {
        uint256 t;
        uint8 r;
        if ((t = (x >> 128)) > 0) {
            x = t;
            r += 128;
        }
        if ((t = (x >> 64)) > 0) {
            x = t;
            r += 64;
        }
        if ((t = (x >> 32)) > 0) {
            x = t;
            r += 32;
        }
        if ((t = (x >> 16)) > 0) {
            x = t;
            r += 16;
        }
        if ((t = (x >> 8)) > 0) {
            x = t;
            r += 8;
        }
        if ((t = (x >> 4)) > 0) {
            x = t;
            r += 4;
        }
        if ((t = (x >> 2)) > 0) {
            x = t;
            r += 2;
        }
        if ((t = (x >> 1)) > 0) {
            x = t;
            r += 1;
        }
        return r;
    }

    // https://en.wikipedia.org/wiki/Integer_square_root
    /**
     * @dev Get the square root of the number
     * @param x The number, usually 10^36
     * @return int256 The square root of the number, usually 10^18
     */
    function sqrt(int256 x) internal pure returns (int256) {
        require(x >= 0, "negative sqrt");
        if (x < 3) {
            return (x + 1) / 2;
        }

        // binary estimate
        // https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Binary_estimates
        int256 next;
        {
            uint8 n = mostSignificantBit(uint256(x));
            n = (n + 1) / 2;
            next = int256((1 << (n - 1)) + (uint256(x) >> (n + 1)));
        }

        // modified babylonian method
        // https://github.com/Uniswap/uniswap-v2-core/blob/v1.0.1/contracts/libraries/Math.sol#L11
        int256 y = x;
        while (next < y) {
            y = next;
            next = (next + x / next) >> 1;
        }
        return y;
    }
}
