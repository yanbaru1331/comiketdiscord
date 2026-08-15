import { MessageFlags, type Interaction } from 'discord.js';

type ErrorLogger = Pick<Console, 'error'>;

const INITIAL_RESPONSE_NETWORK_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ENETUNREACH',
  'InteractionAlreadyReplied',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function findErrorCode(error: unknown): string | number | undefined {
  let current = error;
  const visited = new Set<object>();

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current);
    if ('code' in current) {
      const code = current.code;
      if (typeof code === 'string' || typeof code === 'number') return code;
    }
    current = 'cause' in current ? current.cause : undefined;
  }

  return undefined;
}

/**
 * An initial interaction response cannot be recovered with a second response
 * when its token has expired or the Discord connection state is unknown.
 */
export function cannotRetryInitialInteractionResponse(error: unknown): boolean {
  const code = findErrorCode(error);
  return code === 10062
    || code === 40060
    || (typeof code === 'string' && INITIAL_RESPONSE_NETWORK_ERROR_CODES.has(code));
}

async function safelyNotifyInteractionFailure(
  interaction: Interaction,
  originalError: unknown,
  logger: ErrorLogger,
): Promise<void> {
  if (!interaction.isRepliable()) return;

  if (
    !interaction.replied
    && !interaction.deferred
    && cannotRetryInitialInteractionResponse(originalError)
  ) return;

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply('例外入力の反映に失敗しました。');
      return;
    }

    await interaction.reply({
      content: '例外入力の反映に失敗しました。',
      flags: MessageFlags.Ephemeral,
    });
  } catch (notificationError) {
    logger.error('Interactionエラーの通知にも失敗しました:', notificationError);
  }
}

export async function runInteractionSafely(
  interaction: Interaction,
  operation: () => Promise<void>,
  logger: ErrorLogger = console,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    logger.error('例外入力の反映に失敗しました:', error);
    await safelyNotifyInteractionFailure(interaction, error, logger);
  }
}
