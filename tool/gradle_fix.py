"""Ajustes do projeto Android gerado pelo CI: ID do app na Play Store e regras do R8."""
import re
APP_ID = 'br.com.justgo.app'  # ID definitivo na Play Store (com.justgo.justgo já era de outro app)
p = 'android/app/build.gradle.kts'
s = open(p).read()
if 'proguard-rules.pro' not in s:
    s, n = re.subn(r'(\n(\s*)release \{\n)', r'\1\2    proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")\n', s, count=1)
    if not n: raise SystemExit('bloco release nao encontrado')
s, n = re.subn(r'applicationId\s*=\s*"[^"]+"', f'applicationId = "{APP_ID}"', s, count=1)
if not n: raise SystemExit('applicationId nao encontrado')
# notificações: flutter_local_notifications precisa de "desugaring" do Java
if 'isCoreLibraryDesugaringEnabled' not in s:
    s, n = re.subn(r'compileOptions \{\n', 'compileOptions {\n        isCoreLibraryDesugaringEnabled = true\n', s, count=1)
    if not n: raise SystemExit('compileOptions nao encontrado')
    s += '\ndependencies {\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")\n}\n'
open(p, 'w').write(s)
print('ID do app:', APP_ID, '· regras do R8 aplicadas')
