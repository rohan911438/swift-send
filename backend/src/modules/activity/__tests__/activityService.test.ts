import { ActivityService } from '../activityService';

jest.mock('../../../utils/redisCache', () => ({
  getCachedJson: jest.fn(),
  setCachedJson: jest.fn(),
  deleteCachedKeys: jest.fn(),
}));

const { getCachedJson, setCachedJson, deleteCachedKeys } = jest.requireMock('../../../utils/redisCache') as {
  getCachedJson: jest.Mock;
  setCachedJson: jest.Mock;
  deleteCachedKeys: jest.Mock;
};

describe('ActivityService Redis caching', () => {
  const sampleRecord = {
    id: 'tx1',
    state: 'settled',
    amount: 100,
    recipient: {
      metadata: { identifier: '+15551234567', name: 'Alice' },
      type: 'bank',
      country: 'US',
    },
    metadata: { network_fee: 1, service_fee: 2 },
    createdAt: new Date().toISOString(),
    statusHistory: [{ state: 'created', at: new Date().toISOString() }],
  } as any;

  const repository = {
    listRecentByUserId: jest.fn().mockResolvedValue([sampleRecord]),
    listByUserId: jest.fn().mockResolvedValue([sampleRecord]),
  };
  const notifications = { listByUserId: jest.fn().mockResolvedValue([]) } as any;
  const exporter = { generateTransactionExcel: jest.fn().mockResolvedValue(Buffer.from('')) } as any;

  let service: ActivityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActivityService(repository as any, notifications, exporter);
  });

  it('uses Redis cache for transaction list when available', async () => {
    getCachedJson.mockResolvedValueOnce([{ id: 'cached-tx', type: 'send' }]);

    const transactions = await service.listTransactions('user-1', 10);

    expect(getCachedJson).toHaveBeenCalledWith('activity:transactions:user-1:10');
    expect(transactions).toEqual([{ id: 'cached-tx', type: 'send' }]);
    expect(repository.listRecentByUserId).not.toHaveBeenCalled();
  });

  it('caches transaction list after load when Redis miss occurs', async () => {
    getCachedJson.mockResolvedValueOnce(null);

    const transactions = await service.listTransactions('user-1', 10);

    expect(repository.listRecentByUserId).toHaveBeenCalledWith('user-1', 10);
    expect(setCachedJson).toHaveBeenCalledWith(expect.stringContaining('activity:transactions:user-1:10'), expect.any(Array), expect.any(Number));
    expect(transactions[0].id).toBe('tx1');
  });

  it('invalidates Redis transaction and insight caches for a user', async () => {
    await service.invalidateUser('user-1');

    expect(deleteCachedKeys).toHaveBeenCalledWith('activity:transactions:user-1:*');
    expect(deleteCachedKeys).toHaveBeenCalledWith('activity:insights:user-1');
  });
});
