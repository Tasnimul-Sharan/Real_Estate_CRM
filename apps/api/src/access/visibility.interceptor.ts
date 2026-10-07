import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';

// Protect nested data too: denying a module must not expose it through a related detail page.
@Injectable()
export class VisibilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const permissions: string[] | undefined = req.user?.permissions;
    if (!permissions || req.user.role === 'SUPER_ADMIN') return next.handle();
    const can = (module: string) => permissions.includes(`${module}.view`);
    const clean = (value: any): any => {
      if (Array.isArray(value)) return value.map(clean);
      if (!value || typeof value !== 'object' || value instanceof Date || typeof value.toJSON === 'function') return value;
      const out = { ...value };
      const related: Record<string, string> = { plots: 'plots', plot: 'plots', payments: 'payments', bookings: 'bookings', leads: 'leads', activities: 'activities', customer: 'customers', preferredProject: 'projects', project: 'projects' };
      for (const [key, val] of Object.entries(out)) {
        if (related[key] && !can(related[key])) out[key] = Array.isArray(val) ? [] : null;
        else if (key === '_count') out[key] = Object.fromEntries(Object.entries(val as object).filter(([name]) => can(name)));
        else out[key] = clean(val);
      }
      return out;
    };
    return next.handle().pipe(map(result => {
      const output = clean(result);
      if (req.url.split('?')[0].endsWith('/dashboard/summary')) {
        const fields: Record<string, string[]> = { leads: ['leadCount', 'newLeads', 'recentLeads'], activities: ['followUps'], customers: ['customers'], plots: ['availablePlots', 'bookedPlots', 'soldPlots'], bookings: ['totalBookedAmount'], payments: ['totalPayments'] };
        for (const [module, keys] of Object.entries(fields)) if (!can(module)) for (const key of keys) delete output[key];
      }
      return output;
    }));
  }
}
