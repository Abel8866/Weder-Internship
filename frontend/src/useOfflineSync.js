import { useCallback, useEffect, useState } from 'react';
import { offlineSyncService } from './offlineSyncService';

export function useOfflineSync(service = offlineSyncService) {
  const [state, setState] = useState({
    isOnline: service.isOnline,
    isSyncing: service.isSyncing,
    reports: [],
    syncError: null
  });

  const refresh = useCallback(async () => {
    const reports = await service.getLocalReports();
    setState((current) => ({ ...current, reports }));
  }, [service]);

  useEffect(() => {
    const previousCallback = service.onStateChange;
    service.onStateChange = (next) => {
      previousCallback?.(next);
      setState((current) => ({ ...current, ...next }));
      void refresh();
    };
    void refresh();

    return () => {
      service.onStateChange = previousCallback;
    };
  }, [refresh, service]);

  const saveReportLocally = useCallback(
    async (data) => {
      const report = await service.saveReportLocally(data);
      await refresh();
      return report;
    },
    [refresh, service]
  );

  const triggerSync = useCallback(async () => {
    const result = await service.triggerSync();
    await refresh();
    return result;
  }, [refresh, service]);

  return { ...state, saveReportLocally, triggerSync, refresh };
}

