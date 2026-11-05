import { normalizeRut } from "@/utils/rut";

export type AppEmployee = { id: string; firstName: string; lastName: string; nationalId: string | null };
export type WorkeraPerson = { nationalId: string; fullName: string; active: boolean };

/** One app employee with no RUT in common with Workera, and the one person whose name fits. */
export type MatchProposal = { employee: AppEmployee; person: WorkeraPerson };

export type EmployeeMatching = {
  matchedCount: number;
  proposals: MatchProposal[];
  /** App employees nobody in Workera fits: no RUT in common, and no name or more than one. */
  unmatched: AppEmployee[];
  /** Active in Workera and in no app employee, matched or proposed. */
  onlyInWorkera: WorkeraPerson[];
};

/**
 * Pairs the app's employees with Workera's people. A shared RUT is a match. Without one, a name is
 * only a proposal for an admin to confirm: a wrong pair would credit one person's attendance to
 * another. A name fits when it holds the employee's first and last name, ignoring accents and case.
 */
export function matchEmployees(employees: readonly AppEmployee[], people: readonly WorkeraPerson[]): EmployeeMatching {
  const byRut = new Map(people.map((person) => [normalizeRut(person.nationalId), person]));
  const paired = new Set<string>();
  let matchedCount = 0;
  const unpaired: AppEmployee[] = [];

  for (const employee of employees) {
    const person = employee.nationalId ? byRut.get(normalizeRut(employee.nationalId)) : undefined;
    if (person) {
      matchedCount++;
      paired.add(person.nationalId);
    } else {
      unpaired.push(employee);
    }
  }

  const proposals: MatchProposal[] = [];
  const unmatched: AppEmployee[] = [];
  for (const employee of unpaired) {
    const fitting = people.filter((person) => !paired.has(person.nationalId) && nameFits(employee, person));
    if (fitting.length === 1) {
      proposals.push({ employee, person: fitting[0] });
      paired.add(fitting[0].nationalId);
    } else {
      unmatched.push(employee);
    }
  }

  const onlyInWorkera = people.filter((person) => person.active && !paired.has(person.nationalId));
  return { matchedCount, proposals, unmatched, onlyInWorkera };
}

function nameFits(employee: AppEmployee, person: WorkeraPerson): boolean {
  const words = new Set(wordsOf(person.fullName));
  const wanted = [...wordsOf(employee.firstName), ...wordsOf(employee.lastName)];
  return wanted.length >= 2 && wanted.every((word) => words.has(word));
}

function wordsOf(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
}
