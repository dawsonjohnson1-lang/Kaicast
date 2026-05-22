import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, DESKTOP_MAX_WIDTH } from './tokens';
import { DesktopNav } from './components/DesktopNav';
import type { NavigateFn } from './router';

// Vite `?raw` brings the markdown source in as a string at build time.
// No external markdown lib — a minimal renderer below handles the subset
// of markdown used in the legal docs (headings, bold, paragraphs, hr,
// bullet lists).
import termsMd    from './legal/terms.md?raw';
import privacyMd  from './legal/privacy.md?raw';
import cookiesMd  from './legal/cookies.md?raw';
import refundMd   from './legal/refund.md?raw';
import aupMd      from './legal/aup.md?raw';

export type LegalDoc = 'terms' | 'privacy' | 'cookies' | 'refund' | 'aup';

const DOCS: Record<LegalDoc, { title: string; source: string }> = {
  terms:    { title: 'Terms of Service',  source: termsMd },
  privacy:  { title: 'Privacy Policy',    source: privacyMd },
  cookies:  { title: 'Cookie Policy',     source: cookiesMd },
  refund:   { title: 'Refund Policy',     source: refundMd },
  aup:      { title: 'Acceptable Use Policy', source: aupMd },
};

export interface LegalScreenProps {
  doc: LegalDoc;
  onNavigate?: NavigateFn;
}

export function LegalScreen({ doc, onNavigate }: LegalScreenProps) {
  const { title, source } = DOCS[doc];
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active="dashboard" onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>LEGAL</Text>
          <Text style={styles.h1}>{title}</Text>
        </View>
        <Markdown source={source} />
      </View>
    </ScrollView>
  );
}

// ─── Minimal markdown renderer ───────────────────────────────────────────
// Patterns handled (in priority order):
//   `# ` H1, `## ` H2, `### ` H3
//   `---` horizontal rule
//   `- ` bullet (single level)
//   blank line = paragraph break
//   **bold** inline (also handles two-space soft breaks at EOL)

function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <View style={styles.docBody}>
      {blocks.map((b, i) => renderBlock(b, i))}
    </View>
  );
}

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'hr' }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: 'ul', items: list });
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '') {
      flushPara();
      flushList();
      continue;
    }
    if (line === '---' || line === '***') {
      flushPara(); flushList();
      blocks.push({ kind: 'hr' });
      continue;
    }
    if (line.startsWith('# ')) {
      flushPara(); flushList();
      blocks.push({ kind: 'h1', text: line.slice(2) });
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara(); flushList();
      blocks.push({ kind: 'h2', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('### ')) {
      flushPara(); flushList();
      blocks.push({ kind: 'h3', text: line.slice(4) });
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushPara();
      list.push(line.slice(2));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

function renderBlock(b: Block, key: number): React.ReactNode {
  switch (b.kind) {
    case 'h1':
      return <Text key={key} style={styles.docH1}>{b.text}</Text>;
    case 'h2':
      return <Text key={key} style={styles.docH2}>{b.text}</Text>;
    case 'h3':
      return <Text key={key} style={styles.docH3}>{b.text}</Text>;
    case 'hr':
      return <View key={key} style={styles.docHr} />;
    case 'p':
      return <Text key={key} style={styles.docP}>{renderInline(b.text)}</Text>;
    case 'ul':
      return (
        <View key={key} style={styles.docUl}>
          {b.items.map((it, i) => (
            <View key={i} style={styles.docLi}>
              <Text style={styles.docLiDot}>·</Text>
              <Text style={styles.docLiText}>{renderInline(it)}</Text>
            </View>
          ))}
        </View>
      );
  }
}

// Inline: **bold** segments only. Anything else passes through.
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <Text key={i} style={styles.docStrong}>{p.slice(2, -2)}</Text>;
    }
    return <Text key={i}>{p}</Text>;
  });
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: {
    width: '100%',
    maxWidth: 880,
    paddingHorizontal: 32,
    paddingBottom: 96,
  },

  head: {
    paddingVertical: 48,
    gap: 8,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text3,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 40,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.8,
  },

  docBody: { gap: 14 },
  docH1: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    marginTop: 16,
  },
  docH2: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    marginTop: 24,
  },
  docH3: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
    marginTop: 16,
  },
  docP: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text2,
  },
  docStrong: {
    fontWeight: '700',
    color: colors.text1,
  },
  docHr: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 16,
  },
  docUl: {
    gap: 6,
    paddingLeft: 4,
  },
  docLi: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  docLiDot: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text3,
    lineHeight: 22,
  },
  docLiText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text2,
  },
});
