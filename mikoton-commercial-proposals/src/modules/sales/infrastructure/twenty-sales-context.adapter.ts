import type { OpportunityContextQuery } from 'src/modules/sales/application/opportunity-context.port';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

export class TwentySalesContextAdapter implements OpportunityContextQuery {
  constructor(private readonly records = new TwentyRecordRepository()) {}

  getOpportunityContext(opportunityId: string) {
    return this.records.getOpportunityContext(opportunityId);
  }
}
