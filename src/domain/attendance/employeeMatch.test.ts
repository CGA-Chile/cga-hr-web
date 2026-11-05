import { describe, expect, it } from "vitest";
import { matchEmployees, type AppEmployee, type WorkeraPerson } from "./employeeMatch";

const employee = (id: string, firstName: string, lastName: string, nationalId: string | null = null): AppEmployee => ({
  id,
  firstName,
  lastName,
  nationalId,
});
const person = (nationalId: string, fullName: string, active = true): WorkeraPerson => ({ nationalId, fullName, active });

describe("matchEmployees", () => {
  it("matches by RUT whatever the spelling", () => {
    const result = matchEmployees([employee("a", "Ana", "Rojas", "12.345.678-k")], [person("12345678-K", "OTRA PERSONA")]);

    expect(result.matchedCount).toBe(1);
    expect(result.proposals).toEqual([]);
    expect(result.onlyInWorkera).toEqual([]);
  });

  it("only proposes a name match, never applies it", () => {
    const result = matchEmployees([employee("a", "José", "Pérez")], [person("11111111-1", "JOSE LUIS PEREZ SOTO")]);

    expect(result.matchedCount).toBe(0);
    expect(result.proposals.map((proposal) => proposal.person.nationalId)).toEqual(["11111111-1"]);
  });

  it("proposes nothing when two people fit the same name", () => {
    const result = matchEmployees(
      [employee("a", "Ana", "Rojas")],
      [person("11111111-1", "ANA MARIA ROJAS"), person("22222222-2", "ANA ROJAS DIAZ")],
    );

    expect(result.proposals).toEqual([]);
    expect(result.unmatched.map((row) => row.id)).toEqual(["a"]);
  });

  it("does not propose someone already matched by RUT", () => {
    const result = matchEmployees(
      [employee("a", "Ana", "Rojas", "11111111-1"), employee("b", "Ana", "Rojas")],
      [person("11111111-1", "ANA ROJAS")],
    );

    expect(result.proposals).toEqual([]);
    expect(result.unmatched.map((row) => row.id)).toEqual(["b"]);
  });

  it("does not match on a single shared word", () => {
    const result = matchEmployees([employee("a", "Ana", "")], [person("11111111-1", "ANA ROJAS")]);

    expect(result.proposals).toEqual([]);
  });

  it("lists who is active only in Workera, and leaves out the inactive", () => {
    const result = matchEmployees([], [person("11111111-1", "ANA ROJAS"), person("22222222-2", "LUIS SOTO", false)]);

    expect(result.onlyInWorkera.map((row) => row.nationalId)).toEqual(["11111111-1"]);
  });
});
