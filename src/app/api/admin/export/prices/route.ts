import ExcelJS from "exceljs";
import { getAllVariantsForAdmin } from "@/lib/admin-data";
import { getAdminOrNull } from "@/lib/auth";
import { addTable, highlightColumns, istDate, xlsxResponse } from "@/lib/excel-export";
import { getSettings } from "@/lib/settings";

/** Today's price list as Excel — edit prices/stock and upload it back. */
export async function GET() {
  if (!(await getAdminOrNull())) return new Response("Please login as admin", { status: 401 });
  const [rows, s] = await Promise.all([getAllVariantsForAdmin(), getSettings()]);
  const wb = new ExcelJS.Workbook();
  wb.creator = s.shopName;
  const ws = addTable(
    wb,
    "Prices",
    [
      { header: "ID", key: "id", width: 8 },
      { header: "Category", key: "category", width: 16 },
      { header: "Brand", key: "brand", width: 12 },
      { header: "Model", key: "name", width: 34 },
      { header: "Variant", key: "label", width: 16 },
      { header: "Type", key: "kind", width: 11 },
      { header: "Model No", key: "model", width: 16 },
      { header: "Wholesale Price", key: "price", width: 16, money: true },
      { header: "MRP", key: "mrp", width: 12, money: true },
      { header: "Stock", key: "stock", width: 9 },
      { header: "Live", key: "live", width: 7 },
    ],
    rows.map((r) => ({
      id: r.id,
      category: r.categoryName ?? "",
      brand: r.brand,
      name: r.name,
      label: r.label,
      kind: r.kind === "activated" ? "Activated" : "Fresh",
      model: r.modelNumber,
      price: r.price,
      mrp: r.mrp ?? "",
      stock: r.stock,
      live: r.isActive ? "Yes" : "No",
    })),
  );
  highlightColumns(ws, [8, 10]);
  ws.getColumn(1).font = { color: { argb: "FF94A3B8" } };
  return xlsxResponse(wb, `prices-${istDate()}.xlsx`);
}
