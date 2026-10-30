# JustGo — app Android

App Flutter do JustGo. A interface (pasta `assets/web`) roda num servidor local dentro do app; o Flutter cuida do GPS em segundo plano, voz, compartilhamento, login com Google e ícone/abertura nativos.

## Como gerar o APK
Todo push na branch `main` dispara o GitHub Actions (`.github/workflows/build.yml`). O APK fica em:
- **Actions → último build → Artifacts → JustGo-apk**, ou
- branch **`build-output`** → arquivo `JustGo.apk` (junto com `build.log`).

## Login com Google no app
No Supabase, em **Authentication → URL Configuration → Redirect URLs**, adicione:
```
justgo://login-callback
```

## Estrutura
- `lib/main.dart` — app Flutter (servidor local, WebView, GPS nativo, voz, compartilhar, links)
- `assets/web/` — interface do JustGo (a mesma do site)
- `assets/brand/` — ícone e abertura
- `native/android/` — AndroidManifest e configurações copiadas para o projeto Android no build
- `tool/deps.txt` — pacotes Flutter usados

## Atualizar o app sem reinstalar (OTA)
O visual do app (pasta `assets/web`) é baixado pelo próprio app direto deste repositório.
1. Mude os arquivos em `assets/web`.
2. Rode `python3 tool/make_version_web.py` (gera o `assets/web/version.json`).
3. Faça commit e push no `main`.
Quem tem o app 2.5.1+ recebe "Nova versão do JustGo · Atualizar" na próxima abertura (até ~10 min).
