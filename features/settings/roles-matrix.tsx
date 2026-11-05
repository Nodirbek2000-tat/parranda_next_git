import { Check, Minus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";

type Cell = string | boolean;

/** API_CONTRACT_V3 §1.2, read-only (roles are fixed in code — deviation 20.4). */
const MATRIX: { group: string; cells: [Cell, Cell, Cell, Cell, Cell] }[] = [
  { group: "Xodimlar", cells: [true, false, false, false, false] },
  { group: "Xonadonlar", cells: [true, "ko‘rish", false, "ko‘rish", "o‘ziniki"] },
  { group: "Partiyalar", cells: [true, true, false, "ko‘rish", false] },
  { group: "Parranda harakatlari", cells: [true, true, false, "nobud bo‘lish", "o‘ziniki"] },
  { group: "Kunlik hisobotlar", cells: [true, "ko‘rish", false, "ko‘rish", "o‘ziniki"] },
  { group: "Ombor, mahsulotlar", cells: [true, true, false, "ko‘rish", false] },
  { group: "Inventarizatsiya", cells: ["tasdiqlash", "sanash", false, false, false] },
  { group: "Buyurtmalar", cells: [true, "ko‘rish", false, false, "o‘ziniki"] },
  { group: "Transport va haydovchilar", cells: [true, "ko‘rish", true, false, false] },
  { group: "Logistika topshiriqlari", cells: [true, "ko‘rish", "bajarish", false, "tasdiqlash"] },
  { group: "Veterinariya", cells: [true, "emlash tarixi", false, true, "o‘ziniki, murojaat"] },
  { group: "Statistika, boshqaruv paneli", cells: [true, true, false, false, "o‘ziniki"] },
  { group: "Hisobotlar", cells: ["barchasi", "ombor, yem, harakat", "logistika", "vet, o‘lim", "o‘ziniki"] },
  { group: "Bildirishnomalar monitori", cells: [true, false, false, false, false] },
  { group: "Audit jurnali", cells: [true, false, false, false, false] },
  { group: "Kompaniya sozlamalari", cells: ["Super Admin", "ko‘rish", "ko‘rish", "ko‘rish", "ko‘rish"] },
];

const ROLES = ["Administrator", "Omborchi", "Logistika", "Veterinar", "Xonadon egasi"] as const;

function Value({ cell }: { cell: Cell }) {
  if (cell === true) return <Check className="mx-auto size-4 text-accent" aria-label="Ruxsat bor" />;
  if (cell === false) return <Minus className="mx-auto size-4 text-line-strong" aria-label="Ruxsat yo‘q" />;
  return <span className="text-xs text-ink">{cell}</span>;
}

/** Rollar tab of /settings: who may do what. */
export function RolesMatrix() {
  return (
    <Card>
      <CardHeader
        title="Rollar va ruxsatlar"
        description="Ruxsatlar tizimda qat’iy belgilangan: xonadonlar ma’lumotlari bir-biridan ajratilgan holda qoladi. Super Admin — administratorning barcha huquqlari va sozlamalar."
      />
      <div className="mt-4 overflow-x-auto border-t border-line">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Rollar bo‘yicha ruxsatlar</caption>
          <thead>
            <tr>
              <th scope="col" className="h-10 border-b border-line bg-surface px-4 text-left text-xs font-medium text-muted sm:pl-6">
                Bo‘lim
              </th>
              {ROLES.map((role) => (
                <th key={role} scope="col" className="h-10 border-b border-line bg-surface px-3 text-center text-xs font-medium text-muted">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.group} className="hover:bg-subtle">
                <th scope="row" className="h-11 border-b border-line px-4 text-left font-medium text-ink sm:pl-6">
                  {row.group}
                </th>
                {row.cells.map((cell, index) => (
                  <td key={ROLES[index]} className="h-11 border-b border-line px-3 text-center">
                    <Value cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
