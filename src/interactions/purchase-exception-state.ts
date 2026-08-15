import type { PurchaseExceptionNote } from '../presentation/purchase-candidate-embeds.js';

export interface MutableExceptionState {
  exception?: PurchaseExceptionNote;
}

/** Keeps memory state aligned with the Embed when its Discord edit fails. */
export async function applyExceptionWithRollback(
  state: MutableExceptionState,
  exception: PurchaseExceptionNote,
  refresh: () => Promise<void>,
): Promise<void> {
  const hadPreviousException = Object.prototype.hasOwnProperty.call(state, 'exception');
  const previousException = state.exception;
  state.exception = exception;

  try {
    await refresh();
  } catch (error) {
    if (hadPreviousException) {
      state.exception = previousException;
    } else {
      delete state.exception;
    }
    throw error;
  }
}
