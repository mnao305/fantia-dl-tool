import { browser } from 'webextension-polyfill-ts'

export type Settings = {
  allFileOneFolder: boolean;
};

/**
 * オプション画面が開かれたときに呼ばれる
 */
const setup = async () => {
  // 翻訳文言を入れる
  document.querySelectorAll<HTMLElement>('[data-locale]').forEach((elem) => {
    elem.innerText = elem.dataset.locale
      ? browser.i18n.getMessage(elem.dataset.locale)
      : ''
  })
  // title属性がある場合はそれも入れる
  document.querySelectorAll<HTMLElement>('[title]').forEach((elem) => {
    elem.title = elem.title ? browser.i18n.getMessage(elem.title) : ''
  })

  // 保存済みの設定を表示に反映
  const settings = (await browser.storage.local.get({
    allFileOneFolder: false
  })) as Settings

  for (const key in settings) {
    const setting = settings[key as keyof Settings]
    const inputEl = document.querySelector<HTMLInputElement>(`[name="${key}"]`)
    if (!inputEl) continue

    if (typeof setting === 'boolean') {
      inputEl.checked = setting
    }
  }
}

setup()

/**
 * オプション画面で設定を変更したときに呼ばれる
 */
const save = async () => {
  console.log('save')
  const settings: Settings = {
    allFileOneFolder:
      document.querySelector<HTMLInputElement>('[name="allFileOneFolder"]')
        ?.checked ?? false
  }

  await browser.storage.local.set(settings)

  // 保存完了を表示
  const saveMsg = document.querySelector<HTMLDivElement>('#saveMsg')
  saveMsg!.style.display = 'inline-block'
  setTimeout(() => {
    saveMsg!.style.display = 'none'
  }, 2000)
}

document
  .querySelector<HTMLButtonElement>('#save')
  ?.addEventListener('click', save)
