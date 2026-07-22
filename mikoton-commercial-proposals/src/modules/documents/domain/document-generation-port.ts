export type DocumentGenerationRequest<TPayload> = {
  requestId: string;
  idempotencyKey: string;
  snapshotHash?: string;
  payload: TPayload;
  requestedFormats: Array<'xlsx' | 'pdf'>;
};

export interface DocumentGenerationPort<TPayload, TResult> {
  generate(request: DocumentGenerationRequest<TPayload>): Promise<TResult>;
}
