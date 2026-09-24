import { beforeAll, describe, expect, it } from "vitest";
import { service, unwrap } from "./support";

type CataloguePosition = {
  id: string;
  code: string;
  type: string;
  bonus_eligible: boolean;
  triggers_equal_share: boolean;
  display_order: number;
};

const LINE = ["RIETER", "ACM", "ENCAJADOR_ACM", "ALIMENTADOR_RIETER", "PACKING_ACM"];
const RATE_BEARING = ["RIETER", "ACM", "ENCAJADOR_ACM", "ALIMENTADOR_RIETER"];
const OTHER_WORK = [
  "ABSORBENTE",
  "ASEO",
  "BODEGA",
  "CARDA_COIL",
  "CARDA_VIEJA",
  "COPOS",
  "ENCAJADOR_FALUS",
  "FALU_A1_MAXI",
  "FALU_A2_MAXI",
  "FALU_N1",
  "FALU_N2",
  "MANTENCION",
  "PACKING",
  "PRENSADO",
  "SUPERVISOR",
];
const ABSENCE = ["LICENCIA", "FALTA"];

let catalogue: CataloguePosition[];

beforeAll(async () => {
  catalogue = unwrap(
    await service
      .from("positions")
      .select("id, code, type, bonus_eligible, triggers_equal_share, display_order")
      .not("code", "like", "TEST_%")
      .is("deleted_at", null)
      .order("display_order"),
  );
});

function byCode(code: string): CataloguePosition {
  const position = catalogue.find((candidate) => candidate.code === code);
  if (!position) throw new Error(`Position ${code} is missing from the catalogue`);
  return position;
}

describe("the position catalogue from docs/DOMAIN.md §11", () => {
  it("holds exactly the listed positions, and none of the discarded ones", () => {
    expect(catalogue.map((position) => position.code).sort()).toEqual(
      [...LINE, ...OTHER_WORK, ...ABSENCE].sort(),
    );
  });

  it("marks the five line positions, and only them, as bonus-eligible", () => {
    const eligible = catalogue.filter((position) => position.bonus_eligible).map((p) => p.code);

    expect(eligible.sort()).toEqual([...LINE].sort());
  });

  it("has exactly one scheme trigger, Packing ACM, and it is bonus-eligible", () => {
    const triggers = catalogue.filter((position) => position.triggers_equal_share);

    expect(triggers.map((position) => position.code)).toEqual(["PACKING_ACM"]);
    expect(triggers[0].bonus_eligible).toBe(true);
  });

  it("types Licencia and Falta as absences and everything else as work", () => {
    for (const position of catalogue) {
      expect([position.code, position.type]).toEqual([
        position.code,
        ABSENCE.includes(position.code) ? "ABSENCE" : "WORK",
      ]);
    }
  });

  it("puts the five line positions at the top of the picker", () => {
    expect(catalogue.slice(0, LINE.length).map((position) => position.code)).toEqual(LINE);
  });

  it("keeps Packing and Packing ACM apart, since confusing them changes the whole line's bonus", () => {
    const codesInOrder = catalogue.map((position) => position.code);
    const distance = Math.abs(codesInOrder.indexOf("PACKING") - codesInOrder.indexOf("PACKING_ACM"));

    expect(distance).toBeGreaterThan(1);
  });
});

describe("the example seed", () => {
  it("provides a settings version with a rate for each rate-bearing position and none for the trigger", async () => {
    const settings = unwrap(
      await service
        .from("bonus_settings")
        .select("id, daily_cap, bonus_position_rates(position_id, amount)")
        .is("effective_to", null)
        .is("deleted_at", null)
        .single(),
    );
    const ratedPositionIds = settings.bonus_position_rates.map((rate) => rate.position_id);

    expect(ratedPositionIds.sort()).toEqual(RATE_BEARING.map((code) => byCode(code).id).sort());
    expect(ratedPositionIds).not.toContain(byCode("PACKING_ACM").id);
  });

  it("provides employees to work with", async () => {
    const employees = unwrap(await service.from("employees").select("id").is("deleted_at", null));

    expect(employees.length).toBeGreaterThan(0);
  });
});
