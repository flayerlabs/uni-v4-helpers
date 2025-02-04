import { TickMath } from "@uniswap/v3-sdk";
import { encodeAbiParameters, Hex, hexToBigInt, pad } from "viem";

export const bytes32ToUint256 = (value: Hex) => {
  return hexToBigInt(value);
};

export const getSqrtPriceX96FromTick = (tick: number): bigint => {
  return BigInt(TickMath.getSqrtRatioAtTick(tick).toString());
};

export const uint256ToBytes32 = (value: bigint) => {
  return pad(
    encodeAbiParameters([{ type: "uint256", name: "value" }], [value]),
    { size: 32, dir: "right" }
  );
};
