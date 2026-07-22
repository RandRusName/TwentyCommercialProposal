import type { OpportunityContext } from 'src/domain/commercial-proposal';

export interface OpportunityContextQuery {
  getOpportunityContext(opportunityId: string): Promise<OpportunityContext>;
}
