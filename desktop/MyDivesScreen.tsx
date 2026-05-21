import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  radius,
  DESKTOP_MAX_WIDTH,
  TIER_COLORS,
  type ConditionTier,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';
import type { NavigateFn } from './router';

/**
 * My Dives — power-user dive log management.
 *
 * Reached from the Dashboard left sidebar ("My dives" link). Distinct
 * from Profile › Dive Reports: that view is social-flavored detailed
 * cards intended for showcasing dives. This view is dense, sortable,
 * filterable, and bulk-actionable — the "spreadsheet" view of your
 * entire log.
 *
 * Layout: DesktopNav (Dashboard active, since My Dives sits under that
 * group), filter bar, main table + stats sidebar.
 */

// ─── Mock data ────────────────────────────────────────────────────────────

type DiveEntry = {
  id: string;
  date: string;          // ISO 'YYYY-MM-DD'
  time: string;          // 'HH:MM'
  spot: string;
  region: string;
  island: 'O\'ahu' | 'Maui' | 'Big Island' | 'Kaua\'i';
  diveType: 'Scuba' | 'Freediving' | 'Spearfishing' | 'Snorkel';
  depthFt: number;
  durationMin: number;
  vizFt: number;
  waterTempF: number;
  rating: ConditionTier;
  buddy?: string;
  hasPhotos: boolean;
};

const DIVES: DiveEntry[] = [
  { id: 'd147', date: '2024-04-14', time: '09:12', spot: 'Electric Beach',  region: 'Leeward',     island: "O'ahu",      diveType: 'Scuba',        depthFt: 68,  durationMin: 52, vizFt: 60, waterTempF: 79, rating: 'excellent', buddy: 'Kai M.',     hasPhotos: true  },
  { id: 'd146', date: '2024-04-12', time: '07:30', spot: "Shark's Cove",    region: 'North Shore', island: "O'ahu",      diveType: 'Freediving',   depthFt: 42,  durationMin: 38, vizFt: 48, waterTempF: 78, rating: 'great',     buddy: 'Leilani S.', hasPhotos: true  },
  { id: 'd145', date: '2024-04-09', time: '11:00', spot: 'Hanauma Bay',     region: 'East Shore',  island: "O'ahu",      diveType: 'Snorkel',      depthFt: 12,  durationMin: 60, vizFt: 30, waterTempF: 79, rating: 'good',                          hasPhotos: false },
  { id: 'd144', date: '2024-04-06', time: '08:00', spot: 'Molokini Crater', region: 'South',       island: 'Maui',       diveType: 'Scuba',        depthFt: 110, durationMin: 44, vizFt: 80, waterTempF: 77, rating: 'excellent', buddy: 'Marcus H.',  hasPhotos: true  },
  { id: 'd143', date: '2024-04-04', time: '06:45', spot: 'Electric Beach',  region: 'Leeward',     island: "O'ahu",      diveType: 'Spearfishing', depthFt: 35,  durationMin: 62, vizFt: 50, waterTempF: 78, rating: 'great',                         hasPhotos: true  },
  { id: 'd142', date: '2024-03-31', time: '10:15', spot: 'Three Tables',    region: 'North Shore', island: "O'ahu",      diveType: 'Freediving',   depthFt: 45,  durationMin: 50, vizFt: 55, waterTempF: 78, rating: 'great',     buddy: 'Ryan P.',    hasPhotos: false },
  { id: 'd141', date: '2024-03-28', time: '17:30', spot: 'Magic Island',    region: 'South Shore', island: "O'ahu",      diveType: 'Scuba',        depthFt: 28,  durationMin: 42, vizFt: 35, waterTempF: 80, rating: 'good',                          hasPhotos: true  },
  { id: 'd140', date: '2024-03-24', time: '07:00', spot: 'Two Step',        region: 'West',        island: 'Big Island', diveType: 'Scuba',        depthFt: 55,  durationMin: 48, vizFt: 70, waterTempF: 78, rating: 'great',     buddy: 'Alana T.',   hasPhotos: true  },
  { id: 'd139', date: '2024-03-20', time: '14:00', spot: 'Tunnels Beach',   region: 'North Shore', island: "Kaua'i",     diveType: 'Snorkel',      depthFt: 18,  durationMin: 75, vizFt: 45, waterTempF: 76, rating: 'good',                          hasPhotos: true  },
  { id: 'd138', date: '2024-03-16', time: '08:30', spot: 'Honolua Bay',     region: 'Northwest',   island: 'Maui',       diveType: 'Freediving',   depthFt: 38,  durationMin: 55, vizFt: 50, waterTempF: 77, rating: 'great',                         hasPhotos: false },
  { id: 'd137', date: '2024-03-13', time: '06:00', spot: 'Electric Beach',  region: 'Leeward',     island: "O'ahu",      diveType: 'Freediving',   depthFt: 50,  durationMin: 75, vizFt: 65, waterTempF: 78, rating: 'excellent', buddy: 'Ryan P.',    hasPhotos: true  },
  { id: 'd136', date: '2024-03-09', time: '12:00', spot: 'Black Rock',      region: 'West',        island: 'Maui',       diveType: 'Snorkel',      depthFt: 15,  durationMin: 80, vizFt: 40, waterTempF: 77, rating: 'good',                          hasPhotos: true  },
  { id: 'd135', date: '2024-03-05', time: '09:00', spot: 'Kealakekua Bay',  region: 'Kona',        island: 'Big Island', diveType: 'Scuba',        depthFt: 75,  durationMin: 50, vizFt: 85, waterTempF: 78, rating: 'excellent', buddy: 'Alana T.',   hasPhotos: true  },
  { id: 'd134', date: '2024-03-01', time: '07:15', spot: "Shark's Cove",    region: 'North Shore', island: "O'ahu",      diveType: 'Scuba',        depthFt: 48,  durationMin: 45, vizFt: 38, waterTempF: 76, rating: 'good',                          hasPhotos: false },
  { id: 'd133', date: '2024-02-26', time: '15:00', spot: 'Sandy Beach',     region: 'East Shore',  island: "O'ahu",      diveType: 'Spearfishing', depthFt: 22,  durationMin: 50, vizFt: 20, waterTempF: 75, rating: 'fair',                          hasPhotos: false },
  { id: 'd132', date: '2024-02-22', time: '08:45', spot: 'Electric Beach',  region: 'Leeward',     island: "O'ahu",      diveType: 'Scuba',        depthFt: 44,  durationMin: 52, vizFt: 50, waterTempF: 76, rating: 'great',     buddy: 'Kai M.',     hasPhotos: true  },
  { id: 'd131', date: '2024-02-18', time: '10:00', spot: 'Mokuleia',        region: 'North Shore', island: "O'ahu",      diveType: 'Snorkel',      depthFt: 8,   durationMin: 45, vizFt: 22, waterTempF: 75, rating: 'fair',                          hasPhotos: false },
  { id: 'd130', date: '2024-02-14', time: '13:00', spot: 'Magic Island',    region: 'South Shore', island: "O'ahu",      diveType: 'Freediving',   depthFt: 35,  durationMin: 60, vizFt: 42, waterTempF: 75, rating: 'good',                          hasPhotos: false },
];

const DIVE_TYPE_FILTERS = ['All types', 'Scuba', 'Freediving', 'Spearfishing', 'Snorkel'] as const;
const DEPTH_FILTERS = ['Any depth', '0–30 ft', '30–60 ft', '60–100 ft', '100+ ft'] as const;
const YEAR_FILTERS  = ['All time', '2024', '2023', '2022'] as const;

type SortKey = 'date' | 'depthFt' | 'durationMin' | 'vizFt';

// ─── Screen ───────────────────────────────────────────────────────────────

export interface MyDivesScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function MyDivesScreen({ activeNav = 'dashboard', onNavigate }: MyDivesScreenProps) {
  const [typeFilter,  setTypeFilter]  = React.useState<(typeof DIVE_TYPE_FILTERS)[number]>('All types');
  const [depthFilter, setDepthFilter] = React.useState<(typeof DEPTH_FILTERS)[number]>('Any depth');
  const [yearFilter,  setYearFilter]  = React.useState<(typeof YEAR_FILTERS)[number]>('All time');
  const [sortKey,     setSortKey]     = React.useState<SortKey>('date');
  const [sortDir,     setSortDir]     = React.useState<'asc' | 'desc'>('desc');
  const [selected,    setSelected]    = React.useState<Set<string>>(new Set());
  const [search,      setSearch]      = React.useState('');

  const filtered = React.useMemo(() => {
    let list = DIVES.slice();

    if (typeFilter !== 'All types') {
      list = list.filter((d) => d.diveType === typeFilter);
    }
    if (depthFilter !== 'Any depth') {
      const [lo, hi] = depthFilter === '0–30 ft' ? [0, 30]
        : depthFilter === '30–60 ft' ? [30, 60]
        : depthFilter === '60–100 ft' ? [60, 100]
        : [100, Infinity];
      list = list.filter((d) => d.depthFt >= lo && d.depthFt <= hi);
    }
    if (yearFilter !== 'All time') {
      list = list.filter((d) => d.date.startsWith(yearFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.spot.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q) ||
        d.buddy?.toLowerCase().includes(q) ||
        d.diveType.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [typeFilter, depthFilter, yearFilter, search, sortKey, sortDir]);

  const allChecked = filtered.length > 0 && filtered.every((d) => selected.has(d.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((d) => next.delete(d.id));
      else filtered.forEach((d) => next.add(d.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <View style={styles.body}>
          <View style={styles.bodyMain}>
            <Header total={DIVES.length} filteredCount={filtered.length} />
            <FilterBar
              typeFilter={typeFilter} onTypeFilter={setTypeFilter}
              depthFilter={depthFilter} onDepthFilter={setDepthFilter}
              yearFilter={yearFilter} onYearFilter={setYearFilter}
              search={search} onSearch={setSearch}
            />

            {selected.size > 0 ? (
              <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())} />
            ) : null}

            <DiveTable
              rows={filtered}
              selected={selected}
              allChecked={allChecked}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => {
                if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                else { setSortKey(k); setSortDir('desc'); }
              }}
              onOpen={(spot) => onNavigate?.('spot-detail', { spotId: slugify(spot) })}
            />
          </View>

          <View style={styles.bodySidebar}>
            <StatsSummaryCard />
            <ByYearCard />
            <MostDivedSpotsCard onNavigate={onNavigate} />
            <ExportCard />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function Header({ total, filteredCount }: { total: number; filteredCount: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>My dives</Text>
        <Text style={styles.headerSub}>
          {filteredCount === total
            ? `${total} dives logged · across 4 islands`
            : `${filteredCount} of ${total} dives · filtered`}
        </Text>
      </View>
      <Pressable style={styles.headerBtn}>
        <Text style={styles.headerBtnIcon}>+</Text>
        <Text style={styles.headerBtnText}>Log a dive</Text>
      </Pressable>
    </View>
  );
}

// ─── Filter bar ──────────────────────────────────────────────────────────

function FilterBar(p: {
  typeFilter: (typeof DIVE_TYPE_FILTERS)[number];
  onTypeFilter: (v: (typeof DIVE_TYPE_FILTERS)[number]) => void;
  depthFilter: (typeof DEPTH_FILTERS)[number];
  onDepthFilter: (v: (typeof DEPTH_FILTERS)[number]) => void;
  yearFilter: (typeof YEAR_FILTERS)[number];
  onYearFilter: (v: (typeof YEAR_FILTERS)[number]) => void;
  search: string;
  onSearch: (v: string) => void;
}) {
  return (
    <View style={styles.filterBar}>
      <View style={styles.filterSearchWrap}>
        <Text style={styles.filterSearchIcon}>⌕</Text>
        <TextInput
          value={p.search}
          onChangeText={p.onSearch}
          placeholder="Search spot, buddy, region…"
          placeholderTextColor={colors.text4}
          style={[styles.filterSearchInput, { outlineStyle: 'none' } as object]}
        />
      </View>
      <FilterDropdown label="Type"  value={p.typeFilter}  options={[...DIVE_TYPE_FILTERS]} onChange={(v) => p.onTypeFilter(v as (typeof DIVE_TYPE_FILTERS)[number])} />
      <FilterDropdown label="Depth" value={p.depthFilter} options={[...DEPTH_FILTERS]}     onChange={(v) => p.onDepthFilter(v as (typeof DEPTH_FILTERS)[number])} />
      <FilterDropdown label="Year"  value={p.yearFilter}  options={[...YEAR_FILTERS]}      onChange={(v) => p.onYearFilter(v as (typeof YEAR_FILTERS)[number])} />
    </View>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={styles.filterDropdownWrap}>
      <Pressable style={styles.filterDropdownBtn} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.filterDropdownLabel}>{label}:</Text>
        <Text style={styles.filterDropdownValue}>{value}</Text>
        <Text style={styles.filterDropdownCaret}>▾</Text>
      </Pressable>
      {open ? (
        <View style={styles.filterDropdownMenu}>
          {options.map((o) => {
            const active = o === value;
            return (
              <Pressable
                key={o}
                style={[styles.filterDropdownItem, active && styles.filterDropdownItemActive]}
                onPress={() => { onChange(o); setOpen(false); }}
              >
                <Text style={[styles.filterDropdownItemText, active && styles.filterDropdownItemTextActive]}>
                  {o}
                </Text>
                {active ? <Text style={styles.filterDropdownItemCheck}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ─── Bulk action bar ─────────────────────────────────────────────────────

function BulkActionBar({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <View style={styles.bulkBar}>
      <Text style={styles.bulkText}>
        <Text style={styles.bulkCount}>{count}</Text> dive{count === 1 ? '' : 's'} selected
      </Text>
      <View style={{ flex: 1 }} />
      <Pressable style={styles.bulkBtn}><Text style={styles.bulkBtnText}>Export selected</Text></Pressable>
      <Pressable style={styles.bulkBtn}><Text style={styles.bulkBtnText}>Add to album</Text></Pressable>
      <Pressable style={styles.bulkBtn}><Text style={styles.bulkBtnText}>Change privacy</Text></Pressable>
      <Pressable style={[styles.bulkBtn, styles.bulkBtnDanger]}><Text style={[styles.bulkBtnText, { color: colors.nogo }]}>Delete</Text></Pressable>
      <Pressable onPress={onClear} style={styles.bulkClear}><Text style={styles.bulkClearText}>×</Text></Pressable>
    </View>
  );
}

// ─── Dive table ──────────────────────────────────────────────────────────

function DiveTable({
  rows,
  selected,
  allChecked,
  onToggleAll,
  onToggleOne,
  sortKey,
  sortDir,
  onSort,
  onOpen,
}: {
  rows: DiveEntry[];
  selected: Set<string>;
  allChecked: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  onOpen: (spot: string) => void;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Pressable onPress={onToggleAll} style={styles.checkCell}>
          <View style={[styles.checkbox, allChecked && styles.checkboxOn]}>
            {allChecked ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
        </Pressable>
        <HeaderCell label="Date"     width={108} sortKey="date"        currentSort={sortKey} sortDir={sortDir} onSort={onSort} />
        <HeaderCell label="Spot"     flex={1.6} />
        <HeaderCell label="Type"     width={108} />
        <HeaderCell label="Depth"    width={70}  sortKey="depthFt"     currentSort={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeaderCell label="Time"     width={70}  sortKey="durationMin" currentSort={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeaderCell label="Vis"      width={56}  sortKey="vizFt"       currentSort={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeaderCell label="Water"    width={56}  align="right" />
        <HeaderCell label="Rating"   width={100} />
        <HeaderCell label="Buddy"    width={110} />
        <HeaderCell label=""         width={28}  align="right" />
      </View>

      {rows.map((r, i) => {
        const isLast = i === rows.length - 1;
        const checked = selected.has(r.id);
        return (
          <Pressable
            key={r.id}
            onPress={() => onOpen(r.spot)}
            style={[styles.row, !isLast && styles.rowDivider, checked && styles.rowChecked]}
          >
            <Pressable onPress={(e) => { e.stopPropagation(); onToggleOne(r.id); }} style={styles.checkCell}>
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
            </Pressable>

            <View style={[styles.cell, { width: 108 }]}>
              <Text style={styles.cellDate}>{formatDate(r.date)}</Text>
              <Text style={styles.cellSub}>{r.time}</Text>
            </View>

            <View style={[styles.cell, { flex: 1.6 }]}>
              <Text style={styles.cellSpot}>{r.spot}</Text>
              <Text style={styles.cellSub}>{r.region} · {r.island}{r.hasPhotos ? ' · 📷' : ''}</Text>
            </View>

            <View style={[styles.cell, { width: 108 }]}>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{r.diveType}</Text>
              </View>
            </View>

            <NumCell width={70} value={r.depthFt}    unit="ft" />
            <NumCell width={70} value={r.durationMin} unit="min" />
            <NumCell width={56} value={r.vizFt}       unit="ft" />
            <NumCell width={56} value={r.waterTempF}  unit="°F" />

            <View style={[styles.cell, { width: 100, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <View style={[styles.ratingDot, { backgroundColor: TIER_COLORS[r.rating] }]} />
              <Text style={[styles.ratingText, { color: TIER_COLORS[r.rating] }]}>
                {r.rating === 'no-go' ? 'NO-GO' : r.rating.toUpperCase()}
              </Text>
            </View>

            <View style={[styles.cell, { width: 110 }]}>
              <Text style={styles.cellSub}>{r.buddy ?? '—'}</Text>
            </View>

            <View style={[styles.cell, { width: 28, alignItems: 'flex-end' }]}>
              <Pressable hitSlop={8}><Text style={styles.rowMenuBtn}>⋯</Text></Pressable>
            </View>
          </Pressable>
        );
      })}

      {rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No dives match the current filters</Text>
          <Text style={styles.emptySub}>Try clearing one filter, or log a new dive.</Text>
        </View>
      ) : null}
    </View>
  );
}

function HeaderCell({
  label,
  width,
  flex,
  align,
  sortKey,
  currentSort,
  sortDir,
  onSort,
}: {
  label: string;
  width?: number;
  flex?: number;
  align?: 'right';
  sortKey?: SortKey;
  currentSort?: SortKey;
  sortDir?: 'asc' | 'desc';
  onSort?: (k: SortKey) => void;
}) {
  const isSorted = sortKey && currentSort === sortKey;
  const content = (
    <View style={[styles.headerCellInner, align === 'right' && styles.headerCellRight]}>
      <Text style={styles.headerCellText}>{label}</Text>
      {isSorted ? <Text style={styles.headerCellSortIcon}>{sortDir === 'asc' ? '↑' : '↓'}</Text> : null}
    </View>
  );
  return (
    <Pressable
      onPress={sortKey && onSort ? () => onSort(sortKey) : undefined}
      style={[styles.headerCell, width != null && { width }, flex != null && { flex }]}
    >
      {content}
    </Pressable>
  );
}

function NumCell({ width, value, unit }: { width: number; value: number; unit: string }) {
  return (
    <View style={[styles.cell, { width, alignItems: 'flex-end' }]}>
      <Text style={styles.cellNum}>{value}<Text style={styles.cellNumUnit}> {unit}</Text></Text>
    </View>
  );
}

// ─── Sidebar cards ───────────────────────────────────────────────────────

const STATS = {
  total: 147,
  totalBottomTime: '38h 22m',
  totalDepth: '6,820 ft',
  deepestDive: { depth: 110, spot: 'Molokini Crater', date: 'Apr 6, 2024' },
  longestDive: { duration: 80, spot: 'Black Rock',     date: 'Mar 9, 2024' },
  bestVisibility: { vizFt: 85, spot: 'Kealakekua Bay', date: 'Mar 5, 2024' },
  mostFrequent: 'Electric Beach',
};

function StatsSummaryCard() {
  return (
    <View style={styles.sideCard}>
      <View style={styles.sideCardHeader}>
        <Text style={styles.sideCardTitle}>Lifetime stats</Text>
      </View>
      <View style={styles.statsGrid}>
        <View style={[styles.statsCell, styles.statsCellBorderR, styles.statsCellBorderB]}>
          <Text style={styles.statsValue}>{STATS.total}</Text>
          <Text style={styles.statsLabel}>DIVES</Text>
        </View>
        <View style={[styles.statsCell, styles.statsCellBorderB]}>
          <Text style={styles.statsValue}>{STATS.totalBottomTime}</Text>
          <Text style={styles.statsLabel}>BOTTOM TIME</Text>
        </View>
        <View style={[styles.statsCell, styles.statsCellBorderR]}>
          <Text style={styles.statsValue}>{STATS.totalDepth}</Text>
          <Text style={styles.statsLabel}>TOTAL DEPTH</Text>
        </View>
        <View style={styles.statsCell}>
          <Text style={styles.statsValue}>34</Text>
          <Text style={styles.statsLabel}>SPECIES</Text>
        </View>
      </View>

      <View style={styles.recordsList}>
        <RecordRow icon="📏" label="Deepest"        primary={`${STATS.deepestDive.depth} ft`}    secondary={`${STATS.deepestDive.spot} · ${STATS.deepestDive.date}`} />
        <RecordRow icon="⏱"  label="Longest"        primary={`${STATS.longestDive.duration} min`} secondary={`${STATS.longestDive.spot} · ${STATS.longestDive.date}`} />
        <RecordRow icon="👁"  label="Best visibility" primary={`${STATS.bestVisibility.vizFt} ft`} secondary={`${STATS.bestVisibility.spot} · ${STATS.bestVisibility.date}`} isLast />
      </View>
    </View>
  );
}

function RecordRow({ icon, label, primary, secondary, isLast }: { icon: string; label: string; primary: string; secondary: string; isLast?: boolean }) {
  return (
    <View style={[styles.recordRow, !isLast && styles.recordRowDivider]}>
      <Text style={styles.recordIcon}>{icon}</Text>
      <View style={styles.recordTextWrap}>
        <Text style={styles.recordLabel}>{label}</Text>
        <Text style={styles.recordSecondary}>{secondary}</Text>
      </View>
      <Text style={styles.recordPrimary}>{primary}</Text>
    </View>
  );
}

function ByYearCard() {
  const buckets = { '2024': 0, '2023': 0, '2022': 0 };
  for (const d of DIVES) {
    const y = d.date.slice(0, 4) as keyof typeof buckets;
    if (y in buckets) buckets[y] += 1;
  }
  // Mock 2023 / 2022 totals (we only have 2024 dives in the mock data)
  buckets['2023'] = 89;
  buckets['2022'] = 39;
  const max = Math.max(...Object.values(buckets));

  return (
    <View style={styles.sideCard}>
      <View style={styles.sideCardHeader}>
        <Text style={styles.sideCardTitle}>By year</Text>
      </View>
      <View style={styles.byYearBody}>
        {Object.entries(buckets).map(([year, n]) => (
          <View key={year} style={styles.byYearRow}>
            <Text style={styles.byYearLabel}>{year}</Text>
            <View style={styles.byYearBarTrack}>
              <View style={[styles.byYearBarFill, { width: `${(n / max) * 100}%` }]} />
            </View>
            <Text style={styles.byYearCount}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MostDivedSpotsCard({ onNavigate }: { onNavigate?: NavigateFn }) {
  const counts: Record<string, number> = {};
  for (const d of DIVES) counts[d.spot] = (counts[d.spot] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <View style={styles.sideCard}>
      <View style={styles.sideCardHeader}>
        <Text style={styles.sideCardTitle}>Most-dived spots</Text>
      </View>
      {top.map(([spot, n], i) => (
        <Pressable
          key={spot}
          onPress={() => onNavigate?.('spot-detail', { spotId: slugify(spot) })}
          style={[styles.topSpotRow, i < top.length - 1 && styles.topSpotRowDivider]}
        >
          <Text style={styles.topSpotRank}>{i + 1}</Text>
          <Text style={styles.topSpotName}>{spot}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.topSpotCount}>{n}<Text style={styles.topSpotUnit}> dives</Text></Text>
        </Pressable>
      ))}
    </View>
  );
}

function ExportCard() {
  return (
    <View style={styles.sideCard}>
      <View style={styles.sideCardHeader}>
        <Text style={styles.sideCardTitle}>Export</Text>
      </View>
      <View style={styles.exportBody}>
        <Pressable style={styles.exportBtn}>
          <Text style={styles.exportBtnLabel}>Download CSV</Text>
          <Text style={styles.exportBtnSub}>All 147 dives · 24 columns</Text>
        </Pressable>
        <Pressable style={styles.exportBtn}>
          <Text style={styles.exportBtnLabel}>Export to UDDF</Text>
          <Text style={styles.exportBtnSub}>Dive Computer XML format</Text>
        </Pressable>
        <Pressable style={styles.exportBtn}>
          <Text style={styles.exportBtnLabel}>Print log book</Text>
          <Text style={styles.exportBtnSub}>Printable PDF · last 10 dives</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
    paddingHorizontal: 28,
    paddingBottom: 64,
  },

  body: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: 24,
    alignItems: 'flex-start',
  },
  bodyMain: { flex: 1, gap: 18 },
  bodySidebar: { width: 320, gap: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  headerLeft: { flex: 1, gap: 4 },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  headerBtnIcon: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.bg,
  },
  headerBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    zIndex: 10,
  },
  filterSearchWrap: {
    flex: 1,
    height: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  filterSearchIcon: {
    fontSize: 13,
    color: colors.text4,
  },
  filterSearchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },

  filterDropdownWrap: {
    position: 'relative',
    zIndex: 10,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  filterDropdownLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  filterDropdownValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  filterDropdownCaret: {
    fontSize: 10,
    color: colors.text3,
    marginLeft: 2,
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 180,
    padding: 4,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
    gap: 2,
    zIndex: 20,
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm - 2,
    gap: 8,
  },
  filterDropdownItemActive: {
    backgroundColor: colors.accentDim,
  },
  filterDropdownItemText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  filterDropdownItemTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  filterDropdownItemCheck: {
    fontSize: 11,
    color: colors.accent,
  },

  // Bulk action bar
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(9,161,251,0.40)',
    borderRadius: radius.md,
  },
  bulkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },
  bulkCount: {
    fontWeight: '700',
    color: colors.accent,
  },
  bulkBtn: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(12,16,21,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(9,161,251,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBtnDanger: {
    borderColor: 'rgba(247,55,38,0.40)',
  },
  bulkBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
    fontWeight: '500',
  },
  bulkClear: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkClearText: {
    fontSize: 18,
    color: colors.text2,
  },

  // Table
  table: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 4,
    backgroundColor: colors.surface1,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  headerCell: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
  },
  headerCellInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerCellRight: {
    justifyContent: 'flex-end',
  },
  headerCellText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
    fontWeight: '700',
  },
  headerCellSortIcon: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 4,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowChecked: {
    backgroundColor: 'rgba(9,161,251,0.05)',
  },
  cell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    gap: 2,
  },
  cellDate: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  cellSpot: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  cellSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.text3,
  },
  cellNum: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.text1,
    fontWeight: '600',
  },
  cellNumUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '400',
  },

  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.surface2,
    justifyContent: 'center',
  },
  typePillText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text2,
    fontWeight: '500',
  },
  ratingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ratingText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  rowMenuBtn: {
    fontSize: 18,
    color: colors.text3,
    paddingHorizontal: 4,
  },

  // Checkboxes
  checkCell: {
    width: 36,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxMark: {
    fontSize: 10,
    color: colors.bg,
    fontWeight: '700',
  },

  emptyState: {
    padding: 48,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },

  // Sidebar cards
  sideCard: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  sideCardHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  sideCardTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },

  // Lifetime stats grid (2x2)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsCell: {
    width: '50%',
    padding: 16,
    gap: 4,
  },
  statsCellBorderR: {
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  statsCellBorderB: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  statsValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  statsLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // Records list
  recordsList: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  recordRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  recordIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  recordTextWrap: { flex: 1, gap: 2 },
  recordLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  recordSecondary: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  recordPrimary: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },

  // By year bars
  byYearBody: {
    padding: 16,
    gap: 10,
  },
  byYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  byYearLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    width: 40,
  },
  byYearBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  byYearBarFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  byYearCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text2,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },

  // Most-dived spots
  topSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
  },
  topSpotRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  topSpotRank: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    width: 16,
  },
  topSpotName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  topSpotCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text2,
    fontWeight: '600',
  },
  topSpotUnit: {
    color: colors.text3,
    fontWeight: '400',
  },

  // Export buttons
  exportBody: {
    padding: 8,
    gap: 4,
  },
  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.sm,
    gap: 2,
  },
  exportBtnLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  exportBtnSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.text3,
  },
});
