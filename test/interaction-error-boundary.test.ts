import assert from 'node:assert/strict';
import test from 'node:test';
import type { Interaction } from 'discord.js';
import {
  cannotRetryInitialInteractionResponse,
  runInteractionSafely,
} from '../src/interactions/interaction-error-boundary.js';
import { applyExceptionWithRollback } from '../src/interactions/purchase-exception-state.js';
import type { PurchaseExceptionNote } from '../src/presentation/purchase-candidate-embeds.js';

interface FakeInteractionOptions {
  repliable?: boolean;
  replied?: boolean;
  deferred?: boolean;
  replyError?: unknown;
  editReplyError?: unknown;
}

function createFakeInteraction(options: FakeInteractionOptions = {}) {
  const replyMessages: string[] = [];
  const editReplyMessages: string[] = [];
  const interaction = {
    isRepliable: () => options.repliable ?? true,
    replied: options.replied ?? false,
    deferred: options.deferred ?? false,
    reply: async (replyOptions: { content: string }) => {
      replyMessages.push(replyOptions.content);
      if (options.replyError) throw options.replyError;
    },
    editReply: async (content: string) => {
      editReplyMessages.push(content);
      if (options.editReplyError) throw options.editReplyError;
    },
  } as unknown as Interaction;

  return { interaction, replyMessages, editReplyMessages };
}

function createLogger() {
  const errors: unknown[][] = [];
  return {
    logger: {
      error: (...values: unknown[]) => {
        errors.push(values);
      },
    },
    errors,
  };
}

function codedError(code: string | number, message = String(code)): Error {
  return Object.assign(new Error(message), { code });
}

test('接続タイムアウト後は期限切れInteractionへ再返信しない', async () => {
  const fake = createFakeInteraction();
  const log = createLogger();

  await runInteractionSafely(
    fake.interaction,
    async () => {
      throw codedError('UND_ERR_CONNECT_TIMEOUT');
    },
    log.logger,
  );

  assert.deepEqual(fake.replyMessages, []);
  assert.deepEqual(fake.editReplyMessages, []);
  assert.equal(log.errors.length, 1);
});

test('原因に包まれたネットワークエラーも再返信不可として扱う', () => {
  const error = Object.assign(new Error('fetch failed'), {
    cause: codedError('ECONNRESET'),
  });

  assert.equal(cannotRetryInitialInteractionResponse(error), true);
});

test('Unknown interaction 10062後は再返信しない', async () => {
  const fake = createFakeInteraction();
  const log = createLogger();

  await runInteractionSafely(
    fake.interaction,
    async () => {
      throw codedError(10062, 'Unknown interaction');
    },
    log.logger,
  );

  assert.deepEqual(fake.replyMessages, []);
  assert.deepEqual(fake.editReplyMessages, []);
});

test('二重応答 40060後はさらに返信しない', async () => {
  const fake = createFakeInteraction();
  const log = createLogger();

  await runInteractionSafely(
    fake.interaction,
    async () => {
      throw codedError(40060, 'Interaction has already been acknowledged');
    },
    log.logger,
  );

  assert.deepEqual(fake.replyMessages, []);
  assert.deepEqual(fake.editReplyMessages, []);
});

test('エラー通知の返信自体が失敗してもハンドラから例外を漏らさない', async () => {
  const fake = createFakeInteraction({
    replyError: codedError(10062, 'Unknown interaction'),
  });
  const log = createLogger();

  await runInteractionSafely(
    fake.interaction,
    async () => {
      throw new Error('Modal payload error');
    },
    log.logger,
  );

  assert.deepEqual(fake.replyMessages, ['例外入力の反映に失敗しました。']);
  assert.equal(log.errors.length, 2);
});

test('defer済みなら新規返信ではなく元の応答を編集する', async () => {
  const fake = createFakeInteraction({ deferred: true });
  const log = createLogger();

  await runInteractionSafely(
    fake.interaction,
    async () => {
      throw new Error('Embed edit failed');
    },
    log.logger,
  );

  assert.deepEqual(fake.replyMessages, []);
  assert.deepEqual(fake.editReplyMessages, ['例外入力の反映に失敗しました。']);
});

test('defer済みのエラー通知が失敗しても例外を漏らさない', async () => {
  const fake = createFakeInteraction({
    deferred: true,
    editReplyError: codedError('UND_ERR_SOCKET'),
  });
  const log = createLogger();

  await runInteractionSafely(
    fake.interaction,
    async () => {
      throw new Error('Embed edit failed');
    },
    log.logger,
  );

  assert.equal(log.errors.length, 2);
});

test('返信不能なInteractionでは通知を試行しない', async () => {
  const fake = createFakeInteraction({ repliable: false });
  const log = createLogger();

  await runInteractionSafely(
    fake.interaction,
    async () => {
      throw new Error('unrelated interaction failed');
    },
    log.logger,
  );

  assert.deepEqual(fake.replyMessages, []);
  assert.deepEqual(fake.editReplyMessages, []);
});

test('Embed更新失敗時は既存の例外状態へ戻す', async () => {
  const previous: PurchaseExceptionNote = {
    type: '限数不足',
    memo: '1個のみ',
    updatedBy: 'user-1',
  };
  const next: PurchaseExceptionNote = {
    type: '売り切れ',
    updatedBy: 'user-2',
  };
  const state = { exception: previous };

  await assert.rejects(
    applyExceptionWithRollback(state, next, async () => {
      throw new Error('message edit failed');
    }),
    /message edit failed/,
  );

  assert.equal(state.exception, previous);
});

test('初回の例外反映に失敗した場合は例外状態を残さない', async () => {
  const state: { exception?: PurchaseExceptionNote } = {};
  const next: PurchaseExceptionNote = {
    type: 'その他',
    updatedBy: 'user-1',
  };

  await assert.rejects(
    applyExceptionWithRollback(state, next, async () => {
      throw new Error('message edit failed');
    }),
  );

  assert.equal(Object.hasOwn(state, 'exception'), false);
});

test('Embed更新成功時は新しい例外状態を保持する', async () => {
  const state: { exception?: PurchaseExceptionNote } = {};
  const next: PurchaseExceptionNote = {
    type: '売り切れ',
    updatedBy: 'user-1',
  };

  await applyExceptionWithRollback(state, next, async () => {});

  assert.equal(state.exception, next);
});
