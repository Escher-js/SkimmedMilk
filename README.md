# SkimmedMilk 要件定義
package.jsonを参照のこと：
```json
{
  "name": "skimmedmilk",
  "version": "0.3.0",
  "description": "Your app description",
  "main": "main.js",
  "author": "psmuler <zhmuler@gmail.com>",
  "license": "MIT",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make"
  },
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "skimmed-milk",
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": "dmg"
    },
    "files": [
      "**/*"
    ]
  },
  "devDependencies": {
    "@electron-forge/cli": "^6.1.1",
    "@electron-forge/maker-deb": "^6.1.1",
    "@electron-forge/maker-rpm": "^6.1.1",
    "@electron-forge/maker-squirrel": "^6.1.1",
    "@electron-forge/maker-zip": "^6.1.1",
    "electron": "^13.6.9"
  },
  "dependencies": {
    "diff2html": "^3.4.35",
    "electron-squirrel-startup": "^1.0.0"
  }
}
```

# 現在の実装
関数呼び出しの関係


# その他の注意点
electron v12以降の
