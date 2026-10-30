import { KeyValue } from '../../models/types';

// 실행이 시작된 저장소와 환경을 고정한다. 환경 전환은 허용하되 프로필 세대가 바뀌면 폐기한다.
export interface ExecutionContext {
  readonly profileName: string;
  readonly environmentId: string | null;
  readonly generation: number;
  readonly profileId?: string;
}

export function hasEnvironmentChanges(before: KeyValue[], after: KeyValue[]): boolean {
  const baseline = new Map(before.map((entry) => [entry.key, entry]));
  const next = new Map(after.map((entry) => [entry.key, entry]));
  if (baseline.size !== next.size) { return true; }
  return Array.from(baseline).some(([key, value]) => {
    const updated = next.get(key);
    return !updated || updated.value !== value.value || updated.enabled !== value.enabled;
  });
}
