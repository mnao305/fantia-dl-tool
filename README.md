# webextension-typescript-template

自分用オレオレTypeScript製ブラウザ拡張機能用のテンプレート

## 使い方等々

このリポジトリは`Template repository`にしてあるので、↑にある`Use this template`ボタンを押せばこの構成でプロジェクトを始められる。

### 使う上でまず変更する点

- [ ] プロジェクト名（package.json, package-lock.json）
- [ ] プロジェクト説明文（package.json）
- [ ] package.json内の各リンク
- [ ] LICENSE

### 置いてあるnpm script

- test
  - 現状何もなし。必要ならjest等導入して変える
- build
  - そのままproductionモードでビルド
- build:dev
  - そのままdevelopモードでビルド
- watch
  - ファイル変更したらdevelopモードでビルド
- commit
  - 対話的にcommitlintに沿ったコミットをする
- lint
  - eslint。内容的にはstandard styleそのまま
- zip
  - ビルドしたファイルをzip化する。↑のbuildコマンドを実行後にする
