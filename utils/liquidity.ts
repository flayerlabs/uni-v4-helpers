import { getSqrtPriceX96FromTick } from "./ticks";

const getAmount0ForLiquidity = (
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
) => {
  let [sqrtRatioA, sqrtRatioB] = [sqrtRatioAX96, sqrtRatioBX96];

  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }

  const leftShiftedLiquidity = liquidity << 96n;
  const sqrtDiff = sqrtRatioB - sqrtRatioA;
  const multipliedRes = leftShiftedLiquidity * sqrtDiff;
  const numerator = multipliedRes / sqrtRatioB;
  const amount0 = numerator / sqrtRatioA;

  return amount0;
};

const getAmount1ForLiquidity = (
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
) => {
  let [sqrtRatioA, sqrtRatioB] = [sqrtRatioAX96, sqrtRatioBX96];

  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }

  const sqrtDiff = sqrtRatioB - sqrtRatioA;
  const multipliedRes = liquidity * sqrtDiff;

  const amount1 = multipliedRes / 2n ** 96n;

  return amount1;
};

export const calculateUnderlyingTokenBalances = (
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number
): { amount0: bigint; amount1: bigint } => {
  const sqrtPriceCurrentX96 = getSqrtPriceX96FromTick(tickCurrent);
  const sqrtPriceLowerX96 = getSqrtPriceX96FromTick(tickLower);
  const sqrtPriceUpperX96 = getSqrtPriceX96FromTick(tickUpper);

  let amount0 = 0n;
  let amount1 = 0n;

  if (sqrtPriceCurrentX96 <= sqrtPriceLowerX96) {
    // Current price is below the position range
    amount0 = getAmount0ForLiquidity(
      sqrtPriceLowerX96,
      sqrtPriceUpperX96,
      liquidity
    );
  } else if (sqrtPriceCurrentX96 < sqrtPriceUpperX96) {
    // Current price is within the position range
    amount0 = getAmount0ForLiquidity(
      sqrtPriceCurrentX96,
      sqrtPriceUpperX96,
      liquidity
    );
    amount1 = getAmount1ForLiquidity(
      sqrtPriceLowerX96,
      sqrtPriceCurrentX96,
      liquidity
    );
  } else {
    // Current price is above the position range
    amount1 = getAmount1ForLiquidity(
      sqrtPriceLowerX96,
      sqrtPriceUpperX96,
      liquidity
    );
  }

  return { amount0, amount1 };
};
