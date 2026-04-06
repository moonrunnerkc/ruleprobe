/**
 * File with line length violations.
 */

/** Short line. */
export function shortFunction(): string {
  return "ok";
}

/** This function has a line that is deliberately too long so we can test the max-line-length regex verifier against it and make sure it catches violations correctly in real file scanning scenarios. */
export function functionWithLongJsdoc(): string {
  const shortVar = "fine";
  const thisIsAnExtremelyLongVariableNameThatExceedsOneHundredCharactersWhenCombinedWithTheAssignmentAndTheValueOnTheRightSide = "way too long line here for sure";
  return shortVar + thisIsAnExtremelyLongVariableNameThatExceedsOneHundredCharactersWhenCombinedWithTheAssignmentAndTheValueOnTheRightSide;
}
