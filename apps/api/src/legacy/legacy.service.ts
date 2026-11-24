import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyQuery } from './legacy.dto';

// Match the importer's decimal budget. Source DOUBLE literals are retained as strings.
const Exact = Prisma.Decimal.clone({ precision: 256, toExpNeg: -1000, toExpPos: 1000 });
const metadata = {
  id: true, sourceFile: true, sourceDatabase: true, snapshotAt: true,
  importedAt: true, recordCount: true, sourceCounts: true, reconciliation: true,
} as const;
type Row = {
  companyId: number | null; companyName: string; period: string;
  salesAmount: string | null; targetAmount: string | null;
  due: string | null; od: string | null; codOd: string | null;
};

@Injectable()
export class LegacyService {
  constructor(private readonly prisma: PrismaService) {}

  imports() {
    return this.prisma.legacyImport.findMany({
      select: metadata, orderBy: [{ snapshotAt: 'desc' }, { importedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async summary(q: LegacyQuery) {
    const period = q.period ?? 'monthly', page = q.page ?? 1, pageSize = q.pageSize ?? 50;
    const snapshot = q.importId
      ? await this.prisma.legacyImport.findUnique({ where: { id: q.importId }, select: metadata })
      : await this.prisma.legacyImport.findFirst({ select: metadata, orderBy: [{ snapshotAt: 'desc' }, { importedAt: 'desc' }, { id: 'desc' }] });
    if (q.importId && !snapshot) throw new NotFoundException('Imported snapshot was not found');
    if (!snapshot) return {
      snapshot: null, companies: [], period, coverage: { from: null, to: null },
      totals: { salesAmount: null, targetAmount: '0', rows: 0 }, rows: [],
      pagination: { page, pageSize, total: 0, pages: 1 },
    };
    const salesTable = period === 'yearly' ? null : `sale_${period}`;
    const targetTable = `target_${period}`;
    // Snapshots are immutable: the metadata and its records always refer to one import.
    const records = await this.prisma.legacyRecord.findMany({
      where: { importId: snapshot.id, tableName: { in: ['company', targetTable, ...(salesTable ? [salesTable] : [])] } },
      select: { tableName: true, data: true },
    });
    const companies = records.filter(r => r.tableName === 'company').map(r => {
      const data = r.data as Record<string, any>;
      return { id: data.id as number, name: data.name as string };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    const names = new Map(companies.map(c => [c.id, c.name]));
    if (q.companyId && q.companyId !== 'none' && !names.has(Number(q.companyId))) {
      throw new BadRequestException('Company was not found in this snapshot');
    }
    const rowsByPeriod = new Map<string, Row>();
    for (const record of records) {
      if (record.tableName === 'company') continue;
      const d = record.data as Record<string, any>;
      if (q.companyId && (q.companyId === 'none' ? d.company_id !== null : d.company_id !== Number(q.companyId))) continue;
      const keyDate = period === 'daily' ? d.date : period === 'monthly'
        ? `${d.year}-${String(d.month).padStart(2, '0')}` : d.year;
      const key = JSON.stringify([d.company_id, keyDate]);
      let row = rowsByPeriod.get(key);
      if (!row) {
        row = { companyId: d.company_id, companyName: d.company_id === null ? 'Unassigned company' : names.get(d.company_id)!, period: keyDate,
          salesAmount: null, targetAmount: null, due: null, od: null, codOd: null };
        rowsByPeriod.set(key, row);
      }
      if (record.tableName === salesTable) {
        row.salesAmount = d.amount; row.due = d.due; row.od = d.od; row.codOd = d.cod_od;
      } else row.targetAmount = d.amount;
    }
    const rows = [...rowsByPeriod.values()].sort((a, b) => b.period.localeCompare(a.period) || (a.companyId ?? -1) - (b.companyId ?? -1));
    const sales = rows.filter(r => r.salesAmount !== null);
    const sum = (key: 'salesAmount' | 'targetAmount') => rows.reduce((total, row) => total.plus(row[key] ?? '0'), new Exact(0)).toFixed();
    return {
      snapshot, companies, period,
      coverage: { from: rows.length ? rows[rows.length - 1].period : null, to: rows.length ? rows[0].period : null },
      totals: { salesAmount: sales.length ? sum('salesAmount') : null, targetAmount: sum('targetAmount'), rows: rows.length },
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / pageSize)) },
    };
  }
}
