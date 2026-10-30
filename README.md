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
