interface CustomMatchers {
  toBeNonNaNNumber(): void;
}

declare namespace jest {
  interface Expect extends CustomMatchers {}
  interface Matchers extends CustomMatchers {}
}
