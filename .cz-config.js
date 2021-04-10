'use strict';
module.exports = {
  types: [
    {
      value: 'feat',
      name: 'feat:     新機能',
      title: 'Features'
    },
    {
      value: 'fix',
      name: 'fix:      バグ修正',
      title: 'Bug Fixes'
    },
    {
      value: 'docs',
      name: 'docs:     ドキュメントのみの変更',
      title: 'Documentation'
    },
    {
      value: 'style',
      name: 'style:    コードスタイルの変更\n            （コードの動作に影響しないスペース、フォーマット、セミコロンなどの変更）',
      title: 'Styles'
    },
    {
      value: 'refactor',
      name: 'refactor: リファクタリング\n            （機能追加やバグ修正を含まない変更）',
      title: 'Code Refactoring'
    },
    {
      value: 'perf',
      name: 'perf:     パフォーマンスの改善のための変更',
      title: 'Performance Improvements'
    },
    {
      value: 'test',
      name: 'test:     不足テストの追加や既存テストの修正',
      title: 'Tests'
    },
    {
      value: 'build',
      name: 'build:    ビルドシステムや外部依存に関する変更\n           （スコープ例: gulp, broccoli, npm）',
      title: 'Builds'
    },
    {
      value: 'ci',
      name: 'ci:       CI用の設定やスクリプトに関する変更\n           （スコープ例:Travis, Circle, BrowserStack, SauceLabs)',
      title: 'CI'
    },
    {
      value: 'chore',
      name: 'chore:    カテゴライズする必要がないその他の変更\n           （補助ツール、ドキュメント生成などのソースやテストの変更を含まない変更）',
      title: 'Chores'
    },
    {
      value: 'wip',
      name: 'wip:      作業中',
      title: 'wip'
    }
  ],
  scopes: [
    // { name: '*' },
    // { name: 'admin' },
    // { name: 'exampleScope' },
    // { name: 'changeMe' }
  ],
  // it needs to match the value for field type. Eg.: 'fix'
  /*
  scopeOverrides: {
    fix: [
      {name: 'merge'},
      {name: 'style'},
      {name: 'e2eTest'},
      {name: 'unitTest'}
    ]
  },
  */
  // override the messages, defaults are as follows
  messages: {
    type: 'コミットする変更タイプを選択:\n',
    scope: '変更内容のスコープ(例:コンポーネントやファイル名)(optional):\n',
    // used if allowCustomScopes is true
    customScope: '変更内容のスコープ(例:コンポーネントやファイル名)(optional):\n',
    subject: '変更内容を要約した本質的説明、つまりタイトル(例:hogeの機能を追加):\n',
    body: '変更内容の詳細（"|"で改行）(optional):\n',
    breaking: '破壊的変更についての記述(optional):\n',
    footer: '関連issueを追記 (例:"fix #123", "re #123")(optional):\n',
    confirmCommit: 'このコミット内容でよろしいですか?'
  },
  allowCustomScopes: true,
  allowBreakingChanges: ['feat', 'fix']
};