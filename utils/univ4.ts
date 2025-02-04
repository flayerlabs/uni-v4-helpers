export const TICK_SPACING = 60;

export const getValidTick = ({
  tick,
  roundDown,
}: {
  tick: number;
  roundDown: boolean;
}) => {
  // If the tick is already valid, exit early
  if (tick % TICK_SPACING === 0) {
    return tick;
  }

  // Division that rounds towards zero (like Solidity)
  let validTick = Math.trunc(tick / TICK_SPACING) * TICK_SPACING;

  // Handle negative ticks (Solidity behavior)
  if (tick < 0 && tick % TICK_SPACING !== 0) {
    validTick -= TICK_SPACING;
  }

  // If not rounding down, add TICK_SPACING to get the upper tick
  if (!roundDown) {
    validTick += TICK_SPACING;
  }

  return validTick;
};
