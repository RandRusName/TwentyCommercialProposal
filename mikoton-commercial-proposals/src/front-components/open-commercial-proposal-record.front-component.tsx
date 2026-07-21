import { defineFrontComponent } from 'twenty-sdk/define';
import {
  AppPath,
  CommandLink,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import { OPEN_COMMERCIAL_PROPOSAL_RECORD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const OpenCommercialProposalRecord = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const recordId =
    selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;

  if (recordId === null) {
    return null;
  }

  return (
    <CommandLink
      to={AppPath.RecordShowPage}
      params={{
        objectNameSingular: 'commercialProposal',
        objectRecordId: recordId,
      }}
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    OPEN_COMMERCIAL_PROPOSAL_RECORD_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'Открыть карточку коммерческого предложения',
  description: 'Открывает центральную карточку CommercialProposal',
  isHeadless: true,
  component: OpenCommercialProposalRecord,
});
