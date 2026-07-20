import { defineLogicFunction, HTTPMethod } from 'twenty-sdk/define';
import { type RoutePayload } from 'twenty-sdk/logic-function';

import { EDITOR_CONTEXT_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  assertAggregateIntegrity,
  buildEditorContext,
  validateCommercialProposalId,
} from 'src/domain/commercial-proposal-aggregate';
import {
  failure,
  json,
  toApplicationError,
} from 'src/logic-functions/http-response';
import { TwentyRecordRepository } from 'src/services/twenty-record-repository';

const handler = async (event: RoutePayload) => {
  try {
    const commercialProposalId = validateCommercialProposalId(
      event.pathParameters.id,
    );

    const repository = new TwentyRecordRepository();
    const aggregate =
      await repository.getCommercialProposalAggregate(commercialProposalId);
    assertAggregateIntegrity(aggregate);
    const warnings: Array<
      'OPPORTUNITY_CONTEXT_UNAVAILABLE' | 'COMPANY_CONTEXT_UNAVAILABLE'
    > = [];
    const opportunity = await repository
      .getOpportunityContext(aggregate.proposal.opportunityId)
      .catch(() => {
        warnings.push('OPPORTUNITY_CONTEXT_UNAVAILABLE');
        return null;
      });
    const company =
      aggregate.proposal.companyId === null
        ? null
        : await repository
            .getCompanyContext(aggregate.proposal.companyId)
            .catch(() => {
              warnings.push('COMPANY_CONTEXT_UNAVAILABLE');
              return null;
            });

    return json({
      status: 'success',
      ...buildEditorContext(aggregate, {
        opportunity: opportunity === null ? null : {
          id: opportunity.id,
          name: opportunity.name,
          amount: opportunity.amount,
          currencyCode: opportunity.currencyCode,
        },
        company,
        warnings,
      }),
    });
  } catch (error) {
    const applicationError = toApplicationError(error);

    console.error('editor-context-commercial-proposal failed', {
      proposalId: event.pathParameters.id,
      code: applicationError.code,
      cause:
        applicationError.cause instanceof Error
          ? applicationError.cause.message
          : undefined,
    });

    return failure(applicationError);
  }
};

export default defineLogicFunction({
  universalIdentifier:
    EDITOR_CONTEXT_COMMERCIAL_PROPOSAL_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'Commercial Proposal Editor Context',
  description: 'Returns canonical CommercialProposal aggregate editor context',
  timeoutSeconds: 10,
  httpRouteTriggerSettings: {
    path: '/commercial-proposals/:id/editor-context',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler,
});
