import { beforeEach, describe, expect, it } from 'vitest';
import type { Parcel } from '@/domain/field';
import { EMPTY_ANSWERS, sameField, useStore } from './store';

const parcel = (id: string): Parcel => ({
  id, source: 'tkgm', polygons: [], areaM2: 1000, areaBadge: 'official', label: id,
});

describe('a new field starts with blank answers', () => {
  beforeEach(() => useStore.getState().reset());

  it('sameField: overlap of at least one parcel', () => {
    expect(sameField([parcel('a')], [parcel('a'), parcel('b')])).toBe(true);
    expect(sameField([parcel('a'), parcel('b')], [parcel('b')])).toBe(true);
    expect(sameField([parcel('a')], [parcel('c')])).toBe(false);
    expect(sameField([], [parcel('c')])).toBe(false);
  });

  it('clears the answers when another field is picked', () => {
    const st = useStore.getState();
    st.setField([parcel('a')], 'karapinar', 0);
    st.answer('depth', 'deep');
    st.answer('priority', 'soil' as never);
    st.setQuestion(3);
    st.setField([parcel('z')], 'develi', 0);
    expect(useStore.getState().answers).toEqual(EMPTY_ANSWERS);
    expect(useStore.getState().question).toBe(0);
  });

  it('clears them after the field was removed and a new one picked', () => {
    const st = useStore.getState();
    st.setField([parcel('a')], 'karapinar', 0);
    st.answer('depth', 'deep');
    st.setField([], null, null);
    st.setField([parcel('z')], 'develi', 0);
    expect(useStore.getState().answers.depth).toBeNull();
  });

  it('keeps them when a parcel is added to the same field', () => {
    const st = useStore.getState();
    st.setField([parcel('a')], 'karapinar', 0);
    st.answer('depth', 'deep');
    st.setField([parcel('a'), parcel('b')], 'karapinar', 0);
    expect(useStore.getState().answers.depth).toBe('deep');
  });
});
