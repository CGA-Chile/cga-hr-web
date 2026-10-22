import { expect, it } from "vitest";
import { formatAmount, formatThousands } from "./money";

it("shows an exact amount with the thousands grouped and no sign", () => {
  expect(formatAmount(2_142)).toBe("2.142");
  expect(formatAmount(25_000)).toBe("25.000");
  expect(formatAmount(0)).toBe("0");
});

it("shows thousands with at most one decimal, truncated so a total never looks bigger than it is", () => {
  expect(formatThousands(26_000)).toBe("26k");
  expect(formatThousands(25_500)).toBe("25,5k");
  expect(formatThousands(4_199)).toBe("4,1k");
  expect(formatThousands(0)).toBe("0k");
});
