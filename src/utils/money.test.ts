import { expect, it } from "vitest";
import { formatThousands } from "./money";

it("shows thousands with at most one decimal, truncated so a total never looks bigger than it is", () => {
  expect(formatThousands(26_000)).toBe("26k");
  expect(formatThousands(25_500)).toBe("25,5k");
  expect(formatThousands(4_199)).toBe("4,1k");
  expect(formatThousands(0)).toBe("0k");
});
